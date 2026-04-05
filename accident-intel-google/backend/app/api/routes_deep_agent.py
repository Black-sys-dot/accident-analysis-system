import base64
import logging
import os
import struct
import time
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai

from app.services.sandbox_service import execute_python_code, install_dependency, validate_generated_output

router = APIRouter()
logger = logging.getLogger("deep_agent")
logger.setLevel(logging.INFO)

GEMINI_LIVE_AGENT_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"


def _pcm16le_to_wav_bytes(
    pcm_bytes: bytes,
    sample_rate: int = 24000,
    channels: int = 1,
    bits_per_sample: int = 16,
) -> bytes:
    if not pcm_bytes:
        return b""

    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    subchunk2_size = len(pcm_bytes)
    chunk_size = 36 + subchunk2_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        chunk_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        subchunk2_size,
    )
    return header + pcm_bytes


def _build_deep_live_tool_declarations() -> list[dict]:
    return [
        {
            "name": "execute_python_code",
            "description": (
                "Execute Python code in the sandbox. Use 'data.csv' from current directory. "
                "Columns include lat, lon, month, season, location. "
                "Always provide expected_output and output_kind so output can be validated quickly."
            ),
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "code": {"type": "STRING", "description": "Python code to execute."},
                    "expected_output": {
                        "type": "STRING",
                        "description": "Optional expected output filename, e.g. chart.png or map_data.json.",
                    },
                    "output_kind": {
                        "type": "STRING",
                        "description": "Optional validation hint: chart or map.",
                    },
                },
                "required": ["code"],
            },
        },
        {
            "name": "install_dependency",
            "description": "Install an allowed Python package via pip.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "package": {"type": "STRING", "description": "pip package name to install."}
                },
                "required": ["package"],
            },
        },
        {
            "name": "show_map_layer",
            "description": (
                "Render generated map JSON from sandbox on map UI. "
                "Supported layer_type values: heatmap, markers. "
                "For markers hover popups, include hover_text or hover_html on each point. "
                "Optional legend supported with payload object: {layer_type, data|points, legend:{title,items:[{label,color}]}}."
            ),
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "filename": {"type": "STRING", "description": "JSON file name in sandbox."},
                    "layer_type": {"type": "STRING", "description": "heatmap or markers."},
                },
                "required": ["filename", "layer_type"],
            },
        },
        {
            "name": "render_on_map",
            "description": "Alias of show_map_layer.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "filename": {"type": "STRING", "description": "JSON file name in sandbox."},
                    "layer_type": {"type": "STRING", "description": "heatmap or markers."},
                },
                "required": ["filename", "layer_type"],
            },
        },
        {
            "name": "show_chart",
            "description": "Render generated chart image from sandbox in chat panel.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "filename": {"type": "STRING", "description": "Image filename in sandbox."}
                },
                "required": ["filename"],
            },
        },
        {
            "name": "render_in_panel",
            "description": "Alias of show_chart.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "filename": {"type": "STRING", "description": "Image filename in sandbox."}
                },
                "required": ["filename"],
            },
        },
    ]


def _build_deep_system_instruction() -> str:
    return """
You are ALERT-ACC Deep Analysis Bot operating in a strict Python sandbox.

You have `data.csv` in the current working directory. Core columns: lat, lon, month, season, location.

Working style:
1. You are free to write and run custom Python scripts to satisfy the user request.
2. Move fast: choose the simplest working script first, then refine if needed.
3. For charts, save an image file in sandbox (for example chart.png), then call show_chart/render_in_panel.
4. For map visuals, save JSON in sandbox (for example map_data.json), then call show_map_layer/render_on_map.
5. Use plain filenames only (no sandbox/ prefix in tool args).
6. Keep assistant speech short and useful; avoid long planning monologues.
7. Do not dump huge raw tables to stdout; print concise diagnostics only.
8. Assume month is usually numeric (1..12) unless data inspection proves otherwise.
9. Renderer supports:
   - heatmap points: {lat, lon, weight?}
   - markers: {lat, lon, title?, color?, hover_text?, hover_html?}
   - optional legend object when returning an object payload:
     { layer_type, data|points, legend: { title, items: [{label, color}] } }
10. If a first script fails, immediately run a corrected script and continue until output is rendered.
""".strip()


