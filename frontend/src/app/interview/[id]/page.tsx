"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

type InterviewSession = {
    id: number;
    user_id: number;
    interview_type: string;
    role: string;
    difficulty: string;
    duration: number;
    status: string;
    created_at: string;
};

type InterviewMessage = {
    id: number;
    session_id: number;
    sender: string;
    message: string;
    created_at: string;
};

type LiveEvaluation = {
    id: number;
    session_id: number;
    question_index: number;
    question_text: string;
    answer_text: string;
    overall_score: number;
    communication_score: number;
    technical_score: number;
    structure_score: number;
    confidence_score: number;
    relevance_score: number;
    strengths: string;
    improvements: string;
    missed_opportunities: string;
    ideal_answer: string;
    recommended_topics: string[];
};

type VoiceMode = "toggle" | "hold";

function MetricCard({
    label,
    value,
    accentClass,
}: {
    label: string;
    value: string | number;
    accentClass: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                {label}
            </p>
            <p className={`mt-2 text-2xl font-bold ${accentClass}`}>{value}</p>
        </div>
    );
}

function ScoreMiniCard({
    label,
    value,
    accentClass,
}: {
    label: string;
    value: number;
    accentClass: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                {label}
            </p>
            <p className={`mt-2 text-2xl font-bold ${accentClass}`}>{value}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                    className={`h-full rounded-full ${accentClass.replace("text-", "bg-")}`}
                    style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
                />
            </div>
        </div>
    );
}

function StatusBadge({
    label,
    active,
    activeClass,
}: {
    label: string;
    active: boolean;
    activeClass: string;
}) {
    return (
        <span
            className={`rounded-full border px-3 py-1 text-xs font-medium tracking-[0.14em] uppercase ${active
                ? activeClass
                : "border-slate-700 bg-slate-900/80 text-slate-400"
                }`}
        >
            {label}
        </span>
    );
}

