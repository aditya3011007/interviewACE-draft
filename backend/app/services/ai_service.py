def evaluate_answer(answer: str) -> dict:
    length_score = min(max(len(answer) // 40, 4), 9)

    return {
        "communication_score": length_score,
        "technical_score": max(length_score - 1, 4),
        "relevance_score": min(length_score + 1, 10),
        "confidence_score": 6,
        "overall_feedback": "Good start. Try to structure your answer more clearly, add technical depth, and include a concrete example.",
        "improved_answer": f"Improved version: {answer}\n\nA stronger answer would include clearer structure, tradeoffs, and an example from a real project."
    }