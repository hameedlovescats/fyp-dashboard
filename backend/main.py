import os
import io
import csv
import json
import math
from pathlib import Path
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import numpy as np
import pandas as pd
import joblib

# IMPORTANT:
# Import transforms BEFORE joblib.load so any custom functions used in the saved pipeline are importable.
import transforms  # noqa: F401

import build_artifacts


load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_RESULTS_DIR = BACKEND_DIR / "results"


def _parse_results_dir() -> Path:
    raw = os.getenv("RESULTS_DIR", "").strip()
    if not raw:
        return DEFAULT_RESULTS_DIR

    p = Path(raw)
    # If user provided a relative path, resolve it relative to backend folder
    if not p.is_absolute():
        p = (BACKEND_DIR / p).resolve()
    return p


RESULTS_DIR = _parse_results_dir()


def _parse_date_yyyy_mm_dd(s: str) -> date:
    try:
        return datetime.strptime(s.strip(), "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date '{s}'. Use YYYY-MM-DD.")


def _ensure_monday(d: date) -> None:
    if d.weekday() != 0:
        raise HTTPException(status_code=400, detail=f"target_week_start must be a Monday. Got {d.isoformat()}.")


def _next_monday_after(d: date) -> date:
    # if d is Monday already, next Monday is +7 days
    days_ahead = 7 - d.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return d + timedelta(days=days_ahead)


def _week_of_year(d: date) -> int:
    return int(d.isocalendar().week)


def _woy_sin_cos(woy: int) -> tuple[float, float]:
    # Use 52 to match typical seasonal encoding
    rad = 2.0 * math.pi * (float(woy) / 52.0)
    return float(math.sin(rad)), float(math.cos(rad))


def _safe_float(x: Any, field_name: str) -> float:
    try:
        v = float(x)
    except Exception:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a number. Got: {x}")
    if np.isnan(v) or np.isinf(v):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid number. Got: {x}")
    return v


def _load_json_if_exists(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_threshold(meta: Dict[str, Any], metrics: Dict[str, Any]) -> float:
    # Support multiple historical keys
    for key in ["decision_threshold", "prob_threshold", "threshold"]:
        if key in meta:
            try:
                return float(meta[key])
            except Exception:
                pass
        if key in metrics:
            try:
                return float(metrics[key])
            except Exception:
                pass
    return 0.5


def _feature_columns(meta: Dict[str, Any], metrics: Dict[str, Any]) -> List[str]:
    return (
        meta.get("feature_columns")
        or meta.get("features")
        or metrics.get("features")
        or [
            "lag_1",
            "lag_2",
            "lag_3",
            "lag_4",
            "lag_5",
            "lag_6",
            "lag_7",
            "lag_8",
            "woy_sin",
            "woy_cos",
        ]
    )


def _require_model(app: FastAPI):
    if app.state.model is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model not loaded. Check /health. model_error={app.state.model_error}",
        )


def _predict_from_lags(
    app: FastAPI,
    client_id: str,
    target_week_start: date,
    lags: Dict[str, float],
) -> Dict[str, Any]:
    _require_model(app)

    meta: Dict[str, Any] = app.state.meta or {}
    metrics: Dict[str, Any] = app.state.metrics or {}
    model = app.state.model

    woy = _week_of_year(target_week_start)
    woy_sin, woy_cos = _woy_sin_cos(woy)

    feature_cols: List[str] = _feature_columns(meta, metrics)

    row: Dict[str, Any] = {
        "lag_1": float(lags["lag_1"]),
        "lag_2": float(lags["lag_2"]),
        "lag_3": float(lags["lag_3"]),
        "lag_4": float(lags["lag_4"]),
        "lag_5": float(lags["lag_5"]),
        "lag_6": float(lags["lag_6"]),
        "lag_7": float(lags["lag_7"]),
        "lag_8": float(lags["lag_8"]),
        "woy_sin": woy_sin,
        "woy_cos": woy_cos,
    }

    X = pd.DataFrame([[row.get(c, 0.0) for c in feature_cols]], columns=feature_cols)

    try:
        proba = float(model.predict_proba(X)[0, 1])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    threshold = float(app.state.decision_threshold)
    status = "ALERT" if proba >= threshold else "OK"

    return {
        "client_id": client_id,
        "target_week_start": target_week_start.isoformat(),
        "week_of_year": woy,
        "prob_high_risk": proba,
        "status": status,
        "decision_threshold": threshold,
    }


