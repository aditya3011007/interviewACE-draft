import json
import re
from statistics import mean
from typing import Dict, List

from google import genai

from app.core.config import settings

MODEL_NAME = "gemini-3-flash-preview"

client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None

STOPWORDS = {
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "it", "that", "this", "as",
    "at", "by", "from", "about", "into", "your", "you", "i", "we", "our",
    "their", "they", "them", "how", "what", "why", "when", "where",
}

ACTION_VERBS = {
    "built", "implemented", "designed", "optimized", "deployed", "led",
    "improved", "reduced", "scaled", "created", "developed", "debugged",
    "migrated", "evaluated", "trained", "automated", "integrated",
}

STRUCTURE_MARKERS = {
    "first", "second", "third", "finally", "because", "therefore",
    "tradeoff", "approach", "result", "outcome", "impact",
}

STAR_MARKERS = {
    "situation", "task", "action", "result", "challenge", "responsibility",
}

TECH_KEYWORDS = {
    "api", "database", "model", "pipeline", "system", "architecture",
    "latency", "scaling", "frontend", "backend", "deployment",
    "training", "inference", "etl", "stream", "authentication",
    "authorization", "cache", "queue", "index", "monitoring",
    "docker", "cloud", "kafka", "redis", "sql", "nosql",
}

LOW_SIGNAL_ANSWERS = {
    "idk", "i dont know", "i don't know", "not sure", "no idea",
    "skip", "n/a", "none", "nothing", "dont know", "don't know",
}


def _clamp_score(value: int, low: int = 5, high: int = 95) -> int:
    return max(low, min(high, int(value)))


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _keyword_overlap(question: str, answer: str) -> int:
    q_words = {
        word for word in re.findall(r"[a-zA-Z]{4,}", question.lower())
        if word not in STOPWORDS
    }
    a_words = set(re.findall(r"[a-zA-Z]{4,}", answer.lower()))

    if not q_words:
        return 0

    return len(q_words.intersection(a_words))


def _force_nonempty_list(values: List[str], fallback: List[str], limit: int = 6) -> List[str]:
    cleaned = []
    for value in values:
        value = str(value).strip()
        if value and value not in cleaned:
            cleaned.append(value)
    if cleaned:
        return cleaned[:limit]
    return fallback[:limit]


def _recommended_topics_from_dimensions(
    interview_type: str,
    role: str,
    technical_score: int,
    structure_score: int,
    confidence_score: int,
    relevance_score: int,
) -> List[str]:
    topics = []

    role_lower = role.lower()

    if technical_score < 72:
        if "ml" in role_lower:
            topics.extend([
                "Model evaluation metrics",
                "Production inference pipelines",
                "ML system design tradeoffs",
            ])
        elif "data engineer" in role_lower:
            topics.extend([
                "Streaming pipelines",
                "ETL vs ELT design",
                "Data storage tradeoffs",
            ])
        elif "full stack" in role_lower:
            topics.extend([
                "Authentication and authorization",
                "Frontend-backend architecture",
                "Performance optimization",
            ])
        else:
            topics.extend([
                "System design tradeoffs",
                "Backend architecture",
                "Scalability fundamentals",
            ])

    if structure_score < 72:
        topics.append("Answer structuring with clear step-by-step reasoning")

    if confidence_score < 72:
        topics.append("Using stronger ownership language in interview answers")

    if relevance_score < 72:
        topics.append("Staying tightly aligned with the interview question")

    if interview_type.lower() == "behavioral":
        topics.append("STAR-method storytelling")

    deduped = []
    for topic in topics:
        if topic not in deduped:
            deduped.append(topic)

    return deduped[:5]


