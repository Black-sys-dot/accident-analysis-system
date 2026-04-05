import os
from typing import List

import pandas as pd
from supabase import Client, create_client

df = None
REQUIRED_COLUMNS = ["lat", "lon", "month", "season", "location"]


def _get_env(name: str, default: str = "") -> str:
    value = (os.getenv(name) or default).strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _get_supabase_client() -> Client:
    supabase_url = _get_env("SUPABASE_URL")
    service_role_key = _get_env("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(supabase_url, service_role_key)


def _fetch_rows(client: Client, table_name: str) -> List[dict]:
    all_rows: List[dict] = []
    page_size = 1000
    start = 0

    while True:
        end = start + page_size - 1
        response = (
            client.table(table_name)
            .select(",".join(REQUIRED_COLUMNS))
            .range(start, end)
            .execute()
        )
        rows = response.data or []
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        start += page_size

    return all_rows


def _normalize_dataframe(raw_rows: List[dict]) -> pd.DataFrame:
    if not raw_rows:
        raise RuntimeError("No rows found in Supabase table.")

    loaded_df = pd.DataFrame(raw_rows)
    missing = [col for col in REQUIRED_COLUMNS if col not in loaded_df.columns]
    if missing:
        raise RuntimeError(f"Supabase table missing required columns: {', '.join(missing)}")

    loaded_df["lat"] = pd.to_numeric(loaded_df["lat"], errors="coerce")
    loaded_df["lon"] = pd.to_numeric(loaded_df["lon"], errors="coerce")
    loaded_df["month"] = pd.to_numeric(loaded_df["month"], errors="coerce")
    loaded_df = loaded_df.dropna(subset=["lat", "lon", "month"])
    loaded_df["month"] = loaded_df["month"].astype(int)
    loaded_df["season"] = loaded_df["season"].fillna("").astype(str)
    loaded_df["location"] = loaded_df["location"].fillna("").astype(str)
    return loaded_df


def load_data():
    global df
    if df is None:
        table_name = (os.getenv("SUPABASE_TABLE") or "pune-accidents").strip()
        client = _get_supabase_client()
        rows = _fetch_rows(client, table_name)
        df = _normalize_dataframe(rows)
    return df


def get_data():
    return load_data()