def _parse_allowed_origins() -> List[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    if not raw:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    parts = [p.strip() for p in raw.split(",")]
    return [p for p in parts if p]


def _to_iso_date_string(value: Any) -> str:
    """Convert epoch ms or ISO date string to ISO YYYY-MM-DD format."""
    if value is None:
        return ""
    
    value_str = str(value).strip()
    if not value_str:
        return ""
    
    # Try as epoch milliseconds (large number)
    try:
        ms = float(value)
        if ms > 1000000000:  # Likely epoch ms
            dt = datetime.fromtimestamp(ms / 1000.0)
            return dt.strftime("%Y-%m-%d")
    except (ValueError, OSError):
        pass
    
    # Try as ISO string
    if "T" in value_str or len(value_str) == 10:
        try:
            dt = datetime.fromisoformat(value_str.split("T")[0])
            return dt.strftime("%Y-%m-%d")
        except (ValueError, AttributeError):
            pass
    
    return value_str


def _dedup_by_client_latest(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Keep only the latest row per client_id by date, standardize dates to ISO."""
    client_dict = {}
    
    for row in rows:
        cid = row.get("client_id")
        if not cid:
            continue
        
        # Normalize target_week_start to ISO date
        row["target_week_start"] = _to_iso_date_string(row.get("target_week_start", ""))
        
        week_str = row.get("target_week_start", "")
        if not week_str:
            continue
        
        # Keep the row with latest date per client
        if cid not in client_dict:
            client_dict[cid] = row
        else:
            existing_week = client_dict[cid].get("target_week_start", "")
            if week_str > existing_week:  # ISO dates sort correctly as strings
                client_dict[cid] = row
    
    return list(client_dict.values())


def _compute_base_latest_alerts(alert_history_path: Path) -> List[Dict[str, Any]]:
    """Load alert_history.csv once at startup and compute latest per client.
    This is cached in app.state.base_latest_alerts for fast /api/latest-alerts responses.
    """
    if not alert_history_path.exists():
        return []
    
    try:
        df = pd.read_csv(alert_history_path)
        rows = []
        for _, row in df.iterrows():
            row_dict = row.to_dict()
            row_dict["target_week_start"] = _to_iso_date_string(row_dict.get("target_week_start", ""))
            row_dict["source"] = "historical"  # Mark as coming from alert_history.csv
            rows.append(row_dict)
        
        # Keep only the latest per client
        return _dedup_by_client_latest(rows)
    except Exception as e:
        print(f"WARNING: Could not load base_latest_alerts from alert_history.csv: {e}")
        return []


def _try_load_model_with_retry(model_path: Path, alert_history: Path, results_dir: Path):
    """
    Try to load model. If it fails, retrain it from alert_history.csv.
    This is Option A for portability: auto-retrain if joblib fails.
    """
    try:
        if model_path.exists():
            return joblib.load(model_path)
    except Exception as e:
        print(f"WARNING: Failed to load model from {model_path}: {e}")
        print(f"INFO: Attempting to retrain model from {alert_history}...")

        try:
            pipe, meta, metrics = build_artifacts.train_lr_from_alert_history(
                alert_history_csv=alert_history,
                results_dir=results_dir,
            )
            print(f"INFO: Model retrained and saved to {model_path}")
            return pipe
        except Exception as retrain_error:
            print(f"ERROR: Retrain failed: {retrain_error}")
            return None

    return None


app = FastAPI(title="Pest Risk API", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup_load_artifacts():
    app.state.results_dir = None
    app.state.model = None
    app.state.meta = {}
    app.state.metrics = {}
    app.state.comparison = []
    app.state.model_error = None
    app.state.decision_threshold = 0.5
    app.state.test_y_true = None
    app.state.test_y_proba = None
    app.state.feature_columns = []
    app.state.base_latest_alerts = []  # Cache of latest per client from alert_history.csv

    try:
        # If RESULTS_DIR is invalid or missing artifacts, build portable artifacts in backend/results.
        results_dir = RESULTS_DIR
        try:
            if not results_dir.exists():
                results_dir = build_artifacts.ensure_backend_results(BACKEND_DIR, prefer_public=True)
            else:
                required = [results_dir / "alert_history.csv", results_dir / "lr_metrics.json"]
                if not all(p.exists() for p in required):
                    results_dir = build_artifacts.ensure_backend_results(BACKEND_DIR, prefer_public=True)
        except Exception:
            results_dir = build_artifacts.ensure_backend_results(BACKEND_DIR, prefer_public=True)

        app.state.results_dir = results_dir

        meta_path = results_dir / "lr_meta.json"
        metrics_path = results_dir / "lr_metrics.json"
        model_path = results_dir / "lr_model.joblib"
        comparison_path = results_dir / "model_comparison.csv"
        alert_history = results_dir / "alert_history.csv"

        app.state.meta = _load_json_if_exists(meta_path)
        app.state.metrics = _load_json_if_exists(metrics_path)
        app.state.decision_threshold = _resolve_threshold(app.state.meta, app.state.metrics)
        app.state.feature_columns = _feature_columns(app.state.meta, app.state.metrics)

        # Try to load model with Option A fallback (auto-retrain)
        app.state.model = _try_load_model_with_retry(model_path, alert_history, results_dir)

        if app.state.model is None:
            app.state.model_error = (
                f"Could not load or retrain model. Check that alert_history.csv exists in {results_dir}"
            )
        else:
            # Load test data for calibration/threshold sweep
            try:
                if alert_history.exists():
                    df = pd.read_csv(alert_history)
                    test_df = df[df.get("split", "").astype(str).str.lower() == "test"]
                    if len(test_df) > 0:
                        X_test = test_df[app.state.feature_columns]
                        y_test = pd.to_numeric(test_df.get("y", []), errors="coerce").astype(int).to_numpy()

                        # Convert to numeric, handling any non-numeric values
                        X_test_numeric = X_test.apply(pd.to_numeric, errors="coerce")

                        if len(y_test) > 0 and not X_test_numeric.isna().any().any():
                            y_proba = app.state.model.predict_proba(X_test_numeric)[:, 1]
                            app.state.test_y_true = y_test
                            app.state.test_y_proba = y_proba
            except Exception as e:
                print(f"INFO: Could not load test data for calibration: {e}")

        if comparison_path.exists():
            try:
                comp_df = pd.read_csv(comparison_path)
                app.state.comparison = comp_df.to_dict(orient="records")
            except Exception:
                app.state.comparison = []

        # Cache the base latest alerts from alert_history (computed once at startup)
        app.state.base_latest_alerts = _compute_base_latest_alerts(alert_history)
    except Exception as e:
        app.state.model = None
        app.state.model_error = str(e)


@app.get("/health")
def health():
    return {
        "ok": True,
        "results_dir": str(app.state.results_dir) if app.state.results_dir else None,
        "has_model": app.state.model is not None,
        "model_error": app.state.model_error,
        "decision_threshold": float(app.state.decision_threshold),
        "has_test_data": app.state.test_y_true is not None,
    }


@app.get("/api/latest-alerts")
def latest_alerts():
    """Return latest alerts per client from all sources: base history cache, latest_alerts.json, and user predictions.
    
    Merges three sources:
    1. app.state.base_latest_alerts (cached latest from alert_history.csv, computed at startup)
    2. latest_alerts.json (if exists)
    3. user_alert_history.csv (user-saved predictions)
    
    Then deduplicates to keep only the latest per client.
    This keeps historical data visible (e.g., kelaniya) while adding new user predictions fast.
    """
    results_dir: Path = app.state.results_dir or DEFAULT_RESULTS_DIR
    all_rows = []
    
    # Start with the cached base_latest_alerts from alert_history.csv (computed at startup)
    all_rows.extend(app.state.base_latest_alerts)
    
    # Load from latest_alerts.json (if exists)
    try:
        path = results_dir / "latest_alerts.json"
        if path.exists():
            alerts_list = json.loads(path.read_text(encoding="utf-8"))
            for alert in alerts_list:
                alert["target_week_start"] = _to_iso_date_string(alert.get("target_week_start", ""))
                if "source" not in alert:
                    alert["source"] = "static"  # From latest_alerts.json
                all_rows.append(alert)
    except Exception:
        pass
    
    # Merge user predictions (from user_alert_history.csv)
    try:
        user_history_path = results_dir / "user_alert_history.csv"
        if user_history_path.exists():
            df = pd.read_csv(user_history_path)
            for _, row in df.iterrows():
                row_dict = row.to_dict()
                row_dict["target_week_start"] = _to_iso_date_string(row_dict.get("target_week_start", ""))
                if "source" not in row_dict or pd.isna(row_dict.get("source")):
                    row_dict["source"] = "user"
                all_rows.append(row_dict)
    except Exception:
        pass
    
    # Deduplicate: keep only latest row per client
    deduped = _dedup_by_client_latest(all_rows)
    
    return deduped


@app.get("/api/history")
def history(client_id: str):
    """Return merged history from alert_history.csv and user_alert_history.csv, sorted by target_week_start."""
    results_dir: Path = app.state.results_dir or DEFAULT_RESULTS_DIR
    return _get_merged_history(results_dir, client_id)


@app.get("/api/client-mapping")
def client_mapping():
    """Return client_id -> display_name mapping (Option A: display-name mapping layer).
    Collects IDs from:
    1. app.state.base_latest_alerts (cached from alert_history.csv at startup)
    2. latest_alerts.json
    3. user_alert_history.csv
    
    This ensures historical alerts like 'kelaniya' remain visible after new predictions are saved.
    """
    results_dir: Path = app.state.results_dir or DEFAULT_RESULTS_DIR
    mapping_path = results_dir / "client_mapping.json"
    
    # Collect actual client IDs from all three sources
    actual_ids = set()
    
    # From cached base_latest_alerts (computed at startup from alert_history.csv)
    for row in app.state.base_latest_alerts:
        cid = str(row.get("client_id", "")).strip()
        if cid:
            actual_ids.add(cid)
    
    # From latest_alerts.json
    try:
        alerts_path = results_dir / "latest_alerts.json"
        if alerts_path.exists():
            alerts = json.loads(alerts_path.read_text(encoding="utf-8"))
            for alert in alerts:
                cid = str(alert.get("client_id", "")).strip()
                if cid:
                    actual_ids.add(cid)
    except Exception:
        pass
    
    # From user_alert_history.csv
    try:
        user_history_path = results_dir / "user_alert_history.csv"
        if user_history_path.exists():
            df = pd.read_csv(user_history_path)
            for _, row in df.iterrows():
                cid = str(row.get("client_id", "")).strip()
                if cid:
                    actual_ids.add(cid)
    except Exception:
        pass
    
    # Try to load existing mapping
    if mapping_path.exists():
        try:
            existing_mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
            # Validate: check if existing mapping keys match actual IDs
            existing_keys = set(existing_mapping.keys())
            if existing_keys & actual_ids:  # If there's any overlap, use existing mapping
                # Return existing, but ensure all actual IDs are covered
                for cid in actual_ids:
                    if cid not in existing_mapping:
                        existing_mapping[cid] = cid if _is_word_like(cid) else f"Field {len(existing_mapping) + 1}"
                return existing_mapping
        except Exception:
            pass
    
    # Auto-generate mapping from actual IDs
    mapping = {}
    field_count = 1
    
    for cid in sorted(actual_ids):
        if _is_word_like(cid):
            # Keep word-like IDs (4+ chars or user-created names like Dehiwela, kelaniya)
            mapping[cid] = cid
        else:
            # Convert short IDs (BB, Wr, We, H, Y, etc.) to "Field N"
            mapping[cid] = f"Field {field_count}"
            field_count += 1
    
    return mapping


def _is_word_like(value: str) -> bool:
    """Check if a string looks like a human name vs anonymized code.
    
    Returns True (keep as-is) if:
    - Length >= 4 (likely a real name like 'Malwatte', 'Dehiwela')
    - Contains space, dash, underscore (user-typed name)
    
    Returns False (should map to Field N) if:
    - Length <= 3 and only letters/numbers (likely anonymized code like 'BB', 'Wr', 'We')
    """
    s = str(value).strip()
    if not s:
        return False
    
    # Keep if >= 4 chars (likely real name)
    if len(s) >= 4:
        return True
    
    # Keep if contains space, dash, underscore (user-typed name)
    if any(c in s for c in [" ", "-", "_"]):
        return True
    
    # Otherwise it's likely anonymized (2-3 letter codes)
    return False


class PredictRequest(BaseModel):
    client_id: str = Field(..., min_length=1)
    target_week_start: str = Field(..., description="YYYY-MM-DD (Monday)")
    lag_1: float
    lag_2: float
    lag_3: float
    lag_4: float
    lag_5: float
    lag_6: float
    lag_7: float
    lag_8: float


class SavePredictionRequest(BaseModel):
    client_id: str = Field(..., min_length=1)
    target_week_start: str
    prob_high_risk: float
    status: str


@app.post("/api/predict")
def predict(payload: PredictRequest):
    target = _parse_date_yyyy_mm_dd(payload.target_week_start)
    _ensure_monday(target)

    lags = {
        "lag_1": _safe_float(payload.lag_1, "lag_1"),
        "lag_2": _safe_float(payload.lag_2, "lag_2"),
        "lag_3": _safe_float(payload.lag_3, "lag_3"),
        "lag_4": _safe_float(payload.lag_4, "lag_4"),
        "lag_5": _safe_float(payload.lag_5, "lag_5"),
        "lag_6": _safe_float(payload.lag_6, "lag_6"),
        "lag_7": _safe_float(payload.lag_7, "lag_7"),
        "lag_8": _safe_float(payload.lag_8, "lag_8"),
    }

    return _predict_from_lags(app, payload.client_id, target, lags)


@app.post("/api/predict-file")
async def predict_file(
    file: UploadFile = File(...),
    client_id: str = Form(...),
    target_week_start: Optional[str] = Form(None),
):
    _require_model(app)

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {str(e)}")

    required = {"week_start", "count"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing columns: {sorted(list(missing))}. Required: week_start,count",
        )

    df = df.copy()
    df["week_start"] = pd.to_datetime(df["week_start"], errors="coerce").dt.date
    df["count"] = pd.to_numeric(df["count"], errors="coerce")

    if df["week_start"].isna().any():
        raise HTTPException(status_code=400, detail="Some week_start values are invalid dates (use YYYY-MM-DD).")
    if df["count"].isna().any():
        raise HTTPException(status_code=400, detail="Some count values are not numeric.")

    df = df.sort_values("week_start").reset_index(drop=True)

    if len(df) < 8:
        raise HTTPException(status_code=400, detail=f"Need at least 8 rows, got {len(df)}")

    last8 = df.tail(8).reset_index(drop=True)

    # Map oldest -> lag_8, newest -> lag_1
    lags = {}
    for i in range(8):
        v = _safe_float(last8.loc[i, "count"], "count")
        if v < 0:
            raise HTTPException(status_code=400, detail="count must be >= 0")
        lag_num = 8 - i
        lags[f"lag_{lag_num}"] = float(v)

    most_recent_week = last8.loc[7, "week_start"]

    if target_week_start and target_week_start.strip():
        target = _parse_date_yyyy_mm_dd(target_week_start)
    else:
        target = _next_monday_after(most_recent_week)

    _ensure_monday(target)

    return _predict_from_lags(app, client_id.strip(), target, lags)


def _get_merged_history(results_dir: Path, client_id: Optional[str]) -> List[Dict[str, Any]]:
    """Merge alert_history.csv and user_alert_history.csv, optionally filtered by client_id.
    Returns rows sorted by date (most recent first) with dates normalized to ISO format.
    Includes source field: 'historical' for alert_history.csv, 'user' for user_alert_history.csv."""
    rows = []
    
    # Load alert_history.csv (historical data)
    history_path = results_dir / "alert_history.csv"
    if history_path.exists():
        try:
            df = pd.read_csv(history_path)
            for _, row in df.iterrows():
                cid = str(row.get("client_id", "")).strip()
                if client_id is None or cid == str(client_id).strip():
                    row_dict = row.to_dict()
                    row_dict["target_week_start"] = _to_iso_date_string(row_dict.get("target_week_start", ""))
                    row_dict["source"] = "historical"
                    rows.append(row_dict)
        except Exception:
            pass
    
    # Load user_alert_history.csv (user saved predictions)
    user_history_path = results_dir / "user_alert_history.csv"
    if user_history_path.exists():
        try:
            df = pd.read_csv(user_history_path)
            for _, row in df.iterrows():
                cid = str(row.get("client_id", "")).strip()
                if client_id is None or cid == str(client_id).strip():
                    row_dict = row.to_dict()
                    row_dict["target_week_start"] = _to_iso_date_string(row_dict.get("target_week_start", ""))
                    # Preserve source field, default to 'user'
                    if "source" not in row_dict or pd.isna(row_dict["source"]):
                        row_dict["source"] = "user"
                    rows.append(row_dict)
        except Exception:
            pass
    
    # Sort by target_week_start descending (most recent first), handling ISO format
    try:
        rows = sorted(rows, key=lambda r: str(r.get("target_week_start", "")), reverse=True)
    except Exception:
        pass
    
    return rows


@app.post("/api/save-prediction")
def save_prediction(payload: SavePredictionRequest):
    """
    Save user's prediction to user_alert_history.csv with schema compatible with dashboard history view.
    This makes saved predictions appear in Fields, FieldDetail, and Overview automatically.
    """
    results_dir: Path = app.state.results_dir or DEFAULT_RESULTS_DIR
    results_dir.mkdir(parents=True, exist_ok=True)

    user_history_file = results_dir / "user_alert_history.csv"

    # Convert status to alert flag
    alert_flag = 1 if payload.status == "ALERT" else 0

    row = {
        "client_id": payload.client_id.strip(),
        "target_week_start": payload.target_week_start,
        "prob_high_risk": float(payload.prob_high_risk),
        "alert": alert_flag,
        "y_count": 0,
        "source": "user",
    }

    try:
        if user_history_file.exists():
            df = pd.read_csv(user_history_file)
            df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
        else:
            df = pd.DataFrame([row])

        df = df.sort_values("target_week_start", ignore_index=True)
        df.to_csv(user_history_file, index=False)
        return {"success": True, "message": f"Prediction saved for {payload.client_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save prediction: {str(e)}")


@app.get("/api/calibration")
def calibration():
    """
    Option 3A: Calibration panel (Brier score + reliability diagram).
    Shows probability calibration using test data.
    """
    if app.state.test_y_true is None or app.state.test_y_proba is None:
        return {
            "available": False,
            "message": "No test data available for calibration curve.",
            "brier_score": None,
            "curve": [],
        }

    result = build_artifacts.compute_calibration_curve(
        app.state.test_y_true,
        app.state.test_y_proba,
        n_bins=10,
    )

    return {
        "available": True,
        "brier_score": result.get("brier_score"),
        "curve": result.get("curve", []),
        "n_samples_test": result.get("n_samples", 0),
        "interpretation": (
            "Brier score measures probability calibration (0=perfect, 0.25=worst). "
            "Curve shows: if model predicts 0.60, did events occur ~60% of the time?"
        ),
    }


@app.get("/api/threshold-sweep")
def threshold_sweep():
    """
    Option 3B: Threshold transparency (metrics across thresholds).
    Shows how precision, recall, specificity change with threshold.
    Justifies chosen threshold decision.
    """
    if app.state.test_y_true is None or app.state.test_y_proba is None:
        return {
            "available": False,
            "message": "No test data available for threshold sweep.",
            "thresholds": [],
        }

    thresholds_default = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.67, 0.7, 0.8, 0.9]
    results = build_artifacts.compute_threshold_sweep(
        app.state.test_y_true,
        app.state.test_y_proba,
        thresholds=thresholds_default,
    )

    current_threshold = float(app.state.decision_threshold)

    return {
        "available": True,
        "current_threshold": current_threshold,
        "thresholds": results,
        "interpretation": (
            "Higher threshold = fewer alerts (higher precision, lower recall). "
            "Choose threshold based on cost of false positives vs missed outbreaks."
        ),
    }


@app.get("/api/model-interpretability")
def model_interpretability():
    """
    Option 3C: Interpretability (logistic regression as odds ratios).
    Shows which features drive risk prediction and by how much.
    """
    _require_model(app)

    result = build_artifacts.compute_interpretability(
        app.state.model,
        app.state.feature_columns,
    )

    if "error" in result:
        return {
            "available": False,
            "error": result.get("error"),
            "features": [],
        }

    return {
        "available": True,
        "intercept": result.get("intercept"),
        "log_odds_intercept": result.get("log_odds_intercept"),
        "features": result.get("features", []),
        "interpretation": (
            "Each feature's odds_ratio shows: for each unit increase, how much does risk multiply? "
            "Odds ratio > 1 = increases risk. < 1 = decreases risk."
        ),
    }


@app.get("/api/model-metrics")
def model_metrics():
    return {
        "decision_threshold": float(app.state.decision_threshold),
        "meta": app.state.meta,
        "metrics": app.state.metrics,
        "comparison": app.state.comparison,
        "results_dir": str(app.state.results_dir) if app.state.results_dir else None,
        "has_model": app.state.model is not None,
        "model_error": app.state.model_error,
        "has_test_data": app.state.test_y_true is not None,
        "build_date": datetime.now().isoformat(),
    }
