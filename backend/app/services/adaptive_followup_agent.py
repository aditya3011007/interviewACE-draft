import json
import re
from typing import Any, Dict, List, Optional

from google import genai

from app.core.config import settings

MODEL_NAME = "gemini-3-flash-preview"

client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None

ALLOWED_MOVES = [
    "go_deeper",
    "switch_topic",
    "ask_tradeoffs",
    "ask_metrics",
    "challenge_vague_answer",
    "probe_jd_gap",
]


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _force_list(values: Any, limit: int = 6) -> List[str]:
    if not isinstance(values, list):
        return []

    cleaned = []
    for value in values:
        text = str(value).strip()
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned[:limit]


def _fallback_followup_decision(
    latest_answer: str,
    latest_evaluation: Dict[str, Any],
    planner_state: Optional[Dict[str, Any]],
    comparison_context: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    overall_score = int(latest_evaluation.get("overall_score", 0))
    answer_length = len((latest_answer or "").split())
    gap_areas = []
    if comparison_context:
        gap_areas = _force_list(comparison_context.get("gap_areas"), limit=4)

    planner_gaps = []
    if planner_state:
        planner_gaps = _force_list(planner_state.get("job_description_priorities"), limit=4)

    target_focus = ""
    if gap_areas:
        target_focus = gap_areas[0]
    elif planner_gaps:
        target_focus = planner_gaps[0]

    if answer_length <= 10 or overall_score <= 35:
        move = "challenge_vague_answer"
        rationale = (
            "The answer did not provide enough evidence or depth, so the next move should demand specifics."
        )
    elif latest_evaluation.get("relevance_score", 0) < 55:
        move = "switch_topic"
        rationale = (
            "The answer drifted from the question, so the interview should reset to a clearer target area."
        )
    elif latest_evaluation.get("technical_score", 0) < 60:
        move = "ask_tradeoffs"
        rationale = (
            "The answer needs stronger implementation judgment, so tradeoffs are the best next probe."
        )
    elif latest_evaluation.get("confidence_score", 0) < 60:
        move = "ask_metrics"
        rationale = (
            "The answer needs stronger ownership and impact evidence, so metrics should be requested next."
        )
    elif target_focus:
        move = "probe_jd_gap"
        rationale = (
            "The interview should cover a job-specific gap to keep the session aligned with the target role."
        )
    else:
        move = "go_deeper"
        rationale = (
            "The answer was solid enough to justify a deeper follow-up on the same topic."
        )

    return {
        "move": move,
        "rationale": rationale,
        "target_focus": target_focus or "current topic",
        "question_goal": (
            "Use the chosen move to gather stronger evidence, clearer tradeoffs, or better alignment with the job target."
        ),
    }


def choose_followup_strategy(
    interview_type: str,
    role: str,
    difficulty: str,
    conversation_messages: List[Any],
    latest_answer: str,
    latest_evaluation: Dict[str, Any],
    planner_state: Optional[Dict[str, Any]] = None,
    resume_context: str = "",
    job_description_context: str = "",
    comparison_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    fallback = _fallback_followup_decision(
        latest_answer,
        latest_evaluation,
        planner_state,
        comparison_context,
    )

    if client is None or not settings.GEMINI_API_KEY:
        return fallback

    transcript_lines = []
    for msg in conversation_messages[-10:]:
        speaker = "Interviewer" if msg.sender == "ai" else "Candidate"
        transcript_lines.append(f"{speaker}: {msg.message}")

    prompt = f"""
You are an adaptive follow-up agent for a mock interview.
Decide the best next interview move after the candidate's latest answer.
Return ONLY valid JSON.

Interview type: {interview_type}
Target role: {role}
Difficulty: {difficulty}

Resume context:
{resume_context or "No resume context provided."}

Job description context:
{job_description_context or "No job description context provided."}

Planner state:
{json.dumps(planner_state or {}, ensure_ascii=False)}

Resume-vs-JD comparison:
{json.dumps(comparison_context or {}, ensure_ascii=False)}

Latest evaluation:
{json.dumps(latest_evaluation, ensure_ascii=False)}

Recent transcript:
{chr(10).join(transcript_lines) or "No transcript available."}

Return ONLY valid JSON with exactly these keys:
move
rationale
target_focus
question_goal

Rules:
- move must be one of: {", ".join(ALLOWED_MOVES)}
- rationale must be a short string
- target_focus must be a short string
- question_goal must be a short string
- if the answer is vague or low-evidence, prefer challenge_vague_answer or ask_metrics
- if a JD gap remains important, probe_jd_gap is allowed
- do not include markdown
- do not include code fences
""".strip()

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
        )
        text = _strip_code_fences((response.text or "").strip())
        if not text:
            return fallback

        data = json.loads(text)
        move = str(data.get("move", "")).strip()
        if move not in ALLOWED_MOVES:
            return fallback

        return {
            "move": move,
            "rationale": str(data.get("rationale", "")).strip() or fallback["rationale"],
            "target_focus": str(data.get("target_focus", "")).strip()
            or fallback["target_focus"],
            "question_goal": str(data.get("question_goal", "")).strip()
            or fallback["question_goal"],
        }
    except Exception:
        return fallback
