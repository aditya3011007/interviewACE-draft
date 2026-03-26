def generate_first_question(interview_type: str, role: str, difficulty: str) -> str:
    role = role.lower()
    interview_type = interview_type.lower()
    difficulty = difficulty.lower()

    if interview_type == "hr_voice":
        if difficulty == "easy":
            return f"To get us started, can you tell me about yourself and what attracted you to this {role} opportunity?"
        elif difficulty == "medium":
            return f"Tell me about a professional experience that best reflects who you are as a {role} and how you work with other people."
        else:
            return f"Walk me through a high-pressure professional situation that shaped how you lead, communicate, or make decisions as a {role}."

    if interview_type == "behavioral":
        if difficulty == "easy":
            return f"Tell me about yourself and why you are interested in a {role} role."
        elif difficulty == "medium":
            return f"Tell me about a challenging project you worked on that helped you grow as a {role}."
        else:
            return f"Describe a time you faced ambiguity or conflict in a project, and explain how you handled it as a {role}."

    if interview_type == "technical":
        if "software engineer" in role:
            if difficulty == "easy":
                return "What is the difference between a stack and a queue, and when would you use each?"
            elif difficulty == "medium":
                return "How would you design a rate limiter for a web application? Walk me through the tradeoffs."
            else:
                return "Design a scalable URL shortening service. Explain the database, API, and scaling considerations."

        if "full stack" in role:
            if difficulty == "easy":
                return "What is the difference between client-side rendering and server-side rendering?"
            elif difficulty == "medium":
                return "How would you design authentication and authorization for a full-stack web app?"
            else:
                return "Design a production-grade real-time collaboration app. Explain frontend, backend, and scaling concerns."

        if "ml engineer" in role:
            if difficulty == "easy":
                return "What is overfitting in machine learning, and how can you reduce it?"
            elif difficulty == "medium":
                return "How would you build and deploy a model inference pipeline for a production ML application?"
            else:
                return "Design an end-to-end ML system for real-time fraud detection, including data, training, inference, and monitoring."

        if "data engineer" in role:
            if difficulty == "easy":
                return "What is the difference between ETL and ELT?"
            elif difficulty == "medium":
                return "How would you design a data pipeline for processing millions of events per day?"
            else:
                return "Design a fault-tolerant streaming data platform with ingestion, transformation, storage, and monitoring."

    if difficulty == "easy":
        return f"What strengths do you bring to a {role} position?"
    elif difficulty == "medium":
        return f"Tell me about a project that best demonstrates your readiness for a {role} role."
    else:
        return f"What is the most technically challenging problem you have solved relevant to a {role} role?"


def generate_followup_question(
    interview_type: str,
    role: str,
    difficulty: str,
    answer_count: int,
) -> str:
    interview_type = interview_type.lower()
    role = role.lower()
    difficulty = difficulty.lower()

    if interview_type == "hr_voice":
        hr_questions = [
            "What kind of work environment helps you do your best work, and why?",
            "Tell me about a time you had to handle conflict or tension with a teammate or stakeholder.",
            "What feedback have you received recently that changed how you work?",
            "Why do you believe you are a strong fit for this role right now?",
        ]
        return hr_questions[answer_count % len(hr_questions)]

    if interview_type == "behavioral":
        behavioral_questions = [
            f"Can you describe a situation where you had to collaborate with others to succeed in a {role} project?",
            "Tell me about a time you received difficult feedback. How did you respond?",
            "Describe a situation where you had multiple deadlines. How did you prioritize your work?",
            "Tell me about a time you failed or made a mistake. What did you learn from it?",
        ]
        return behavioral_questions[answer_count % len(behavioral_questions)]

    if interview_type == "technical":
        if "software engineer" in role:
            questions = [
                "How do hashing and indexing improve performance in software systems?",
                "Explain the difference between processes and threads, and when you would use each.",
                "How would you design a caching strategy for a high-traffic application?",
                "What tradeoffs would you consider when designing a scalable backend service?",
            ]
        elif "full stack" in role:
            questions = [
                "How would you manage state in a modern frontend application?",
                "What are the tradeoffs between monolithic and microservice architectures?",
                "How would you secure APIs in a full-stack application?",
                "How would you optimize the performance of a React-based web app?",
            ]
        elif "ml engineer" in role:
            questions = [
                "How do you evaluate whether a machine learning model is production-ready?",
                "What is the difference between batch inference and real-time inference?",
                "How would you monitor model drift in production?",
                "How do precision and recall affect model design tradeoffs?",
            ]
        elif "data engineer" in role:
            questions = [
                "How would you handle late-arriving data in a pipeline?",
                "What is partitioning, and why is it important in large-scale data systems?",
                "How would you design a reliable streaming ETL pipeline?",
                "What tradeoffs do you consider between data warehouses and data lakes?",
            ]
        else:
            questions = [
                f"What technical skills are most important for a {role}?",
                f"How would you approach solving a hard technical problem in a {role} position?",
                f"What tradeoffs do you think matter most in a {role} system design interview?",
            ]

        return questions[answer_count % len(questions)]

    mixed_questions = [
        f"What makes you a strong fit for a {role} role?",
        "Tell me about a project where you had to solve a difficult technical challenge.",
        "How do you approach learning a new tool or framework quickly?",
        "Describe how you handle uncertainty in technical projects.",
    ]

    return mixed_questions[answer_count % len(mixed_questions)]