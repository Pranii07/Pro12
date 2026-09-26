"""
NeuroScreen — Facial Processor Unit Tests
============================================
Tests for the facial feature extraction service.

These tests use deterministic inputs (known feature dicts, synthetic
EAR sequences, mock landmark coordinates) so they don't require
MediaPipe, OpenCV, or a camera.
"""

import pytest
import math
import base64
import numpy as np


class TestFacialProcessorScore:
    """Test FacialProcessor.compute_score() with known inputs."""

    def test_perfect_score(self):
        """Full attention + stable head + normal blink rate → score near 100."""
        from app.services.facial_processor import FacialProcessor

        features = {
            "attention_score": 100,
            "head_orientation_stability": 100,
            "blink_rate_per_minute": 17,  # Ideal blink rate
        }
        score = FacialProcessor.compute_score(features)
        assert 95 <= score <= 100, f"Expected near-perfect score, got {score}"

    def test_zero_features(self):
        """All zeros → score 0."""
        from app.services.facial_processor import FacialProcessor

        features = {
            "attention_score": 0,
            "head_orientation_stability": 0,
            "blink_rate_per_minute": 0,
        }
        score = FacialProcessor.compute_score(features)
        assert score == 0.0

    def test_moderate_score(self):
        """Moderate values → mid-range score."""
        from app.services.facial_processor import FacialProcessor

        features = {
            "attention_score": 70,
            "head_orientation_stability": 60,
            "blink_rate_per_minute": 12,
        }
        score = FacialProcessor.compute_score(features)
        assert 40 <= score <= 80, f"Expected mid-range, got {score}"

    def test_abnormal_blink_rate_low(self):
        """Very low blink rate penalised."""
        from app.services.facial_processor import FacialProcessor

        features = {
            "attention_score": 90,
            "head_orientation_stability": 90,
            "blink_rate_per_minute": 3,  # Very low
        }
        score = FacialProcessor.compute_score(features)
        # Blink component will be low, dragging score down
        assert score < 90

    def test_abnormal_blink_rate_high(self):
        """Very high blink rate penalised."""
        from app.services.facial_processor import FacialProcessor

        features = {
            "attention_score": 90,
            "head_orientation_stability": 90,
            "blink_rate_per_minute": 50,  # Very high
        }
        score = FacialProcessor.compute_score(features)
        assert score < 80

    def test_score_clamped(self):
        """Score always in [0, 100]."""
        from app.services.facial_processor import FacialProcessor

        features = {
            "attention_score": 100,
            "head_orientation_stability": 100,
            "blink_rate_per_minute": 17,
        }
        score = FacialProcessor.compute_score(features)
        assert 0 <= score <= 100

    def test_missing_keys_default_zero(self):
        """Missing keys → default 0, no crash."""
        from app.services.facial_processor import FacialProcessor

        score = FacialProcessor.compute_score({})
        assert 0 <= score <= 100


class TestFacialProcessorEmptyFeatures:
    """Test _empty_features() factory method."""

    def test_returns_correct_keys(self):
        from app.services.facial_processor import FacialProcessor

        features = FacialProcessor._empty_features(
            frames_processed=10,
            capture_duration_seconds=15.0,
            note="test note",
        )
        assert features["blink_rate_per_minute"] == 0.0
        assert features["avg_head_movement"] == 0.0
        assert features["head_orientation_stability"] == 0.0
        assert features["attention_score"] == 0.0
        assert features["frames_processed"] == 10
        assert features["capture_duration_seconds"] == 15.0
        assert features["emotion_indicators"] is None
        assert features["processing_note"] == "test note"

    def test_default_values(self):
        from app.services.facial_processor import FacialProcessor

        features = FacialProcessor._empty_features()
        assert features["frames_processed"] == 0
        assert features["capture_duration_seconds"] == 0
        assert features["processing_note"] == ""


