import json
from typing import Any, Dict, Optional

from google import genai

from app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def _build_personalization_block(
    resume_context: Optional[str],
    job_description_context: Optional[str],
) -> str:
    sections = []
    if resume_context:
        sections.append("Candidate resume context:\n" + resume_context)
    if job_description_context:
        sections.append("Target job description context:\n" + job_description_context)

    if not sections:
        return "No resume or job description context was provided."

    return "\n\n".join(sections)


def _build_planner_block(planner_state: Optional[Dict[str, Any]]) -> str:
    if not planner_state:
        return "No hidden interview plan was provided."

    return json.dumps(planner_state, ensure_ascii=False)


def _build_followup_block(followup_context: Optional[Dict[str, Any]]) -> str:
    if not followup_context:
        return "No adaptive follow-up decision was provided."

    return json.dumps(followup_context, ensure_ascii=False)


def generate_gemini_first_question(
    interview_type: str,
    role: str,
    difficulty: str,
    resume_context: Optional[str] = None,
    job_description_context: Optional[str] = None,
    planner_state: Optional[Dict[str, Any]] = None,
) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    personalization_block = _build_personalization_block(
        resume_context,
        job_description_context,
    )
    planner_block = _build_planner_block(planner_state)
    style_guidance = (
        "Keep the tone warm, conversational, and human like an experienced HR interviewer."
        if interview_type.lower() == "hr_voice"
        else "Keep the tone professional and concise."
    )

    prompt = f"""
You are a professional AI mock interviewer.
Ask exactly one interview question.
Do not include feedback or explanation.
If resume or job description context is provided, tailor the question to it.
If a hidden interview plan is provided, use it to choose the best opening focus.
{style_guidance}

Interview type: {interview_type}
Target role: {role}
Difficulty: {difficulty}
Personalization context:
{personalization_block}
Hidden interview plan:
{planner_block}

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
    resume_context: Optional[str] = None,
    job_description_context: Optional[str] = None,
    planner_state: Optional[Dict[str, Any]] = None,
    followup_context: Optional[Dict[str, Any]] = None,
) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    transcript_lines = []
    for msg in conversation_messages:
        speaker = "Interviewer" if msg.sender == "ai" else "Candidate"
        transcript_lines.append(f"{speaker}: {msg.message}")

    transcript = "\n".join(transcript_lines)
    personalization_block = _build_personalization_block(
        resume_context,
        job_description_context,
    )
    planner_block = _build_planner_block(planner_state)
    followup_block = _build_followup_block(followup_context)
    style_guidance = (
        "Keep the tone warm, conversational, and human like an experienced HR interviewer. Favor natural back-and-forth wording."
        if interview_type.lower() == "hr_voice"
        else "Keep the tone professional and concise."
    )

    prompt = f"""
You are a professional AI mock interviewer.
Ask exactly one strong next follow-up question.
Make it relevant to the candidate's previous answer.
If personalization context is provided, align the follow-up with the candidate's background and the target role.
If a hidden interview plan is provided, use it to decide which competency, resume story, or job priority should be covered next.
If an adaptive follow-up decision is provided, it should strongly influence the next question.
Do not provide feedback.
Return only the next question.
{style_guidance}

Interview type: {interview_type}
Target role: {role}
Difficulty: {difficulty}
Personalization context:
{personalization_block}
Hidden interview plan:
{planner_block}
Adaptive follow-up decision:
{followup_block}

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