def evaluate_answer_fallback(
    question: str,
    answer: str,
    interview_type: str,
    role: str,
    difficulty: str,
) -> Dict:
    answer_clean = answer.strip()
    answer_lower = answer_clean.lower()
    word_count = len(answer_clean.split())
    sentence_count = max(1, len(re.findall(r"[.!?]+", answer_clean)))
    overlap = _keyword_overlap(question, answer_clean)

    # Very weak starting point. Strong answers must earn score upward.
    communication_score = 25
    structure_score = 20
    technical_score = 20
    confidence_score = 20
    relevance_score = 20

    # Hard penalties for low-signal answers
    if answer_lower in LOW_SIGNAL_ANSWERS or word_count <= 3:
        communication_score -= 12
        structure_score -= 10
        technical_score -= 10
        confidence_score -= 12
        relevance_score -= 8
    elif word_count <= 8:
        communication_score -= 6
        structure_score -= 5
        technical_score -= 5
        confidence_score -= 6
        relevance_score -= 4
    elif word_count >= 20:
        communication_score += 12
        structure_score += 10
        confidence_score += 8
    elif word_count >= 35:
        communication_score += 20
        structure_score += 14
        confidence_score += 10

    if sentence_count >= 2:
        communication_score += 5
    if sentence_count >= 3:
        structure_score += 5

    structure_hits = sum(1 for marker in STRUCTURE_MARKERS if marker in answer_lower)
    structure_score += min(20, structure_hits * 4)

    if interview_type.lower() == "behavioral":
        star_hits = sum(1 for marker in STAR_MARKERS if marker in answer_lower)
        structure_score += min(18, star_hits * 5)

    tech_hits = sum(1 for keyword in TECH_KEYWORDS if keyword in answer_lower)
    technical_score += min(28, tech_hits * 4)

    action_hits = sum(1 for verb in ACTION_VERBS if verb in answer_lower)
    confidence_score += min(20, action_hits * 4)

    relevance_score += min(25, overlap * 5)

    # Extra harshness for "empty but longer filler" style answers
    if word_count > 0 and tech_hits == 0 and overlap == 0 and action_hits == 0 and structure_hits == 0:
        technical_score -= 8
        relevance_score -= 8
        structure_score -= 5

    communication_score = _clamp_score(communication_score)
    structure_score = _clamp_score(structure_score)
    technical_score = _clamp_score(technical_score)
    confidence_score = _clamp_score(confidence_score)
    relevance_score = _clamp_score(relevance_score)

    overall_score = round(
        mean([
            communication_score,
            structure_score,
            technical_score,
            confidence_score,
            relevance_score,
        ])
    )

    strengths_list = []
    improvements_list = []

    if communication_score >= 70:
        strengths_list.append("The answer was understandable and had some useful detail.")
    else:
        improvements_list.append("Provide more complete, specific detail instead of brief or vague responses.")

    if structure_score >= 70:
        strengths_list.append("The response followed a reasonably organized structure.")
    else:
        improvements_list.append("Organize the answer with a clearer flow: context, approach, and result.")

    if technical_score >= 70:
        strengths_list.append("Relevant technical ideas or implementation detail were included.")
    else:
        improvements_list.append("Use concrete technical concepts, tools, tradeoffs, or implementation details.")

    if confidence_score >= 70:
        strengths_list.append("The answer showed ownership and confidence.")
    else:
        improvements_list.append("Use stronger ownership language and explain what you personally did.")

    if relevance_score >= 70:
        strengths_list.append("The response stayed fairly aligned with the question.")
    else:
        improvements_list.append("Address the exact question more directly and avoid generic filler.")

    if not strengths_list:
        strengths_list.append("The candidate stayed engaged and attempted an answer.")

    if not improvements_list:
        improvements_list.append("Make the answer more precise, structured, and technically grounded.")

    if word_count <= 8:
        missed_opportunities = (
            "The answer was too short to demonstrate meaningful reasoning, depth, or technical judgment."
        )
    else:
        missed_opportunities = (
            "A stronger answer could have included clearer reasoning, stronger tradeoffs, and more specific impact."
        )

    if interview_type.lower() == "behavioral":
        ideal_answer = (
            "A stronger answer would briefly explain the situation, your specific responsibility, "
            "the actions you took, and the final measurable result."
        )
    else:
        ideal_answer = (
            "A stronger answer would define the problem clearly, explain the approach step by step, "
            "highlight important tradeoffs, and end with the result or impact."
        )

    recommended_topics = _recommended_topics_from_dimensions(
        interview_type,
        role,
        technical_score,
        structure_score,
        confidence_score,
        relevance_score,
    )

    # Force very weak responses to stay clearly weak
    if word_count <= 3 or answer_lower in LOW_SIGNAL_ANSWERS:
        overall_score = min(overall_score, 18)
    elif word_count <= 8:
        overall_score = min(overall_score, 32)
    elif word_count <= 15 and tech_hits == 0 and overlap <= 1:
        overall_score = min(overall_score, 45)

    return {
        "overall_score": overall_score,
        "communication_score": communication_score,
        "technical_score": technical_score,
        "structure_score": structure_score,
        "confidence_score": confidence_score,
        "relevance_score": relevance_score,
        "strengths": " ".join(strengths_list),
        "improvements": " ".join(improvements_list),
        "missed_opportunities": missed_opportunities,
        "ideal_answer": ideal_answer,
        "recommended_topics": recommended_topics,
    }


