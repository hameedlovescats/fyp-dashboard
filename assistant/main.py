import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(title="AgriAI Copilot", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


class HistoryItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: List[HistoryItem] = []
    context: Dict[str, Any] = {}


def _top_fields(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    fields = context.get("fields") or []
    if not isinstance(fields, list):
        return []
    return sorted(
        [field for field in fields if isinstance(field, dict)],
        key=lambda field: float(field.get("prob_high_risk") or 0),
        reverse=True,
    )


def _field_named(message: str, fields: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    lower = message.lower()
    for field in fields:
        client_id = str(field.get("client_id") or "").strip()
        if client_id and client_id.lower() in lower:
            return field
    return None


def _pct(value: Any) -> int:
    try:
        return round(float(value or 0) * 100)
    except Exception:
        return 0


def _local_answer(message: str, context: Dict[str, Any]) -> str:
    lower = message.lower()
    fields = _top_fields(context)
    threshold = float(context.get("threshold") or 0.67)
    top = fields[0] if fields else None
    named = _field_named(message, fields)

    if named:
        risk = _pct(named.get("prob_high_risk"))
        client = named.get("client_id")
        if int(named.get("alert") or 0) == 1:
            return (
                f"{client} is at about {risk}% predicted high-risk probability and is above the current alert threshold. "
                "Prioritize field scouting, confirm the pest and crop stage, record counts, then choose an IPM response using local agronomic and label guidance."
            )
        return (
            f"{client} is at about {risk}% predicted high-risk probability, below the current alert threshold. "
            "Continue routine scouting and watch the trend rather than treating from probability alone."
        )

    if any(term in lower for term in ["highest", "attention", "which field", "priority field"]):
        if not top:
            return "I cannot see field context yet. Reload the dashboard and ask again."
        return (
            f"{top.get('client_id')} is the highest-risk field in the current dashboard context at about {_pct(top.get('prob_high_risk'))}%. "
            + ("It is above threshold, so verify the signal with field scouting first." if int(top.get("alert") or 0) == 1 else "It remains below threshold, so increased observation is more appropriate than automatic treatment.")
        )

    if "threshold" in lower or "0.67" in lower:
        return (
            f"The current threshold is {threshold:.2f} ({round(threshold * 100)}%). Predictions at or above it become ALERTs. "
            "A lower threshold increases sensitivity but usually creates more false alarms; a higher threshold reduces alerts but can miss more outbreaks."
        )

    if any(term in lower for term in ["pest", "outbreak", "high risk", "what should i do", "recommend"]):
        return (
            "For a high-risk signal: scout and identify the pest, record field counts and crop stage, compare the recent trend, check adjacent fields, and use integrated pest management where appropriate. "
            "Do not select a pesticide from the model probability alone; confirm the pest and follow local agronomic and product-label guidance."
        )

    if any(term in lower for term in ["water", "irrigation", "moisture"]):
        return (
            "Irrigation should be based on crop stage, soil moisture, drainage, rainfall and weather — not pest-risk probability alone. "
            "The Sensors page shows where live moisture and weather feeds can be integrated later."
        )

    if any(term in lower for term in ["fertilizer", "nitrogen", "npk"]):
        return (
            "Fertilizer advice depends on crop, growth stage, soil or tissue testing, expected yield, local recommendations and recent applications. "
            "Tell me the crop and what soil/tissue information you have; avoid applying nutrients based only on this pest-risk model."
        )

    if top:
        return (
            f"I can interpret field risk and discuss general crop decision support. The highest visible risk right now is {top.get('client_id')} at about {_pct(top.get('prob_high_risk'))}%. "
            "Ask about a specific field, pest scouting, the decision threshold, irrigation, or what action to take next."
        )

    return "I can help interpret pest risk, explain the model, plan scouting, and discuss general agriculture decision support. Ask me a specific field or crop question."


def _openai_answer(payload: ChatRequest) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.getenv("OPENAI_MODEL", "gpt-5.6").strip() or "gpt-5.6"
    context_json = json.dumps(payload.context, ensure_ascii=False, separators=(",", ":"))
    recent = "\n".join(f"{item.role}: {item.content}" for item in payload.history[-6:])
    user_input = (
        f"Dashboard context (may include historical/demo data): {context_json}\n"
        f"Recent conversation:\n{recent}\n\n"
        f"User: {payload.message}"
    )
    body = {
        "model": model,
        "store": False,
        "instructions": (
            "You are AgriAI Copilot, a concise agriculture decision-support assistant embedded in a pest-risk dashboard. "
            "Use the supplied dashboard context when relevant. Never invent live sensor readings, crop conditions or field observations. "
            "Treat model probabilities as decision support, not proof of infestation. Recommend field scouting and integrated pest management before treatment. "
            "For pesticide, fertilizer, disease diagnosis or other consequential agronomy, avoid pretending a universal prescription is safe; ask for crop/location context and defer to local labels or agronomic guidance where needed. "
            "Keep answers practical and usually under 180 words."
        ),
        "input": user_input,
    }

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError):
        return None

    text_parts: List[str] = []
    for item in data.get("output") or []:
        if item.get("type") != "message":
            continue
        for content in item.get("content") or []:
            if content.get("type") == "output_text" and content.get("text"):
                text_parts.append(str(content["text"]))
    answer = "\n".join(text_parts).strip()
    return answer or None


@app.get("/health")
def health():
    return {"ok": True, "llm_configured": bool(os.getenv("OPENAI_API_KEY", "").strip())}


@app.post("/api/chat")
def chat(payload: ChatRequest):
    answer = _openai_answer(payload)
    if answer:
        return {"reply": answer, "mode": "openai"}
    return {"reply": _local_answer(payload.message, payload.context), "mode": "local"}
