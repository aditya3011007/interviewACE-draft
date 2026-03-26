import json
import re
from typing import Any, Dict, List

from google import genai

from app.core.config import settings

MODEL_NAME = "gemini-3-flash-preview"

client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None

COMMON_SKILLS = [
    "python",
    "java",
    "javascript",
    "typescript",
    "react",
    "next.js",
    "node",
    "fastapi",
    "sql",
    "postgresql",
    "mongodb",
    "redis",
    "docker",
    "kubernetes",
    "aws",
    "gcp",
    "azure",
    "machine learning",
    "tensorflow",
    "pytorch",
    "pandas",
    "spark",
    "airflow",
    "etl",
    "data pipelines",
    "system design",
    "api design",
    "microservices",
]


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _clean_lines(raw_text: str) -> List[str]:
    return [line.strip(" -\t") for line in raw_text.splitlines() if line.strip()]


def _sentences(raw_text: str) -> List[str]:
    return [segment.strip() for segment in re.split(r"(?<=[.!?])\s+", raw_text) if segment.strip()]


def _keyword_hits(raw_text: str) -> List[str]:
    text_lower = raw_text.lower()
    hits = []
    for skill in COMMON_SKILLS:
        if skill in text_lower and skill not in hits:
            hits.append(skill)
    return hits[:12]


def _force_list(value: Any, limit: int = 6) -> List[str]:
    if not isinstance(value, list):
        return []

    items = []
    for item in value:
        text = str(item).strip()
        if text and text not in items:
            items.append(text)
    return items[:limit]


def _first_nonempty_line(raw_text: str, fallback: str) -> str:
    for line in _clean_lines(raw_text):
        if len(line) >= 4:
            return line[:120]
    return fallback


def extract_resume_profile_fallback(raw_text: str) -> Dict[str, Any]:
    lines = _clean_lines(raw_text)
    sentence_list = _sentences(raw_text)
    keywords = _keyword_hits(raw_text)
    highlights = []

    for line in lines:
        if len(line.split()) >= 6 and line not in highlights:
            highlights.append(line)
        if len(highlights) >= 5:
            break

    inferred_roles = []
    text_lower = raw_text.lower()
    if "machine learning" in text_lower or "ml" in text_lower:
        inferred_roles.append("ML Engineer")
    if "data engineer" in text_lower or "etl" in text_lower or "spark" in text_lower:
        inferred_roles.append("Data Engineer")
    if "frontend" in text_lower or "react" in text_lower or "next.js" in text_lower:
        inferred_roles.append("Frontend Engineer")
    if "backend" in text_lower or "fastapi" in text_lower or "api" in text_lower:
        inferred_roles.append("Backend Engineer")
    if not inferred_roles:
        inferred_roles.append("Software Engineer")

    return {
        "headline": _first_nonempty_line(raw_text, "Resume profile"),
        "summary": " ".join(sentence_list[:2])[:500] or "Resume uploaded for interview personalization.",
        "skills": keywords[:10],
        "experience_highlights": highlights[:5],
        "project_highlights": highlights[1:4] if len(highlights) > 1 else highlights[:3],
        "target_roles": inferred_roles[:4],
        "keywords": keywords[:12],
    }


def extract_job_description_profile_fallback(raw_text: str) -> Dict[str, Any]:
    lines = _clean_lines(raw_text)
    sentence_list = _sentences(raw_text)
    keywords = _keyword_hits(raw_text)
    role_title = _first_nonempty_line(raw_text, "Target role")

    responsibilities = []
    preferred_skills = []
    text_lower = raw_text.lower()

    for line in lines:
        lower_line = line.lower()
        if any(token in lower_line for token in ["responsible", "build", "design", "lead", "develop", "own"]):
            responsibilities.append(line)
        elif any(token in lower_line for token in ["preferred", "nice to have", "bonus"]):
            preferred_skills.append(line)

        if len(responsibilities) >= 5 and len(preferred_skills) >= 3:
            break

    seniority = "mid-level"
    if any(token in text_lower for token in ["senior", "staff", "principal", "lead"]):
        seniority = "senior"
    elif any(token in text_lower for token in ["intern", "junior", "entry"]):
        seniority = "junior"

    return {
        "role_title": role_title,
        "summary": " ".join(sentence_list[:2])[:500] or "Job description uploaded for interview personalization.",
        "required_skills": keywords[:10],
        "preferred_skills": preferred_skills[:5],
        "responsibilities": responsibilities[:5] or lines[:5],
        "seniority": seniority,
        "keywords": keywords[:12],
    }