export default function InterviewSessionPage() {
    const params = useParams();
    const router = useRouter();
    const token = useAuthStore((state) => state.token);

    const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

    const recognitionRef = useRef<any>(null);
    const recognitionStartedRef = useRef(false);
    const autoSpokenQuestionIdRef = useRef<number | null>(null);
    const queuedQuestionIdRef = useRef<number | null>(null);

    const [session, setSession] = useState<InterviewSession | null>(null);
    const [messages, setMessages] = useState<InterviewMessage[]>([]);
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [ending, setEnding] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [latestEvaluation, setLatestEvaluation] = useState<LiveEvaluation | null>(
        null
    );

    const [voiceInputSupported, setVoiceInputSupported] = useState(false);
    const [voiceOutputSupported, setVoiceOutputSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState("");
    const [voiceError, setVoiceError] = useState("");
    const [autoReadEnabled, setAutoReadEnabled] = useState(true);
    const [voiceMode, setVoiceMode] = useState<VoiceMode>("toggle");
    const [queuedAutoRead, setQueuedAutoRead] = useState(false);

    const maxAnswers = 5;

    const userAnswerCount = useMemo(
        () => messages.filter((msg) => msg.sender === "user").length,
        [messages]
    );

    const latestAiQuestion = useMemo(() => {
        const reversed = [...messages].reverse();
        return reversed.find((msg) => msg.sender === "ai") || null;
    }, [messages]);

    const progressPercent = Math.min(
        100,
        Math.round((userAnswerCount / maxAnswers) * 100)
    );

    const voiceSummary = useMemo(() => {
        if (!voiceInputSupported && !voiceOutputSupported) return "Text only";
        if (isListening) return "Listening";
        if (isSpeaking) return "Speaking";
        if (queuedAutoRead) return "Queued";
        return "Ready";
    }, [voiceInputSupported, voiceOutputSupported, isListening, isSpeaking, queuedAutoRead]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const SpeechRecognitionCtor =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        setVoiceInputSupported(Boolean(SpeechRecognitionCtor));
        setVoiceOutputSupported("speechSynthesis" in window);

        if (!SpeechRecognitionCtor) return;

        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            recognitionStartedRef.current = true;
            setVoiceError("");
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            let interimText = "";
            let finalText = "";

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalText += transcript + " ";
                } else {
                    interimText += transcript;
                }
            }

            if (finalText.trim()) {
                setAnswer((prev) =>
                    prev.trim()
                        ? `${prev.trim()} ${finalText.trim()}`.trim()
                        : finalText.trim()
                );
            }

            setLiveTranscript(interimText.trim());
        };

        recognition.onerror = (event: any) => {
            const errorCode = event?.error || "unknown";
            if (errorCode !== "aborted") {
                setVoiceError(`Voice input error: ${errorCode}`);
            }
            recognitionStartedRef.current = false;
            setIsListening(false);
        };

        recognition.onend = () => {
            recognitionStartedRef.current = false;
            setIsListening(false);
            setLiveTranscript("");
        };

        recognitionRef.current = recognition;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                try {
                    recognition.stop();
                } catch { }
                if ("speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                }
                setIsSpeaking(false);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);

            try {
                recognition.stop();
            } catch { }

            if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    useEffect(() => {
        if (!token) {
            router.push("/login");
            return;
        }

        if (!sessionId) return;

        const fetchSessionData = async () => {
            try {
                const [sessionRes, messagesRes, evalRes] = await Promise.all([
                    api.get(`/interviews/${sessionId}`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                    api.get(`/interviews/${sessionId}/messages`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                    api.get(`/interviews/${sessionId}/evaluations`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }),
                ]);

                setSession(sessionRes.data);
                setMessages(messagesRes.data);
                setTimeLeft(sessionRes.data.duration * 60);

                const evaluations = evalRes.data || [];
                if (evaluations.length > 0) {
                    setLatestEvaluation(evaluations[evaluations.length - 1]);
                }

                if (sessionRes.data.status === "completed") {
                    router.push(`/interview/${sessionId}/report`);
                    return;
                }
            } catch (error) {
                console.error("Failed to fetch interview session:", error);
                router.push("/dashboard");
            } finally {
                setLoading(false);
            }
        };

        fetchSessionData();
    }, [sessionId, token, router]);

    useEffect(() => {
        if (timeLeft === null) return;
        if (timeLeft <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [timeLeft]);

    useEffect(() => {
        if (timeLeft !== 0 || !token || !sessionId) return;

        const endInterview = async () => {
            try {
                await api.post(
                    `/interviews/${sessionId}/complete`,
                    {},
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                router.push(`/interview/${sessionId}/report`);
            } catch (error) {
                console.error("Failed to auto-complete interview:", error);
            }
        };

        endInterview();
    }, [timeLeft, token, sessionId, router]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    const speakText = (text: string, messageId?: number) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

        try {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1;
            utterance.pitch = 1;

            utterance.onstart = () => {
                setVoiceError("");
                setIsSpeaking(true);
                if (messageId) {
                    autoSpokenQuestionIdRef.current = messageId;
                }
            };

            utterance.onend = () => {
                setIsSpeaking(false);
                if (
                    queuedQuestionIdRef.current &&
                    latestAiQuestion &&
                    queuedQuestionIdRef.current === latestAiQuestion.id &&
                    !isListening
                ) {
                    queuedQuestionIdRef.current = null;
                    setQueuedAutoRead(false);
                    speakText(latestAiQuestion.message, latestAiQuestion.id);
                }
            };

            utterance.onerror = () => {
                setIsSpeaking(false);
                setVoiceError("Voice playback failed.");
            };

            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error("Failed to speak text:", error);
            setVoiceError("Voice playback failed.");
        }
    };

    useEffect(() => {
        if (!autoReadEnabled || !voiceOutputSupported || !latestAiQuestion || loading) {
            return;
        }

        if (autoSpokenQuestionIdRef.current === latestAiQuestion.id) {
            return;
        }

        if (isListening || submitting) {
            queuedQuestionIdRef.current = latestAiQuestion.id;
            setQueuedAutoRead(true);
            return;
        }

        speakText(latestAiQuestion.message, latestAiQuestion.id);
    }, [
        autoReadEnabled,
        voiceOutputSupported,
        latestAiQuestion,
        loading,
        isListening,
        submitting,
    ]);

    useEffect(() => {
        if (!latestAiQuestion) return;
        if (!autoReadEnabled) return;
        if (!voiceOutputSupported) return;
        if (isListening) return;
        if (isSpeaking) return;
        if (!queuedQuestionIdRef.current) return;
        if (queuedQuestionIdRef.current !== latestAiQuestion.id) return;

        queuedQuestionIdRef.current = null;
        setQueuedAutoRead(false);
        speakText(latestAiQuestion.message, latestAiQuestion.id);
    }, [latestAiQuestion, autoReadEnabled, voiceOutputSupported, isListening, isSpeaking]);

    const startListening = () => {
        if (!voiceInputSupported || !recognitionRef.current) return;
        if (recognitionStartedRef.current) return;

        try {
            setVoiceError("");

            if (isSpeaking && typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
            }

            recognitionRef.current.start();
        } catch (error) {
            console.error("Failed to start listening:", error);
            setVoiceError("Could not start microphone input.");
        }
    };

    const stopListening = () => {
        if (!recognitionRef.current || !recognitionStartedRef.current) return;

        try {
            recognitionRef.current.stop();
        } catch (error) {
            console.error("Failed to stop listening:", error);
        }
    };

    const speakQuestion = () => {
        if (!voiceOutputSupported || !latestAiQuestion) return;
        queuedQuestionIdRef.current = null;
        setQueuedAutoRead(false);
        speakText(latestAiQuestion.message, latestAiQuestion.id);
    };

    const stopSpeaking = () => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    };

    const handlePushToTalkStart = () => {
        if (voiceMode !== "hold") return;
        startListening();
    };

    const handlePushToTalkEnd = () => {
        if (voiceMode !== "hold") return;
        stopListening();
    };

    const handleSubmitAnswer = async () => {
        if (!answer.trim() || !token || !sessionId) return;

        setSubmitting(true);

        if (isListening) {
            stopListening();
        }

        try {
            const res = await api.post(
                `/interviews/${sessionId}/answer`,
                { message: answer },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setMessages((prev) => [...prev, ...res.data.messages]);
            setLatestEvaluation(res.data.evaluation || null);
            setAnswer("");
            setLiveTranscript("");

            if (res.data.completed) {
                router.push(`/interview/${sessionId}/report`);
            }
        } catch (error) {
            console.error("Failed to submit answer:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEndInterview = async () => {
        if (!token || !sessionId) return;

        setEnding(true);

        if (isListening) {
            stopListening();
        }
        if (isSpeaking) {
            stopSpeaking();
        }

        try {
            await api.post(
                `/interviews/${sessionId}/complete`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            router.push(`/interview/${sessionId}/report`);
        } catch (error) {
            console.error("Failed to complete interview:", error);
        } finally {
            setEnding(false);
        }
    };

    if (!sessionId || loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                Loading interview session...
            </main>
        );
    }

    if (!session) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                Session not found.
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-10%] top-[-5%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute right-[-8%] top-[18%] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
                <div className="absolute bottom-[-8%] left-[20%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-7xl px-6 py-10">
                <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <div className="inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
                            Live Interview
                        </div>

                        <h1 className="mt-4 text-4xl font-bold tracking-tight">
                            Session #{session.id}
                        </h1>

                        <p className="mt-3 max-w-2xl text-slate-300">
                            Voice mode is now hardened for interruptions, unsupported browsers,
                            and mixed input styles.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400">
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
                                {session.interview_type}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 capitalize">
                                {session.role}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 capitalize">
                                {session.difficulty}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
                                {session.duration} min
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/dashboard"
                            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                            Back to Dashboard
                        </Link>

                        <button
                            onClick={handleEndInterview}
                            disabled={ending}
                            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 font-medium text-amber-300 transition hover:bg-amber-500/15 disabled:opacity-60"
                        >
                            {ending ? "Ending..." : "End Interview"}
                        </button>
                    </div>
                </div>

                <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="Progress"
                        value={`${userAnswerCount} / ${maxAnswers}`}
                        accentClass="text-cyan-400"
                    />
                    <MetricCard
                        label="Completion"
                        value={`${progressPercent}%`}
                        accentClass="text-emerald-400"
                    />
                    <MetricCard
                        label="Time Left"
                        value={timeLeft !== null ? formatTime(timeLeft) : "--:--"}
                        accentClass="text-fuchsia-400"
                    />
                    <MetricCard
                        label="Voice Mode"
                        value={voiceSummary}
                        accentClass={
                            isListening
                                ? "text-emerald-400"
                                : isSpeaking
                                    ? "text-cyan-400"
                                    : queuedAutoRead
                                        ? "text-amber-400"
                                        : "text-slate-300"
                        }
                    />
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                    <div className="space-y-6 xl:col-span-8">
                        <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/12 to-fuchsia-500/10 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                                <div className="max-w-3xl">
                                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                                        Current interviewer focus
                                    </p>
                                    <h2 className="mt-3 text-2xl font-semibold text-white">
                                        {latestAiQuestion?.message || "Waiting for the next question..."}
                                    </h2>
                                    <p className="mt-3 text-sm text-slate-300">
                                        Auto-read is now queued if you are already speaking into the mic,
                                        so question playback won’t clash with voice capture.
                                    </p>
                                </div>

                                <div className="min-w-[280px] rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                        Voice control center
                                    </p>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            onClick={speakQuestion}
                                            disabled={!voiceOutputSupported || !latestAiQuestion || isSpeaking}
                                            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
                                        >
                                            {isSpeaking ? "Speaking..." : "Read Aloud"}
                                        </button>

                                        <button
                                            onClick={stopSpeaking}
                                            disabled={!isSpeaking}
                                            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                                        >
                                            Stop Voice
                                        </button>
                                    </div>

                                    <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm">
                                        <span className="text-slate-300">Auto-read next question</span>
                                        <button
                                            type="button"
                                            onClick={() => setAutoReadEnabled((prev) => !prev)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${autoReadEnabled ? "bg-cyan-500" : "bg-slate-700"
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${autoReadEnabled ? "translate-x-5" : "translate-x-1"
                                                    }`}
                                            />
                                        </button>
                                    </label>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setVoiceMode("toggle")}
                                            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${voiceMode === "toggle"
                                                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                                                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800"
                                                }`}
                                        >
                                            Toggle mode
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setVoiceMode("hold")}
                                            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${voiceMode === "hold"
                                                ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"
                                                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800"
                                                }`}
                                        >
                                            Push-to-talk
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {!voiceInputSupported && !voiceOutputSupported && (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                                This browser does not support the voice features used here. The
                                full interview still works in text mode.
                            </div>
                        )}

                        {!voiceInputSupported && voiceOutputSupported && (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                                Voice playback is available, but microphone speech recognition is
                                not supported in this browser.
                            </div>
                        )}

                        {voiceError && (
                            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                                {voiceError}
                            </div>
                        )}

                        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                        Conversation
                                    </p>
                                    <h3 className="mt-2 text-2xl font-semibold">
                                        Interview transcript
                                    </h3>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <StatusBadge
                                        label="Mic"
                                        active={isListening}
                                        activeClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                    />
                                    <StatusBadge
                                        label="Speaker"
                                        active={isSpeaking}
                                        activeClass="border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                                    />
                                    <StatusBadge
                                        label="Queued"
                                        active={queuedAutoRead}
                                        activeClass="border-amber-500/20 bg-amber-500/10 text-amber-300"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`rounded-2xl p-5 ${msg.sender === "ai"
                                            ? "border border-cyan-500/20 bg-cyan-500/10"
                                            : "border border-slate-800 bg-slate-950"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs uppercase tracking-[0.18em] text-cyan-400">
                                                {msg.sender === "ai" ? "AI Interviewer" : "You"}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(msg.created_at).toLocaleTimeString([], {
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                })}
                                            </p>
                                        </div>

                                        <p className="mt-3 leading-8 text-slate-200">
                                            {msg.message}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                        Your response
                                    </p>
                                    <h3 className="mt-2 text-2xl font-semibold">
                                        Speak or type your answer
                                    </h3>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    {voiceMode === "toggle" ? (
                                        <>
                                            <button
                                                onClick={startListening}
                                                disabled={!voiceInputSupported || isListening}
                                                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                                            >
                                                {isListening ? "Listening..." : "Start Speaking"}
                                            </button>

                                            <button
                                                onClick={stopListening}
                                                disabled={!isListening}
                                                className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                                            >
                                                Stop Mic
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onMouseDown={handlePushToTalkStart}
                                            onMouseUp={handlePushToTalkEnd}
                                            onMouseLeave={handlePushToTalkEnd}
                                            onTouchStart={handlePushToTalkStart}
                                            onTouchEnd={handlePushToTalkEnd}
                                            disabled={!voiceInputSupported}
                                            className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-5 py-2.5 text-sm font-medium text-fuchsia-300 transition hover:bg-fuchsia-500/15 disabled:opacity-50"
                                        >
                                            Hold to Talk
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mb-4 flex flex-wrap gap-2">
                                <StatusBadge
                                    label={voiceInputSupported ? "Voice input ready" : "Voice input unavailable"}
                                    active={voiceInputSupported}
                                    activeClass="border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                                />
                                <StatusBadge
                                    label={autoReadEnabled ? "Auto-read on" : "Auto-read off"}
                                    active={autoReadEnabled}
                                    activeClass="border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300"
                                />
                                <StatusBadge
                                    label={voiceMode === "toggle" ? "Toggle mode" : "Push-to-talk"}
                                    active
                                    activeClass="border-slate-700 bg-slate-900/80 text-slate-300"
                                />
                            </div>

                            {isListening && (
                                <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                                    <div className="flex items-center gap-3">
                                        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
                                        <p className="text-sm font-medium text-emerald-300">
                                            Microphone is actively listening...
                                        </p>
                                    </div>
                                </div>
                            )}

                            {liveTranscript && (
                                <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                                            Live transcript preview
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() => setLiveTranscript("")}
                                            className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                                        >
                                            Clear preview
                                        </button>
                                    </div>

                                    <p className="mt-2 text-sm leading-7 text-slate-200">
                                        {liveTranscript}
                                    </p>
                                </div>
                            )}

                            <textarea
                                rows={9}
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Type your response here or use voice input to draft it."
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                            />

                            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="max-w-2xl text-sm text-slate-400">
                                    Voice-first best practice: dictate, review, tighten, then submit.
                                    Push-to-talk helps reduce accidental background capture.
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setAnswer("")}
                                        disabled={!answer.trim()}
                                        className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        Clear Answer
                                    </button>

                                    <button
                                        onClick={handleSubmitAnswer}
                                        disabled={submitting || !answer.trim()}
                                        className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {submitting ? "Submitting..." : "Submit Answer"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 xl:col-span-4">
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                Session health
                            </p>
                            <h3 className="mt-2 text-2xl font-semibold">
                                Live progress tracker
                            </h3>

                            <div className="mt-5">
                                <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
                                    <span>Interview progress</span>
                                    <span>{progressPercent}%</span>
                                </div>
                                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                                    <div
                                        className="h-full rounded-full bg-cyan-400"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 space-y-3 text-slate-300">
                                <p>
                                    <span className="font-medium text-white">Type:</span>{" "}
                                    {session.interview_type}
                                </p>
                                <p>
                                    <span className="font-medium text-white">Role:</span>{" "}
                                    {session.role}
                                </p>
                                <p>
                                    <span className="font-medium text-white">Difficulty:</span>{" "}
                                    {session.difficulty}
                                </p>
                                <p>
                                    <span className="font-medium text-white">Answers used:</span>{" "}
                                    {userAnswerCount} / {maxAnswers}
                                </p>
                            </div>
                        </div>

                        {latestEvaluation && (
                            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-amber-300">
                                            Latest answer review
                                        </p>
                                        <h3 className="mt-2 text-xl font-semibold">
                                            Question {latestEvaluation.question_index}
                                        </h3>
                                    </div>

                                    <span className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-sm font-semibold text-amber-300">
                                        {latestEvaluation.overall_score}/100
                                    </span>
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-3">
                                    <ScoreMiniCard
                                        label="Communication"
                                        value={latestEvaluation.communication_score}
                                        accentClass="text-cyan-300"
                                    />
                                    <ScoreMiniCard
                                        label="Technical"
                                        value={latestEvaluation.technical_score}
                                        accentClass="text-emerald-300"
                                    />
                                    <ScoreMiniCard
                                        label="Structure"
                                        value={latestEvaluation.structure_score}
                                        accentClass="text-fuchsia-300"
                                    />
                                    <ScoreMiniCard
                                        label="Relevance"
                                        value={latestEvaluation.relevance_score}
                                        accentClass="text-amber-300"
                                    />
                                </div>

                                <div className="mt-5 space-y-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            What worked
                                        </p>
                                        <p className="mt-2 text-sm leading-7 text-slate-200">
                                            {latestEvaluation.strengths}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Improve next
                                        </p>
                                        <p className="mt-2 text-sm leading-7 text-slate-200">
                                            {latestEvaluation.improvements}
                                        </p>
                                    </div>
                                </div>

                                {latestEvaluation.recommended_topics.length > 0 && (
                                    <div className="mt-5">
                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                            Recommended practice topics
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {latestEvaluation.recommended_topics.map((topic) => (
                                                <span
                                                    key={topic}
                                                    className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300"
                                                >
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                Robust voice guidance
                            </p>
                            <div className="mt-4 space-y-4 text-sm text-slate-300">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                    Push-to-talk is better in noisy environments or when you want
                                    tighter control.
                                </div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                    Auto-read is queued during microphone capture so the app avoids
                                    overlapping playback and listening.
                                </div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                    If voice input fails, the page remains fully usable in text mode.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}