class TestBlinkCounting:
    """Test _count_blinks() with synthetic EAR sequences."""

    def test_no_blinks(self):
        """EAR always above threshold → 0 blinks."""
        from app.services.facial_processor import FacialProcessor

        ear_values = [0.30, 0.31, 0.29, 0.30, 0.32, 0.30]
        count = FacialProcessor._count_blinks(ear_values)
        assert count == 0

    def test_single_blink(self):
        """One dip below threshold for 2+ frames → 1 blink."""
        from app.services.facial_processor import FacialProcessor

        ear_values = [0.30, 0.30, 0.15, 0.10, 0.30, 0.30]
        count = FacialProcessor._count_blinks(ear_values)
        assert count == 1

    def test_two_blinks(self):
        """Two separate dips → 2 blinks."""
        from app.services.facial_processor import FacialProcessor

        ear_values = [0.30, 0.10, 0.10, 0.30, 0.30, 0.10, 0.10, 0.30]
        count = FacialProcessor._count_blinks(ear_values)
        assert count == 2

    def test_blink_at_end(self):
        """Blink at the end of sequence (eyes close and stay closed)."""
        from app.services.facial_processor import FacialProcessor

        ear_values = [0.30, 0.30, 0.30, 0.10, 0.10]
        count = FacialProcessor._count_blinks(ear_values)
        assert count == 1

    def test_single_frame_dip_no_blink(self):
        """Single frame below threshold → not a blink (needs 2+ consecutive)."""
        from app.services.facial_processor import FacialProcessor

        ear_values = [0.30, 0.10, 0.30, 0.30]
        count = FacialProcessor._count_blinks(ear_values)
        assert count == 0

    def test_empty_sequence(self):
        """Empty EAR list → 0 blinks."""
        from app.services.facial_processor import FacialProcessor

        count = FacialProcessor._count_blinks([])
        assert count == 0

    def test_too_short(self):
        """Sequence shorter than EAR_CONSEC_FRAMES → 0 blinks."""
        from app.services.facial_processor import FacialProcessor

        count = FacialProcessor._count_blinks([0.10])
        assert count == 0


class TestHeadMovement:
    """Test _compute_avg_movement() with known position lists."""

    def test_no_movement(self):
        """Same position every frame → 0 movement."""
        from app.services.facial_processor import FacialProcessor

        positions = [(100, 100)] * 10
        avg = FacialProcessor._compute_avg_movement(positions)
        assert avg == 0.0

    def test_known_movement(self):
        """Known displacement → expected average."""
        from app.services.facial_processor import FacialProcessor

        # Move 10px right each frame (9 movements for 10 positions)
        positions = [(i * 10, 100) for i in range(10)]
        avg = FacialProcessor._compute_avg_movement(positions)
        # Each movement = 10px, normalized by /50 → 0.2 each, average = 0.2
        assert abs(avg - 0.2) < 0.01, f"Expected 0.2, got {avg}"

    def test_large_movement_capped(self):
        """Large movement normalised to max 1.0."""
        from app.services.facial_processor import FacialProcessor

        positions = [(0, 0), (200, 200)]  # ~283px displacement
        avg = FacialProcessor._compute_avg_movement(positions)
        assert avg == 1.0

    def test_single_position(self):
        """Single position → 0 movement."""
        from app.services.facial_processor import FacialProcessor

        avg = FacialProcessor._compute_avg_movement([(100, 100)])
        assert avg == 0.0

    def test_empty_positions(self):
        """Empty list → 0 movement."""
        from app.services.facial_processor import FacialProcessor

        avg = FacialProcessor._compute_avg_movement([])
        assert avg == 0.0


class TestOrientationStability:
    """Test _compute_orientation_stability() with known pose lists."""

    def test_perfectly_stable(self):
        """Same pose every frame → stability = 100."""
        from app.services.facial_processor import FacialProcessor

        poses = [(0.0, 0.0, 0.0)] * 10
        stability = FacialProcessor._compute_orientation_stability(poses)
        assert stability == 100.0

    def test_moderate_instability(self):
        """Some variance → stability between 0 and 100."""
        from app.services.facial_processor import FacialProcessor

        poses = [(i * 2.0, i * 1.5, 0.0) for i in range(10)]
        stability = FacialProcessor._compute_orientation_stability(poses)
        assert 0 < stability < 100

    def test_high_instability(self):
        """Large variance → stability near 0."""
        from app.services.facial_processor import FacialProcessor

        poses = [(i * 30.0, i * 30.0, 0.0) for i in range(10)]
        stability = FacialProcessor._compute_orientation_stability(poses)
        assert stability <= 10, f"Expected very low stability, got {stability}"

    def test_single_pose(self):
        """Single pose → 100 (not enough data to measure instability)."""
        from app.services.facial_processor import FacialProcessor

        stability = FacialProcessor._compute_orientation_stability([(5.0, 3.0, 1.0)])
        assert stability == 100.0


