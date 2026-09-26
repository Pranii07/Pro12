"""
NeuroScreen -- Keystroke Dynamics Model Training & Comparison
=============================================================
Trains and compares three interpretable ML classifiers on real keystroke timing data:
  1. Logistic Regression
  2. Random Forest
  3. Gradient Boosting

Dataset:
  DSL-StrongPasswordData (20,400 samples across 51 subjects)

Data Leakage Prevention:
  Splits data strictly by subject ID using GroupShuffleSplit (or GroupKFold).
  Samples from any single subject exist EXCLUSIVELY in either train or test,
  never across both.

Evaluation Metrics:
  - Accuracy
  - Precision (weighted & macro)
  - Recall (weighted & macro)
  - F1-Score (weighted & macro)
  - Confusion Matrix
  - 5-Fold Subject-Grouped Cross-Validation

Model Artifacts:
  - Best model: ml/models/keystroke_model.joblib
  - Preprocessor: ml/models/keystroke_preprocessor.joblib
  - Metadata: ml/models/keystroke_model_metadata.json

IMPORTANT ETHICAL & CLINICAL NOTICE:
------------------------------------
This is an educational and research prototype. DSL-StrongPasswordData contains
keystroke biometric timings from healthy adult typists. It does NOT contain
clinical diagnostic labels for Parkinson's disease or other neurological disorders.
The models evaluate motor timing fluency and behavioral screening risk levels only.

Usage:
  cd Pro12
  py ml/training/train_keystroke.py
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
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, cross_val_score

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.keystroke_preprocessor import (
    CLASS_NAMES,
    KEYSTROKE_FEATURE_COLUMNS,
    KeystrokePreprocessor,
    predict_keystroke,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("neuroscreen.keystroke.training")

# -------------------------------------------------------
# Configuration
# -------------------------------------------------------

DATASET_PATH = PROJECT_ROOT / "ml" / "datasets" / "DSL-StrongPasswordData.csv"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_SAVE_PATH = MODELS_DIR / "keystroke_model.joblib"
PREPROCESSOR_SAVE_PATH = MODELS_DIR / "keystroke_preprocessor.joblib"
METADATA_SAVE_PATH = MODELS_DIR / "keystroke_model_metadata.json"

RANDOM_SEED = 42
TEST_SUBJECT_RATIO = 0.20
CV_FOLDS = 5


def get_models() -> dict[str, Any]:
    """Instantiate the 3 transparent, explainable classifiers to compare."""
    return {
        "Logistic Regression": LogisticRegression(
            C=1.0,
            max_iter=1000,
            solver="lbfgs",
            class_weight="balanced",
            random_state=RANDOM_SEED,
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=100,
            max_depth=8,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.8,
            random_state=RANDOM_SEED,
        ),
    }


def train_and_evaluate():
    """Run the complete keystroke model training, evaluation, and serialization pipeline."""
    # Configure UTF-8 on Windows stdout if possible
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    print("=" * 70)
    print("NeuroScreen -- Keystroke Dynamics Model Training & Comparison")
    print("=" * 70)
    print()
    print("[!] CLINICAL NOTICE: Research & educational prototype.")
    print("    Dataset: Real keystroke dynamics (DSL-StrongPasswordData).")
    print("    Predicts motor latency / rhythm screening tiers (NOT Parkinson's diagnosis).")
    print()

    # 1. Load Dataset
    if not DATASET_PATH.exists():
        print(f"[X] Error: Dataset not found at {DATASET_PATH}")
        sys.exit(1)

    raw_df = pd.read_csv(DATASET_PATH)
    n_rows, n_cols = raw_df.shape
    n_subjects = raw_df["subject"].nunique() if "subject" in raw_df.columns else 0
    print(f"[OK] Loaded raw dataset: {n_rows:,} records, {n_cols} columns across {n_subjects} subjects.")

    # 2. Extract Canonical Features & Behavioral Targets
    print("[*] Extracting keystroke timing features & deriving motor screening levels...")
    X, groups = KeystrokePreprocessor.extract_features_from_dsl(raw_df)
    y = KeystrokePreprocessor.derive_behavioral_target(X)

    class_counts = pd.Series(y).value_counts().sort_index()
    print("   Class distribution:")
    for idx, name in enumerate(CLASS_NAMES):
        cnt = class_counts.get(idx, 0)
        pct = cnt / len(y) * 100.0
        print(f"     {name:<10}: {cnt:>5} samples ({pct:.1f}%)")

    # 3. Subject-Level Train/Test Split (Prevent Data Leakage)
    print("\n[L] Splitting train/test by subject ID (Zero Data Leakage)...")
    gss = GroupShuffleSplit(n_splits=1, test_size=TEST_SUBJECT_RATIO, random_state=RANDOM_SEED)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train_raw = X.iloc[train_idx].reset_index(drop=True)
    X_test_raw = X.iloc[test_idx].reset_index(drop=True)
    y_train = y[train_idx]
    y_test = y[test_idx]
    groups_train = groups.iloc[train_idx].reset_index(drop=True)
    groups_test = groups.iloc[test_idx].reset_index(drop=True)

    train_subs = set(groups_train.unique())
    test_subs = set(groups_test.unique())

    # Leakage verification assertion
    assert train_subs.isdisjoint(test_subs), "CRITICAL: Data leakage detected! Subject in both train and test!"
    print(f"   Train set: {len(X_train_raw):,} samples across {len(train_subs)} subjects ({sorted(list(train_subs))[:5]}...)")
    print(f"   Test set:  {len(X_test_raw):,} samples across {len(test_subs)} subjects ({sorted(list(test_subs))})")
    print("   [OK] Subject sets are completely disjoint (0% subject leakage).")

    # 4. Preprocessing Pipeline
    print("\n[*] Fitting KeystrokePreprocessor on training data...")
    preprocessor = KeystrokePreprocessor()
    X_train = preprocessor.fit_transform(X_train_raw)
    X_test = preprocessor.transform(X_test_raw)
    print(f"   Preprocessed feature shape: Train {X_train.shape}, Test {X_test.shape}")

    # 5. Model Training & Benchmarking
    print("\n" + "=" * 70)
    print("MODEL BENCHMARKING & COMPARISON (Evaluated on Unseen Subjects)")
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

        # Predict on unseen test subjects
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

        # Subject-grouped Cross-Validation (on training subjects)
        print("  Running 5-fold subject-grouped cross-validation...")
        gkf = GroupKFold(n_splits=CV_FOLDS)
        cv_scores = cross_val_score(model, X_train, y_train, groups=groups_train, cv=gkf, scoring="f1_weighted", n_jobs=-1)

        # Feature Importance / Coefficients
        feature_impact = None
        if hasattr(model, "feature_importances_"):
            feature_impact = {
                feat: round(float(imp), 4)
                for feat, imp in zip(KEYSTROKE_FEATURE_COLUMNS, model.feature_importances_)
            }
        elif hasattr(model, "coef_"):
            # Multi-class logistic regression coefficients: average absolute impact per feature
            coef_mean = np.mean(np.abs(model.coef_), axis=0)
            feature_impact = {
                feat: round(float(c), 4)
                for feat, c in zip(KEYSTROKE_FEATURE_COLUMNS, coef_mean)
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
            "feature_importance": feature_impact,
        }
        results[name] = result

        print(f"  Accuracy:          {acc:.4f}")
        print(f"  Precision (wt):    {prec_weighted:.4f}")
        print(f"  Recall (wt):       {rec_weighted:.4f}")
        print(f"  F1-Score (wt):     {f1_weighted:.4f}")
        print(f"  CV F1 (5-fold):    {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
        print(f"  Train Time:        {fit_time:.2f}s")
        print("\n  Classification Report:")
        print(classification_report(y_test, y_pred, target_names=CLASS_NAMES, digits=4))

        if f1_weighted > best_f1:
            best_f1 = f1_weighted
            best_model_name = name
            best_model_obj = model

    # 6. Comparison Table
    print("=" * 80)
    print(f"{'Model':<22} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1 (wt)':>10} {'CV F1':>12}")
    print("-" * 80)
    for name, r in results.items():
        best_tag = "  <-- BEST" if name == best_model_name else ""
        print(
            f"{name:<22} {r['accuracy']:>10.4f} {r['precision_weighted']:>10.4f} "
            f"{r['recall_weighted']:>10.4f} {r['f1_weighted']:>10.4f} "
            f"{r['cv_f1_mean']:>6.4f}+/-{r['cv_f1_std']:<4.4f}{best_tag}"
        )
    print("=" * 80)
    print(f"\n[BEST] Selected Best Model: {best_model_name} (F1-Score = {best_f1:.4f})")

    # 7. Serialize Artifacts
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
        "model_component": "Keystroke Dynamics Behavioral Classifier",
        "dataset_name": "DSL-StrongPasswordData",
        "dataset_source": "Killourhy & Maxion (2009) Keystroke Dynamics Benchmark",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "selected_best_model": best_model_name,
        "classes": CLASS_NAMES,
        "feature_columns": KEYSTROKE_FEATURE_COLUMNS,
        "n_samples_total": len(X),
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "n_train_subjects": len(train_subs),
        "n_test_subjects": len(test_subs),
        "leakage_prevention": "Strict GroupShuffleSplit by subject ID (test subjects never seen in training)",
        "model_comparison": results,
        "disclaimer": (
            "This keystroke dynamics model evaluates motor timing fluency and rhythm characteristics "
            "as part of an educational/research multi-modal screening prototype. "
            "It does NOT diagnose Parkinson's disease or any clinical neurological disorder."
        ),
    }

    with open(METADATA_SAVE_PATH, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"   [OK] Saved metadata to: {METADATA_SAVE_PATH}")

    # 8. Reusable Inference Smoke Test
    print("\n[TEST] Testing reusable predict_keystroke() function...")
    sample_tests = [
        {
            "description": "Fast & Fluent Typing Sample (High WPM, low hold/flight)",
            "features": {"wpm": 72.0, "cpm": 360.0, "accuracy": 0.98, "backspace_rate": 0.02, "avg_hold_time_ms": 78.0, "avg_flight_time_ms": 95.0},
        },
        {
            "description": "Average Typing Sample (Moderate WPM, medium latency)",
            "features": {"wpm": 48.0, "cpm": 240.0, "accuracy": 0.91, "backspace_rate": 0.06, "avg_hold_time_ms": 92.0, "avg_flight_time_ms": 150.0},
        },
        {
            "description": "Slow / Hesitant Typing Sample (Low WPM, prolonged hold/flight times)",
            "features": {"wpm": 22.0, "cpm": 110.0, "accuracy": 0.82, "backspace_rate": 0.14, "avg_hold_time_ms": 185.0, "avg_flight_time_ms": 320.0},
        },
    ]

    for test in sample_tests:
        print(f"\n  Case: {test['description']}")
        pred = predict_keystroke(test["features"], model=best_model_obj, preprocessor=preprocessor)
        print(f"    Screening Level:       {pred['screening_level']}")
        print(f"    Fluency Score (0-100): {pred['score']}")
        print(f"    Class Probabilities:   {pred['confidence_distribution']}")

    print("\n" + "=" * 70)
    print("[OK] Keystroke Training Pipeline completed successfully!")
    print("=" * 70)


if __name__ == "__main__":
    train_and_evaluate()
