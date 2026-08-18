import { useMemo, useRef, useState } from "react";
import { API_BASE } from "../config.js";

const QUICK_PROMPTS = [
  "Which field needs attention?",
  "What should I do for high pest risk?",
  "Explain the 0.67 threshold",
];

function localFallback(message, fields) {
  const text = message.toLowerCase();
  const sorted = [...fields].sort((a, b) => Number(b.prob_high_risk || 0) - Number(a.prob_high_risk || 0));
  const top = sorted[0];

  const named = fields.find((field) => text.includes(String(field.client_id || "").toLowerCase()));
  if (named) {
    const pct = Math.round(Number(named.prob_high_risk || 0) * 100);
    return `${named.client_id} is currently at about ${pct}% predicted high-risk probability. ${Number(named.alert) === 1 ? "It is above the alert threshold, so prioritize scouting and confirm pest pressure in the field before treatment." : "It is below the alert threshold. Continue routine scouting and watch for a rising trend."}`;
  }

  if (text.includes("highest") || text.includes("attention") || text.includes("which field")) {
    if (!top) return "I cannot see field data yet. Open the Fields page or try again after the dashboard finishes loading.";
    return `${top.client_id} has the highest visible risk at about ${Math.round(Number(top.prob_high_risk || 0) * 100)}%. ${Number(top.alert) === 1 ? "I would inspect that field first, verify pest counts, and document what you find before deciding on control." : "It is still below the alert threshold, so increased monitoring is more appropriate than automatic treatment."}`;
  }

  if (text.includes("threshold") || text.includes("0.67")) {
    return "The current decision threshold is 0.67. A predicted probability at or above 67% becomes an ALERT. The threshold is a decision-support setting: lowering it catches more potential outbreaks but creates more false alarms; raising it does the opposite.";
  }

  if (text.includes("pest") || text.includes("outbreak") || text.includes("high risk")) {
    return "For a high-risk signal: 1) scout the field and verify pest presence, 2) record pest counts and crop stage, 3) check recent trend and nearby fields, 4) use integrated pest management first where appropriate, and 5) only choose a treatment after confirming the pest and local label guidance. The model should support — not replace — field inspection.";
  }

  if (text.includes("water") || text.includes("irrig")) {
    return "Irrigation decisions should use crop stage, soil moisture, recent rainfall, drainage, and local weather. Avoid using pest-risk probability as a water recommendation by itself. If you connect moisture/weather sensors, I can combine those signals in the dashboard.";
  }

  return top
    ? `I can help interpret this dashboard and discuss general crop-management questions. Right now the highest visible field risk is ${top.client_id} at about ${Math.round(Number(top.prob_high_risk || 0) * 100)}%. Ask me about a field, the model threshold, scouting, pest risk, irrigation, or what action to take next.`
    : "I can help interpret pest risk, explain the model, plan scouting, and discuss general agricultural decision support. Ask me a field question and I’ll use whatever dashboard context is available.";
}

export default function AgriAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("Field intelligence");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "I’m AgriAI Copilot. Ask me about field risk, pest scouting, model results, or what action to take next." },
  ]);
  const contextRef = useRef(null);

  const historyForApi = useMemo(
    () => messages.slice(-6).map((m) => ({ role: m.role, content: m.text })),
    [messages],
  );

  async function getFields() {
    if (contextRef.current) return contextRef.current;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(`${API_BASE}/api/latest-alerts`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error("Could not load fields");
      const data = await response.json();
      contextRef.current = Array.isArray(data) ? data : [];
      return contextRef.current;
    } catch {
      return [];
    }
  }

  async function sendMessage(raw) {
    const message = String(raw ?? input).trim();
    if (!message || busy) return;

    setInput("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setBusy(true);

    const fields = await getFields();
    const compactFields = fields.slice().sort((a, b) => Number(b.prob_high_risk || 0) - Number(a.prob_high_risk || 0)).slice(0, 12).map((field) => ({
      client_id: field.client_id,
      prob_high_risk: Number(field.prob_high_risk || 0),
      alert: Number(field.alert || 0),
      target_week_start: field.target_week_start,
      lag_1: field.lag_1,
      lag_2: field.lag_2,
    }));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);
      const response = await fetch("/_/assistant/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: historyForApi, context: { fields: compactFields, threshold: 0.67 } }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error("Assistant service unavailable");
      const json = await response.json();
      setMode(json.mode === "openai" ? "AI model + field context" : "Field intelligence");
      setMessages((current) => [...current, { role: "assistant", text: json.reply || localFallback(message, fields) }]);
    } catch {
      setMode("Field intelligence");
      setMessages((current) => [...current, { role: "assistant", text: localFallback(message, fields) }]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <>
      <button className={`copilot-fab ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen((v) => !v)} aria-label="Open AgriAI assistant">
        <span className="copilot-pulse" />
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4.8C13.7 4.9 8.2 6.9 6 11.5c-1.8 3.8.3 7.1 3.7 8.5 3.5 1.5 7.2-.1 9-3.6 2.1-3.9 1.3-8.3 1.3-11.6ZM5 21c3.6-4.8 7.1-8 12-10.7" /></svg>
        <span>{open ? "Close" : "Ask AgriAI"}</span>
      </button>

      <section className={`copilot-panel ${open ? "is-open" : ""}`} aria-label="AgriAI field copilot">
        <header className="copilot-head">
          <div>
            <span className="eyebrow">AGRICULTURE COPILOT</span>
            <h2>Ask the field.</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
        </header>

        <div className="copilot-mode"><i /> {mode}</div>

        <div className="copilot-messages">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-row ${message.role}`}>
              <div className="chat-bubble">{message.text}</div>
            </div>
          ))}
          {busy ? <div className="chat-row assistant"><div className="chat-bubble typing"><i /><i /><i /></div></div> : null}
        </div>

        <div className="quick-prompts">
          {QUICK_PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>{prompt}</button>)}
        </div>

        <form className="copilot-input" onSubmit={onSubmit}>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about a field, risk or crop decision…" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">↗</button>
        </form>
        <p className="copilot-note">Decision support only. Confirm crop and pest conditions in the field before treatment.</p>
      </section>
    </>
  );
}
