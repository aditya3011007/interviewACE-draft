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


def _force_list(values: Any, fallback: List[str], limit: int = 6) -> List[str]:
    if not isinstance(values, list):
        return fallback[:limit]

    cleaned = []
    for value in values:
        text = str(value).strip()
        if text and text not in cleaned:
            cleaned.append(text)

    return cleaned[:limit] if cleaned else fallback[:limit]


def _build_fallback_report(
    role: str,
    comparison_context: Optional[Dict[str, Any]],
    planner_state: Optional[Dict[str, Any]],
    base_feedback: Dict[str, Any],
) -> Dict[str, Any]:
    matched_strengths = []
    risky_gaps = []
    best_stories = []
    practice_priorities = []

    if comparison_context:
        matched_strengths.extend(
            _force_list(
                comparison_context.get("match_areas"),
                fallback=[],
                limit=4,
            )
        )
        risky_gaps.extend(
            _force_list(
                comparison_context.get("interview_risk_zones"),
                fallback=[],
                limit=4,
            )
        )
        practice_priorities.extend(
            _force_list(
                comparison_context.get("gap_areas"),
                fallback=[],
                limit=4,
            )
        )

    if planner_state:
        best_stories.extend(
            _force_list(
                planner_state.get("resume_stories_to_probe"),
                fallback=[],
                limit=4,
            )
        )
        if not practice_priorities:
            practice_priorities.extend(
                _force_list(
                    planner_state.get("job_description_priorities"),
                    fallback=[],
                    limit=4,
                )
            )

    if not matched_strengths:
        matched_strengths = _force_list(
            base_feedback.get("standout_strengths"),
            fallback=["General communication strengths"],
            limit=4,
        )
    if not risky_gaps:
        risky_gaps = _force_list(
            base_feedback.get("weak_areas"),
            fallback=["Role-specific evidence gaps"],
            limit=4,
        )
    if not best_stories:
        best_stories = [
            "Use the strongest project with clear ownership, technical tradeoffs, and measurable impact."
        ]
    if not practice_priorities:
        practice_priorities = _force_list(
            base_feedback.get("recommended_topics"),
            fallback=["Role-specific interview practice"],
            limit=4,
        )

    return {
        "resume_jd_alignment_summary": (
            f"For this {role} target, the strongest fit appears in {', '.join(matched_strengths[:2]).lower()}, "
            f"while the main risk areas are {', '.join(risky_gaps[:2]).lower()}."
        ),
        "matched_strengths_for_job": matched_strengths[:4],
        "risky_gaps": risky_gaps[:4],
        "best_interview_stories": best_stories[:4],
        "next_practice_priorities": practice_priorities[:4],
    }


def synthesize_final_report(
    interview_type: str,
    role: str,
    difficulty: str,
    evaluations: List[Dict[str, Any]],
    planner_state: Optional[Dict[str, Any]],
    comparison_context: Optional[Dict[str, Any]],
    base_feedback: Dict[str, Any],
) -> Dict[str, Any]:
    fallback = _build_fallback_report(
        role,
        comparison_context,
        planner_state,
        base_feedback,
    )

    if client is None or not settings.GEMINI_API_KEY:
        return fallback

    prompt = f"""
You are a report synthesizer agent for a mock interview platform.
Create job-specific final report sections from interview evidence.
Return ONLY valid JSON.

Interview type: {interview_type}
Role: {role}
Difficulty: {difficulty}

Base feedback:
{json.dumps(base_feedback, ensure_ascii=False)}

Planner state:
{json.dumps(planner_state or {}, ensure_ascii=False)}

Resume-vs-JD comparison:
{json.dumps(comparison_context or {}, ensure_ascii=False)}

Per-answer evaluations:
{json.dumps(evaluations, ensure_ascii=False)}

Return ONLY valid JSON with exactly these keys:
resume_jd_alignment_summary
matched_strengths_for_job
risky_gaps
best_interview_stories
next_practice_priorities

Rules:
- resume_jd_alignment_summary must be a string
- all list fields must be arrays of short strings
- matched_strengths_for_job should focus on strengths that actually fit this target job
- risky_gaps should focus on job risk, not generic advice
- best_interview_stories should be concrete story prompts or themes the candidate should use in real interviews
- next_practice_priorities should be the highest-leverage next steps
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
        return {
            "resume_jd_alignment_summary": str(
                data.get("resume_jd_alignment_summary", "")
            ).strip()
            or fallback["resume_jd_alignment_summary"],
            "matched_strengths_for_job": _force_list(
                data.get("matched_strengths_for_job"),
                fallback=fallback["matched_strengths_for_job"],
                limit=4,
            ),
            "risky_gaps": _force_list(
                data.get("risky_gaps"),
                fallback=fallback["risky_gaps"],
                limit=4,
            ),
            "best_interview_stories": _force_list(
                data.get("best_interview_stories"),
                fallback=fallback["best_interview_stories"],
                limit=4,
            ),
            "next_practice_priorities": _force_list(
                data.get("next_practice_priorities"),
                fallback=fallback["next_practice_priorities"],
                limit=4,
            ),
        }
    except Exception:
        return fallback
