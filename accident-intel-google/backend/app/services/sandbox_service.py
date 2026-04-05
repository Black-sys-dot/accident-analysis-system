import os
import shutil
import subprocess
import re
from typing import Optional
import pandas as pd
from app.utils.data_loader import get_data

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SANDBOX_DIR = os.path.join(BASE_DIR, "sandbox")
ALLOWED_PACKAGES = {
    "pandas",
    "numpy",
    "matplotlib",
    "seaborn",
    "folium",
    "scikit-learn",
}


def _normalize_package_name(package: str) -> str:
    # Keep this intentionally simple and defensive for pip-style specifiers.
    raw = (package or "").strip().lower()
    if not raw:
        return ""
    base = re.split(r"[<>=!~\[\s;]", raw, maxsplit=1)[0]
    return base.replace("_", "-")


def _is_valid_sandbox_path(path: str) -> bool:
    sandbox_real = os.path.realpath(SANDBOX_DIR)
    file_real = os.path.realpath(path)
    return file_real.startswith(sandbox_real + os.sep) or file_real == sandbox_real


def _get_sandbox_file_path(filename: str) -> str:
    safe_name = os.path.basename((filename or "").strip())
    if not safe_name:
        raise ValueError("Filename is required.")
    file_path = os.path.join(SANDBOX_DIR, safe_name)
    if not _is_valid_sandbox_path(file_path):
        raise ValueError("Invalid sandbox path.")
    return file_path


def validate_generated_output(filename: str, output_kind: Optional[str] = None) -> dict:
    """Validate generated sandbox output exists and matches basic type expectations."""
    try:
        file_path = _get_sandbox_file_path(filename)
    except ValueError as e:
        return {"ok": False, "error": str(e)}

    if not os.path.exists(file_path):
        return {"ok": False, "error": f"Expected output file '{os.path.basename(file_path)}' was not created."}

    ext = os.path.splitext(file_path)[1].lower()
    kind = (output_kind or "").strip().lower()
    if kind == "chart" and ext not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
        return {"ok": False, "error": "Chart output must be an image file (e.g., .png, .jpg)."}
    if kind == "map" and ext != ".json":
        return {"ok": False, "error": "Map output must be a .json file."}

    return {"ok": True, "filename": os.path.basename(file_path), "size_bytes": os.path.getsize(file_path)}

def reset_sandbox():
    """Wipes the sandbox directory and copies a fresh data.csv into it."""
    # Recreate the sandbox directory
    deleted_count = 0
    if os.path.exists(SANDBOX_DIR):
        for filename in os.listdir(SANDBOX_DIR):
            file_path = os.path.join(SANDBOX_DIR, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                    deleted_count += 1
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
                    deleted_count += 1
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
    else:
        os.makedirs(SANDBOX_DIR)

    # Get the merged data and save it as data.csv in the sandbox
    try:
        df = get_data()
        csv_path = os.path.join(SANDBOX_DIR, "data.csv")
        df.to_csv(csv_path, index=False)
        return {
            "status": "success",
            "message": f"Sandbox reset. data.csv has {len(df)} rows.",
            "rows": int(len(df)),
            "cleared_items": int(deleted_count),
        }
    except Exception as e:
        return {"status": "error", "message": f"Failed to populate data.csv: {e}"}


def execute_python_code(code: str, expected_output: Optional[str] = None, output_kind: Optional[str] = None) -> dict:
    """Executes python code inside the sandbox directory."""
    script_path = os.path.join(SANDBOX_DIR, "agent_script.py")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(code)
    
    try:
        # Run the script with the current python interpreter
        import sys
        result = subprocess.run(
            [sys.executable, script_path],
            cwd=SANDBOX_DIR,
            env={
                **os.environ,
                # Force non-GUI backend so matplotlib charts work on headless/local server.
                "MPLBACKEND": "Agg",
                "PYTHONUNBUFFERED": "1",
            },
            capture_output=True,
            text=True,
            timeout=45
        )
        response = {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
        if result.returncode == 0 and expected_output:
            check = validate_generated_output(expected_output, output_kind=output_kind)
            if not check.get("ok"):
                response["returncode"] = 2
                response["stderr"] = (response.get("stderr") or "") + f"\n{check.get('error')}"
            response["output_check"] = check
        return response
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Execution timed out after 45 seconds.", "returncode": 124}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": 1}


def install_dependency(package: str) -> dict:
    """Installs a python package into the current environment using pip."""
    normalized = _normalize_package_name(package)
    if not normalized:
        return {"stdout": "", "stderr": "Package name is required.", "returncode": 1}
    if normalized not in ALLOWED_PACKAGES:
        allowed = ", ".join(sorted(ALLOWED_PACKAGES))
        return {
            "stdout": "",
            "stderr": f"Package '{normalized}' is blocked. Allowed packages: {allowed}.",
            "returncode": 1,
            "blocked": True,
        }

    try:
        import sys
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", normalized],
            capture_output=True,
            text=True,
            timeout=60
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "package": normalized,
        }
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": 1}


def generate_monthly_trend_chart(filename: str = "monthly_trends.png") -> dict:
    """
    Deterministic monthly trend chart generator to avoid LLM script mistakes.
    Expects month column as numeric 1..12 in data.csv.
    """
    try:
        # Local import so this module can still load even if matplotlib missing at import time.
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        out_path = _get_sandbox_file_path(filename)
        data_path = _get_sandbox_file_path("data.csv")

        df = pd.read_csv(data_path)
        if "month" not in df.columns:
            return {"stdout": "", "stderr": "Missing 'month' column in data.csv.", "returncode": 1}

        month_series = pd.to_numeric(df["month"], errors="coerce").dropna().astype(int)
        month_series = month_series[(month_series >= 1) & (month_series <= 12)]
        counts = month_series.value_counts().sort_index().reindex(range(1, 13), fill_value=0)

        fig, ax = plt.subplots(figsize=(10, 5))
        ax.bar(list(range(1, 13)), counts.values, color="#2b78b6", edgecolor="#123a5f", linewidth=0.6)
        ax.set_title("Monthly Trends (Accident Count)")
        ax.set_xlabel("Month")
        ax.set_ylabel("Count")
        ax.set_xticks(list(range(1, 13)))
        ax.grid(axis="y", alpha=0.2)
        fig.tight_layout()
        fig.savefig(out_path, dpi=150)
        plt.close(fig)

        total = int(counts.sum())
        return {
            "stdout": f"Generated {os.path.basename(out_path)} with total counted entries={total}.",
            "stderr": "",
            "returncode": 0,
            "output_check": validate_generated_output(os.path.basename(out_path), output_kind="chart"),
            "monthly_counts": {str(i): int(v) for i, v in zip(range(1, 13), counts.values)},
            "total_counted": total,
        }
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": 1}
