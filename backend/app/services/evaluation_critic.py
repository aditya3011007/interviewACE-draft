import json
import re
from typing import Any, Dict, List

from google import genai

from app.core.config import settings

MODEL_NAME = "gemini-3-flash-preview"

client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None

LOW_SIGNAL_ANSWERS = {
    "idk",
    "i dont know",
    "i don't know",
    "not sure",
    "no idea",
    "skip",
    "n/a",
    "none",
    "nothing",
    "dont know",
    "don't know",
}


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


def _fallback_critic(
    question: str,
    answer: str,
    first_pass: Dict[str, Any],
) -> Dict[str, Any]:
    data = dict(first_pass)
    answer_clean = (answer or "").strip()
    answer_lower = answer_clean.lower()
    word_count = len(answer_clean.split())
    answer_mentions_question = False

    for keyword in re.findall(r"[a-zA-Z]{5,}", question.lower()):
        if keyword in answer_lower:
            answer_mentions_question = True
            break

    summary_parts = []

    if answer_lower in LOW_SIGNAL_ANSWERS or word_count <= 3:
        data["overall_score"] = min(int(data["overall_score"]), 18)
        data["communication_score"] = min(int(data["communication_score"]), 12)
        data["technical_score"] = min(int(data["technical_score"]), 15)
        data["structure_score"] = min(int(data["structure_score"]), 12)
        data["confidence_score"] = min(int(data["confidence_score"]), 12)
        data["relevance_score"] = min(int(data["relevance_score"]), 15)
        data["improvements"] = (
            data["improvements"].strip()
            + " The answer was too short to justify a higher score."
        ).strip()
        summary_parts.append("The critic heavily penalized the answer because it contained almost no evidence.")
    elif word_count <= 10 and int(data["overall_score"]) > 45:
        data["overall_score"] = 45
        summary_parts.append("The critic reduced the score because the answer was too short for a strong rating.")

    if not answer_mentions_question and int(data["relevance_score"]) > 50:
        data["relevance_score"] = 45
        data["overall_score"] = min(int(data["overall_score"]), 50)
        data["improvements"] = (
            data["improvements"].strip()
            + " The answer should address the exact question more directly."
        ).strip()
        summary_parts.append("The critic lowered relevance because the answer did not clearly address the prompt.")

    recommendations = list(data.get("recommended_topics") or [])
    if int(data["technical_score"]) < 60 and "System design tradeoffs" not in recommendations:
        recommendations.append("System design tradeoffs")
    if int(data["relevance_score"]) < 60 and "Staying tightly aligned with the interview question" not in recommendations:
        recommendations.append("Staying tightly aligned with the interview question")
    if int(data["confidence_score"]) < 60 and "Using stronger ownership language in interview answers" not in recommendations:
        recommendations.append("Using stronger ownership language in interview answers")

    data["recommended_topics"] = recommendations[:6]
    data["critic_summary"] = " ".join(summary_parts).strip() or (
        "The critic accepted the first-pass evaluation with only minor guardrail adjustments."
    )
    return data


def critique_evaluation(
    question: str,
    answer: str,
    first_pass: Dict[str, Any],
    interview_type: str,
    role: str,
    difficulty: str,
) -> Dict[str, Any]:
    fallback = _fallback_critic(question, answer, first_pass)

    if client is None or not settings.GEMINI_API_KEY:
        return fallback

    prompt = f"""
You are an evaluation critic for a mock interview platform.
Review a first-pass answer evaluation and determine whether it is too generous or too weak.
Return ONLY valid JSON.

Interview type: {interview_type}
Role: {role}
Difficulty: {difficulty}

Question:
{question}

Candidate answer:
{answer}

First-pass evaluation:
{json.dumps(first_pass, ensure_ascii=False)}

Return ONLY valid JSON with exactly these keys:
overall_score
communication_score
technical_score
structure_score
confidence_score
relevance_score
strengths
improvements
missed_opportunities
ideal_answer
code_quality_score
code_feedback
recommended_topics
critic_summary

Rules:
- all score fields except code_quality_score must be integers from 0 to 100
- code_quality_score may be null or an integer from 0 to 100
- lower the score if the answer is too short or vague for the current rating
- lower relevance if the answer does not address the question
- strengthen improvements or recommendations when weak areas were understated
- keep strengths/improvements/missed_opportunities/ideal_answer as strings
- code_feedback and critic_summary must be strings
- recommended_topics must be an array of short strings
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
        for key in [
            "overall_score",
            "communication_score",
            "technical_score",
            "structure_score",
            "confidence_score",
            "relevance_score",
        ]:
            data[key] = int(data[key])

        if data.get("code_quality_score") is not None:
            data["code_quality_score"] = int(data["code_quality_score"])

        data["recommended_topics"] = _force_list(
            data.get("recommended_topics"),
            fallback=list(fallback.get("recommended_topics") or []),
            limit=6,
        )

        if not str(data.get("critic_summary", "")).strip():
            data["critic_summary"] = fallback["critic_summary"]

        return data
    except Exception:
        return fallback
