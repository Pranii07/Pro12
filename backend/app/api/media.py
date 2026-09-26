"""
NeuroScreen — Media Processing API Endpoints
==============================================
Dedicated endpoints for speech and facial media uploads.

Pipeline (Section 6 of the architecture):
  1. Browser captures a bounded clip (audio / frame burst)
  2. Single HTTPS upload to these endpoints
  3. FastAPI extracts numeric features IN MEMORY
  4. Raw bytes are discarded immediately after extraction
  5. Only the feature vector is returned (and can be persisted via module results)

Raw audio/video is NEVER written to disk, Supabase Storage, or any
persistent store. It exists only in RAM during the feature extraction
call and is garbage collected when the request handler returns.

Both modules are skippable — these endpoints are only called when
the user chooses to complete the speech or facial module.
"""

from __future__ import annotations

import io
import logging
import time

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import TokenData, get_current_user
from app.schemas.media import (
    SpeechFeaturesResponse,
    SpeechUploadResponse,
    FacialFeaturesResponse,
    FacialUploadResponse,
    EmotionIndicators,
)
from app.services.speech_processor import speech_processor, SpeechProcessor
from app.services.facial_processor import facial_processor, FacialProcessor

logger = logging.getLogger("neuroscreen.media")

router = APIRouter(prefix="/media", tags=["Media Processing"])

# Max upload sizes (enforced at application level)
MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024   # 10 MB
MAX_FRAMES_COUNT = 60                      # Max 60 frames
MAX_FRAME_SIZE_BYTES = 200 * 1024          # 200 KB per frame


# -------------------------------------------------------
# Request schema for facial upload
# -------------------------------------------------------

class FacialUploadRequest(BaseModel):
    """Request body for facial frame upload."""
    assessment_id: str = Field(description="The assessment session ID")
    frames: list[str] = Field(
        description="List of base64-encoded JPEG frames",
        max_length=MAX_FRAMES_COUNT,
    )
    capture_duration_seconds: float = Field(
        gt=0, le=60,
        description="Total capture duration in seconds"
    )


# -------------------------------------------------------
# Speech Upload Endpoint
# -------------------------------------------------------

@router.post(
    "/speech",
    response_model=SpeechUploadResponse,
    summary="Process Speech Audio",
    description=(
        "Upload a bounded audio recording for speech feature extraction. "
        "The audio is processed IN MEMORY and immediately discarded. "
        "Only the extracted numeric features are returned.\n\n"
        "Accepted formats: WAV, WebM, OGG. Max size: 10 MB.\n\n"
        "⚠️ Disclaimer: This is for behavioural screening / research only."
    ),
)
async def process_speech(
    audio_file: UploadFile = File(
        description="Audio recording (WAV/WebM/OGG, max 10MB)"
    ),
    assessment_id: str = Form(description="Assessment session ID"),
    language: str = Form(default="en", description="Language code: 'en' or 'kn'"),
    user: TokenData = Depends(get_current_user),
):
    """
    Process speech audio and extract behavioural features.

    The raw audio bytes are held in memory ONLY during this request.
    They are never written to disk or any persistent storage.
    """
    start_time = time.monotonic()

    # --- Validate file size ---
    audio_bytes = await audio_file.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio file too large. Maximum: {MAX_AUDIO_SIZE_BYTES // (1024*1024)} MB.",
        )

    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio file.",
        )

    # --- Convert to WAV if needed ---
    wav_bytes = _convert_to_wav(audio_bytes, audio_file.content_type or "")

    # --- Extract features ---
    features = speech_processor.extract_features(wav_bytes, language=language)
    score = SpeechProcessor.compute_score(features)

    elapsed = time.monotonic() - start_time
    logger.info(
        f"Speech processing complete for user={user.user_id}, "
        f"assessment={assessment_id}, duration={features['duration_seconds']}s, "
        f"processing_time={elapsed:.2f}s"
    )

    # --- Raw audio bytes are now out of scope and will be GC'd ---
    del audio_bytes
    del wav_bytes

    return SpeechUploadResponse(
        success=True,
        features=SpeechFeaturesResponse(**features),
        score=score,
    )


# -------------------------------------------------------
# Facial Upload Endpoint
# -------------------------------------------------------

