"""
NeuroScreen -- Facial Dynamics & Expression Preprocessing Pipeline
===================================================================
Handles image validation, deduplication, facial feature extraction,
and standardization for the facial-analysis component.

Trained and validated on real facial expression benchmark data (FacialDataSets).
Extracts explainable computer vision features:
  - 900 HOG (Histogram of Oriented Gradients) features capturing facial contour,
    eyebrow furrowing, eye geometry, and mouth curvature.
  - 8 Geometric and Symmetry features:
    * facial_symmetry_diff: Left vs right mirrored difference (facial symmetry index)
    * brow_region_mean: Upper face / eyebrow region mean intensity
    * brow_region_std: Upper face / eyebrow region texture variance
    * mouth_region_mean: Lower face / mouth region mean intensity
    * mouth_region_std: Lower face / mouth region texture variance
    * edge_gradient_energy: Sobel horizontal and vertical edge energy
    * overall_intensity_mean: Overall facial luminance
    * overall_intensity_std: Overall facial contrast

IMPORTANT ETHICAL & CLINICAL NOTICE:
------------------------------------
This pipeline and its models measure facial behavioral dynamics and expression
patterns. They are part of an educational/research prototype.
Emotion/expression labels (Angry, Disgust, Fear, Happy, Neutral) reflect affective
visual states and must NOT be construed as clinical diagnoses of Parkinson's
disease or any other neurological disorder.
"""

from __future__ import annotations

import base64
import hashlib
import logging
from pathlib import Path
from typing import Any, Optional, Union

import cv2
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("neuroscreen.facial.preprocessing")

# -------------------------------------------------------
# Classes & Feature Definitions
# -------------------------------------------------------

FACIAL_CLASSES = ["Angry", "Disgust", "Fear", "Happy", "Neutral"]

GEOMETRIC_FEATURE_NAMES = [
    "facial_symmetry_diff",
    "brow_region_mean",
    "brow_region_std",
    "mouth_region_mean",
    "mouth_region_std",
    "edge_gradient_energy",
    "overall_intensity_mean",
    "overall_intensity_std",
]

HOG_DIM = 900
TOTAL_FEATURE_DIM = HOG_DIM + len(GEOMETRIC_FEATURE_NAMES)  # 908 features


