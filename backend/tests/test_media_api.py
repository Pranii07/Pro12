"""
NeuroScreen — Media API Endpoint Tests
=========================================
Tests for the speech and facial media upload endpoints.

These tests verify:
  - Input validation (file size, empty files, frame count limits)
  - Authentication requirements (401 without token)
  - Correct response structure

Note: Tests that call the actual processing endpoints mock the
processor services to avoid needing Vosk models, MediaPipe, etc.
"""

import pytest
import json
import io
import base64
import struct
from unittest.mock import patch, MagicMock

import numpy as np


# -------------------------------------------------------
# Speech Endpoint Tests
# -------------------------------------------------------

class TestSpeechEndpointValidation:
    """Test POST /api/media/speech input validation."""

    def test_empty_audio_rejected(self, client):
        """Empty audio file → 400."""
        response = client.post(
            "/api/media/speech",
            data={"assessment_id": "test-123", "language": "en"},
            files={"audio_file": ("recording.webm", b"", "audio/webm")},
        )
        assert response.status_code == 400
        assert "Empty audio" in response.json().get("detail", "")

    def test_oversized_audio_rejected(self, client):
        """Audio file > 10MB → 413."""
        # Create a 11MB dummy file
        big_audio = b"\x00" * (11 * 1024 * 1024)
        response = client.post(
            "/api/media/speech",
            data={"assessment_id": "test-123", "language": "en"},
            files={"audio_file": ("recording.webm", big_audio, "audio/webm")},
        )
        assert response.status_code == 413

    def test_missing_assessment_id_rejected(self, client):
        """Missing assessment_id → 422 (validation error)."""
        # Create a minimal WAV header
        wav_data = _create_minimal_wav()
        response = client.post(
            "/api/media/speech",
            files={"audio_file": ("recording.wav", wav_data, "audio/wav")},
        )
        assert response.status_code == 422

    @patch("app.api.media.speech_processor")
    def test_successful_speech_processing(self, mock_processor, client):
        """Valid audio + mock processor → 200 with features."""
        mock_processor.extract_features.return_value = {
            "speech_rate_wpm": 140.5,
            "avg_pause_duration_ms": 320.0,
            "fluency_score": 72.3,
            "transcript": "test transcript",
            "duration_seconds": 10.5,
            "processing_note": "",
        }
        # Mock the static compute_score method on the class
        with patch("app.api.media.SpeechProcessor.compute_score", return_value=75.0):
            wav_data = _create_minimal_wav()
            response = client.post(
                "/api/media/speech",
                data={"assessment_id": "test-123", "language": "en"},
                files={"audio_file": ("recording.wav", wav_data, "audio/wav")},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "features" in data
        assert "score" in data
        assert "disclaimer" in data
        assert data["features"]["speech_rate_wpm"] == 140.5


# -------------------------------------------------------
# Facial Endpoint Tests
# -------------------------------------------------------

class TestFacialEndpointValidation:
    """Test POST /api/media/facial input validation."""

    def test_empty_frames_rejected(self, client):
        """Empty frames list → 400."""
        response = client.post(
            "/api/media/facial",
            json={
                "assessment_id": "test-123",
                "frames": [],
                "capture_duration_seconds": 15.0,
            },
        )
        assert response.status_code == 400
        assert "No frames" in response.json().get("detail", "")

    def test_too_many_frames_rejected(self, client):
        """More than 60 frames → 400 or 422."""
        response = client.post(
            "/api/media/facial",
            json={
                "assessment_id": "test-123",
                "frames": ["dGVzdA=="] * 61,  # 61 base64 frames
                "capture_duration_seconds": 15.0,
            },
        )
        # Could be 400 from our check or 422 from Pydantic max_length
        assert response.status_code in (400, 422)

    def test_invalid_capture_duration(self, client):
        """Negative capture duration → 422."""
        response = client.post(
            "/api/media/facial",
            json={
                "assessment_id": "test-123",
                "frames": ["dGVzdA=="],
                "capture_duration_seconds": -1,
            },
        )
        assert response.status_code == 422

    def test_zero_capture_duration(self, client):
        """Zero capture duration → 422."""
        response = client.post(
            "/api/media/facial",
            json={
                "assessment_id": "test-123",
                "frames": ["dGVzdA=="],
                "capture_duration_seconds": 0,
            },
        )
        assert response.status_code == 422

    @patch("app.api.media.FacialProcessor.decode_base64_frames")
    @patch("app.api.media.facial_processor")
    def test_successful_facial_processing(self, mock_processor, mock_decode, client):
        """Valid frames + mock processor → 200 with features."""
        # Mock decode to return a dummy frame
        mock_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        mock_decode.return_value = [mock_frame]

        mock_processor.extract_features.return_value = {
            "blink_rate_per_minute": 15.0,
            "avg_head_movement": 0.12,
            "head_orientation_stability": 85.0,
            "attention_score": 92.0,
            "frames_processed": 1,
            "capture_duration_seconds": 15.0,
            "emotion_indicators": {
                "smile_likelihood": 0.3,
                "label": "Experimental / Non-diagnostic",
            },
            "processing_note": "",
        }

        with patch("app.api.media.FacialProcessor.compute_score", return_value=80.0):
            response = client.post(
                "/api/media/facial",
                json={
                    "assessment_id": "test-123",
                    "frames": ["dGVzdA=="],
                    "capture_duration_seconds": 15.0,
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "features" in data
        assert "score" in data
        assert "disclaimer" in data
        assert data["features"]["blink_rate_per_minute"] == 15.0

    @patch("app.api.media.FacialProcessor.decode_base64_frames")
    def test_no_valid_frames_decoded(self, mock_decode, client):
        """All frames fail to decode → 400."""
        mock_decode.return_value = []

        response = client.post(
            "/api/media/facial",
            json={
                "assessment_id": "test-123",
                "frames": ["invalid-base64"],
                "capture_duration_seconds": 15.0,
            },
        )
        assert response.status_code == 400
        assert "No valid frames" in response.json().get("detail", "")


# -------------------------------------------------------
# Authentication Tests
# -------------------------------------------------------

class TestMediaAuthRequired:
    """Test that media endpoints require authentication."""

    def test_speech_requires_auth(self, unauthenticated_client):
        """Speech endpoint without token → 401 or 403."""
        wav_data = _create_minimal_wav()
        response = unauthenticated_client.post(
            "/api/media/speech",
            data={"assessment_id": "test-123", "language": "en"},
            files={"audio_file": ("recording.wav", wav_data, "audio/wav")},
        )
        assert response.status_code in (401, 403)

    def test_facial_requires_auth(self, unauthenticated_client):
        """Facial endpoint without token → 401 or 403."""
        response = unauthenticated_client.post(
            "/api/media/facial",
            json={
                "assessment_id": "test-123",
                "frames": ["dGVzdA=="],
                "capture_duration_seconds": 15.0,
            },
        )
        assert response.status_code in (401, 403)


# -------------------------------------------------------
# Helpers
# -------------------------------------------------------

def _create_minimal_wav(
    sample_rate: int = 16000,
    duration_seconds: float = 0.1,
    channels: int = 1,
    sample_width: int = 2,
) -> bytes:
    """Create a minimal valid WAV file in memory."""
    num_samples = int(sample_rate * duration_seconds)
    data_size = num_samples * channels * sample_width
    file_size = 36 + data_size

    buf = io.BytesIO()
    # RIFF header
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", file_size))
    buf.write(b"WAVE")
    # fmt chunk
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))  # chunk size
    buf.write(struct.pack("<H", 1))   # PCM format
    buf.write(struct.pack("<H", channels))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * channels * sample_width))  # byte rate
    buf.write(struct.pack("<H", channels * sample_width))  # block align
    buf.write(struct.pack("<H", sample_width * 8))  # bits per sample
    # data chunk
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(b"\x00" * data_size)

    return buf.getvalue()