@router.post(
    "/facial",
    response_model=FacialUploadResponse,
    summary="Process Facial Frames",
    description=(
        "Upload a burst of camera frames for facial feature extraction. "
        "Frames are processed IN MEMORY and immediately discarded. "
        "Only the extracted numeric features are returned.\n\n"
        "Max frames: 60. Each frame: base64-encoded JPEG.\n\n"
        "⚠️ Emotion indicators are EXPERIMENTAL / NON-DIAGNOSTIC.\n"
        "⚠️ Disclaimer: This is for behavioural screening / research only."
    ),
)
async def process_facial(
    body: FacialUploadRequest,
    user: TokenData = Depends(get_current_user),
):
    """
    Process facial video frames and extract behavioural features.

    The raw frame data is held in memory ONLY during this request.
    It is never written to disk or any persistent storage.
    """
    start_time = time.monotonic()

    if not body.frames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No frames provided.",
        )

    if len(body.frames) > MAX_FRAMES_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many frames. Maximum: {MAX_FRAMES_COUNT}.",
        )

    # --- Decode base64 frames ---
    decoded_frames = FacialProcessor.decode_base64_frames(body.frames)

    if not decoded_frames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid frames could be decoded.",
        )

    # --- Extract features ---
    features = facial_processor.extract_features(
        decoded_frames,
        capture_duration_seconds=body.capture_duration_seconds,
    )
    score = FacialProcessor.compute_score(features)

    elapsed = time.monotonic() - start_time
    logger.info(
        f"Facial processing complete for user={user.user_id}, "
        f"assessment={body.assessment_id}, "
        f"frames={features['frames_processed']}, "
        f"processing_time={elapsed:.2f}s"
    )

    # --- Raw frame data is now out of scope and will be GC'd ---
    del decoded_frames
    del body

    # Build response
    emotion = features.get("emotion_indicators")
    emotion_model = None
    if emotion:
        emotion_model = EmotionIndicators(
            smile_likelihood=emotion.get("smile_likelihood", 0),
            label=emotion.get("label", "Experimental / Non-diagnostic"),
        )

    return FacialUploadResponse(
        success=True,
        features=FacialFeaturesResponse(
            blink_rate_per_minute=features["blink_rate_per_minute"],
            avg_head_movement=features["avg_head_movement"],
            head_orientation_stability=features["head_orientation_stability"],
            attention_score=features["attention_score"],
            frames_processed=features["frames_processed"],
            capture_duration_seconds=features["capture_duration_seconds"],
            emotion_indicators=emotion_model,
            processing_note=features.get("processing_note", ""),
        ),
        score=score,
    )


# -------------------------------------------------------
# Audio Format Conversion Helper
# -------------------------------------------------------

def _convert_to_wav(audio_bytes: bytes, content_type: str) -> bytes:
    """
    Convert audio bytes to WAV format if needed.

    The frontend now records directly in WAV format (16kHz mono PCM),
    so this mostly acts as a passthrough. Falls back to soundfile
    for any other format — no ffmpeg dependency.
    """
    # If already WAV (RIFF header), pass through directly
    if audio_bytes[:4] == b"RIFF" or content_type in (
        "audio/wav", "audio/wave", "audio/x-wav",
    ):
        logger.info("Audio is already WAV format, passing through.")
        return audio_bytes

    # Fallback: try reading with soundfile (handles WAV, FLAC, OGG/Vorbis)
    try:
        import soundfile as sf
        import numpy as np

        audio_buffer = io.BytesIO(audio_bytes)
        y, sr = sf.read(audio_buffer)

        # Convert to mono if stereo
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)

        # Resample to 16kHz if needed
        if sr != 16000:
            try:
                import librosa
                y = librosa.resample(y.astype(np.float32), orig_sr=sr, target_sr=16000)
                sr = 16000
            except ImportError:
                pass

        # Write as WAV
        wav_buffer = io.BytesIO()
        sf.write(wav_buffer, y, sr, format="WAV", subtype="PCM_16")
        logger.info(f"Converted audio from '{content_type}' to WAV via soundfile.")
        return wav_buffer.getvalue()

    except Exception as e:
        logger.warning(
            f"Audio conversion failed ({content_type}): {e}. "
            f"Treating as raw WAV (may fail downstream)."
        )
        return audio_bytes
