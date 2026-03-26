"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type InterviewSession = {
    id: number;
    user_id: number;
    interview_type: string;
    role: string;
    difficulty: string;
    duration: number;
    resume_title?: string | null;
    job_description_title?: string | null;
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

type OrbMode = "idle" | "ai" | "user" | "ended";

function ParticleOrb({
    mode,
    intensity,
}: {
    mode: OrbMode;
    intensity: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const particles = Array.from({ length: 180 }, (_, index) => ({
            angle: (Math.PI * 2 * index) / 180,
            distance: 110 + Math.random() * 24,
            size: 1.2 + Math.random() * 2.6,
            speed: 0.002 + Math.random() * 0.006,
            drift: Math.random() * 1000,
        }));

        let animationFrame = 0;
        const render = (time: number) => {
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            context.clearRect(0, 0, width, height);
            const centerX = width / 2;
            const centerY = height / 2;

            const baseRadius =
                mode === "ai" ? 92 : mode === "user" ? 84 : mode === "ended" ? 72 : 78;
            const pulse =
                Math.sin(time * 0.003) * 10 * intensity +
                Math.sin(time * 0.0013) * 6 * intensity;
            const radius = baseRadius + pulse;

            const gradient = context.createRadialGradient(
                centerX,
                centerY,
                radius * 0.1,
                centerX,
                centerY,
                radius * 1.7
            );
            if (mode === "ai") {
                gradient.addColorStop(0, "rgba(34,211,238,0.95)");
                gradient.addColorStop(0.45, "rgba(168,85,247,0.45)");
                gradient.addColorStop(1, "rgba(15,23,42,0.02)");
            } else if (mode === "user") {
                gradient.addColorStop(0, "rgba(16,185,129,0.95)");
                gradient.addColorStop(0.45, "rgba(34,211,238,0.35)");
                gradient.addColorStop(1, "rgba(15,23,42,0.02)");
            } else if (mode === "ended") {
                gradient.addColorStop(0, "rgba(244,114,182,0.8)");
                gradient.addColorStop(0.5, "rgba(168,85,247,0.3)");
                gradient.addColorStop(1, "rgba(15,23,42,0.02)");
            } else {
                gradient.addColorStop(0, "rgba(148,163,184,0.75)");
                gradient.addColorStop(0.45, "rgba(34,211,238,0.18)");
                gradient.addColorStop(1, "rgba(15,23,42,0.02)");
            }

            context.beginPath();
            context.fillStyle = gradient;
            context.arc(centerX, centerY, radius * 1.45, 0, Math.PI * 2);
            context.fill();

            particles.forEach((particle) => {
                const animatedAngle = particle.angle + time * particle.speed;
                const driftRadius =
                    particle.distance +
                    Math.sin(time * 0.002 + particle.drift) * 10 * intensity;
                const x = centerX + Math.cos(animatedAngle) * driftRadius;
                const y = centerY + Math.sin(animatedAngle) * driftRadius;

                context.beginPath();
                context.fillStyle =
                    mode === "user"
                        ? "rgba(110,231,183,0.85)"
                        : mode === "ended"
                            ? "rgba(244,114,182,0.8)"
                            : "rgba(103,232,249,0.85)";
                context.arc(x, y, particle.size, 0, Math.PI * 2);
                context.fill();
            });

            context.beginPath();
            context.fillStyle = "rgba(15,23,42,0.9)";
            context.arc(centerX, centerY, radius * 0.88, 0, Math.PI * 2);
            context.fill();

            context.beginPath();
            context.strokeStyle =
                mode === "user"
                    ? "rgba(16,185,129,0.65)"
                    : mode === "ended"
                        ? "rgba(244,114,182,0.6)"
                        : "rgba(34,211,238,0.65)";
            context.lineWidth = 2.5;
            context.arc(centerX, centerY, radius, 0, Math.PI * 2);
            context.stroke();

            animationFrame = window.requestAnimationFrame(render);
        };

        animationFrame = window.requestAnimationFrame(render);
        return () => window.cancelAnimationFrame(animationFrame);
    }, [intensity, mode]);

    return (
        <div className="relative mx-auto aspect-square w-full max-w-[420px]">
            <canvas
                ref={canvasRef}
                className="h-full w-full"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-full border border-white/10 bg-slate-950/40 px-6 py-3 text-center backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {mode === "ai"
                            ? "AI speaking"
                            : mode === "user"
                                ? "Listening to you"
                                : mode === "ended"
                                    ? "Interview ended"
                                    : "Ready"}
                    </p>
                </div>
            </div>
        </div>
    );
}

