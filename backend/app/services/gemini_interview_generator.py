from google import genai

from app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_gemini_first_question(interview_type: str, role: str, difficulty: str) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    prompt = f"""
You are a professional AI mock interviewer.
Ask exactly one interview question.
Do not include feedback or explanation.

Interview type: {interview_type}
Target role: {role}
Difficulty: {difficulty}

Return only the question.
""".strip()

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )

    text = (response.text or "").strip()
    if not text:
        raise ValueError("Gemini returned an empty first question")
    return text


def generate_gemini_followup_question(
    interview_type: str,
    role: str,
    difficulty: str,
    conversation_messages: list,
) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    transcript_lines = []
    for msg in conversation_messages:
        speaker = "Interviewer" if msg.sender == "ai" else "Candidate"
        transcript_lines.append(f"{speaker}: {msg.message}")

    transcript = "\n".join(transcript_lines)

    prompt = f"""
You are a professional AI mock interviewer.
Ask exactly one strong next follow-up question.
Make it relevant to the candidate's previous answer.
Do not provide feedback.
Return only the next question.

Interview type: {interview_type}
Target role: {role}
Difficulty: {difficulty}

Transcript:
{transcript}
""".strip()

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )

    text = (response.text or "").strip()
    if not text:
        raise ValueError("Gemini returned an empty follow-up question")
    return text


def generate_gemini_feedback(role: str, difficulty: str, conversation_messages: list) -> dict:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    transcript_lines = []
    for msg in conversation_messages:
        speaker = "Interviewer" if msg.sender == "ai" else "Candidate"
        transcript_lines.append(f"{speaker}: {msg.message}")

    transcript = "\n".join(transcript_lines)

    prompt = f"""
You are an interview evaluator.

Evaluate the candidate for a {difficulty} {role} interview.
Return ONLY valid JSON with exactly these keys:
overall_score, communication_score, technical_score,
problem_solving_score, confidence_score,
strengths, improvements, summary

Rules:
- scores must be integers from 0 to 100
- strengths must be a string
- improvements must be a string
- summary must be a string

Transcript:
{transcript}
""".strip()

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )

    import json

    text = (response.text or "").strip()
    if not text:
        raise ValueError("Gemini returned empty feedback")

    return json.loads(text)