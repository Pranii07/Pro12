"""
NeuroScreen -- Facial Dynamics & Expression Model Training & Comparison
========================================================================
Trains and compares interpretable ML classifiers on real facial expression benchmark data:
  1. Support Vector Machine (RBF SVM with CalibratedClassifierCV)
  2. Random Forest
  3. Logistic Regression
  4. XGBoost

Dataset:
  FacialDataSets (2,203 samples across 5 emotion/expression classes)
  Classes: Angry, Disgust, Fear, Happy, Neutral

Data Leakage Prevention:
  - Exact MD5 hash deduplication removes identical images across classes/splits.
  - Stratified split (80% train, 20% test) maintains class balance.
  - Documented limitation: FER2013 distribution does not provide subject IDs.

Evaluation Metrics:
  - Accuracy
  - Precision (weighted & macro)
  - Recall (weighted & macro)
  - F1-Score (weighted & macro)
  - Confusion Matrix
  - 5-Fold Stratified Cross-Validation

Model Artifacts:
  - Best model: ml/models/facial_model.joblib
  - Preprocessor: ml/models/facial_preprocessor.joblib
  - Metadata: ml/models/facial_model_metadata.json

IMPORTANT ETHICAL & CLINICAL NOTICE:
------------------------------------
This is an educational and research prototype. FacialDataSets contains facial
expression images. It does NOT contain clinical diagnostic labels for Parkinson's
disease or other neurological disorders. The models evaluate visual affective
states and facial movement/symmetry dynamics only.

Usage:
  cd Pro12
  py ml/training/train_facial.py
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
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.svm import SVC
from xgboost import XGBClassifier

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.facial_preprocessor import (
    FACIAL_CLASSES,
    FacialPreprocessor,
    predict_facial,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("neuroscreen.facial.training")

# -------------------------------------------------------
# Configuration
# -------------------------------------------------------

DATASET_DIR = PROJECT_ROOT / "ml" / "datasets" / "FacialDataSets" / "test"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_SAVE_PATH = MODELS_DIR / "facial_model.joblib"
PREPROCESSOR_SAVE_PATH = MODELS_DIR / "facial_preprocessor.joblib"
METADATA_SAVE_PATH = MODELS_DIR / "facial_model_metadata.json"

RANDOM_SEED = 42
TEST_SIZE = 0.20
CV_FOLDS = 5


def get_models() -> dict[str, Any]:
    """Instantiate the candidate classifiers to compare."""
    return {
        "RBF SVM (Calibrated)": CalibratedClassifierCV(
            SVC(
                kernel="rbf",
                C=5.0,
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
    """Run the complete facial model training, evaluation, and serialization pipeline."""
    # Ensure Windows console encoding compatibility
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    print("=" * 70)
    print("NeuroScreen -- Facial Dynamics & Expression Model Training")
    print("=" * 70)
    print()
    print("[!] CLINICAL NOTICE: Research & educational prototype.")
    print("    Dataset: Real facial expression benchmark (FacialDataSets).")
    print("    Predicts affective expression & symmetry states (NOT Parkinson's diagnosis).")
    print()

    # 1. Load & Deduplicate Dataset
    if not DATASET_DIR.exists():
        print(f"[X] Error: Dataset directory not found at {DATASET_DIR}")
        sys.exit(1)

    print(f"[*] Loading and extracting features from {DATASET_DIR}...")
    t_load = time.time()
    X, y, file_paths, stats = FacialPreprocessor.load_dataset(DATASET_DIR)
    load_time = time.time() - t_load

    print(f"[OK] Extracted features in {load_time:.2f}s:")
    print(f"     Total images loaded:     {stats['total_images_loaded']:,}")
    print(f"     Duplicates removed:      {stats['duplicates_removed']}")
    print(f"     Corrupted images:        {stats['corrupted_images']}")
    print(f"     Feature dimension:       {stats['feature_dim']} (900 HOG + 8 symmetry/geometric)")
    print("     Class distribution:")
    for cls_name, count in stats["class_distribution"].items():
        pct = count / len(y) * 100.0
        print(f"       {cls_name:<10}: {count:>4} samples ({pct:.1f}%)")

    # 2. Stratified Train/Test Split (Prevent Data Leakage)
    print("\n[L] Splitting train/test (80/20 Stratified)...")
    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_SEED
    )
    print(f"    Train set: {len(X_train_raw):,} samples")
    print(f"    Test set:  {len(X_test_raw):,} samples")

    # 3. Fit Preprocessor
    print("\n[*] Fitting FacialPreprocessor (StandardScaler)...")
    preprocessor = FacialPreprocessor()
    X_train = preprocessor.fit_transform(X_train_raw)
    X_test = preprocessor.transform(X_test_raw)
    print("    [OK] Preprocessing completed.")

    # 4. Model Training & Benchmarking
    print("\n" + "=" * 70)
    print("MODEL BENCHMARKING & COMPARISON (Evaluated on Held-Out Test Set)")
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

        # Inference
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

        # 5-fold Stratified Cross-Validation (on training data)
        print("  Running 5-fold stratified cross-validation...")
        skf = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_SEED)
        cv_scores = []
        for train_fold, val_fold in skf.split(X_train, y_train):
            clone_model = get_models()[name]
            clone_model.fit(X_train[train_fold], y_train[train_fold])
            val_preds = clone_model.predict(X_train[val_fold])
            cv_scores.append(f1_score(y_train[val_fold], val_preds, average="weighted", zero_division=0))
        cv_scores = np.array(cv_scores)

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
        }
        results[name] = result

        print(f"  Accuracy:          {acc:.4f}")
        print(f"  Precision (wt):    {prec_weighted:.4f}")
        print(f"  Recall (wt):       {rec_weighted:.4f}")
        print(f"  F1-Score (wt):     {f1_weighted:.4f}")
        print(f"  CV F1 (5-fold):    {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
        print(f"  Train Time:        {fit_time:.2f}s")
        print("\n  Classification Report:")
        print(classification_report(y_test, y_pred, target_names=FACIAL_CLASSES, digits=4))

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
        "model_component": "Facial Dynamics & Expression Classifier",
        "dataset_name": "FacialDataSets (FER2013 subset)",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "selected_best_model": best_model_name,
        "classes": FACIAL_CLASSES,
        "n_samples_total": len(X),
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "feature_dim": X.shape[1],
        "leakage_prevention": "Exact MD5 deduplication + Stratified train/test split. (Subject IDs unavailable in FER2013 distribution).",
        "model_comparison": results,
        "disclaimer": (
            "This facial analysis model evaluates facial expression categories and symmetry dynamics "
            "as part of an educational/research multi-modal screening prototype. "
            "It does NOT diagnose Parkinson's disease or any clinical neurological disorder."
        ),
    }

    with open(METADATA_SAVE_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"   [OK] Saved metadata to: {METADATA_SAVE_PATH}")

    # 7. Reusable Inference Smoke Test
    print("\n[TEST] Testing reusable predict_facial() function on test samples...")
    for cls_name in FACIAL_CLASSES:
        cls_folder = DATASET_DIR / cls_name
        sample_file = next(cls_folder.glob("*.png"))
        pred = predict_facial(sample_file, model=best_model_obj, preprocessor=preprocessor)
        print(f"  Ground Truth: {cls_name:<8} -> Predicted: {pred['class']:<8} (Conf: {pred['confidence']:.2f}, SymDiff: {pred['features']['facial_symmetry_diff']})")

    print("\n" + "=" * 70)
    print("[OK] Facial Training Pipeline completed successfully!")
    print("=" * 70)


if __name__ == "__main__":
    train_and_evaluate()
