"""
NeuroScreen — Facial Feature Extraction Service
==================================================
Extracts behavioural features from a burst of facial video frames:
  - Blink rate (Eye Aspect Ratio / EAR method)
  - Head movement (frame-to-frame landmark displacement)
  - Head orientation stability (yaw/pitch variance)
  - Attention score (% frames with face detected + oriented forward)
  - Emotion indicators (EXPERIMENTAL — smile detection from mouth landmarks)

All processing is done IN MEMORY using OpenCV + MediaPipe Face Mesh.
Raw frame data is never written to disk or any persistent storage.
It is garbage collected after feature extraction completes.

Emotion analysis (if extracted) is labeled "Experimental / Non-diagnostic"
and is NEVER treated as a screening signal — display-only.
"""

from __future__ import annotations

import base64
import logging
import math
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger("neuroscreen.facial")

# -------------------------------------------------------
# Eye landmark indices for MediaPipe Face Mesh (468 landmarks)
# Used for Eye Aspect Ratio (EAR) blink detection
# -------------------------------------------------------
# Left eye vertical: top [159, 145], bottom [153, 144]
# Left eye horizontal: inner [133], outer [33]
LEFT_EYE_IDX = [33, 133, 159, 145, 153, 144]
# Right eye vertical: top [386, 374], bottom [380, 373]
# Right eye horizontal: inner [362], outer [263]
RIGHT_EYE_IDX = [263, 362, 386, 374, 380, 373]

# Mouth landmarks for smile detection (experimental)
# Upper lip top: 13, Lower lip bottom: 14
# Left corner: 61, Right corner: 291
MOUTH_IDX = [13, 14, 61, 291]

# Nose tip for head pose reference
NOSE_TIP_IDX = 1

# Key landmarks for head pose estimation
# Nose tip, chin, left/right eye corner, left/right mouth corner
POSE_LANDMARK_IDX = [1, 152, 33, 263, 61, 291]

# EAR threshold for blink detection
EAR_THRESHOLD = 0.21
EAR_CONSEC_FRAMES = 2  # Min consecutive frames below threshold = 1 blink