def _extract_audio_events_from_live_message(msg: Any) -> list[Dict[str, Any]]:
    events: list[Dict[str, Any]] = []
    server_content = getattr(msg, "server_content", None)
    model_turn = getattr(server_content, "model_turn", None)
    parts = getattr(model_turn, "parts", None) or []
    for part in parts:
        inline_data = getattr(part, "inline_data", None)
        if inline_data is None:
            continue
        raw_data = getattr(inline_data, "data", None)
        if not raw_data:
            continue

        mime_type = (getattr(inline_data, "mime_type", None) or "audio/wav").lower()
        if isinstance(raw_data, (bytes, bytearray)):
            raw_bytes = bytes(raw_data)
        elif isinstance(raw_data, str):
            raw_bytes = base64.b64decode(raw_data)
        else:
            continue

        if "audio/pcm" in mime_type or "audio/l16" in mime_type:
            sample_rate = 24000
            if "rate=" in mime_type:
                try:
                    sample_rate = int(mime_type.split("rate=")[1].split(";")[0].strip())
                except Exception:
                    sample_rate = 24000
            raw_bytes = _pcm16le_to_wav_bytes(raw_bytes, sample_rate=sample_rate, channels=1, bits_per_sample=16)
            mime_type = "audio/wav"

        events.append(
            {
                "type": "audio",
                "audio_base64": base64.b64encode(raw_bytes).decode("utf-8"),
                "mime_type": mime_type,
            }
        )
    return events


def _extract_text_events_from_live_message(msg: Any) -> list[Dict[str, Any]]:
    events: list[Dict[str, Any]] = []
    text_chunks: list[str] = []

    direct_text = getattr(msg, "text", None)
    if isinstance(direct_text, str):
        cleaned = direct_text.strip()
        if cleaned:
            text_chunks.append(cleaned)

    server_content = getattr(msg, "server_content", None)
    model_turn = getattr(server_content, "model_turn", None)
    parts = getattr(model_turn, "parts", None) or []
    for part in parts:
        ptxt = getattr(part, "text", None)
        if isinstance(ptxt, str):
            cleaned = ptxt.strip()
            if cleaned:
                text_chunks.append(cleaned)

    for chunk in text_chunks:
        events.append({"type": "text", "text": chunk})
    return events


def _normalize_args(args: Any) -> Dict[str, Any]:
    if isinstance(args, dict):
        return args
    if hasattr(args, "items"):
        return {k: v for k, v in args.items()}
    return {}