def evaluate_answer_with_gemini(
    question: str,
    answer: str,
    interview_type: str,
    role: str,
    difficulty: str,
) -> Dict:
    if not settings.GEMINI_API_KEY or client is None:
        raise ValueError("GEMINI_API_KEY is not configured")

    prompt = f"""
You are an expert interview evaluator.

Evaluate exactly one interview answer and return ONLY valid JSON.

Interview type: {interview_type}
Role: {role}
Difficulty: {difficulty}

Question:
{question}

Candidate answer:
{answer}

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
recommended_topics

Rules:
- all score fields must be integers from 0 to 100
- very short, vague, or low-effort answers should score low
- strengths must be a string
- improvements must be a string
- missed_opportunities must be a string
- ideal_answer must be a string
- recommended_topics must be an array of short strings
- no markdown
- no code fences
""".strip()

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    text = _strip_code_fences((response.text or "").strip())
    if not text:
        raise ValueError("Gemini returned empty evaluation")

    data = json.loads(text)

    required_keys = [
        "overall_score",
        "communication_score",
        "technical_score",
        "structure_score",
        "confidence_score",
        "relevance_score",
        "strengths",
        "improvements",
        "missed_opportunities",
        "ideal_answer",
        "recommended_topics",
    ]

    for key in required_keys:
        if key not in data:
            raise ValueError(f"Missing key in Gemini evaluation: {key}")

    for score_key in [
        "overall_score",
        "communication_score",
        "technical_score",
        "structure_score",
        "confidence_score",
        "relevance_score",
    ]:
        data[score_key] = int(data[score_key])

    if not isinstance(data["recommended_topics"], list):
        data["recommended_topics"] = []

    data["recommended_topics"] = _force_nonempty_list(
        [str(topic) for topic in data["recommended_topics"]],
        fallback=["Structured technical communication"],
        limit=6,
    )

    return data


def evaluate_answer(
    question: str,
    answer: str,
    interview_type: str,
    role: str,
    difficulty: str,
) -> Dict:
    try:
        data = evaluate_answer_with_gemini(
            question,
            answer,
            interview_type,
            role,
            difficulty,
        )

        # Guardrails even when Gemini is used
        answer_clean = answer.strip().lower()
        word_count = len(answer.strip().split())

        if answer_clean in LOW_SIGNAL_ANSWERS or word_count <= 3:
            data["overall_score"] = min(int(data["overall_score"]), 18)
        elif word_count <= 8:
            data["overall_score"] = min(int(data["overall_score"]), 32)

        return data
    except Exception:
        return evaluate_answer_fallback(
            question,
            answer,
            interview_type,
            role,
            difficulty,
        )