def _extract_with_gemini(raw_text: str, kind: str) -> Dict[str, Any]:
    if client is None or not settings.GEMINI_API_KEY:
        raise ValueError("Gemini is not configured")

    if kind == "resume":
        json_shape = """
{
  "headline": "short title",
  "summary": "2-3 sentence summary",
  "skills": ["skill"],
  "experience_highlights": ["bullet"],
  "project_highlights": ["bullet"],
  "target_roles": ["role"],
  "keywords": ["keyword"]
}
""".strip()
    else:
        json_shape = """
{
  "role_title": "short title",
  "summary": "2-3 sentence summary",
  "required_skills": ["skill"],
  "preferred_skills": ["skill"],
  "responsibilities": ["bullet"],
  "seniority": "junior|mid-level|senior",
  "keywords": ["keyword"]
}
""".strip()

    prompt = f"""
You extract structured interview personalization context from a {kind}.
Return ONLY valid JSON matching this shape exactly:
{json_shape}

Rules:
- keep lists concise and deduplicated
- keep bullets short
- do not include markdown
- do not include code fences

Source text:
{raw_text[:12000]}
""".strip()

    response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
    text = _strip_code_fences((response.text or "").strip())
    if not text:
        raise ValueError("Gemini returned empty profile extraction")
    data = json.loads(text)

    if kind == "resume":
        return {
            "headline": str(data.get("headline", "")).strip() or "Resume profile",
            "summary": str(data.get("summary", "")).strip() or "Resume uploaded for interview personalization.",
            "skills": _force_list(data.get("skills"), limit=10),
            "experience_highlights": _force_list(data.get("experience_highlights"), limit=5),
            "project_highlights": _force_list(data.get("project_highlights"), limit=5),
            "target_roles": _force_list(data.get("target_roles"), limit=4),
            "keywords": _force_list(data.get("keywords"), limit=12),
        }

    return {
        "role_title": str(data.get("role_title", "")).strip() or "Target role",
        "summary": str(data.get("summary", "")).strip() or "Job description uploaded for interview personalization.",
        "required_skills": _force_list(data.get("required_skills"), limit=10),
        "preferred_skills": _force_list(data.get("preferred_skills"), limit=5),
        "responsibilities": _force_list(data.get("responsibilities"), limit=5),
        "seniority": str(data.get("seniority", "")).strip() or "mid-level",
        "keywords": _force_list(data.get("keywords"), limit=12),
    }


def extract_resume_profile(raw_text: str) -> Dict[str, Any]:
    try:
        return _extract_with_gemini(raw_text, kind="resume")
    except Exception:
        return extract_resume_profile_fallback(raw_text)


def extract_job_description_profile(raw_text: str) -> Dict[str, Any]:
    try:
        return _extract_with_gemini(raw_text, kind="job_description")
    except Exception:
        return extract_job_description_profile_fallback(raw_text)


def build_resume_prompt_context(extracted_profile: Dict[str, Any]) -> str:
    if not extracted_profile:
        return ""

    sections = []
    headline = str(extracted_profile.get("headline", "")).strip()
    summary = str(extracted_profile.get("summary", "")).strip()
    skills = _force_list(extracted_profile.get("skills"), limit=6)
    highlights = _force_list(extracted_profile.get("experience_highlights"), limit=3)
    target_roles = _force_list(extracted_profile.get("target_roles"), limit=3)

    if headline:
        sections.append("Headline: " + headline)
    if summary:
        sections.append("Summary: " + summary)
    if target_roles:
        sections.append("Target roles: " + ", ".join(target_roles))
    if skills:
        sections.append("Skills: " + ", ".join(skills))
    if highlights:
        sections.append("Experience highlights: " + " | ".join(highlights))

    return "\n".join(sections)


