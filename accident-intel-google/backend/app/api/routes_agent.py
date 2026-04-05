import json
import os
import base64
import asyncio
import struct
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

router = APIRouter()


class AgentRequest(BaseModel):
    message: str
    ui_state: Dict[str, Any] = Field(default_factory=dict)


class AgentResponse(BaseModel):
    speech_before: str
    action: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    speech_after: Optional[str] = None


class AgentSpeakRequest(BaseModel):
    text: str
    voice: Optional[str] = None


class AgentLiveTranscribeRequest(BaseModel):
    audio_base64: str
    mime_type: Optional[str] = "audio/pcm;rate=16000"


def _pcm16le_to_wav_bytes(
    pcm_bytes: bytes,
    sample_rate: int = 16000,
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


def _extract_text_from_generate_content_response(response: Any) -> str:
    direct_text = (getattr(response, "text", None) or "").strip()
    if direct_text:
        return direct_text

    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        texts = []
        for p in parts:
            t = getattr(p, "text", None)
            if t and isinstance(t, str):
                texts.append(t.strip())
        merged = " ".join([t for t in texts if t]).strip()
        if merged:
            return merged
    return ""


def _extract_audio_from_response(response: Any) -> Dict[str, Any]:
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            inline_data = getattr(part, "inline_data", None)
            if not inline_data:
                continue
            raw_data = getattr(inline_data, "data", None)
            if not raw_data:
                continue
            mime_type = (getattr(inline_data, "mime_type", None) or "audio/wav").lower()

            raw_bytes: bytes
            if isinstance(raw_data, (bytes, bytearray)):
                raw_bytes = bytes(raw_data)
            elif isinstance(raw_data, str):
                raw_bytes = base64.b64decode(raw_data)
            else:
                continue

            # Browser <audio> cannot directly play raw PCM from data URL. Convert PCM to WAV.
            if "audio/pcm" in mime_type or "audio/l16" in mime_type:
                sample_rate = 24000
                # If provider includes rate in mime type (e.g., audio/pcm;rate=16000), respect it.
                if "rate=" in mime_type:
                    try:
                        sample_rate = int(mime_type.split("rate=")[1].split(";")[0].strip())
                    except Exception:
                        sample_rate = 24000
                raw_bytes = _pcm16le_to_wav_bytes(raw_bytes, sample_rate=sample_rate, channels=1, bits_per_sample=16)
                mime_type = "audio/wav"

            return {
                "audio_base64": base64.b64encode(raw_bytes).decode("utf-8"),
                "mime_type": mime_type,
            }
    return {}


ACTION_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "scenario_openMapAnalysis": {
        "when": "Use when user wants to open analysis/map from the home page.",
        "payload": {}
    },
    "scenario_backToHome": {
        "when": "Use when user asks to return to the landing/home screen.",
        "payload": {}
    },
    "scenario_showSummerHeatmap": {
        "when": "Use for summer risk/heatmap requests.",
        "payload": {}
    },
    "scenario_showMonsoonHeatmap": {
        "when": "Use for monsoon/rainy season risk requests.",
        "payload": {}
    },
    "scenario_showWinterHeatmap": {
        "when": "Use for winter risk requests.",
        "payload": {}
    },
    "scenario_showAllSeasonHeatmap": {
        "when": "Use for all-season combined heatmap view.",
        "payload": {}
    },
    "scenario_showMonthlyTrend": {
        "when": "Use when user asks for month-wise trend/chart.",
        "payload": {}
    },
    "scenario_showTop5Hotspots": {
        "when": "Use when user asks for most dangerous/top hotspots.",
        "payload": {}
    },
    "scenario_showAllHotspots": {
        "when": "Use when user asks to see all hotspot clusters.",
        "payload": {}
    },
    "scenario_findSafestRoute": {
        "when": "Use for routing/navigation/safest route requests.",
        "payload": {
            "origin": "string (optional if useCurrentOrigin=true)",
            "destination": "string (required)",
            "useCurrentOrigin": "boolean (optional)"
        }
    }
}


