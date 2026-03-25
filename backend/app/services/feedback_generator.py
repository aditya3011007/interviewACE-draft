def generate_feedback_from_answers(messages, role: str, difficulty: str):
    user_answers = [m.message.strip() for m in messages if m.sender == "user"]

    total_words = sum(len(answer.split()) for answer in user_answers)
    avg_words = total_words / len(user_answers) if user_answers else 0

    combined_text = " ".join(user_answers).lower()

    communication_score = 60
    technical_score = 60
    problem_solving_score = 60
    confidence_score = 60

    strengths = []
    improvements = []

    if avg_words > 35:
        communication_score += 15
        strengths.append("Gave reasonably detailed answers instead of very short responses.")
    else:
        improvements.append("Provide more complete and structured answers with clearer detail.")

    if any(word in combined_text for word in ["because", "tradeoff", "design", "scalable", "optimize", "approach"]):
        problem_solving_score += 15
        strengths.append("Showed some structured reasoning and tradeoff awareness.")
    else:
        improvements.append("Explain your reasoning process and tradeoffs more explicitly.")

    technical_keywords = [
        "api", "database", "model", "pipeline", "system", "architecture",
        "latency", "scaling", "frontend", "backend", "deployment",
        "training", "inference", "etl", "stream", "authentication"
    ]

    tech_hits = sum(1 for word in technical_keywords if word in combined_text)
    if tech_hits >= 4:
        technical_score += 20
        strengths.append("Used relevant technical concepts and domain vocabulary.")
    elif tech_hits >= 2:
        technical_score += 10
        strengths.append("Referenced some relevant technical concepts.")
    else:
        improvements.append("Use more concrete technical concepts, tools, and implementation details in your answers.")

    if any(word in combined_text for word in ["built", "implemented", "designed", "deployed", "improved", "optimized"]):
        confidence_score += 15
        strengths.append("Presented experience in an assertive and ownership-driven way.")
    else:
        improvements.append("Use stronger action-oriented language when describing your work.")

    communication_score = min(communication_score, 95)
    technical_score = min(technical_score, 95)
    problem_solving_score = min(problem_solving_score, 95)
    confidence_score = min(confidence_score, 95)

    overall_score = round(
        (
            communication_score
            + technical_score
            + problem_solving_score
            + confidence_score
        ) / 4
    )

    if not strengths:
        strengths.append("Stayed engaged through the interview and completed multiple responses.")

    if not improvements:
        improvements.append("Keep refining answer conciseness and increasing technical specificity.")

    summary = (
        f"This {difficulty} interview for a {role} role showed "
        f"an overall performance level of {overall_score}/100. "
        f"The strongest areas were communication and engagement, while the main opportunity "
        f"is to improve depth, structure, and technical specificity in responses."
    )

    return {
        "overall_score": overall_score,
        "communication_score": communication_score,
        "technical_score": technical_score,
        "problem_solving_score": problem_solving_score,
        "confidence_score": confidence_score,
        "strengths": " ".join(strengths),
        "improvements": " ".join(improvements),
        "summary": summary,
    }