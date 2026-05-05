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
  - reply: a short compassionate assistant response suitable for the user
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


HIGH_RISK_PATTERNS = [
    r"\bkill myself\b",
    r"\bkill me\b",
    r"\bshoot myself\b",
    r"\bhang myself\b",
    r"\bpoison myself\b",
    r"\bend my life\b",
    r"\bend it all\b",
    r"\bwant to die\b",
    r"\bwant to end my life\b",
    r"\bwould rather die\b",
    r"\bshould just die\b",
    r"\bI(?:'m| am|m)? going to kill myself\b",
    r"\bI(?:'m| am|m)? going to end my life\b",
    r"\bI(?:'m| am|m)? going to hurt myself\b",
    r"\bI(?:'m| am|m)? going to kill myself\b",
    r"\bi( am|\b|'m)? done living\b",
    r"\bI'm done\b",
    r"\bi don't want to live\b",
    r"\bi wish i was dead\b",
    r"\bi want out\b",
    r"\bself[- ]harm\b",
    r"\bsuicid(al|e)\b",
]
RISK_RE = re.compile("|".join(HIGH_RISK_PATTERNS), re.I)


def is_imminent_risk(text: str) -> bool:
    return bool(RISK_RE.search(text))


def crisis_fallback_reply() -> str:
    return (
        "I hear that you are feeling extremely unsafe right now. "
        "If you can, please contact local emergency services or a crisis hotline immediately. "
        "You are not alone, and it is important to get help right now."
    )


def override_high_risk(parsed: dict, raw_output: str) -> dict:
    score = 0
    state = "crisis"
    reasoning = parsed.get("reasoning") if isinstance(parsed.get("reasoning"), str) else None
    reply = parsed.get("reply") or parsed.get("response") or parsed.get("message")
    if not isinstance(reply, str) or not reply.strip():
        reply = crisis_fallback_reply()
    return {
        "score": score,
        "state": state,
        "reasoning": reasoning or "Detected language indicating imminent self-harm or suicidal intent.",
        "reply": reply.strip(),
        "raw": raw_output,
    }


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
    high_risk = is_imminent_risk(user_text)

    prompt = f"""
Assess the following journal entry for psychological resilience.
Return ONLY valid JSON with keys: score, state, reasoning, reply.
Use score 0-100 and state as calm, alert, or crisis.
Write a short compassionate assistant response in the reply field.

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
        if not isinstance(parsed, dict):
            raise ValueError("Gemini response did not contain a JSON object.")

        if high_risk:
            return jsonify(override_high_risk(parsed, raw_output))

        score = normalize_score(parsed.get("score"))
        state = normalize_state(parsed.get("state") if isinstance(parsed.get("state"), str) else None)
        reasoning = parsed.get("reasoning") if isinstance(parsed.get("reasoning"), str) else ""
        reply = None
        if isinstance(parsed, dict) :
            const_reply = parsed.get("reply") or parsed.get("response") or parsed.get("message")
            if isinstance(const_reply, str):
                reply = const_reply.strip()

        if score is None:
            raise ValueError("Could not parse numeric score from Gemini response.")

        response_payload = {
            "score": score,
            "state": state,
            "reasoning": reasoning,
            "reply": reply if isinstance(reply, str) else "",
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