function formatTranscript(messages: InterviewMessage[]) {
    return messages
        .map((message) => {
            const speaker = message.sender === "ai" ? "AI Interviewer" : "Candidate";
            const time = new Date(message.created_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
            });
            return `[${time}] ${speaker}: ${message.message}`;
        })
        .join("\n\n");
}

function pickPreferredVoice(voices: SpeechSynthesisVoice[]) {
    const preferredNames = [
        "Samantha",
        "Ava",
        "Google UK English Female",
        "Karen",
        "Moira",
    ];

    for (const preferredName of preferredNames) {
        const match = voices.find((voice) => voice.name.includes(preferredName));
        if (match) {
            return match;
        }
    }

    return (
        voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) || null
    );
}

export default function HrVoiceInterviewPage() {
    const params = useParams();
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const spokenQuestionIdRef = useRef<number | null>(null);
    const chosenVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    // Used to prevent double autoplay on initial load.
    const didAutoPlayRef = useRef(false);

    const [session, setSession] = useState<InterviewSession | null>(null);
    const [messages, setMessages] = useState<InterviewMessage[]>([]);
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [ending, setEnding] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [voiceInputSupported, setVoiceInputSupported] = useState(false);
    const [voiceOutputSupported, setVoiceOutputSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState("");
    const [voiceError, setVoiceError] = useState("");
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const latestAiQuestion = useMemo(() => {
        const reversed = [...messages].reverse();
        return reversed.find((message) => message.sender === "ai") || null;
    }, [messages]);

    const transcriptText = useMemo(() => formatTranscript(messages), [messages]);

    const orbMode: OrbMode = completed
        ? "ended"
        : isSpeaking
            ? "ai"
            : isListening
                ? "user"
                : "idle";

    const orbIntensity = completed ? 0.3 : isSpeaking ? 1 : isListening ? 0.95 : 0.45;

    const fetchMessages = useCallback(async () => {
        if (!token || !sessionId) return [];
        const response = await api.get(`/interviews/${sessionId}/messages`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const nextMessages = response.data || [];
        setMessages(nextMessages);
        return nextMessages;
    }, [sessionId, token]);

    const speakText = useCallback((text: string, messageId?: number) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.voice = chosenVoiceRef.current;

            utterance.onstart = () => {
                setVoiceError("");
                setIsSpeaking(true);
                if (messageId) {
                    spokenQuestionIdRef.current = messageId;
                }
            };

            utterance.onend = () => {
                setIsSpeaking(false);
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
    }, []);

    const playGeminiVoice = useCallback(async (messageId: number, text: string) => {
        // Mark early so the autoplay effect doesn't race and trigger twice.
        spokenQuestionIdRef.current = messageId;

        // Stop any in-progress playback first to avoid "glitching" overlaps.
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
        if (audioRef.current) {
            try {
                audioRef.current.pause();
            } catch { }
            audioRef.current = null;
        }

        if (!token || !sessionId) {
            speakText(text, messageId);
            return;
        }

        try {
            setVoiceError("");
            setIsSpeaking(true);
            const response = await api.get(
                `/interviews/${sessionId}/messages/${messageId}/voice-audio`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    responseType: "blob",
                }
            );

            const blob = new Blob([response.data], {
                type: response.data.type || "audio/wav",
            });
            const url = window.URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onended = () => {
                setIsSpeaking(false);
                window.URL.revokeObjectURL(url);
            };
            audio.onerror = () => {
                setIsSpeaking(false);
                window.URL.revokeObjectURL(url);
                setVoiceError("Gemini voice playback failed. Falling back to browser voice.");
                speakText(text, messageId);
            };

            await audio.play();
        } catch (error) {
            console.error("Failed to play Gemini voice:", error);
            setIsSpeaking(false);
            setVoiceError("Gemini voice playback failed. Falling back to browser voice.");
            speakText(text, messageId);
        }
    }, [sessionId, speakText, token]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const SpeechRecognitionCtor =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        setVoiceInputSupported(Boolean(SpeechRecognitionCtor));
        setVoiceOutputSupported("speechSynthesis" in window);

        if ("speechSynthesis" in window) {
            const loadVoices = () => {
                chosenVoiceRef.current = pickPreferredVoice(window.speechSynthesis.getVoices());
            };
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        if (!SpeechRecognitionCtor) return;

        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            setVoiceError("");
            setIsListening(true);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimText = "";
            let finalText = "";
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const transcript = event.results[index][0].transcript;
                if (event.results[index].isFinal) {
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

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            const errorCode = event.error || "unknown";
            if (errorCode !== "aborted") {
                setVoiceError(`Voice input error: ${errorCode}`);
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
            setLiveTranscript("");
        };

        recognitionRef.current = recognition;

        return () => {
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

        const fetchSession = async () => {
            try {
                const sessionResponse = await api.get(`/interviews/${sessionId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                setSession(sessionResponse.data);
                setTimeLeft(sessionResponse.data.duration * 60);

                if (sessionResponse.data.interview_type !== "hr_voice") {
                    router.push(`/interview/${sessionId}`);
                    return;
                }

                const nextMessages = await fetchMessages();
                if (sessionResponse.data.status === "completed") {
                    setCompleted(true);
                }
            } catch (error) {
                console.error("Failed to fetch HR voice interview session:", error);
                router.push("/dashboard");
            } finally {
                setLoading(false);
            }
        };

        fetchSession();
    }, [fetchMessages, playGeminiVoice, router, sessionId, token]);

    useEffect(() => {
        if (loading || completed || !latestAiQuestion) return;
        if (!voiceOutputSupported || spokenQuestionIdRef.current === latestAiQuestion.id) return;
        if (isListening || isSpeaking) return;

        // Avoid double-play on initial load (fetchSession + this effect).
        if (!didAutoPlayRef.current) {
            didAutoPlayRef.current = true;
        }
        playGeminiVoice(latestAiQuestion.id, latestAiQuestion.message);
    }, [
        completed,
        isListening,
        isSpeaking,
        latestAiQuestion,
        loading,
        playGeminiVoice,
        voiceOutputSupported,
    ]);

    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0 || completed) return;

        const interval = window.setInterval(() => {
            setTimeLeft((previous) => {
                if (previous === null) return null;
                if (previous <= 1) {
                    window.clearInterval(interval);
                    return 0;
                }
                return previous - 1;
            });
        }, 1000);

        return () => window.clearInterval(interval);
    }, [completed, timeLeft]);

    useEffect(() => {
        if (timeLeft !== 0 || !token || !sessionId || completed) return;

        const completeInterview = async () => {
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
                await fetchMessages();
                setCompleted(true);
            } catch (error) {
                console.error("Failed to auto-complete HR voice interview:", error);
            }
        };

        completeInterview();
    }, [completed, fetchMessages, sessionId, timeLeft, token]);

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    };

    const startListening = () => {
        if (!voiceInputSupported || !recognitionRef.current || isListening) return;

        try {
            if (isSpeaking && typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
            }
            setVoiceError("");
            recognitionRef.current.start();
        } catch (error) {
            console.error("Failed to start microphone:", error);
            setVoiceError("Could not start microphone input.");
        }
    };

    const stopListening = () => {
        if (!recognitionRef.current || !isListening) return;
        try {
            recognitionRef.current.stop();
        } catch (error) {
            console.error("Failed to stop microphone:", error);
        }
    };

    const handleSubmitAnswer = async () => {
        if (!answer.trim() || !token || !sessionId) return;

        setSubmitting(true);
        stopListening();

        try {
            const response = await api.post(
                `/interviews/${sessionId}/answer`,
                {
                    message: answer,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setMessages((previous) => [...previous, ...response.data.messages]);
            setAnswer("");
            setLiveTranscript("");

            if (response.data.completed) {
                setCompleted(true);
                await fetchMessages();
            }
        } catch (error) {
            console.error("Failed to submit HR voice answer:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEndInterview = async () => {
        if (!token || !sessionId) return;

        setEnding(true);
        stopListening();
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);

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
            await fetchMessages();
            setCompleted(true);
        } catch (error) {
            console.error("Failed to complete HR voice interview:", error);
        } finally {
            setEnding(false);
        }
    };

    const downloadTranscript = () => {
        const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `hr-interview-transcript-session-${sessionId}.txt`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    if (!sessionId || loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                Loading HR voice interview...
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
        <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-6%] top-[-8%] h-80 w-80 rounded-full bg-cyan-500/12 blur-3xl" />
                <div className="absolute right-[-12%] top-[12%] h-96 w-96 rounded-full bg-fuchsia-500/12 blur-3xl" />
                <div className="absolute bottom-[-10%] left-[24%] h-80 w-80 rounded-full bg-emerald-500/12 blur-3xl" />
            </div>

            <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-fuchsia-300">
                            HR Voice Interview
                        </div>
                        <h1 className="mt-4 text-4xl font-bold tracking-tight">
                            Conversational HR Session
                        </h1>
                        <p className="mt-3 max-w-3xl text-slate-300">
                            A voice-first interview flow focused on communication, presence,
                            motivation, and professional storytelling. Speak naturally and treat
                            it like a real HR screen.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400">
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 capitalize">
                                {session.role}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 capitalize">
                                {session.difficulty}
                            </span>
                            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
                                {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
                            </span>
                            {session.resume_title && (
                                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-300">
                                    Resume: {session.resume_title}
                                </span>
                            )}
                            {session.job_description_title && (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                                    JD: {session.job_description_title}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/dashboard"
                            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                            Back to Dashboard
                        </Link>
                        {!completed && (
                            <button
                                onClick={handleEndInterview}
                                disabled={ending}
                                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 font-medium text-amber-300 transition hover:bg-amber-500/15 disabled:opacity-60"
                            >
                                {ending ? "Ending..." : "End Interview"}
                            </button>
                        )}
                    </div>
                </div>

                {voiceError && (
                    <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {voiceError}
                    </div>
                )}

                {!voiceInputSupported && !voiceOutputSupported && (
                    <div className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        This browser does not support the voice features used here. You can still
                        type responses and continue the session.
                    </div>
                )}

                <div className="grid flex-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
                    <section className="rounded-[2rem] border border-slate-800 bg-slate-900/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        <div className="flex h-full flex-col justify-between">
                            <div>
                                <div className="mb-8 text-center">
                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                        Voice Presence Core
                                    </p>
                                    <div className="mt-6">
                                        <ParticleOrb mode={orbMode} intensity={orbIntensity} />
                                    </div>
                                </div>

                                <div className="mx-auto max-w-3xl rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 p-6 text-center">
                                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                                        Current interviewer prompt
                                    </p>
                                    <h2 className="mt-4 text-2xl font-semibold text-white">
                                        {completed
                                            ? "Transcript ready to review"
                                            : latestAiQuestion?.message || "Preparing your HR conversation..."}
                                    </h2>
                                </div>
                            </div>

                            {!completed ? (
                                <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            onClick={startListening}
                                            disabled={!voiceInputSupported || isListening || submitting}
                                            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                                        >
                                            {isListening ? "Listening..." : "Start Speaking"}
                                        </button>
                                        <button
                                            onClick={stopListening}
                                            disabled={!isListening}
                                            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                                        >
                                            Stop Mic
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!latestAiQuestion) return;
                                                playGeminiVoice(latestAiQuestion.id, latestAiQuestion.message);
                                            }}
                                            disabled={!voiceOutputSupported || !latestAiQuestion || isSpeaking}
                                            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 font-medium text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
                                        >
                                            {isSpeaking ? "Speaking..." : "Replay Question"}
                                        </button>
                                    </div>

                                    {liveTranscript && (
                                        <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                                            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                                                Live transcript
                                            </p>
                                            <p className="mt-2 text-sm leading-7 text-slate-200">
                                                {liveTranscript}
                                            </p>
                                        </div>
                                    )}

                                    <textarea
                                        rows={6}
                                        value={answer}
                                        onChange={(event) => setAnswer(event.target.value)}
                                        placeholder="Your spoken answer will appear here. You can also type if needed."
                                        className="mt-5 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-fuchsia-500"
                                    />

                                    <div className="mt-5 flex flex-wrap justify-between gap-3">
                                        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-400">
                                            Keep the answer natural, concise, and story-driven.
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAnswer("");
                                                    setLiveTranscript("");
                                                }}
                                                disabled={!answer.trim() && !liveTranscript}
                                                className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                onClick={handleSubmitAnswer}
                                                disabled={submitting || !answer.trim()}
                                                className="rounded-xl bg-fuchsia-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {submitting ? "Sending..." : "Send Response"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                        Conversation complete
                                    </p>
                                    <h3 className="mt-3 text-2xl font-semibold text-white">
                                        Transcript ready to review and download
                                    </h3>
                                    <p className="mt-3 max-w-2xl text-slate-300">
                                        Review the full HR conversation, download it as a text file,
                                        or continue to the report for scoring and synthesized guidance.
                                    </p>
                                    <div className="mt-5 flex flex-wrap gap-3">
                                        <button
                                            onClick={downloadTranscript}
                                            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 font-medium text-cyan-300 transition hover:bg-cyan-500/15"
                                        >
                                            Download Transcript
                                        </button>
                                        <Link
                                            href={`/interview/${sessionId}/report`}
                                            className="rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
                                        >
                                            View Full Report
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-slate-800 bg-slate-900/75 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
                        {!completed ? (
                            <>
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                    Conversation stream
                                </p>
                                <div className="mt-4 space-y-4">
                                    {messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`rounded-2xl p-4 ${message.sender === "ai"
                                                ? "border border-cyan-500/20 bg-cyan-500/10"
                                                : "border border-slate-800 bg-slate-950/80"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                                                    {message.sender === "ai" ? "AI interviewer" : "You"}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(message.created_at).toLocaleTimeString([], {
                                                        hour: "numeric",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                            <p className="mt-3 leading-7 text-slate-200">
                                                {message.message}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                    Downloadable transcript
                                </p>
                                <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
                                    <pre className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-slate-200">
                                        {transcriptText || "No transcript available."}
                                    </pre>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}