def _build_action_catalog_text() -> str:
    lines = []
    for action_name, meta in ACTION_DEFINITIONS.items():
        lines.append(f"- {action_name}: {meta['when']} Payload: {json.dumps(meta['payload'])}")
    return "\n".join(lines)


PROJECT_CONTEXT_CACHE = """
PROJECT CONTEXT (STATIC - AUTHORITATIVE)
- Project name: ALERT-ACC.
- Domain: Pune road-accident risk intelligence and safe-routing assistant.
- Geography scope: Pune, Maharashtra, India only.

DATA ARCHITECTURE (DUAL PIPELINE)
- Primary pipeline: Vertex AI / Gemini-assisted geocoding pipeline.
- Secondary pipeline: scraped-source geocoding pipeline.
- Runtime data loading combines both geocoded datasets into one working dataset.
- The combined dataset is cleaned and used across heatmap, hotspot, monthly trend, and routing risk scoring.

APP STRUCTURE
- Frontend:
  - Landing page + map analysis page.
  - Right control panel with seasonal analysis, monthly trend, hotspot structure, and safe routing.
  - Agent bot that supports voice and chat mode.
- Backend:
  - /api/heatmap for seasonal/all heatmap points.
  - /api/hotspots for clustered hotspots.
  - /api/monthly for month-wise counts.
  - /api/safest-route for route alternatives + threat scoring.
  - /api/agent/interact for agent planning.
  - /api/agent/speak for Gemini TTS.
  - /api/agent/transcribe-live for Gemini Live STT.

FUNCTIONAL TRUTHS
- Seasonal heatmap supports all/summer/monsoon/winter filters.
- Hotspots default to KMeans with 20 clusters; top 5 option shows densest clusters.
- Monthly trend is grouped accident counts by month.
- Safest route logic:
  - Calls Google Routes API with computeAlternativeRoutes=true.
  - Decodes route polylines.
  - Computes threat score from accident proximity (inverse-distance-squared style kernel).
  - Marks the lowest-threat route as safest.
""".strip()


def _build_live_tool_declarations() -> list[dict]:
    declarations = []
    for action_name, meta in ACTION_DEFINITIONS.items():
        payload = meta.get("payload", {})
        properties = {}
        required = []

        if action_name == "scenario_findSafestRoute":
            properties = {
                "origin": {"type": "string"},
                "destination": {"type": "string"},
                "useCurrentOrigin": {"type": "boolean"},
            }
            required = ["destination"]

        declarations.append(
            {
                "name": action_name,
                "description": f"{meta.get('when', '')} Payload shape: {json.dumps(payload)}",
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            }
        )
    return declarations


def _build_live_system_instruction() -> str:
    return f"""
{PROJECT_CONTEXT_CACHE}

You are ALERT-ACC Bot, a voice-first map assistant.

CRITICAL LIVE CONVERSATION RULES:
1. NO YAPPING. Be extremely concise.
2. If the user asks for a map action, say ONE very short sentence (e.g., "Sure, showing the summer heatmap.") and IMMEDIATELY trigger the tool.
3. NEVER explain what tool you are using, NEVER narrate your thought process, and NEVER say "I am going to use a tool".
4. After the tool call finishes, say one final short sentence to summarize what is on the screen.
5. If no tool is needed, answer directly in 1-2 short sentences.
""".strip()


def _serialize_function_call(call: Any) -> Dict[str, Any]:
    call_id = getattr(call, "id", None) or ""
    call_name = getattr(call, "name", None) or ""
    call_args = getattr(call, "args", None)
    if call_args is None:
        call_args = {}
    return {
        "id": str(call_id),
        "name": str(call_name),
        "args": call_args if isinstance(call_args, dict) else {},
    }


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