class TestSmileDetection:
    """Test _detect_smile() with mock landmark coordinates."""

    def test_neutral_face(self):
        """Landmarks with neutral mouth proportions → low smile score."""
        from app.services.facial_processor import FacialProcessor

        # Create 468 dummy landmarks, set mouth landmarks
        landmarks = [(0.0, 0.0, 0.0)] * 468

        # MOUTH_IDX = [13, 14, 61, 291]
        # Upper lip (13), Lower lip (14) — close together (small height)
        landmarks[13] = (320.0, 240.0, 0.0)  # upper lip
        landmarks[14] = (320.0, 250.0, 0.0)  # lower lip (10px height)

        # Left corner (61), Right corner (291) — moderate width
        landmarks[61] = (300.0, 245.0, 0.0)   # left corner
        landmarks[291] = (340.0, 245.0, 0.0)  # right corner (40px width)

        # MAR = 40/10 = 4.0 → smile_score = (4.0 - 2.0) / 2.0 = 1.0
        # This is actually wide open mouth — let's adjust
        # For neutral: width ~= 2 * height → MAR ≈ 2.0 → score ≈ 0.0
        landmarks[61] = (310.0, 245.0, 0.0)
        landmarks[291] = (330.0, 245.0, 0.0)  # 20px width
        # MAR = 20/10 = 2.0 → score = (2.0 - 2.0) / 2.0 = 0.0

        smile = FacialProcessor._detect_smile(landmarks)
        assert smile == 0.0

    def test_clear_smile(self):
        """Wide mouth relative to height → high smile score."""
        from app.services.facial_processor import FacialProcessor

        landmarks = [(0.0, 0.0, 0.0)] * 468
        landmarks[13] = (320.0, 240.0, 0.0)
        landmarks[14] = (320.0, 250.0, 0.0)   # 10px height
        landmarks[61] = (280.0, 245.0, 0.0)
        landmarks[291] = (360.0, 245.0, 0.0)  # 80px width
        # MAR = 80/10 = 8.0 → score = min(1, (8-2)/2) = 1.0

        smile = FacialProcessor._detect_smile(landmarks)
        assert smile == 1.0

    def test_zero_height(self):
        """Zero mouth height → 0.0 (avoid division by zero)."""
        from app.services.facial_processor import FacialProcessor

        landmarks = [(0.0, 0.0, 0.0)] * 468
        landmarks[13] = (320.0, 245.0, 0.0)
        landmarks[14] = (320.0, 245.0, 0.0)  # Same Y → 0 height
        landmarks[61] = (300.0, 245.0, 0.0)
        landmarks[291] = (340.0, 245.0, 0.0)

        smile = FacialProcessor._detect_smile(landmarks)
        assert smile == 0.0


class TestDecodeBase64Frames:
    """Test decode_base64_frames() with valid and invalid inputs."""

    def test_empty_list(self):
        """Empty input → empty output."""
        from app.services.facial_processor import FacialProcessor

        result = FacialProcessor.decode_base64_frames([])
        assert result == []

    def test_invalid_base64(self):
        """Invalid base64 strings → skipped, empty output."""
        from app.services.facial_processor import FacialProcessor

        result = FacialProcessor.decode_base64_frames(["not-valid-base64!!!"])
        assert result == []

    def test_valid_jpeg_frame(self):
        """Valid base64-encoded JPEG → decoded to numpy array."""
        from app.services.facial_processor import FacialProcessor
        import cv2

        # Create a small 10x10 red image, encode as JPEG, then base64
        img = np.zeros((10, 10, 3), dtype=np.uint8)
        img[:, :, 2] = 255  # Red in BGR
        _, buf = cv2.imencode('.jpg', img)
        b64 = base64.b64encode(buf.tobytes()).decode('utf-8')

        result = FacialProcessor.decode_base64_frames([b64])
        assert len(result) == 1
        assert result[0].shape == (10, 10, 3)

    def test_data_uri_prefix_stripped(self):
        """data:image/jpeg;base64,... prefix stripped correctly."""
        from app.services.facial_processor import FacialProcessor
        import cv2

        img = np.zeros((10, 10, 3), dtype=np.uint8)
        _, buf = cv2.imencode('.jpg', img)
        b64 = base64.b64encode(buf.tobytes()).decode('utf-8')
        data_uri = f"data:image/jpeg;base64,{b64}"

        result = FacialProcessor.decode_base64_frames([data_uri])
        assert len(result) == 1

    def test_mixed_valid_invalid(self):
        """Mix of valid and invalid → only valid frames returned."""
        from app.services.facial_processor import FacialProcessor
        import cv2

        img = np.zeros((10, 10, 3), dtype=np.uint8)
        _, buf = cv2.imencode('.jpg', img)
        b64 = base64.b64encode(buf.tobytes()).decode('utf-8')

        result = FacialProcessor.decode_base64_frames([
            "invalid",
            b64,
            "also-invalid",
            b64,
        ])
        assert len(result) == 2
