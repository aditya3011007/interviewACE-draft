# InterviewAce AI

**AI-powered mock interview platform that adapts to your resume, the job description, and your actual answers — not a canned question bank.**

InterviewAce AI runs realistic, voice-capable mock interviews driven by an agentic planning layer: before the first question is asked, an AI planner reads your resume and the target job description, decides which competencies and resume stories to probe, and sets escalation rules for follow-up questions. As you answer, an adaptive follow-up agent decides whether to dig deeper, challenge vague claims, or move on — then a feedback pipeline synthesizes a structured evaluation report at the end of the session.

## Why it's interesting

- **Hybrid agent architecture, not a chatbot wrapper.** A deterministic backend (auth, sessions, persistence) hosts an AI planning/evaluation layer that generates hidden interview strategy, adapts follow-ups in real time, and produces a final report — see [`INTERVIEW_PLANNER_AGENT.md`](INTERVIEW_PLANNER_AGENT.md) for the design rationale.
- **Personalized from real documents.** Resume and job description are parsed and profiled (`document_parser.py`, `profile_extractor.py`) into structured context the planner and question generator actually condition on, instead of generic prompts.
- **Multi-model AI pipeline.** Uses OpenAI and Google Gemini together — Gemini also powers a live voice interview experience (`gemini_voice_service.py`) so answers can be spoken, not just typed.
- **Full evaluation loop.** Every answer is scored by an evaluator + critic pair (`answer_evaluator.py`, `evaluation_critic.py`) and rolled up into a final report by a report synthesizer, giving structured, defensible feedback rather than a single LLM verdict.

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (React 19), TypeScript, Tailwind CSS + daisyUI, Zustand, React Hook Form |
| Backend | FastAPI, SQLAlchemy, PostgreSQL, Pydantic Settings |
| Auth | JWT (python-jose/passlib), bcrypt password hashing |
| AI/ML | OpenAI API, Google Gemini (incl. Gemini Live for voice) |
| Docs | pypdf / lxml for resume & job description parsing |

## Architecture

```
frontend/  Next.js app — auth, dashboard, profile personalization, live interview UI
backend/
  app/
    routes/     auth, profiles, interview session lifecycle, users
    services/   AI pipeline: planner, question generator, adaptive follow-up,
                answer evaluator + critic, report synthesizer, voice service
    models/     SQLAlchemy models (users, profiles, sessions, messages,
                evaluations, feedback)
    schemas/    Pydantic request/response contracts
    core/       settings & security (JWT, hashing)
```

**Interview lifecycle:** create session → load resume/job-description profiles → planner builds hidden strategy → question generator asks first question → each answer is evaluated and can trigger an adaptive follow-up → on completion, feedback generator + report synthesizer produce the final structured report.

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # or install from pyproject if present

# Create a .env with:
# DATABASE_URL=postgresql://user:password@localhost:5432/interviewace
# SECRET_KEY=your-secret-key
# ALGORITHM=HS256
# ACCESS_TOKEN_EXPIRE_MINUTES=60
# OPENAI_API_KEY=your-openai-key
# GEMINI_API_KEY=your-gemini-key

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend on `http://localhost:8000` (CORS is pre-configured for `localhost:3000`).

## Roadmap

- [ ] Requirements/dependency lockfile for backend (`pyproject.toml` / `requirements.txt`)
- [ ] Automated test coverage for the evaluation pipeline
- [ ] Deployment guide (Docker Compose for backend + Postgres)
