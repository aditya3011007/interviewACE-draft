from openai import OpenAI

from app.core.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)


def _safe_output_text(response) -> str:
    text = getattr(response, "output_text", None)
    if text:
        return text.strip()

    # Defensive fallback if SDK shape changes slightly
    try:
        parts = []
        for item in response.output:
            if getattr(item, "type", None) == "message":
                for content in getattr(item, "content", []):
                    if getattr(content, "type", None) in ("output_text", "text"):
                        parts.append(getattr(content, "text", ""))
        return "\n".join([p for p in parts if p]).strip()
    except Exception:
        return ""


def generate_openai_first_question(
    interview_type: str,
    role: str,
    difficulty: str,
) -> str:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured")

    response = client.responses.create(
        model="gpt-4.1-mini",
        instructions=(
            "You are a professional AI mock interviewer. "
            "Ask exactly one interview question. "
            "Do not include feedback, explanation, or multiple questions. "
            "Keep the wording realistic and concise."
        ),
        input=(
            f"Generate the first question for a mock interview.\n"
            f"Interview type: {interview_type}\n"
            f"Target role: {role}\n"
            f"Difficulty: {difficulty}\n"
            f"Return only the question."
        ),
    )

    question = _safe_output_text(response)
    if not question:
        raise ValueError("OpenAI returned an empty first question")

    return question


def generate_openai_followup_question(
    interview_type: str,
    role: str,
    difficulty: str,
    conversation_messages: list,
) -> str:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured")

    transcript_lines = []
    for msg in conversation_messages:
        speaker = "Interviewer" if msg.sender == "ai" else "Candidate"
        transcript_lines.append(f"{speaker}: {msg.message}")

    transcript = "\n".join(transcript_lines)

    response = client.responses.create(
        model="gpt-4.1-mini",
        instructions=(
            "You are a professional AI mock interviewer. "
            "Given the ongoing interview transcript, ask exactly one strong next follow-up question. "
            "The question should be context-aware, relevant to the candidate's prior answer, "
            "and suitable for the specified interview type, role, and difficulty. "
            "Do not provide feedback. Do not ask multiple questions. Return only the next question."
        ),
        input=(
            f"Interview type: {interview_type}\n"
            f"Target role: {role}\n"
            f"Difficulty: {difficulty}\n\n"
            f"Transcript so far:\n{transcript}\n\n"
            f"Return only the next interviewer question."
        ),
    )

    question = _safe_output_text(response)
    if not question:
        raise ValueError("OpenAI returned an empty follow-up question")

    return question


def generate_openai_feedback(
    role: str,
    difficulty: str,
    conversation_messages: list,
) -> dict:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured")

    transcript_lines = []
    for msg in conversation_messages:
        speaker = "Interviewer" if msg.sender == "ai" else "Candidate"
        transcript_lines.append(f"{speaker}: {msg.message}")

    transcript = "\n".join(transcript_lines)

    response = client.responses.create(
        model="gpt-4.1-mini",
        instructions=(
            "You are an interview evaluator. "
            "Evaluate the candidate based on the transcript and return JSON only. "
            "Use these keys exactly: "
            "overall_score, communication_score, technical_score, problem_solving_score, confidence_score, "
            "strengths, improvements, summary. "
            "Scores must be integers from 0 to 100. "
            "strengths, improvements, and summary must be plain strings."
        ),
        input=(
            f"Role: {role}\n"
            f"Difficulty: {difficulty}\n\n"
            f"Transcript:\n{transcript}\n\n"
            f"Return valid JSON only."
        ),
        text={
            "format": {
                "type": "json_schema",
                "name": "interview_feedback",
                "schema": {
                    "type": "object",
                    "properties": {
                        "overall_score": {"type": "integer"},
                        "communication_score": {"type": "integer"},
                        "technical_score": {"type": "integer"},
                        "problem_solving_score": {"type": "integer"},
                        "confidence_score": {"type": "integer"},
                        "strengths": {"type": "string"},
                        "improvements": {"type": "string"},
                        "summary": {"type": "string"},
                    },
                    "required": [
                        "overall_score",
                        "communication_score",
                        "technical_score",
                        "problem_solving_score",
                        "confidence_score",
                        "strengths",
                        "improvements",
                        "summary",
                    ],
                    "additionalProperties": False,
                },
            }
        },
    )

    import json

    raw = _safe_output_text(response)
    if not raw:
        raise ValueError("OpenAI returned empty feedback")

    data = json.loads(raw)
    return data