from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.interview import InterviewSession
from app.models.interview_evaluation import InterviewEvaluation
from app.models.interview_feedback import InterviewFeedback
from app.models.interview_message import InterviewMessage
from app.models.job_description_profile import JobDescriptionProfile
from app.models.resume_profile import ResumeProfile
from app.models.user import User
from app.schemas.interview import InterviewSessionCreate, InterviewSessionResponse
from app.schemas.interview_evaluation import InterviewEvaluationResponse
from app.schemas.interview_feedback import InterviewFeedbackResponse
from app.schemas.interview_message import InterviewMessageResponse
from app.services.answer_evaluator import (
    build_session_feedback_from_evaluations,
    evaluate_answer,
)
from app.services.adaptive_followup_agent import choose_followup_strategy
from app.services.evaluation_critic import critique_evaluation
from app.services.gemini_interview_generator import (
    generate_gemini_first_question,
    generate_gemini_followup_question,
)
from app.services.gemini_voice_service import synthesize_hr_voice_audio
from app.services.interview_planner import build_interview_plan
from app.services.profile_extractor import (
    build_job_description_prompt_context,
    build_resume_prompt_context,
    compare_resume_to_job_description,
)
from app.services.question_generator import (
    generate_first_question,
    generate_followup_question,
)
from app.services.report_synthesizer import synthesize_final_report

router = APIRouter(prefix="/interviews", tags=["interviews"])

MAX_USER_ANSWERS = 5


