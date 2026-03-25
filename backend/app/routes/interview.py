from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.interview import InterviewSession
from app.models.interview_evaluation import InterviewEvaluation
from app.models.interview_feedback import InterviewFeedback
from app.models.interview_message import InterviewMessage
from app.models.user import User
from app.schemas.interview import InterviewSessionCreate, InterviewSessionResponse
from app.schemas.interview_evaluation import InterviewEvaluationResponse
from app.schemas.interview_feedback import InterviewFeedbackResponse
from app.schemas.interview_message import InterviewMessageResponse
from app.services.answer_evaluator import (
    build_session_feedback_from_evaluations,
    evaluate_answer,
)
from app.services.gemini_interview_generator import (
    generate_gemini_first_question,
    generate_gemini_followup_question,
)
from app.services.question_generator import (
    generate_first_question,
    generate_followup_question,
)

router = APIRouter(prefix="/interviews", tags=["interviews"])

MAX_USER_ANSWERS = 5


def serialize_evaluation(evaluation: InterviewEvaluation) -> dict:
    return {
        "id": evaluation.id,
        "session_id": evaluation.session_id,
        "question_index": evaluation.question_index,
        "question_text": evaluation.question_text,
        "answer_text": evaluation.answer_text,
        "overall_score": evaluation.overall_score,
        "communication_score": evaluation.communication_score,
        "technical_score": evaluation.technical_score,
        "structure_score": evaluation.structure_score,
        "confidence_score": evaluation.confidence_score,
        "relevance_score": evaluation.relevance_score,
        "strengths": evaluation.strengths,
        "improvements": evaluation.improvements,
        "missed_opportunities": evaluation.missed_opportunities,
        "ideal_answer": evaluation.ideal_answer,
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
        standout_strengths=feedback_data["standout_strengths"],
        weak_areas=feedback_data["weak_areas"],
        recommended_topics=feedback_data["recommended_topics"],
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
    new_session = InterviewSession(
        user_id=current_user.id,
        interview_type=session_data.interview_type,
        role=session_data.role,
        difficulty=session_data.difficulty,
        duration=session_data.duration,
        status="in_progress",
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    try:
        first_question = generate_gemini_first_question(
            session_data.interview_type,
            session_data.role,
            session_data.difficulty,
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

    if not message_text:
        raise HTTPException(status_code=400, detail="Answer cannot be empty")

    latest_ai_question = (
        db.query(InterviewMessage)
        .filter(
            InterviewMessage.session_id == session_id,
            InterviewMessage.sender == "ai",
        )
        .order_by(InterviewMessage.created_at.desc(), InterviewMessage.id.desc())
        .first()
    )

    user_message = InterviewMessage(
        session_id=session_id,
        sender="user",
        message=message_text,
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

    evaluation_data = evaluate_answer(
        question_text,
        message_text,
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
        answer_text=message_text,
        overall_score=evaluation_data["overall_score"],
        communication_score=evaluation_data["communication_score"],
        technical_score=evaluation_data["technical_score"],
        structure_score=evaluation_data["structure_score"],
        confidence_score=evaluation_data["confidence_score"],
        relevance_score=evaluation_data["relevance_score"],
        strengths=evaluation_data["strengths"],
        improvements=evaluation_data["improvements"],
        missed_opportunities=evaluation_data["missed_opportunities"],
        ideal_answer=evaluation_data["ideal_answer"],
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

    try:
        next_question = generate_gemini_followup_question(
            session.interview_type,
            session.role,
            session.difficulty,
            conversation_messages,
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