def _build_system_prompt(ui_state: Dict[str, Any]) -> str:
    action_catalog = _build_action_catalog_text()
    return f"""
{PROJECT_CONTEXT_CACHE}

You are ALERT-ACC Bot, a voice-first assistant for this project.
You are controlling a visual UI robot assistant. When you choose an action, the frontend animates visible button clicks.

Allowed executable UI actions (strict list):
{action_catalog}

Behavior contract:
1) If the user asks for UI navigation/change, choose exactly one action from the list above.
2) If no UI change is needed (question/chitchat/explanation), set action=null and speech_after=null.
3) Keep speech natural, concise, and spoken-language friendly.
4) Never invent actions. Never include markdown/code fences.
5) If user asks outside Pune data scope, explain limitation in speech_before and do not trigger action.
6) For safest route:
   - destination is required.
   - useCurrentOrigin=true can replace explicit origin.
7) If user request is ambiguous, ask a short clarification using speech_before and set action=null.
8) Strict anti-hallucination rule:
   - Answer only using PROJECT CONTEXT (STATIC - AUTHORITATIVE), allowed actions, and current UI state.
   - If asked about details not explicitly known from these facts, respond with a precise limitation statement, e.g.:
     \"I am not aware of that detail in this project right now.\"
   - Do not guess, do not fabricate datasets, models, metrics, or pipelines.
9) Keep output strictly valid JSON with this schema:
{{
  "speech_before": "string",
  "action": "string|null",
  "payload": {{}},
  "speech_after": "string|null"
}}

Current UI state (JSON):
{json.dumps(ui_state, ensure_ascii=True)}
""".strip()


def _extract_json_text(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if text.startswith("```json"):
        return text[7:].strip().rstrip("`").strip()
    if text.startswith("```"):
        return text[3:].strip().rstrip("`").strip()
    return text


def _normalize_agent_response(parsed: Dict[str, Any]) -> AgentResponse:
    speech_before = str(parsed.get("speech_before") or "I can help with that.").strip()
    action = parsed.get("action")
    payload = parsed.get("payload") if isinstance(parsed.get("payload"), dict) else {}
    speech_after = parsed.get("speech_after")

    if action is not None:
        action = str(action).strip()
        if action not in ACTION_DEFINITIONS:
            action = None
            payload = {}
            speech_after = None

    if action == "scenario_findSafestRoute":
        destination = payload.get("destination")
        origin = payload.get("origin")
        use_current = bool(payload.get("useCurrentOrigin", False))

        normalized_payload: Dict[str, Any] = {
            "useCurrentOrigin": use_current
        }
        if isinstance(origin, str) and origin.strip():
            normalized_payload["origin"] = origin.strip()
        if isinstance(destination, str) and destination.strip():
            normalized_payload["destination"] = destination.strip()

        has_origin = bool(normalized_payload.get("origin")) or use_current
        has_destination = bool(normalized_payload.get("destination"))

        if not (has_origin and has_destination):
            action = None
            payload = {}
            speech_after = None
            if not speech_before:
                speech_before = "Please share both source and destination, or use current location plus destination."
        else:
            payload = normalized_payload
    else:
        payload = {}

    if not isinstance(speech_after, str) or not speech_after.strip():
        speech_after = None
    else:
        speech_after = speech_after.strip()

    if not speech_before:
        speech_before = "Tell me what you want to see on the Pune safety map."

    return AgentResponse(
        speech_before=speech_before,
        action=action,
        payload=payload,
        speech_after=speech_after,
    )


@router.post("/agent/interact")
async def interact_with_agent(req: AgentRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is missing on the server.")

    model_name = os.getenv("GEMINI_AGENT_MODEL", "gemini-2.5-flash")

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
    last_error = None

    for _ in range(2):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=req.message,
                config=types.GenerateContentConfig(
                    system_instruction=_build_system_prompt(req.ui_state),
                    response_mime_type="application/json",
                    temperature=0.25,
                ),
            )

            raw_text = _extract_json_text(response.text or "")
            if not raw_text:
                raise ValueError("Empty model response")

            parsed = json.loads(raw_text)
            normalized = _normalize_agent_response(parsed)
            return normalized.model_dump()
        except Exception as e:
            last_error = e
            await asyncio.sleep(0.35)

    raise HTTPException(status_code=500, detail=f"Agent interaction failed: {last_error}")


@router.post("/agent/speak")
async def speak_with_gemini(req: AgentSpeakRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is missing on the server.")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required for speech synthesis.")

    configured_model = (os.getenv("GEMINI_TTS_MODEL", "") or "").strip()
    candidate_models = [
        configured_model,
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts",
    ]
    tts_models = [m for m in candidate_models if m]
    voice_name = (req.voice or os.getenv("GEMINI_TTS_VOICE", "zephyr")).strip().lower()

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
    last_error = None

    # Keep request payload compact and stable to reduce transient TTS failures.
    safe_text = " ".join(text.split())
    if len(safe_text) > 700:
        safe_text = safe_text[:700].rstrip() + "..."

    for model_name in tts_models:
        for attempt in range(4):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=safe_text,
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        temperature=0.2,
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                    voice_name=voice_name
                                )
                            )
                        ),
                    ),
                )

                extracted = _extract_audio_from_response(response)
                if not extracted.get("audio_base64"):
                    raise ValueError("No playable audio bytes returned by Gemini TTS model.")

                return {
                    "audio_base64": extracted["audio_base64"],
                    "mime_type": extracted["mime_type"],
                    "voice": voice_name,
                    "model": model_name,
                }
            except Exception as e:
                last_error = e
                # Quick exponential backoff for transient provider-side 5xx instability.
                await asyncio.sleep(0.25 * (2 ** attempt))

    raise HTTPException(status_code=500, detail=f"Gemini speech failed after model failover: {last_error}")


