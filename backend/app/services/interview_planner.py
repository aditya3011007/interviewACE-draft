import json
import re
from typing import Any, Dict, List, Optional

from google import genai

from app.core.config import settings

MODEL_NAME = "gemini-3-flash-preview"

client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None


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


def _build_fallback_plan(
    interview_type: str,
    role: str,
    difficulty: str,
    comparison_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    role_lower = role.lower()
    competencies = []
    if interview_type.lower() == "behavioral":
        competencies.extend([
            "ownership and execution",
            "communication clarity",
            "decision-making under pressure",
        ])
    elif "ml" in role_lower:
        competencies.extend([
            "modeling tradeoffs",
            "production ML systems",
            "metrics and impact",
        ])
    elif "data engineer" in role_lower:
        competencies.extend([
            "pipeline design",
            "reliability and scale",
            "data modeling tradeoffs",
        ])
    elif "full stack" in role_lower:
        competencies.extend([
            "frontend-backend tradeoffs",
            "system design judgment",
            "product execution",
        ])
    else:
        competencies.extend([
            "system design tradeoffs",
            "implementation depth",
            "metrics and impact",
        ])

    resume_stories = []
    if comparison_context:
        resume_stories.extend(_force_list(comparison_context.get("match_areas"), limit=3))
        if not resume_stories:
            resume_stories.extend(_force_list(comparison_context.get("gap_areas"), limit=2))
    if not resume_stories:
        resume_stories = [
            "a project with clear ownership",
            "a technically challenging implementation",
            "a result with measurable impact",
        ]

    jd_priorities = []
    if comparison_context:
        jd_priorities.extend(_force_list(comparison_context.get("gap_areas"), limit=3))
        jd_priorities.extend(_force_list(comparison_context.get("match_areas"), limit=2))
    if not jd_priorities:
        jd_priorities = [
            "role-specific technical depth",
            "communication under pressure",
            "clear tradeoff reasoning",
        ]

    question_order = [
        "start with strongest resume-to-role overlap",
        "probe one core competency in depth",
        "cover at least one job-specific gap area",
        "end with metrics, tradeoffs, or ownership evidence",
    ]

    return {
        "interview_type": interview_type,
        "role": role,
        "difficulty": difficulty,
        "competencies_to_test": competencies[:4],
        "resume_stories_to_probe": resume_stories[:4],
        "job_description_priorities": jd_priorities[:4],
        "question_order": question_order,
        "weak_answer_escalation_rules": [
            "ask for metrics when the answer is vague",
            "ask for tradeoffs when the approach sounds one-dimensional",
            "challenge ownership when actions are unclear",
            "switch topics after one weak follow-up if evidence stays shallow",
        ],
        "opening_focus": (
            "Start with the strongest resume story that overlaps with the target role and use it to establish confidence early."
        ),
    }


def _build_planner_prompt(
    interview_type: str,
    role: str,
    difficulty: str,
    resume_context: str,
    job_description_context: str,
    comparison_context: Optional[Dict[str, Any]],
) -> str:
    comparison_block = "No resume-vs-JD comparison context was provided."
    if comparison_context:
        comparison_block = json.dumps(comparison_context, ensure_ascii=False)

    return f"""
You are an interview planning agent for a mock interview platform.
Create a hidden interview plan before the interview starts.
Return ONLY valid JSON.

Interview type: {interview_type}
Target role: {role}
Difficulty: {difficulty}

Resume context:
{resume_context or "No resume context provided."}

Job description context:
{job_description_context or "No job description context provided."}

Resume-vs-JD comparison:
{comparison_block}

Return ONLY valid JSON with exactly these keys:
interview_type
role
difficulty
competencies_to_test
resume_stories_to_probe
job_description_priorities
question_order
weak_answer_escalation_rules
opening_focus

Rules:
- competencies_to_test must be an array of 3-4 concise strings
- resume_stories_to_probe must be an array of 2-4 concise strings
- job_description_priorities must be an array of 2-4 concise strings
- question_order must be an array of 3-5 concise sequencing steps
- weak_answer_escalation_rules must be an array of 3-5 concise strings
- opening_focus must be a short string
- keep the plan specific to the role and available profile context
- do not include markdown
- do not include code fences
""".strip()


def build_interview_plan(
    interview_type: str,
    role: str,
    difficulty: str,
    resume_context: str = "",
    job_description_context: str = "",
    comparison_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    fallback_plan = _build_fallback_plan(
        interview_type,
        role,
        difficulty,
        comparison_context=comparison_context,
    )

    if client is None or not settings.GEMINI_API_KEY:
        return fallback_plan

    prompt = _build_planner_prompt(
        interview_type,
        role,
        difficulty,
        resume_context,
        job_description_context,
        comparison_context,
    )

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
        )
        text = _strip_code_fences((response.text or "").strip())
        if not text:
            return fallback_plan

        data = json.loads(text)
        return {
            "interview_type": interview_type,
            "role": role,
            "difficulty": difficulty,
            "competencies_to_test": _force_list(
                data.get("competencies_to_test"),
                limit=4,
            )
            or fallback_plan["competencies_to_test"],
            "resume_stories_to_probe": _force_list(
                data.get("resume_stories_to_probe"),
                limit=4,
            )
            or fallback_plan["resume_stories_to_probe"],
            "job_description_priorities": _force_list(
                data.get("job_description_priorities"),
                limit=4,
            )
            or fallback_plan["job_description_priorities"],
            "question_order": _force_list(
                data.get("question_order"),
                limit=5,
            )
            or fallback_plan["question_order"],
            "weak_answer_escalation_rules": _force_list(
                data.get("weak_answer_escalation_rules"),
                limit=5,
            )
            or fallback_plan["weak_answer_escalation_rules"],
            "opening_focus": str(data.get("opening_focus", "")).strip()
            or fallback_plan["opening_focus"],
        }
    except Exception:
        return fallback_plan