class FacialProcessor:
    """
    Stateless facial feature extractor using MediaPipe Face Mesh.

    All methods take decoded image frames and return numeric features.
    No state is retained between calls.
    """

    def __init__(self):
        self._face_mesh = None

    def _get_face_mesh(self):
        """Lazy-load MediaPipe Face Mesh to avoid import-time overhead."""
        if self._face_mesh is None:
            import mediapipe as mp
            self._face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,  # Process individual frames
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        return self._face_mesh

    def extract_features(
        self,
        frames: list[np.ndarray],
        capture_duration_seconds: float,
    ) -> dict:
        """
        Extract all facial features from a list of decoded image frames.

        Args:
            frames: List of BGR numpy arrays (OpenCV format)
            capture_duration_seconds: Total capture duration in seconds

        Returns:
            dict with blink_rate_per_minute, avg_head_movement,
            head_orientation_stability, attention_score, emotion_indicators, etc.
        """
        if not frames:
            return self._empty_features(
                frames_processed=0,
                capture_duration_seconds=capture_duration_seconds,
                note="No frames provided."
            )

        face_mesh = self._get_face_mesh()

        # Process each frame
        all_landmarks: list[Optional[list]] = []
        all_ear_values: list[float] = []
        all_nose_positions: list[tuple[float, float]] = []
        all_head_poses: list[tuple[float, float, float]] = []
        face_detected_count = 0
        smile_values: list[float] = []

        for i, frame in enumerate(frames):
            try:
                h, w = frame.shape[:2]
                # MediaPipe expects RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = face_mesh.process(rgb_frame)

                if results.multi_face_landmarks:
                    face_detected_count += 1
                    landmarks = results.multi_face_landmarks[0].landmark

                    # Store landmark positions
                    lm_list = [(lm.x * w, lm.y * h, lm.z * w) for lm in landmarks]
                    all_landmarks.append(lm_list)

                    # Eye Aspect Ratio for blink detection
                    ear = self._compute_ear(lm_list)
                    all_ear_values.append(ear)

                    # Nose tip position for head movement tracking
                    nose = lm_list[NOSE_TIP_IDX]
                    all_nose_positions.append((nose[0], nose[1]))

                    # Head pose estimation
                    pose = self._estimate_head_pose(lm_list, w, h)
                    all_head_poses.append(pose)

                    # Smile detection (experimental)
                    smile = self._detect_smile(lm_list)
                    smile_values.append(smile)
                else:
                    all_landmarks.append(None)

            except Exception as e:
                logger.warning(f"Frame {i} processing failed: {e}")
                all_landmarks.append(None)

        frames_processed = len(frames)

        # --- Blink rate ---
        blink_count = self._count_blinks(all_ear_values)
        duration_minutes = capture_duration_seconds / 60.0
        blink_rate = blink_count / duration_minutes if duration_minutes > 0 else 0

        # --- Head movement ---
        avg_head_movement = self._compute_avg_movement(all_nose_positions)

        # --- Head orientation stability ---
        head_stability = self._compute_orientation_stability(all_head_poses)

        # --- Attention score ---
        attention_score = (
            (face_detected_count / frames_processed * 100)
            if frames_processed > 0 else 0
        )

        # --- Emotion indicators (experimental) ---
        emotion_indicators = None
        if smile_values:
            avg_smile = sum(smile_values) / len(smile_values)
            emotion_indicators = {
                "smile_likelihood": round(avg_smile, 3),
                "label": "Experimental / Non-diagnostic",
            }

        return {
            "blink_rate_per_minute": round(blink_rate, 1),
            "avg_head_movement": round(avg_head_movement, 3),
            "head_orientation_stability": round(head_stability, 1),
            "attention_score": round(attention_score, 1),
            "frames_processed": frames_processed,
            "capture_duration_seconds": round(capture_duration_seconds, 2),
            "emotion_indicators": emotion_indicators,
            "processing_note": "",
        }

    def _compute_ear(self, landmarks: list[tuple[float, float, float]]) -> float:
        """
        Compute the average Eye Aspect Ratio (EAR) for both eyes.

        EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
        When eyes are open, EAR is high (~0.3). When closed, EAR drops (~0.05).
        """
        left_ear = self._eye_ear(landmarks, LEFT_EYE_IDX)
        right_ear = self._eye_ear(landmarks, RIGHT_EYE_IDX)
        return (left_ear + right_ear) / 2.0

    @staticmethod
    def _eye_ear(
        landmarks: list[tuple[float, float, float]],
        eye_idx: list[int],
    ) -> float:
        """Compute EAR for a single eye using 6 landmark points."""
        p = [landmarks[i] for i in eye_idx]

        # Vertical distances
        v1 = math.dist((p[2][0], p[2][1]), (p[5][0], p[5][1]))
        v2 = math.dist((p[3][0], p[3][1]), (p[4][0], p[4][1]))

        # Horizontal distance
        h = math.dist((p[0][0], p[0][1]), (p[1][0], p[1][1]))

        if h == 0:
            return 0.3  # Default open-eye EAR

        return (v1 + v2) / (2.0 * h)

    @staticmethod
    def _count_blinks(ear_values: list[float]) -> int:
        """Count blinks from a sequence of EAR values."""
        if len(ear_values) < EAR_CONSEC_FRAMES:
            return 0

        blink_count = 0
        below_threshold_count = 0

        for ear in ear_values:
            if ear < EAR_THRESHOLD:
                below_threshold_count += 1
            else:
                if below_threshold_count >= EAR_CONSEC_FRAMES:
                    blink_count += 1
                below_threshold_count = 0

        # Check if the sequence ended with a blink
        if below_threshold_count >= EAR_CONSEC_FRAMES:
            blink_count += 1

        return blink_count

    @staticmethod
    def _compute_avg_movement(
        positions: list[tuple[float, float]],
    ) -> float:
        """
        Compute average frame-to-frame displacement of the nose tip.
        Normalized to 0-1 range based on typical frame dimensions.
        """
        if len(positions) < 2:
            return 0.0

        movements: list[float] = []
        for i in range(1, len(positions)):
            dx = positions[i][0] - positions[i - 1][0]
            dy = positions[i][1] - positions[i - 1][1]
            displacement = math.sqrt(dx * dx + dy * dy)
            movements.append(displacement)

        avg_movement = sum(movements) / len(movements) if movements else 0
        # Normalize: assume typical frame width ~640px, >50px movement is significant
        normalized = min(1.0, avg_movement / 50.0)
        return normalized

    @staticmethod
    def _estimate_head_pose(
        landmarks: list[tuple[float, float, float]],
        img_w: int,
        img_h: int,
    ) -> tuple[float, float, float]:
        """
        Estimate head pose (yaw, pitch, roll) from facial landmarks.

        Uses the solvePnP approach with key facial points.
        Returns angles in degrees.
        """
        # 3D model points (generic face model)
        model_points = np.array([
            (0.0, 0.0, 0.0),          # Nose tip
            (0.0, -330.0, -65.0),      # Chin
            (-225.0, 170.0, -135.0),   # Left eye corner
            (225.0, 170.0, -135.0),    # Right eye corner
            (-150.0, -150.0, -125.0),  # Left mouth corner
            (150.0, -150.0, -125.0),   # Right mouth corner
        ], dtype=np.float64)

        # 2D image points from landmarks
        image_points = np.array([
            (landmarks[idx][0], landmarks[idx][1])
            for idx in POSE_LANDMARK_IDX
        ], dtype=np.float64)

        # Camera matrix (approximation)
        focal_length = img_w
        center = (img_w / 2, img_h / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1],
        ], dtype=np.float64)

        dist_coeffs = np.zeros((4, 1))

        try:
            success, rotation_vec, translation_vec = cv2.solvePnP(
                model_points, image_points, camera_matrix, dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE,
            )
            if not success:
                return (0.0, 0.0, 0.0)

            rotation_mat, _ = cv2.Rodrigues(rotation_vec)
            # Decompose to Euler angles
            sy = math.sqrt(rotation_mat[0, 0] ** 2 + rotation_mat[1, 0] ** 2)
            if sy > 1e-6:
                yaw = math.degrees(math.atan2(rotation_mat[1, 0], rotation_mat[0, 0]))
                pitch = math.degrees(math.atan2(-rotation_mat[2, 0], sy))
                roll = math.degrees(math.atan2(rotation_mat[2, 1], rotation_mat[2, 2]))
            else:
                yaw = math.degrees(math.atan2(-rotation_mat[1, 2], rotation_mat[1, 1]))
                pitch = math.degrees(math.atan2(-rotation_mat[2, 0], sy))
                roll = 0.0

            return (yaw, pitch, roll)
        except Exception:
            return (0.0, 0.0, 0.0)

    @staticmethod
    def _compute_orientation_stability(
        poses: list[tuple[float, float, float]],
    ) -> float:
        """
        Compute head orientation stability from a sequence of (yaw, pitch, roll).

        Lower variance = more stable = higher score (0-100).
        """
        if len(poses) < 2:
            return 100.0  # Not enough data to measure instability

        yaws = [p[0] for p in poses]
        pitches = [p[1] for p in poses]

        yaw_var = np.var(yaws) if yaws else 0
        pitch_var = np.var(pitches) if pitches else 0

        # Combined variance — map to 0-100 score
        # Low variance (< 10°²) → score near 100
        # High variance (> 200°²) → score near 0
        combined_var = (yaw_var + pitch_var) / 2
        stability = max(0.0, min(100.0, 100 - combined_var * 0.5))

        return stability

    @staticmethod
    def _detect_smile(
        landmarks: list[tuple[float, float, float]],
    ) -> float:
        """
        Experimental smile detection from mouth landmarks.

        Uses mouth aspect ratio: wider mouth relative to height = smile.
        Returns a value between 0 (no smile) and 1 (clear smile).

        ⚠️ EXPERIMENTAL / NON-DIAGNOSTIC — this is a rough geometric
        approximation, NOT a validated emotion detector.
        """
        try:
            # Mouth width (corner to corner)
            left_corner = landmarks[MOUTH_IDX[2]]
            right_corner = landmarks[MOUTH_IDX[3]]
            mouth_width = math.dist(
                (left_corner[0], left_corner[1]),
                (right_corner[0], right_corner[1]),
            )

            # Mouth height (upper to lower lip)
            upper_lip = landmarks[MOUTH_IDX[0]]
            lower_lip = landmarks[MOUTH_IDX[1]]
            mouth_height = math.dist(
                (upper_lip[0], upper_lip[1]),
                (lower_lip[0], lower_lip[1]),
            )

            if mouth_height == 0:
                return 0.0

            # Mouth aspect ratio — higher ratio typically indicates a smile
            mar = mouth_width / mouth_height

            # Normalize: MAR ~2.0 = neutral, ~3.5+ = smile
            smile_score = max(0.0, min(1.0, (mar - 2.0) / 2.0))
            return smile_score

        except (IndexError, TypeError):
            return 0.0

    @staticmethod
    def decode_base64_frames(base64_frames: list[str]) -> list[np.ndarray]:
        """
        Decode a list of base64-encoded JPEG strings to OpenCV BGR arrays.

        Invalid frames are silently skipped.
        """
        decoded: list[np.ndarray] = []
        for i, b64 in enumerate(base64_frames):
            try:
                # Strip data URI prefix if present
                if "," in b64:
                    b64 = b64.split(",", 1)[1]

                img_bytes = base64.b64decode(b64)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is not None:
                    decoded.append(frame)
                else:
                    logger.warning(f"Frame {i}: Failed to decode image")
            except Exception as e:
                logger.warning(f"Frame {i}: Decode error: {e}")

        return decoded

    @staticmethod
    def _empty_features(
        frames_processed: int = 0,
        capture_duration_seconds: float = 0,
        note: str = "",
    ) -> dict:
        """Return a zeroed feature dict for edge cases."""
        return {
            "blink_rate_per_minute": 0.0,
            "avg_head_movement": 0.0,
            "head_orientation_stability": 0.0,
            "attention_score": 0.0,
            "frames_processed": frames_processed,
            "capture_duration_seconds": round(capture_duration_seconds, 2),
            "emotion_indicators": None,
            "processing_note": note,
        }

    @staticmethod
    def compute_score(features: dict) -> float:
        """
        Compute a behavioural facial analysis score (0-100).

        Weighted scoring:
          - Attention (40%): higher attention = better
          - Head stability (30%): more stable = better
          - Blink rate (30%): normal range (10-25 blinks/min) = best
        """
        attention = features.get("attention_score", 0)
        stability = features.get("head_orientation_stability", 0)
        blink_rate = features.get("blink_rate_per_minute", 0)

        # Attention component: already 0-100
        attention_component = attention

        # Stability component: already 0-100
        stability_component = stability

        # Blink rate component: normal adult = 15-20 blinks/min
        # Peak score at 17 blinks/min, drops off on either side
        if blink_rate <= 0:
            blink_component = 0  # No blinks detected (possibly no face)
        else:
            deviation = abs(blink_rate - 17) / 17
            blink_component = max(0, (1 - deviation) * 100)

        score = (
            attention_component * 0.4 +
            stability_component * 0.3 +
            blink_component * 0.3
        )

        return round(min(100, max(0, score)), 1)


# Singleton instance
facial_processor = FacialProcessor()