def build_session_feedback_fallback(
    evaluations: List[Dict],
    interview_type: str,
    role: str,
    difficulty: str,
) -> Dict:
    if not evaluations:
        return {
            "overall_score": 20,
            "communication_score": 20,
            "technical_score": 20,
            "problem_solving_score": 20,
            "confidence_score": 20,
            "strengths": "The session was started, but there was too little evidence to make a strong evaluation.",
            "improvements": "Complete more questions and provide detailed, structured answers with clearer technical depth.",
            "summary": f"This {difficulty} {interview_type} interview for a {role} role ended with insufficient evidence for a confident evaluation.",
            "standout_strengths": ["Initial engagement"],
            "weak_areas": ["Insufficient answer depth", "Incomplete interview"],
            "recommended_topics": ["Structured answering", "Question-focused responses"],
            "question_count": 0,
        }

    communication_score = round(mean([e["communication_score"] for e in evaluations]))
    technical_score = round(mean([e["technical_score"] for e in evaluations]))
    structure_score = round(mean([e["structure_score"] for e in evaluations]))
    confidence_score = round(mean([e["confidence_score"] for e in evaluations]))
    relevance_score = round(mean([e["relevance_score"] for e in evaluations]))

    problem_solving_score = round(mean([structure_score, relevance_score]))
    overall_score = round(
        mean([
            communication_score,
            technical_score,
            problem_solving_score,
            confidence_score,
        ])
    )

    standout_strengths = []
    weak_areas = []

    if communication_score >= 78:
        standout_strengths.append("Clear communication")
    else:
        weak_areas.append("Communication clarity")

    if technical_score >= 78:
        standout_strengths.append("Technical depth")
    else:
        weak_areas.append("Technical specificity")

    if problem_solving_score >= 78:
        standout_strengths.append("Structured reasoning")
    else:
        weak_areas.append("Tradeoff discussion and reasoning")

    if confidence_score >= 78:
        standout_strengths.append("Ownership and confidence")
    else:
        weak_areas.append("Ownership language and confidence")

    all_topics = []
    for e in evaluations:
        for topic in e.get("recommended_topics", []):
            if topic not in all_topics:
                all_topics.append(topic)

    question_count = len(evaluations)

    # Strict penalties for incomplete / low-evidence sessions
    avg_answer_words = round(
        mean([len(str(e["answer_text"]).split()) for e in evaluations])
    )

    if question_count <= 1:
        overall_score = min(overall_score, 35)
        communication_score = min(communication_score, 40)
        technical_score = min(technical_score, 35)
        problem_solving_score = min(problem_solving_score, 35)
        confidence_score = min(confidence_score, 40)
        weak_areas.extend(["Incomplete interview", "Insufficient evidence"])
    elif question_count == 2:
        overall_score = min(overall_score, 50)
        weak_areas.append("Limited interview coverage")

    if avg_answer_words <= 8:
        overall_score = min(overall_score, 25)
        weak_areas.extend(["Very short responses", "Low answer depth"])
    elif avg_answer_words <= 15:
        overall_score = min(overall_score, 45)
        weak_areas.append("Answer depth")

    standout_strengths = _force_nonempty_list(
        standout_strengths,
        fallback=["Initial engagement"],
        limit=4,
    )

    weak_areas = _force_nonempty_list(
        weak_areas,
        fallback=["Answer depth", "Interview completeness"],
        limit=5,
    )

    recommended_topics = _force_nonempty_list(
        all_topics,
        fallback=[
            "Structured technical communication",
            "Answering with examples and tradeoffs",
            "Completing full interview rounds",
        ],
        limit=6,
    )

    strengths = (
        "The session showed "
        + ", ".join(standout_strengths[:3]).lower()
        + "."
    )

    if question_count <= 1:
        improvements = (
            "The interview ended too early to support a strong evaluation. "
            "Complete more questions and provide fuller, more specific answers."
        )
        summary = (
            f"This {difficulty} {interview_type} interview for a {role} role ended after too little evidence "
            f"to support a confident assessment. The current score mainly reflects incomplete participation "
            f"and limited answer depth."
        )
    else:
        improvements = (
            "Primary areas to improve are "
            + ", ".join(weak_areas[:3]).lower()
            + "."
        )
        summary = (
            f"This {difficulty} {interview_type} interview for a {role} role resulted in an overall score of "
            f"{overall_score}/100. The strongest areas were {', '.join(standout_strengths[:2]).lower()}, "
            f"while the main improvement areas are {', '.join(weak_areas[:2]).lower()}."
        )

    return {
        "overall_score": overall_score,
        "communication_score": communication_score,
        "technical_score": technical_score,
        "problem_solving_score": problem_solving_score,
        "confidence_score": confidence_score,
        "strengths": strengths,
        "improvements": improvements,
        "summary": summary,
        "standout_strengths": standout_strengths,
        "weak_areas": weak_areas,
        "recommended_topics": recommended_topics,
        "question_count": question_count,
    }


