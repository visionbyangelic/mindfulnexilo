import json
import os
import re
from flask import Flask, request, jsonify
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

app = Flask(__name__)

SYSTEM_INSTRUCTION = """
You are a clinical resilience scoring engine for a safe-haven journaling app.
Evaluate the user's text and return only valid JSON with these keys:
  - score: integer from 0 to 100
  - state: one of calm, alert, crisis
  - reasoning: a brief explanation of the score
Do not include any surrounding prose or markdown.
"""

JSON_RE = re.compile(r"\{(?:[^{}]|\{[^{}]*\})*\}", re.S)


def find_json_object(text: str) -> str | None:
    match = JSON_RE.search(text)
    return match.group(0) if match else None


def normalize_state(value: str | None) -> str:
    if not isinstance(value, str):
        return "crisis"
    normalized = value.strip().lower()
    if normalized in {"calm", "alert", "crisis"}:
        return normalized
    if normalized in {"stable", "steady", "ok", "okay"}:
        return "calm"
    if normalized in {"concern", "worry", "tense", "anxious"}:
        return "alert"
    return "crisis"


def normalize_score(value) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and 0 < value <= 1:
            value = round(value * 100)
        return max(0, min(100, int(round(value))))
    if isinstance(value, str):
        cleaned = re.sub(r"[^0-9.\-]", "", value)
        if not cleaned:
            return None
        try:
            parsed = float(cleaned)
            if 0 <= parsed <= 1:
                parsed = parsed * 100
            return max(0, min(100, int(round(parsed))))
        except ValueError:
            return None
    return None


def extract_json_payload(text: str) -> dict:
    if not text:
        raise ValueError("Empty response text")
    candidate = find_json_object(text)
    if candidate:
        return json.loads(candidate)
    return json.loads(text)


@app.route("/api/resilience-score", methods=["POST"])
def resilience_score():
    payload = request.get_json(silent=True)
    if not payload or not isinstance(payload, dict):
        return jsonify({"error": "Request body must be JSON."}), 400

    raw_text = payload.get("text")
    if not isinstance(raw_text, str) or not raw_text.strip():
        return jsonify({"error": "Request body must include non-empty `text`."}), 400

    user_text = raw_text.strip()
    prompt = f"""
Assess the following journal entry for psychological resilience.
Return ONLY valid JSON with keys: score, state, reasoning.
Use score 0-100 and state as calm, alert, or crisis.

User entry:
""" + user_text + """
"""

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_INSTRUCTION,
        )
        session = model.start_chat(history=[])
        response = session.send_message(prompt)
        raw_output = getattr(response, "text", str(response))

        parsed = extract_json_payload(raw_output)
        score = normalize_score(parsed.get("score") if isinstance(parsed, dict) else None)
        state = normalize_state(parsed.get("state") if isinstance(parsed, dict) else None)
        reasoning = parsed.get("reasoning") if isinstance(parsed, dict) else None

        if score is None:
            raise ValueError("Could not parse numeric score from Gemini response.")

        response_payload = {
            "score": score,
            "state": state,
            "reasoning": reasoning if isinstance(reasoning, str) else "",
            "raw": raw_output,
        }
        return jsonify(response_payload)

    except json.JSONDecodeError as exc:
        return jsonify({
            "error": "Could not parse JSON from Gemini response.",
            "raw_response": raw_output,
            "message": str(exc),
        }), 502
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