@router.post("/agent/transcribe-live")
async def transcribe_with_gemini_live(req: AgentLiveTranscribeRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is missing on the server.")

    if not req.audio_base64:
        raise HTTPException(status_code=400, detail="audio_base64 is required.")

    configured_model = (os.getenv("GEMINI_LIVE_STT_MODEL", "") or "").strip()
    candidate_models = [
        configured_model,
        "gemini-2.5-flash-native-audio-preview-12-2025",
        "gemini-2.5-flash-native-audio-preview-09-2025",
    ]
    live_models = [m for m in candidate_models if m]
    mime_type = (req.mime_type or "audio/pcm;rate=16000").strip()

    try:
        audio_bytes = base64.b64decode(req.audio_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio payload: {e}")

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Decoded audio is empty.")

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
    last_error = None

    for live_model in live_models:
        try:
            transcript_parts = []
            async with client.aio.live.connect(
                model=live_model,
                config={
                    "response_modalities": ["TEXT"],
                    "input_audio_transcription": {},
                },
            ) as session:
                await session.send_realtime_input(
                    audio=types.Blob(data=audio_bytes, mime_type=mime_type)
                )
                await session.send_realtime_input(audio_stream_end=True)

                try:
                    async with asyncio.timeout(12):
                        async for msg in session.receive():
                            server_content = getattr(msg, "server_content", None)
                            input_tx = getattr(server_content, "input_transcription", None)
                            if input_tx and getattr(input_tx, "text", None):
                                transcript_parts.append(input_tx.text.strip())

                            model_text = getattr(msg, "text", None)
                            if model_text and isinstance(model_text, str):
                                cleaned = model_text.strip()
                                if cleaned:
                                    transcript_parts.append(cleaned)

                            if server_content and getattr(server_content, "turn_complete", False):
                                break
                except TimeoutError:
                    pass

            transcript = " ".join([p for p in transcript_parts if p]).strip()
            return {
                "transcript": transcript,
                "model": live_model,
                "mime_type": mime_type,
            }
        except Exception as e:
            last_error = e
            continue

    # Fallback: if Live handshake or model negotiation fails, use non-live transcription.
    try:
        fallback_model = os.getenv("GEMINI_STT_FALLBACK_MODEL", "gemini-2.5-flash")
        wav_bytes = _pcm16le_to_wav_bytes(audio_bytes, sample_rate=16000, channels=1, bits_per_sample=16)
        response = client.models.generate_content(
            model=fallback_model,
            contents=[
                types.Part.from_bytes(
                    data=wav_bytes,
                    mime_type="audio/wav",
                ),
                "Transcribe this audio. Return only the transcript text without extra formatting.",
            ],
            config=types.GenerateContentConfig(
                temperature=0.0,
            ),
        )
        transcript = _extract_text_from_generate_content_response(response)
        return {
            "transcript": transcript.strip(),
            "model": fallback_model,
            "mime_type": "audio/wav",
            "fallback_used": True,
            "live_error": str(last_error) if last_error else None,
        }
    except Exception as fallback_error:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini Live transcription failed for all candidate models: {last_error}; fallback failed: {fallback_error}",
        )


@router.websocket("/agent/live-ws")
async def agent_live_ws(websocket: WebSocket):
    await websocket.accept()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        await websocket.send_json({"type": "error", "message": "GEMINI_API_KEY is missing on server."})
        await websocket.close()
        return

    live_model = os.getenv("GEMINI_LIVE_AGENT_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")
    voice_name = os.getenv("GEMINI_TTS_VOICE", "zephyr").strip().lower()
    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

    tools = [{"function_declarations": _build_live_tool_declarations()}]
    config = {
        # Switch to Native Audio for synchronized speech and tool calling
        "response_modalities": ["AUDIO"],
        "speech_config": {
            "voice_config": {"prebuilt_voice_config": {"voice_name": voice_name}}
        },
        "tools": tools,
        "system_instruction": _build_live_system_instruction(),
    }

    try:
        async with client.aio.live.connect(model=live_model, config=config) as session:
            await websocket.send_json({"type": "ready", "model": live_model, "voice": voice_name})

            while True:
                incoming = await websocket.receive_json()
                msg_type = (incoming.get("type") or "").strip().lower()

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

                if msg_type != "user_text":
                    await websocket.send_json({"type": "error", "message": f"Unsupported message type: {msg_type}"})
                    continue

                user_text = (incoming.get("text") or "").strip()
                if not user_text:
                    await websocket.send_json({"type": "turn_complete"})
                    continue

                await session.send_client_content(
                    turns={"role": "user", "parts": [{"text": user_text}]},
                    turn_complete=True,
                )

                turn_done = False
                while not turn_done:
                    async for response in session.receive():
                        tool_call = getattr(response, "tool_call", None)
                        function_calls = getattr(tool_call, "function_calls", None) or []
                        if function_calls:
                            calls_payload = [_serialize_function_call(fc) for fc in function_calls]
                            await websocket.send_json({"type": "tool_call", "calls": calls_payload})

                            # Wait for tool responses from frontend and forward back to Gemini.
                            tool_responses_msg = await websocket.receive_json()
                            if (tool_responses_msg.get("type") or "").strip().lower() != "tool_response":
                                await websocket.send_json({"type": "error", "message": "Expected tool_response from client."})
                                turn_done = True
                                break

                            raw_responses = tool_responses_msg.get("responses") or []
                            function_responses = []
                            for item in raw_responses:
                                function_responses.append(
                                    {
                                        "id": item.get("id", ""),
                                        "name": item.get("name", ""),
                                        "response": item.get("response", {}),
                                    }
                                )

                            await session.send_tool_response(function_responses=function_responses)
                            # DO NOT break here! We need to process any audio/turn_complete in the same message.

                        for audio_evt in _extract_audio_events_from_live_message(response):
                            await websocket.send_json(audio_evt)
                        for text_evt in _extract_text_events_from_live_message(response):
                            await websocket.send_json(text_evt)
                        server_content = getattr(response, "server_content", None)
                        turn_complete = bool(getattr(server_content, "turn_complete", False))
                        if turn_complete:
                            await websocket.send_json({"type": "turn_complete"})
                            turn_done = True
                            break

    except WebSocketDisconnect:
        return
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": f"Live websocket error: {e}"})
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