def build_session_feedback_with_gemini(
    evaluations: List[Dict],
    interview_type: str,
    role: str,
    difficulty: str,
) -> Dict:
    if not settings.GEMINI_API_KEY or client is None:
        raise ValueError("GEMINI_API_KEY is not configured")

    compact_eval = []
    for e in evaluations:
        compact_eval.append(
            {
                "question_index": e["question_index"],
                "question_text": e["question_text"],
                "answer_text": e["answer_text"],
                "overall_score": e["overall_score"],
                "communication_score": e["communication_score"],
                "technical_score": e["technical_score"],
                "structure_score": e["structure_score"],
                "confidence_score": e["confidence_score"],
                "relevance_score": e["relevance_score"],
                "recommended_topics": e["recommended_topics"],
            }
        )

    prompt = f"""
You are an expert interview evaluator.

Use the per-answer evaluation data below to create a final session report.
Return ONLY valid JSON.

Interview type: {interview_type}
Role: {role}
Difficulty: {difficulty}

Per-answer evaluations:
{json.dumps(compact_eval, ensure_ascii=False)}

Return ONLY valid JSON with exactly these keys:
overall_score
communication_score
technical_score
problem_solving_score
confidence_score
strengths
improvements
summary
standout_strengths
weak_areas
recommended_topics
question_count

Rules:
- score fields must be integers from 0 to 100
- short or incomplete interviews must receive noticeably lower scores
- if there is too little evidence, say that clearly in the summary
- strengths, improvements, summary must be strings
- standout_strengths must be an array of short strings
- weak_areas must be an array of short strings
- recommended_topics must be an array of short strings
- question_count must be an integer
- no markdown
- no code fences
""".strip()

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    text = _strip_code_fences((response.text or "").strip())
    if not text:
        raise ValueError("Gemini returned empty session feedback")

    data = json.loads(text)

    required_keys = [
        "overall_score",
        "communication_score",
        "technical_score",
        "problem_solving_score",
        "confidence_score",
        "strengths",
        "improvements",
        "summary",
        "standout_strengths",
        "weak_areas",
        "recommended_topics",
        "question_count",
    ]

    for key in required_keys:
        if key not in data:
            raise ValueError(f"Missing key in Gemini session feedback: {key}")

    for score_key in [
        "overall_score",
        "communication_score",
        "technical_score",
        "problem_solving_score",
        "confidence_score",
        "question_count",
    ]:
        data[score_key] = int(data[score_key])

    data["standout_strengths"] = _force_nonempty_list(
        data.get("standout_strengths", []),
        fallback=["Initial engagement"],
        limit=6,
    )
    data["weak_areas"] = _force_nonempty_list(
        data.get("weak_areas", []),
        fallback=["Answer depth", "Interview completeness"],
        limit=6,
    )
    data["recommended_topics"] = _force_nonempty_list(
        data.get("recommended_topics", []),
        fallback=[
            "Structured technical communication",
            "Answering with examples and tradeoffs",
            "Completing full interview rounds",
        ],
        limit=6,
    )

    return data


def build_session_feedback_from_evaluations(
    evaluations: List[Dict],
    interview_type: str,
    role: str,
    difficulty: str,
) -> Dict:
    try:
        data = build_session_feedback_with_gemini(
            evaluations,
            interview_type,
            role,
            difficulty,
        )

        # Final guardrails for unrealistically high scores on short sessions
        question_count = len(evaluations)
        avg_answer_words = 0
        if evaluations:
            avg_answer_words = round(
                mean([len(str(e["answer_text"]).split()) for e in evaluations])
            )

        if question_count <= 1:
            data["overall_score"] = min(int(data["overall_score"]), 35)
        elif question_count == 2:
            data["overall_score"] = min(int(data["overall_score"]), 50)

        if avg_answer_words <= 8:
            data["overall_score"] = min(int(data["overall_score"]), 25)
        elif avg_answer_words <= 15:
            data["overall_score"] = min(int(data["overall_score"]), 45)

        data["weak_areas"] = _force_nonempty_list(
            data.get("weak_areas", []),
            fallback=["Answer depth", "Interview completeness"],
            limit=6,
        )
        data["recommended_topics"] = _force_nonempty_list(
            data.get("recommended_topics", []),
            fallback=[
                "Structured technical communication",
                "Answering with examples and tradeoffs",
                "Completing full interview rounds",
            ],
            limit=6,
        )

        return data
    except Exception:
        return build_session_feedback_fallback(
            evaluations,
            interview_type,
            role,
            difficulty,
        )