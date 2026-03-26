# Interview Planner Agent

## Goal

Add the first hybrid-agent layer without rewriting the app into a fully autonomous system.
The existing deterministic shell should stay responsible for:

- authentication
- profile storage
- interview session lifecycle
- answer persistence
- evaluation persistence
- report delivery

The planner should only generate hidden interview strategy before the first question.

## Best insertion point

The cleanest seam is session creation in `backend/app/routes/interview.py`.

Recommended flow:

1. Load the selected resume and job description profiles for the session.
2. Build compact personalization context from `extracted_profile`.
3. Call a new planner service before the first question is generated.
4. Save the planner output on the session as hidden state.
5. Pass the planner output into first-question generation and future follow-up logic.

## Suggested session field

Add one nullable JSON field to `InterviewSession`:

- `planner_state`

That JSON should stay backend-only and should not be rendered directly in the UI.

## Recommended planner output

```json
{
  "competencies_to_test": [
    "system design tradeoffs",
    "ownership and execution",
    "metrics and impact"
  ],
  "resume_stories_to_probe": [
    "real-time interview product build",
    "backend API ownership",
    "voice UX reliability work"
  ],
  "job_description_priorities": [
    "full-stack execution",
    "scalable backend systems",
    "product-minded communication"
  ],
  "weak_answer_escalation_rules": [
    "ask for metrics when claims are vague",
    "challenge ownership when actions are unclear",
    "switch topics when evidence remains weak after one follow-up"
  ],
  "opening_focus": "Start with the strongest resume story that overlaps with the target role."
}
```

## Service shape

Create a new backend service:

- `backend/app/services/interview_planner.py`

Recommended function:

```python
def build_interview_plan(
    interview_type: str,
    role: str,
    difficulty: str,
    resume_context: str = "",
    job_description_context: str = "",
    comparison_context: dict = None,
) -> dict:
    ...
```

## Prompt contract

The planner should receive:

- interview type
- role
- difficulty
- compact resume context
- compact job description context
- optional resume-vs-JD comparison output

The planner should return only valid JSON with a fixed schema so the deterministic shell can trust and store it.

## How follow-up generation should use it later

After the planner exists, `generate_gemini_followup_question()` should receive:

- transcript
- current evaluation result
- planner state

That enables the next agent step without changing the HTTP contract.

## Why this approach fits the current app

- It preserves the existing FastAPI route orchestration.
- It uses the new Layer 4 profile data immediately.
- It keeps agentic behavior narrow, inspectable, and debuggable.
- It creates a direct upgrade path for adaptive follow-ups and stronger final reports.
