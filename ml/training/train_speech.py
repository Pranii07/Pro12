"""
NeuroScreen -- Speech Dynamics & Acoustic Model Training & Comparison
======================================================================
Trains and compares interpretable ML classifiers on real speech acoustic benchmark data:
  1. Support Vector Machine (RBF SVM with CalibratedClassifierCV)
  2. Random Forest
  3. Logistic Regression
  4. XGBoost

Dataset:
  SpeechDataSets/Crema (CREMA-D: 7,442 samples across 91 unique speakers)
  Classes: Angry, Disgust, Fear, Happy, Neutral, Sad

Data Leakage Prevention:
  - Strict GroupShuffleSplit by speaker ID (91 distinct actors).
  - Test speakers are completely disjoint from training speakers (0% speaker leakage).

Evaluation Metrics:
  - Accuracy
  - Precision (weighted & macro)
  - Recall (weighted & macro)
  - F1-Score (weighted & macro)
  - Confusion Matrix
  - 5-Fold Speaker-Grouped Cross-Validation

Model Artifacts:
  - Best model: ml/models/speech_model.joblib
  - Preprocessor: ml/models/speech_preprocessor.joblib
  - Metadata: ml/models/speech_model_metadata.json

IMPORTANT ETHICAL & CLINICAL NOTICE:
------------------------------------
This is an educational and research prototype. SpeechDataSets contains vocal
actor recordings. It does NOT contain clinical diagnostic labels for Parkinson's
disease or other neurological disorders. The models evaluate acoustic prosody,
pitch dynamics, jitter/shimmer stability, and speech rhythm only.

Usage:
  cd Pro12
  py ml/training/train_speech.py
"""

from __future__ import annotations

