import asyncio
import re
from typing import Optional, Tuple

from google import genai
from google.genai import types

from app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None


def _parse_sample_rate(mime_type: str) -> int:
    match = re.search(r"rate=(\d+)", mime_type or "")
    if match:
        return int(match.group(1))
    return 24000


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int, channels: int = 1, bits_per_sample: int = 16) -> bytes:
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    data_size = len(pcm_bytes)
    riff_chunk_size = 36 + data_size

    header = b"".join(
        [
            b"RIFF",
            riff_chunk_size.to_bytes(4, "little"),
            b"WAVE",
            b"fmt ",
            (16).to_bytes(4, "little"),
            (1).to_bytes(2, "little"),
            channels.to_bytes(2, "little"),
            sample_rate.to_bytes(4, "little"),
            byte_rate.to_bytes(4, "little"),
            block_align.to_bytes(2, "little"),
            bits_per_sample.to_bytes(2, "little"),
            b"data",
            data_size.to_bytes(4, "little"),
        ]
    )
    return header + pcm_bytes


async def synthesize_hr_voice_audio(
    text: str,
    voice_name: Optional[str] = None,
) -> Tuple[bytes, str]:
    if not settings.GEMINI_API_KEY or client is None:
        raise ValueError("GEMINI_API_KEY is not configured")

    if not text.strip():
        raise ValueError("Text cannot be empty")

    chosen_voice = voice_name or settings.GEMINI_HR_VOICE

    config = {
        "response_modalities": ["AUDIO"],
        "speech_config": types.SpeechConfig(
            language_code="en-US",
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=chosen_voice,
                )
            ),
        ),
        "system_instruction": (
            "You are a warm, calm, professional HR interviewer voice. Speak naturally, with human pacing and encouraging tone."
        ),
    }

    audio_bytes = b""
    mime_type = "audio/wav"

    async with client.aio.live.connect(
        model=settings.GEMINI_LIVE_MODEL,
        config=config,
    ) as session:
        await session.send_client_content(
            turns=types.Content(
                role="user",
                parts=[types.Part(text=text)],
            ),
            turn_complete=True,
        )

        async for message in session.receive():
            if (
                message.server_content
                and message.server_content.model_turn
                and message.server_content.model_turn.parts
            ):
                for part in message.server_content.model_turn.parts:
                    if part.inline_data and part.inline_data.data:
                        part_mime = part.inline_data.mime_type or ""
                        if part_mime:
                            mime_type = part_mime
                        audio_bytes += part.inline_data.data
            await asyncio.sleep(0)

    if not audio_bytes:
        raise ValueError("Gemini Live returned no audio data")

    if mime_type.startswith("audio/pcm"):
        sample_rate = _parse_sample_rate(mime_type)
        return _pcm_to_wav(audio_bytes, sample_rate), "audio/wav"

    return audio_bytes, mime_type or "audio/wav"