def _get_resume_or_404(
    resume_id: int,
    current_user: User,
    db: Session,
) -> ResumeProfile:
    resume = (
        db.query(ResumeProfile)
        .filter(
            ResumeProfile.id == resume_id,
            ResumeProfile.user_id == current_user.id,
        )
        .first()
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Resume profile not found")
    return resume


def _get_job_description_or_404(
    job_description_id: int,
    current_user: User,
    db: Session,
) -> JobDescriptionProfile:
    job_description = (
        db.query(JobDescriptionProfile)
        .filter(
            JobDescriptionProfile.id == job_description_id,
            JobDescriptionProfile.user_id == current_user.id,
        )
        .first()
    )
    if not job_description:
        raise HTTPException(status_code=404, detail="Job description profile not found")
    return job_description


def _build_personalization_context(session: InterviewSession) -> tuple:
    resume_context = ""
    job_description_context = ""

    if session.resume and session.resume.extracted_profile:
        resume_context = build_resume_prompt_context(session.resume.extracted_profile)

    if session.job_description and session.job_description.extracted_profile:
        job_description_context = build_job_description_prompt_context(
            session.job_description.extracted_profile
        )

    return resume_context, job_description_context


def _build_comparison_context(
    resume: ResumeProfile,
    job_description: JobDescriptionProfile,
) -> dict:
    if not resume or not job_description:
        return {}

    if not resume.extracted_profile or not job_description.extracted_profile:
        return {}

    return compare_resume_to_job_description(
        resume.id,
        resume.extracted_profile,
        job_description.id,
        job_description.extracted_profile,
    )


def serialize_evaluation(evaluation: InterviewEvaluation) -> dict:
    return {
        "id": evaluation.id,
        "session_id": evaluation.session_id,
        "question_index": evaluation.question_index,
        "question_text": evaluation.question_text,
        "answer_text": evaluation.answer_text,
        "code_language": evaluation.code_language,
        "code_submission": evaluation.code_submission,
        "overall_score": evaluation.overall_score,
        "communication_score": evaluation.communication_score,
        "technical_score": evaluation.technical_score,
        "structure_score": evaluation.structure_score,
        "confidence_score": evaluation.confidence_score,
        "relevance_score": evaluation.relevance_score,
        "code_quality_score": evaluation.code_quality_score,
        "strengths": evaluation.strengths,
        "improvements": evaluation.improvements,
        "missed_opportunities": evaluation.missed_opportunities,
        "ideal_answer": evaluation.ideal_answer,
        "code_feedback": evaluation.code_feedback,
        "critic_summary": evaluation.critic_summary,
        "recommended_topics": evaluation.recommended_topics,
    }


def build_feedback_for_session(
    session: InterviewSession,
    db: Session,
) -> InterviewFeedback:
    existing_feedback = (
        db.query(InterviewFeedback)
        .filter(InterviewFeedback.session_id == session.id)
        .first()
    )

    if existing_feedback:
        return existing_feedback

    evaluation_rows = (
        db.query(InterviewEvaluation)
        .filter(InterviewEvaluation.session_id == session.id)
        .order_by(InterviewEvaluation.question_index.asc())
        .all()
    )

    evaluation_dicts = [
        {
            "question_index": row.question_index,
            "question_text": row.question_text,
            "answer_text": row.answer_text,
            "overall_score": row.overall_score,
            "communication_score": row.communication_score,
            "technical_score": row.technical_score,
            "structure_score": row.structure_score,
            "confidence_score": row.confidence_score,
            "relevance_score": row.relevance_score,
            "critic_summary": row.critic_summary,
            "recommended_topics": row.recommended_topics,
        }
        for row in evaluation_rows
    ]

    feedback_data = build_session_feedback_from_evaluations(
        evaluation_dicts,
        session.interview_type,
        session.role,
        session.difficulty,
    )
    comparison_context = {}
    if session.resume and session.job_description:
        comparison_context = _build_comparison_context(
            session.resume,
            session.job_description,
        )

    synthesized_report = synthesize_final_report(
        session.interview_type,
        session.role,
        session.difficulty,
        evaluation_dicts,
        session.planner_state,
        comparison_context,
        feedback_data,
    )

    feedback = InterviewFeedback(
        session_id=session.id,
        overall_score=feedback_data["overall_score"],
        communication_score=feedback_data["communication_score"],
        technical_score=feedback_data["technical_score"],
        problem_solving_score=feedback_data["problem_solving_score"],
        confidence_score=feedback_data["confidence_score"],
        strengths=feedback_data["strengths"],
        improvements=feedback_data["improvements"],
        summary=feedback_data["summary"],
        resume_jd_alignment_summary=synthesized_report["resume_jd_alignment_summary"],
        standout_strengths=feedback_data["standout_strengths"],
        weak_areas=feedback_data["weak_areas"],
        recommended_topics=feedback_data["recommended_topics"],
        matched_strengths_for_job=synthesized_report["matched_strengths_for_job"],
        risky_gaps=synthesized_report["risky_gaps"],
        best_interview_stories=synthesized_report["best_interview_stories"],
        next_practice_priorities=synthesized_report["next_practice_priorities"],
        question_count=feedback_data["question_count"],
    )

    session.status = "completed"

    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return feedback


@router.post("/", response_model=InterviewSessionResponse)
def create_interview_session(
    session_data: InterviewSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = None
    job_description = None

    if session_data.resume_id is not None:
        resume = _get_resume_or_404(session_data.resume_id, current_user, db)

    if session_data.job_description_id is not None:
        job_description = _get_job_description_or_404(
            session_data.job_description_id,
            current_user,
            db,
        )

    resume_context = ""
    if resume and resume.extracted_profile:
        resume_context = build_resume_prompt_context(resume.extracted_profile)

    job_description_context = ""
    if job_description and job_description.extracted_profile:
        job_description_context = build_job_description_prompt_context(
            job_description.extracted_profile
        )

    comparison_context = {}
    if resume and job_description:
        comparison_context = _build_comparison_context(resume, job_description)

    planner_state = build_interview_plan(
        session_data.interview_type,
        session_data.role,
        session_data.difficulty,
        resume_context=resume_context,
        job_description_context=job_description_context,
        comparison_context=comparison_context,
    )

    new_session = InterviewSession(
        user_id=current_user.id,
        interview_type=session_data.interview_type,
        role=session_data.role,
        difficulty=session_data.difficulty,
        duration=session_data.duration,
        resume_id=resume.id if resume else None,
        job_description_id=job_description.id if job_description else None,
        planner_state=planner_state,
        status="in_progress",
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    resume_context, job_description_context = _build_personalization_context(new_session)

    try:
        first_question = generate_gemini_first_question(
            session_data.interview_type,
            session_data.role,
            session_data.difficulty,
            resume_context=resume_context,
            job_description_context=job_description_context,
            planner_state=new_session.planner_state,
        )
    except Exception:
        first_question = generate_first_question(
            session_data.interview_type,
            session_data.role,
            session_data.difficulty,
        )

    ai_message = InterviewMessage(
        session_id=new_session.id,
        sender="ai",
        message=first_question,
    )

    db.add(ai_message)
    db.commit()

    return new_session


@router.get("/", response_model=List[InterviewSessionResponse])
def get_my_interview_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == current_user.id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )
    return sessions


@router.get("/{session_id}", response_model=InterviewSessionResponse)
def get_interview_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    return session


@router.get("/{session_id}/messages", response_model=List[InterviewMessageResponse])
def get_interview_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    messages = (
        db.query(InterviewMessage)
        .filter(InterviewMessage.session_id == session_id)
        .order_by(InterviewMessage.created_at.asc(), InterviewMessage.id.asc())
        .all()
    )

    return messages


@router.get("/{session_id}/messages/{message_id}/voice-audio")
async def get_interview_message_voice_audio(
    session_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    message = (
        db.query(InterviewMessage)
        .filter(
            InterviewMessage.id == message_id,
            InterviewMessage.session_id == session_id,
            InterviewMessage.sender == "ai",
        )
        .first()
    )

    if not message:
        raise HTTPException(status_code=404, detail="Interview message not found")

    try:
        audio_bytes, mime_type = await synthesize_hr_voice_audio(message.message)
    except Exception as exc:
        exc_str = str(exc).lower()
        if "reported as leaked" in exc_str or "permission_denied" in exc_str:
            # Gemini rejects leaked keys with 403 PERMISSION_DENIED. Returning a
            # 503 (rather than 500) helps the frontend degrade gracefully.
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini voice is unavailable (API key rejected/reported as leaked). "
                    f"{type(exc).__name__}: {exc}"
                ),
            )
        if (
            "biddingeneratecontent" in exc_str
            or "bidiGenerateContent" in str(exc)
            or "not found" in exc_str
            or "models/" in exc_str
        ):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini voice is unavailable (Live audio model unsupported/misconfigured). "
                    f"{type(exc).__name__}: {exc}"
                ),
            )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to synthesize Gemini voice audio: {type(exc).__name__}: {exc}",
        )

    return Response(content=audio_bytes, media_type=mime_type)