class FacialPreprocessor:
    """
    Preprocessing pipeline for facial image data and feature extraction.

    Responsibilities:
      1. Validate image format, dimensions, and channels.
      2. Hash-based deduplication to prevent duplicate sample leakage.
      3. Extract 908 explainable facial features (HOG + symmetry + regional dynamics).
      4. Standardize numeric features using StandardScaler.
      5. Serialize and deserialize fitted preprocessing artifacts.
    """

    def __init__(self):
        self.scaler: Optional[StandardScaler] = None
        self.classes: list[str] = list(FACIAL_CLASSES)
        self.is_fitted: bool = False
        self._hog: Optional[cv2.HOGDescriptor] = None

    def _get_hog(self) -> cv2.HOGDescriptor:
        """Instantiate or return cached OpenCV HOG descriptor for 48x48 images."""
        if self._hog is None:
            win_size = (48, 48)
            block_size = (16, 16)
            block_stride = (8, 8)
            cell_size = (8, 8)
            nbins = 9
            self._hog = cv2.HOGDescriptor(win_size, block_size, block_stride, cell_size, nbins)
        return self._hog

    def extract_image_features(self, img_input: Union[np.ndarray, str, Path, bytes]) -> np.ndarray:
        """
        Extract the 908-dimensional facial feature vector from an image.

        Args:
            img_input: numpy array (BGR or grayscale), file path, or decoded bytes.

        Returns:
            1D numpy array of shape (908,) containing HOG + geometric/symmetry features.
        """
        if isinstance(img_input, (str, Path)):
            img = cv2.imread(str(img_input), cv2.IMREAD_GRAYSCALE)
            if img is None:
                raise ValueError(f"Could not read image from path: {img_input}")
        elif isinstance(img_input, bytes):
            nparr = np.frombuffer(img_input, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
            if img is None:
                raise ValueError("Could not decode image from bytes.")
        elif isinstance(img_input, np.ndarray):
            if img_input.ndim == 3:
                img = cv2.cvtColor(img_input, cv2.COLOR_BGR2GRAY)
            else:
                img = img_input.copy()
        else:
            raise TypeError(f"Unsupported image input type: {type(img_input)}")

        # Ensure 48x48 resolution
        if img.shape != (48, 48):
            img = cv2.resize(img, (48, 48), interpolation=cv2.INTER_AREA)

        # 1. HOG features (900 features)
        hog = self._get_hog()
        hog_feat = hog.compute(img).flatten()

        # 2. Facial Symmetry Index (horizontal mirror difference across vertical midline)
        left_half = img[:, :24].astype(np.float32)
        right_half_flipped = np.fliplr(img[:, 24:]).astype(np.float32)
        sym_diff = float(np.abs(left_half - right_half_flipped).mean())

        # 3. Regional Statistics (Eyebrow/Eye region vs Mouth region)
        brow_region = img[8:24, :].astype(np.float32)
        mouth_region = img[28:44, 8:40].astype(np.float32)

        brow_mean = float(brow_region.mean())
        brow_std = float(brow_region.std())
        mouth_mean = float(mouth_region.mean())
        mouth_std = float(mouth_region.std())

        # 4. Edge Energy (Sobel gradients)
        gx = cv2.Sobel(img, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(img, cv2.CV_32F, 0, 1, ksize=3)
        edge_energy = float(np.sqrt(gx**2 + gy**2).mean())

        # 5. Overall Luminance & Contrast
        overall_mean = float(img.mean())
        overall_std = float(img.std())

        geom_features = np.array([
            sym_diff,
            brow_mean,
            brow_std,
            mouth_mean,
            mouth_std,
            edge_energy,
            overall_mean,
            overall_std,
        ], dtype=np.float32)

        return np.hstack([hog_feat, geom_features])

    @classmethod
    def load_dataset(
        cls, dataset_dir: Union[str, Path]
    ) -> tuple[np.ndarray, np.ndarray, list[str], dict[str, Any]]:
        """
        Load, validate, deduplicate, and extract features from FacialDataSets folder.

        Returns:
            X: 2D numpy array of shape (N, 908)
            y: 1D numpy array of class indices (0 to 4)
            file_paths: list of unique file paths
            stats: summary dictionary
        """
        dataset_dir = Path(dataset_dir)
        classes = sorted([d.name for d in dataset_dir.iterdir() if d.is_dir()])
        
        preprocessor = cls()
        seen_hashes: dict[str, str] = {}
        duplicates: list[tuple[str, str]] = []
        corrupted: list[str] = []

        X_list = []
        y_list = []
        file_paths = []

        class_counts = {c: 0 for c in classes}

        for label_idx, cls_name in enumerate(classes):
            cls_folder = dataset_dir / cls_name
            for file_path in cls_folder.glob("*.png"):
                # 1. MD5 Hash Deduplication
                try:
                    with open(file_path, "rb") as fp:
                        file_hash = hashlib.md5(fp.read()).hexdigest()
                    if file_hash in seen_hashes:
                        duplicates.append((str(file_path), seen_hashes[file_hash]))
                        continue  # Skip identical duplicates to prevent leakage
                    seen_hashes[file_hash] = str(file_path)
                except Exception as e:
                    corrupted.append(str(file_path))
                    logger.warning(f"Error reading {file_path}: {e}")
                    continue

                # 2. Extract features
                try:
                    features = preprocessor.extract_image_features(file_path)
                    X_list.append(features)
                    y_list.append(label_idx)
                    file_paths.append(str(file_path))
                    class_counts[cls_name] += 1
                except Exception as e:
                    corrupted.append(str(file_path))
                    logger.warning(f"Failed extracting features from {file_path}: {e}")

        X = np.array(X_list, dtype=np.float32)
        y = np.array(y_list, dtype=np.int64)

        stats = {
            "total_images_loaded": len(X),
            "duplicates_removed": len(duplicates),
            "corrupted_images": len(corrupted),
            "classes": classes,
            "class_distribution": class_counts,
            "feature_dim": X.shape[1] if len(X) > 0 else 0,
        }

        return X, y, file_paths, stats

    def fit(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> "FacialPreprocessor":
        """Fit StandardScaler on feature matrix."""
        self.scaler = StandardScaler()
        self.scaler.fit(X)
        self.is_fitted = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Standardize feature matrix using fitted scaler."""
        if not self.is_fitted or self.scaler is None:
            raise RuntimeError("FacialPreprocessor is not fitted. Call fit() first.")
        if X.ndim == 1:
            X = X.reshape(1, -1)
        return self.scaler.transform(X)

    def fit_transform(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> np.ndarray:
        """Fit and transform in a single pass."""
        self.fit(X, y)
        return self.transform(X)

    def save(self, filepath: Union[str, Path]) -> None:
        """Serialize fitted preprocessor to disk using joblib."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted preprocessor.")
        data = {
            "scaler": self.scaler,
            "classes": self.classes,
            "geometric_feature_names": GEOMETRIC_FEATURE_NAMES,
            "hog_dim": HOG_DIM,
            "total_feature_dim": TOTAL_FEATURE_DIM,
            "version": "1.0.0",
        }
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(data, filepath)
        logger.info(f"FacialPreprocessor saved to {filepath}")

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "FacialPreprocessor":
        """Deserialize fitted preprocessor from disk."""
        data = joblib.load(filepath)
        instance = cls()
        instance.scaler = data["scaler"]
        instance.classes = data.get("classes", FACIAL_CLASSES)
        instance.is_fitted = True
        return instance


# -------------------------------------------------------
# Reusable Application Prediction Function
# -------------------------------------------------------

_CACHED_FACIAL_MODEL = None
_CACHED_FACIAL_PREPROCESSOR = None


def predict_facial(
    image_or_features: Union[np.ndarray, str, Path, bytes],
    model: Optional[Any] = None,
    preprocessor: Optional[FacialPreprocessor] = None,
    models_dir: Optional[Union[str, Path]] = None,
) -> dict[str, Any]:
    """
    Reusable prediction function that accepts facial image input (frame, path, or bytes)
    or pre-extracted feature vector and produces a structured expression assessment.

    Args:
        image_or_features: Decoded image array (BGR/gray), file path, raw bytes,
                           or 908-element numerical feature vector.
        model: Optional pre-loaded classifier. If None, loaded from disk.
        preprocessor: Optional pre-loaded FacialPreprocessor.
        models_dir: Optional path to directory containing model joblib files.

    Returns:
        Structured result dict:
            - class: str (Predicted expression: "Happy", "Neutral", "Angry", "Fear", "Disgust")
            - confidence: float (0.0 to 1.0)
            - confidence_distribution: dict mapping each class to its probability
            - features: dict with facial symmetry, brow activity, mouth activity, edge energy
            - model_name: str
            - disclaimer: ethical / clinical research notice
    """
    global _CACHED_FACIAL_MODEL, _CACHED_FACIAL_PREPROCESSOR

    if models_dir is None:
        project_root = Path(__file__).resolve().parent.parent.parent
        models_dir = project_root / "ml" / "models"
    else:
        models_dir = Path(models_dir)

    # Load artifacts if not provided
    if preprocessor is None:
        if _CACHED_FACIAL_PREPROCESSOR is None:
            pp_path = models_dir / "facial_preprocessor.joblib"
            if not pp_path.exists():
                raise FileNotFoundError(f"Facial preprocessor not found at {pp_path}. Run training first.")
            _CACHED_FACIAL_PREPROCESSOR = FacialPreprocessor.load(pp_path)
        preprocessor = _CACHED_FACIAL_PREPROCESSOR

    if model is None:
        if _CACHED_FACIAL_MODEL is None:
            m_path = models_dir / "facial_model.joblib"
            if not m_path.exists():
                raise FileNotFoundError(f"Facial model not found at {m_path}. Run training first.")
            _CACHED_FACIAL_MODEL = joblib.load(m_path)
        model = _CACHED_FACIAL_MODEL

    # Extract features if image provided
    if isinstance(image_or_features, np.ndarray) and image_or_features.ndim == 1 and len(image_or_features) == TOTAL_FEATURE_DIM:
        raw_features = image_or_features
    else:
        raw_features = preprocessor.extract_image_features(image_or_features)

    # Standardize
    X_scaled = preprocessor.transform(raw_features)

    # Model inference
    pred_idx = int(model.predict(X_scaled)[0])
    predicted_class = preprocessor.classes[pred_idx]

    # Confidence distribution
    if hasattr(model, "predict_proba"):
        probas = model.predict_proba(X_scaled)[0]
        confidence_dist = {cls_name: round(float(probas[i]), 4) for i, cls_name in enumerate(preprocessor.classes)}
        confidence = float(probas[pred_idx])
    else:
        confidence_dist = {cls_name: 1.0 if cls_name == predicted_class else 0.0 for cls_name in preprocessor.classes}
        confidence = 1.0

    # Extract geometric metrics for audit/interpretability
    geom_vals = raw_features[HOG_DIM:]
    features_summary = {
        "facial_symmetry_diff": round(float(geom_vals[0]), 2),
        "brow_region_mean": round(float(geom_vals[1]), 2),
        "brow_region_std": round(float(geom_vals[2]), 2),
        "mouth_region_mean": round(float(geom_vals[3]), 2),
        "mouth_region_std": round(float(geom_vals[4]), 2),
        "edge_gradient_energy": round(float(geom_vals[5]), 2),
    }

    return {
        "class": predicted_class,
        "confidence": round(confidence, 4),
        "confidence_distribution": confidence_dist,
        "features": features_summary,
        "model_name": type(model).__name__,
        "disclaimer": (
            "This application is intended for behavioural screening and educational/research "
            "purposes only. It is NOT a medical diagnosis and cannot replace evaluation by a "
            "qualified healthcare professional."
        ),
    }