@router.websocket("/agent/deep-live-ws")
async def deep_agent_live_ws(websocket: WebSocket):
    await websocket.accept()
    ws_started = time.perf_counter()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        await websocket.send_json({"type": "error", "message": "GEMINI_API_KEY is missing on server."})
        await websocket.close()
        return

    live_model = os.getenv("GEMINI_DEEP_AGENT_MODEL", GEMINI_LIVE_AGENT_MODEL)
    voice_name = os.getenv("GEMINI_TTS_VOICE", "zephyr").strip().lower()

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
    config = {
        "response_modalities": ["AUDIO"],
        "speech_config": {
            "voice_config": {"prebuilt_voice_config": {"voice_name": voice_name}}
        },
        "tools": [{"function_declarations": _build_deep_live_tool_declarations()}],
        "system_instruction": _build_deep_system_instruction(),
    }

    try:
        async with client.aio.live.connect(model=live_model, config=config) as session:
            await websocket.send_json({"type": "ready", "model": live_model, "voice": voice_name})
            logger.info("deep_ws connected model=%s voice=%s", live_model, voice_name)

            while True:
                incoming = await websocket.receive_json()
                msg_type = (incoming.get("type") or "").strip().lower()
                logger.info("deep_ws incoming type=%s", msg_type)

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

                if msg_type == "user_text":
                    user_text = (incoming.get("text") or "").strip()
                    if not user_text:
                        await websocket.send_json({"type": "turn_complete"})
                        continue
                    turn_started = time.perf_counter()
                    logger.info("deep_ws turn start chars=%s", len(user_text))
                    await websocket.send_json(
                        {
                            "type": "status",
                            "message": "Request sent to model. Waiting for response...",
                            "debug": {"phase": "sent_to_model", "chars": len(user_text)},
                        }
                    )
                    await session.send_client_content(
                        turns={"role": "user", "parts": [{"text": user_text}]},
                        turn_complete=True,
                    )
                elif msg_type == "client_audio":
                    b64 = incoming.get("audio_base64", "")
                    if not b64:
                        await websocket.send_json({"type": "error", "message": "audio_base64 is required for client_audio."})
                        continue
                    raw = base64.b64decode(b64)
                    await session.send_client_content(
                        turns={
                            "role": "user",
                            "parts": [{"inline_data": {"mime_type": "audio/pcm;rate=16000", "data": raw}}],
                        }
                    )
                    continue
                elif msg_type == "turn_complete":
                    await session.send_client_content(
                        turns={"role": "user", "parts": []},
                        turn_complete=True,
                    )
                else:
                    await websocket.send_json({"type": "error", "message": f"Unsupported message type: {msg_type}"})
                    continue

                turn_done = False
                saw_first_model_event = False
                while not turn_done:
                    async for response in session.receive():
                        if not saw_first_model_event:
                            saw_first_model_event = True
                            elapsed_ms = int((time.perf_counter() - turn_started) * 1000) if "turn_started" in locals() else None
                            await websocket.send_json(
                                {
                                    "type": "status",
                                    "message": "Model started responding.",
                                    "debug": {"phase": "model_responding", "elapsed_ms": elapsed_ms},
                                }
                            )
                            logger.info("deep_ws first model event elapsed_ms=%s", elapsed_ms)

                        tool_call = getattr(response, "tool_call", None)
                        function_calls = getattr(tool_call, "function_calls", None) or []

                        if function_calls:
                            function_responses = []
                            calls_for_frontend = []
                            dispatched_frontend = set()
                            logger.info("deep_ws tool_calls count=%s", len(function_calls))

                            for fc in function_calls:
                                name = str(getattr(fc, "name", "") or "")
                                args = _normalize_args(getattr(fc, "args", {}))
                                logger.info("deep_ws tool name=%s args_keys=%s", name, list(args.keys()))

                                if name == "execute_python_code":
                                    started = time.perf_counter()
                                    await websocket.send_json(
                                        {
                                            "type": "status",
                                            "message": "Running Python script in sandbox...",
                                        }
                                    )
                                    result = execute_python_code(
                                        args.get("code", ""),
                                        expected_output=args.get("expected_output"),
                                        output_kind=args.get("output_kind"),
                                    )
                                    await websocket.send_json(
                                        {
                                            "type": "status",
                                            "message": "Python execution finished.",
                                            "debug": {
                                                "phase": "python_done",
                                                "elapsed_ms": int((time.perf_counter() - started) * 1000),
                                                "returncode": result.get("returncode"),
                                                "stderr_head": (result.get("stderr") or "")[:160],
                                            },
                                        }
                                    )
                                    # Auto-render fallback: if model provided output hints and script succeeded,
                                    # dispatch render even if model forgets explicit render tool call.
                                    if (
                                        result.get("returncode") == 0
                                        and isinstance(result.get("output_check"), dict)
                                        and result["output_check"].get("ok")
                                    ):
                                        out_kind = (args.get("output_kind") or "").strip().lower()
                                        out_name = result["output_check"].get("filename")
                                        if out_kind == "chart" and out_name:
                                            dedupe_key = ("show_chart", out_name, "")
                                            if dedupe_key not in dispatched_frontend:
                                                calls_for_frontend.append(
                                                    {"name": "show_chart", "args": {"filename": out_name}}
                                                )
                                                dispatched_frontend.add(dedupe_key)
                                                await websocket.send_json(
                                                    {
                                                        "type": "status",
                                                        "message": f"Auto-rendering chart from {out_name}...",
                                                    }
                                                )
                                        elif out_kind == "map" and out_name:
                                            dedupe_key = ("show_map_layer", out_name, "heatmap")
                                            if dedupe_key not in dispatched_frontend:
                                                calls_for_frontend.append(
                                                    {"name": "show_map_layer", "args": {"filename": out_name, "layer_type": "heatmap"}}
                                                )
                                                dispatched_frontend.add(dedupe_key)
                                                await websocket.send_json(
                                                    {
                                                        "type": "status",
                                                        "message": f"Auto-rendering map layer from {out_name}...",
                                                    }
                                                )
                                elif name == "install_dependency":
                                    pkg_name = args.get("package", "")
                                    started = time.perf_counter()
                                    await websocket.send_json(
                                        {
                                            "type": "status",
                                            "message": f"Installing dependency: {pkg_name}...",
                                        }
                                    )
                                    result = install_dependency(args.get("package", ""))
                                    await websocket.send_json(
                                        {
                                            "type": "status",
                                            "message": "Dependency install step finished.",
                                            "debug": {
                                                "phase": "pip_done",
                                                "elapsed_ms": int((time.perf_counter() - started) * 1000),
                                                "returncode": result.get("returncode"),
                                                "stderr_head": (result.get("stderr") or "")[:160],
                                            },
                                        }
                                    )
                                elif name in {"show_map_layer", "render_on_map"}:
                                    filename = args.get("filename", "")
                                    check = validate_generated_output(filename, output_kind="map")
                                    if check.get("ok"):
                                        dedupe_key = (name, check["filename"], args.get("layer_type", "heatmap"))
                                        if dedupe_key in dispatched_frontend:
                                            result = {"status": "ok", "message": "Duplicate map render skipped."}
                                            function_responses.append(
                                                {
                                                    "id": getattr(fc, "id", "") or "",
                                                    "name": name,
                                                    "response": result,
                                                }
                                            )
                                            continue
                                        dispatched_frontend.add(dedupe_key)
                                        await websocket.send_json(
                                            {
                                                "type": "status",
                                                "message": f"Rendering map layer from {check['filename']}...",
                                            }
                                        )
                                        calls_for_frontend.append(
                                            {"name": name, "args": {"filename": check["filename"], "layer_type": args.get("layer_type", "heatmap")}}
                                        )
                                        result = {"status": "ok", "message": "Map render command sent to frontend."}
                                    else:
                                        result = {"status": "error", "message": check.get("error")}
                                elif name in {"show_chart", "render_in_panel"}:
                                    filename = args.get("filename", "")
                                    check = validate_generated_output(filename, output_kind="chart")
                                    if check.get("ok"):
                                        dedupe_key = (name, check["filename"], "")
                                        if dedupe_key in dispatched_frontend:
                                            result = {"status": "ok", "message": "Duplicate chart render skipped."}
                                            function_responses.append(
                                                {
                                                    "id": getattr(fc, "id", "") or "",
                                                    "name": name,
                                                    "response": result,
                                                }
                                            )
                                            continue
                                        dispatched_frontend.add(dedupe_key)
                                        await websocket.send_json(
                                            {
                                                "type": "status",
                                                "message": f"Rendering chart from {check['filename']}...",
                                            }
                                        )
                                        calls_for_frontend.append(
                                            {"name": name, "args": {"filename": check["filename"]}}
                                        )
                                        result = {"status": "ok", "message": "Chart render command sent to frontend."}
                                    else:
                                        result = {"status": "error", "message": check.get("error")}
                                else:
                                    result = {"status": "error", "message": f"Unknown tool: {name}"}

                                function_responses.append(
                                    {
                                        "id": getattr(fc, "id", "") or "",
                                        "name": name,
                                        "response": result,
                                    }
                                )

                            if calls_for_frontend:
                                await websocket.send_json({"type": "tool_call", "calls": calls_for_frontend})

                            await session.send_tool_response(function_responses=function_responses)
                            logger.info("deep_ws tool responses sent count=%s", len(function_responses))

                        for audio_evt in _extract_audio_events_from_live_message(response):
                            await websocket.send_json(audio_evt)
                        for text_evt in _extract_text_events_from_live_message(response):
                            await websocket.send_json(text_evt)

                        server_content = getattr(response, "server_content", None)
                        if server_content and getattr(server_content, "turn_complete", False):
                            turn_elapsed_ms = int((time.perf_counter() - turn_started) * 1000) if "turn_started" in locals() else None
                            await websocket.send_json(
                                {
                                    "type": "status",
                                    "message": "Turn complete.",
                                    "debug": {"phase": "turn_complete", "elapsed_ms": turn_elapsed_ms},
                                }
                            )
                            await websocket.send_json({"type": "turn_complete"})
                            logger.info("deep_ws turn complete elapsed_ms=%s", turn_elapsed_ms)
                            turn_done = True
                            break

    except WebSocketDisconnect:
        logger.info("deep_ws disconnected uptime_ms=%s", int((time.perf_counter() - ws_started) * 1000))
        return
    except Exception as e:
        logger.exception("deep_ws error: %s", e)
        try:
            await websocket.send_json({"type": "error", "message": f"Deep live websocket error: {e}"})
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