@router.get("/{session_id}/evaluations", response_model=List[InterviewEvaluationResponse])
def get_interview_evaluations(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    evaluations = (
        db.query(InterviewEvaluation)
        .filter(InterviewEvaluation.session_id == session_id)
        .order_by(InterviewEvaluation.question_index.asc())
        .all()
    )

    return evaluations


@router.post("/{session_id}/answer")
def submit_answer(
    session_id: int,
    answer_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Interview already completed")

    message_text = answer_data.get("message", "").strip()
    code_submission = answer_data.get("code_submission", "").strip()
    code_language = answer_data.get("code_language", "").strip()

    if not message_text and not code_submission:
        raise HTTPException(
            status_code=400,
            detail="Answer cannot be empty. Submit text, code, or both.",
        )

    latest_ai_question = (
        db.query(InterviewMessage)
        .filter(
            InterviewMessage.session_id == session_id,
            InterviewMessage.sender == "ai",
        )
        .order_by(InterviewMessage.created_at.desc(), InterviewMessage.id.desc())
        .first()
    )

    display_message_text = message_text
    if not display_message_text and code_submission:
        display_message_text = (
            f"Submitted a {code_language or 'code'} solution without a written explanation."
        )

    user_message = InterviewMessage(
        session_id=session_id,
        sender="user",
        message=display_message_text,
    )

    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    user_answer_count = (
        db.query(InterviewMessage)
        .filter(
            InterviewMessage.session_id == session_id,
            InterviewMessage.sender == "user",
        )
        .count()
    )

    question_text = latest_ai_question.message if latest_ai_question else "Question unavailable"

    first_pass_evaluation = evaluate_answer(
        question_text,
        message_text,
        session.interview_type,
        session.role,
        session.difficulty,
        code_submission=code_submission,
        code_language=code_language,
    )
    evaluation_data = critique_evaluation(
        question_text,
        display_message_text,
        first_pass_evaluation,
        session.interview_type,
        session.role,
        session.difficulty,
    )

    evaluation = InterviewEvaluation(
        session_id=session_id,
        question_index=user_answer_count,
        question_message_id=latest_ai_question.id if latest_ai_question else None,
        answer_message_id=user_message.id,
        question_text=question_text,
        answer_text=display_message_text,
        code_language=code_language or None,
        code_submission=code_submission or None,
        overall_score=evaluation_data["overall_score"],
        communication_score=evaluation_data["communication_score"],
        technical_score=evaluation_data["technical_score"],
        structure_score=evaluation_data["structure_score"],
        confidence_score=evaluation_data["confidence_score"],
        relevance_score=evaluation_data["relevance_score"],
        code_quality_score=evaluation_data.get("code_quality_score"),
        strengths=evaluation_data["strengths"],
        improvements=evaluation_data["improvements"],
        missed_opportunities=evaluation_data["missed_opportunities"],
        ideal_answer=evaluation_data["ideal_answer"],
        code_feedback=evaluation_data.get("code_feedback") or None,
        critic_summary=evaluation_data.get("critic_summary") or None,
        recommended_topics=evaluation_data["recommended_topics"],
    )

    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    if user_answer_count >= MAX_USER_ANSWERS:
        feedback = build_feedback_for_session(session, db)

        return {
            "completed": True,
            "messages": [
                {
                    "id": user_message.id,
                    "session_id": user_message.session_id,
                    "sender": user_message.sender,
                    "message": user_message.message,
                    "created_at": user_message.created_at.isoformat()
                    if user_message.created_at
                    else None,
                }
            ],
            "evaluation": serialize_evaluation(evaluation),
            "feedback_id": feedback.id,
        }

    conversation_messages = (
        db.query(InterviewMessage)
        .filter(InterviewMessage.session_id == session_id)
        .order_by(InterviewMessage.created_at.asc(), InterviewMessage.id.asc())
        .all()
    )
    resume_context, job_description_context = _build_personalization_context(session)
    comparison_context = {}
    if session.resume and session.job_description:
        comparison_context = _build_comparison_context(
            session.resume,
            session.job_description,
        )

    followup_state = choose_followup_strategy(
        session.interview_type,
        session.role,
        session.difficulty,
        conversation_messages,
        display_message_text,
        evaluation_data,
        planner_state=session.planner_state,
        resume_context=resume_context,
        job_description_context=job_description_context,
        comparison_context=comparison_context,
    )
    session.followup_state = followup_state
    db.add(session)
    db.commit()
    db.refresh(session)

    try:
        next_question = generate_gemini_followup_question(
            session.interview_type,
            session.role,
            session.difficulty,
            conversation_messages,
            resume_context=resume_context,
            job_description_context=job_description_context,
            planner_state=session.planner_state,
            followup_context=session.followup_state,
        )
    except Exception:
        next_question = generate_followup_question(
            session.interview_type,
            session.role,
            session.difficulty,
            user_answer_count,
        )

    ai_message = InterviewMessage(
        session_id=session_id,
        sender="ai",
        message=next_question,
    )

    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    return {
        "completed": False,
        "messages": [
            {
                "id": user_message.id,
                "session_id": user_message.session_id,
                "sender": user_message.sender,
                "message": user_message.message,
                "created_at": user_message.created_at.isoformat()
                if user_message.created_at
                else None,
            },
            {
                "id": ai_message.id,
                "session_id": ai_message.session_id,
                "sender": ai_message.sender,
                "message": ai_message.message,
                "created_at": ai_message.created_at.isoformat()
                if ai_message.created_at
                else None,
            },
        ],
        "evaluation": serialize_evaluation(evaluation),
    }


@router.post("/{session_id}/complete", response_model=InterviewFeedbackResponse)
def complete_interview(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    return build_feedback_for_session(session, db)


@router.get("/{session_id}/feedback", response_model=InterviewFeedbackResponse)
def get_interview_feedback(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    feedback = (
        db.query(InterviewFeedback)
        .filter(InterviewFeedback.session_id == session_id)
        .first()
    )

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    return feedback


@router.delete("/{session_id}")
def delete_interview_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    db.query(InterviewFeedback).filter(
        InterviewFeedback.session_id == session_id
    ).delete()

    db.query(InterviewEvaluation).filter(
        InterviewEvaluation.session_id == session_id
    ).delete()

    db.query(InterviewMessage).filter(
        InterviewMessage.session_id == session_id
    ).delete()

    db.commit()

    db.delete(session)
    db.commit()

    return {"message": "Interview session deleted successfully"}