def build_job_description_prompt_context(extracted_profile: Dict[str, Any]) -> str:
    if not extracted_profile:
        return ""

    sections = []
    role_title = str(extracted_profile.get("role_title", "")).strip()
    summary = str(extracted_profile.get("summary", "")).strip()
    required_skills = _force_list(extracted_profile.get("required_skills"), limit=6)
    preferred_skills = _force_list(extracted_profile.get("preferred_skills"), limit=4)
    responsibilities = _force_list(extracted_profile.get("responsibilities"), limit=4)
    seniority = str(extracted_profile.get("seniority", "")).strip()

    if role_title:
        sections.append("Role title: " + role_title)
    if seniority:
        sections.append("Seniority: " + seniority)
    if summary:
        sections.append("Summary: " + summary)
    if required_skills:
        sections.append("Required skills: " + ", ".join(required_skills))
    if preferred_skills:
        sections.append("Preferred skills: " + ", ".join(preferred_skills))
    if responsibilities:
        sections.append("Responsibilities: " + " | ".join(responsibilities))

    return "\n".join(sections)


def compare_resume_to_job_description(
    resume_id: int,
    resume_profile: Dict[str, Any],
    job_description_id: int,
    job_description_profile: Dict[str, Any],
) -> Dict[str, Any]:
    resume_skills = _force_list(resume_profile.get("skills"), limit=12)
    jd_required = _force_list(job_description_profile.get("required_skills"), limit=12)
    jd_preferred = _force_list(job_description_profile.get("preferred_skills"), limit=8)
    resume_highlights = _force_list(
        resume_profile.get("experience_highlights"),
        limit=5,
    )
    jd_responsibilities = _force_list(
        job_description_profile.get("responsibilities"),
        limit=5,
    )

    resume_skill_lookup = {skill.lower(): skill for skill in resume_skills}
    jd_required_lookup = {skill.lower(): skill for skill in jd_required}
    jd_preferred_lookup = {skill.lower(): skill for skill in jd_preferred}

    matches = [
        jd_required_lookup[key]
        for key in jd_required_lookup
        if key in resume_skill_lookup
    ]
    preferred_matches = [
        jd_preferred_lookup[key]
        for key in jd_preferred_lookup
        if key in resume_skill_lookup and jd_preferred_lookup[key] not in matches
    ]
    gaps = [
        jd_required_lookup[key]
        for key in jd_required_lookup
        if key not in resume_skill_lookup
    ]

    risk_zones = []
    if not matches:
        risk_zones.append(
            "Very little direct overlap between the saved resume skills and the job description priorities."
        )
    if len(gaps) >= 4:
        risk_zones.append(
            "Several required skills appear unproven, so interviewers may challenge depth and readiness."
        )
    if len(resume_highlights) <= 1:
        risk_zones.append(
            "The resume provides limited story detail, which may make behavioral follow-ups harder to answer with strong evidence."
        )
    if len(jd_responsibilities) <= 1:
        risk_zones.append(
            "The job description is sparse, so role-specific question targeting may be less precise."
        )

    if preferred_matches:
        matches.extend(preferred_matches[:2])

    if not matches:
        matches = [
            "The resume still offers general technical background that can be reframed toward this role."
        ]

    if not gaps:
        gaps = [
            "No obvious hard-skill gaps were detected from the saved profile summaries."
        ]

    if not risk_zones:
        risk_zones = [
            "The main risk is proving depth with metrics, ownership, and tradeoff reasoning during follow-up questions."
        ]

    role_title = str(job_description_profile.get("role_title", "the target role")).strip()
    summary = (
        f"Resume-to-JD alignment for {role_title} is strongest around "
        f"{', '.join(matches[:3]).lower()}. "
        f"The biggest improvement areas are {', '.join(gaps[:3]).lower()}."
    )

    return {
        "resume_id": resume_id,
        "job_description_id": job_description_id,
        "role_fit_summary": summary,
        "match_areas": matches[:6],
        "gap_areas": gaps[:6],
        "interview_risk_zones": risk_zones[:6],
    }