import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from sklearn.svm import SVC
from xgboost import XGBClassifier

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.speech_preprocessor import (
    ACOUSTIC_FEATURE_NAMES,
    SPEECH_CLASSES,
    SpeechPreprocessor,
    predict_speech,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("neuroscreen.speech.training")

# -------------------------------------------------------
# Configuration
# -------------------------------------------------------

DATASET_DIR = PROJECT_ROOT / "ml" / "datasets" / "SpeechDataSets" / "Crema"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_SAVE_PATH = MODELS_DIR / "speech_model.joblib"
PREPROCESSOR_SAVE_PATH = MODELS_DIR / "speech_preprocessor.joblib"
METADATA_SAVE_PATH = MODELS_DIR / "speech_model_metadata.json"

RANDOM_SEED = 42
TEST_SPEAKER_RATIO = 0.20
CV_FOLDS = 5


def get_models() -> dict[str, Any]:
    """Instantiate the candidate acoustic classifiers to compare."""
    return {
        "RBF SVM (Calibrated)": CalibratedClassifierCV(
            SVC(
                kernel="rbf",
                C=3.0,
                gamma="scale",
                class_weight="balanced",
                random_state=RANDOM_SEED,
            ),
            ensemble=False,
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=100,
            max_depth=12,
            min_samples_split=4,
            class_weight="balanced",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
        "Logistic Regression": LogisticRegression(
            C=1.0,
            max_iter=1000,
            solver="lbfgs",
            class_weight="balanced",
            random_state=RANDOM_SEED,
        ),
        "XGBoost": XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=RANDOM_SEED,
            n_jobs=-1,
            eval_metric="mlogloss",
        ),
    }


def train_and_evaluate():
    """Run the complete speech model training, evaluation, and serialization pipeline."""
    # Ensure Windows console encoding compatibility
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    print("=" * 70)
    print("NeuroScreen -- Speech Dynamics & Acoustic Model Training")
    print("=" * 70)
    print()
    print("[!] CLINICAL NOTICE: Research & educational prototype.")
    print("    Dataset: Real speech acoustic benchmark (SpeechDataSets/Crema).")
    print("    Predicts vocal prosody & acoustic dynamics (NOT Parkinson's diagnosis).")
    print()

    # 1. Load Dataset & Extract Acoustic Features
    if not DATASET_DIR.exists():
        print(f"[X] Error: Dataset directory not found at {DATASET_DIR}")
        sys.exit(1)

    print(f"[*] Loading and extracting 41 acoustic features from {DATASET_DIR}...")
    t_load = time.time()
    # Process dataset
    X, y, groups, file_paths, stats = SpeechPreprocessor.load_crema_dataset(DATASET_DIR)
    load_time = time.time() - t_load

    print(f"[OK] Extracted features in {load_time:.2f}s:")
    print(f"     Total samples:           {stats['total_samples']:,}")
    print(f"     Unique speakers:         {stats['speakers_count']}")
    print(f"     Mean audio duration:     {stats['mean_duration_seconds']}s")
    print(f"     Feature dimension:       {stats['feature_dim']} (MFCCs, pitch, jitter, shimmer, spectral)")
    print("     Class distribution:")
    for cls_name, count in stats["class_distribution"].items():
        pct = count / len(y) * 100.0
        print(f"       {cls_name:<10}: {count:>4} samples ({pct:.1f}%)")

    # 2. Speaker-Level Train/Test Split (Prevent Data Leakage)
    print("\n[L] Splitting train/test by Speaker ID (Zero Speaker Leakage)...")
    gss = GroupShuffleSplit(n_splits=1, test_size=TEST_SPEAKER_RATIO, random_state=RANDOM_SEED)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train_raw = X[train_idx]
    X_test_raw = X[test_idx]
    y_train = y[train_idx]
    y_test = y[test_idx]
    groups_train = groups[train_idx]
    groups_test = groups[test_idx]

    train_spks = set(np.unique(groups_train))
    test_spks = set(np.unique(groups_test))

    # Assert 0% speaker leakage
    assert train_spks.isdisjoint(test_spks), "CRITICAL: Speaker in both train and test sets!"
    print(f"    Train set: {len(X_train_raw):,} samples across {len(train_spks)} speakers ({sorted(list(train_spks))[:5]}...)")
    print(f"    Test set:  {len(X_test_raw):,} samples across {len(test_spks)} unseen speakers ({sorted(list(test_spks))[:6]}...)")
    print("    [OK] Speaker sets are completely disjoint (0% speaker leakage).")

    # 3. Fit Preprocessor
    print("\n[*] Fitting SpeechPreprocessor (StandardScaler)...")
    preprocessor = SpeechPreprocessor()
    X_train = preprocessor.fit_transform(X_train_raw)
    X_test = preprocessor.transform(X_test_raw)
    print("    [OK] Acoustic preprocessing completed.")

    # 4. Model Training & Benchmarking
    print("\n" + "=" * 70)
    print("MODEL BENCHMARKING & COMPARISON (Evaluated on Unseen Speakers)")
    print("=" * 70)

    models = get_models()
    results = {}
    best_model_name = None
    best_f1 = -1.0
    best_model_obj = None

    for name, model in models.items():
        print(f"\n--- Training {name} ---")
        t0 = time.time()
        model.fit(X_train, y_train)
        fit_time = time.time() - t0

        # Inference on unseen speakers
        t_pred = time.time()
        y_pred = model.predict(X_test)
        pred_time = time.time() - t_pred

        # Metrics
        acc = accuracy_score(y_test, y_pred)
        prec_weighted = precision_score(y_test, y_pred, average="weighted", zero_division=0)
        rec_weighted = recall_score(y_test, y_pred, average="weighted", zero_division=0)
        f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)
        prec_macro = precision_score(y_test, y_pred, average="macro", zero_division=0)
        rec_macro = recall_score(y_test, y_pred, average="macro", zero_division=0)
        f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
        cm = confusion_matrix(y_test, y_pred).tolist()

        # 5-fold Speaker-Grouped Cross-Validation (on training speakers)
        print("  Running 5-fold speaker-grouped cross-validation...")
        gkf = GroupKFold(n_splits=CV_FOLDS)
        cv_scores = []
        for fold_train, fold_val in gkf.split(X_train, y_train, groups=groups_train):
            clone_model = get_models()[name]
            clone_model.fit(X_train[fold_train], y_train[fold_train])
            val_preds = clone_model.predict(X_train[fold_val])
            cv_scores.append(f1_score(y_train[fold_val], val_preds, average="weighted", zero_division=0))
        cv_scores = np.array(cv_scores)

        # Feature Importance if available
        feature_importance = None
        if hasattr(model, "feature_importances_"):
            feature_importance = {
                feat: round(float(imp), 4)
                for feat, imp in zip(ACOUSTIC_FEATURE_NAMES, model.feature_importances_)
            }

        result = {
            "model_name": name,
            "accuracy": round(acc, 4),
            "precision_weighted": round(prec_weighted, 4),
            "recall_weighted": round(rec_weighted, 4),
            "f1_weighted": round(f1_weighted, 4),
            "precision_macro": round(prec_macro, 4),
            "recall_macro": round(rec_macro, 4),
            "f1_macro": round(f1_macro, 4),
            "confusion_matrix": cm,
            "cv_f1_mean": round(float(cv_scores.mean()), 4),
            "cv_f1_std": round(float(cv_scores.std()), 4),
            "train_time_sec": round(fit_time, 2),
            "inference_time_sec": round(pred_time, 4),
            "feature_importance": feature_importance,
        }
        results[name] = result

        print(f"  Accuracy:          {acc:.4f}")
        print(f"  Precision (wt):    {prec_weighted:.4f}")
        print(f"  Recall (wt):       {rec_weighted:.4f}")
        print(f"  F1-Score (wt):     {f1_weighted:.4f}")
        print(f"  CV F1 (5-fold):    {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
        print(f"  Train Time:        {fit_time:.2f}s")
        print("\n  Classification Report:")
        print(classification_report(y_test, y_pred, target_names=SPEECH_CLASSES, digits=4))

        if f1_weighted > best_f1:
            best_f1 = f1_weighted
            best_model_name = name
            best_model_obj = model

    # 5. Comparison Table
    print("=" * 82)
    print(f"{'Model':<24} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1 (wt)':>10} {'CV F1':>12}")
    print("-" * 82)
    for name, r in results.items():
        best_tag = "  <-- BEST" if name == best_model_name else ""
        print(
            f"{name:<24} {r['accuracy']:>10.4f} {r['precision_weighted']:>10.4f} "
            f"{r['recall_weighted']:>10.4f} {r['f1_weighted']:>10.4f} "
            f"{r['cv_f1_mean']:>6.4f}+/-{r['cv_f1_std']:<4.4f}{best_tag}"
        )
    print("=" * 82)
    print(f"\n[BEST] Selected Best Model: {best_model_name} (F1-Score = {best_f1:.4f})")

    # 6. Save Artifacts
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n[SAVE] Saving model artifacts to {MODELS_DIR}...")

    # Save best model
    joblib.dump(best_model_obj, MODEL_SAVE_PATH)
    print(f"   [OK] Saved best model to: {MODEL_SAVE_PATH}")

    # Save preprocessor
    preprocessor.save(PREPROCESSOR_SAVE_PATH)
    print(f"   [OK] Saved preprocessor to: {PREPROCESSOR_SAVE_PATH}")

    # Save metadata JSON
    metadata = {
        "model_component": "Speech Dynamics & Acoustic Classifier",
        "dataset_name": "SpeechDataSets/Crema (CREMA-D)",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "selected_best_model": best_model_name,
        "classes": SPEECH_CLASSES,
        "n_samples_total": len(X),
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "n_train_speakers": len(train_spks),
        "n_test_speakers": len(test_spks),
        "feature_dim": X.shape[1],
        "feature_names": ACOUSTIC_FEATURE_NAMES,
        "leakage_prevention": "Strict GroupShuffleSplit by Speaker ID (18 test speakers never seen in training)",
        "model_comparison": results,
        "disclaimer": (
            "This speech analysis model evaluates vocal prosody, intonation dynamics, and acoustic features "
            "as part of an educational/research multi-modal screening prototype. "
            "It does NOT diagnose Parkinson's disease or any clinical neurological disorder."
        ),
    }

    with open(METADATA_SAVE_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"   [OK] Saved metadata to: {METADATA_SAVE_PATH}")

    # 7. Reusable Inference Smoke Test
    print("\n[TEST] Testing reusable predict_speech() function on sample files...")
    for emo_code, emo_name in [("ANG", "Angry"), ("HAP", "Happy"), ("NEU", "Neutral"), ("SAD", "Sad")]:
        sample_file = next(DATASET_DIR.glob(f"*_{emo_code}_*.wav"))
        pred = predict_speech(sample_file, model=best_model_obj, preprocessor=preprocessor)
        print(f"  Ground Truth: {emo_name:<8} -> Predicted: {pred['class']:<8} (Conf: {pred['confidence']:.2f}, Pitch: {pred['features']['pitch_f0_mean_hz']}Hz, Jitter: {pred['features']['jitter']})")

    print("\n" + "=" * 70)
    print("[OK] Speech Training Pipeline completed successfully!")
    print("=" * 70)


if __name__ == "__main__":
    train_and_evaluate()
