"""
NeuroScreen — Model Training & Comparison
============================================
Trains and compares three ML models for behavioural screening:
  - Random Forest
  - SVM (RBF kernel)
  - XGBoost

Evaluation: accuracy, precision (weighted), recall (weighted),
F1 (weighted), confusion matrix, ROC-AUC (one-vs-rest),
feature importance (RF/XGBoost), 5-fold stratified cross-validation.

Selects the best model by weighted F1 score, exports it as
.joblib + metadata JSON.

IMPORTANT: Research/Educational Prototype — trained and evaluated
on synthetic data. Not clinically validated.

Usage:
    cd project-root
    py ml/training/train_models.py
"""

from __future__ import annotations

import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.svm import SVC
from xgboost import XGBClassifier

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.preprocessor import NeuroScreenPreprocessor, FEATURE_COLUMNS, INDICATOR_COLUMNS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("neuroscreen.training")

# -------------------------------------------------------
# Configuration
# -------------------------------------------------------

DATASET_PATH = PROJECT_ROOT / "ml" / "datasets" / "synthetic_dataset.csv"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
PREPROCESSOR_PATH = MODELS_DIR / "preprocessor.joblib"
BEST_MODEL_PATH = MODELS_DIR / "best_model.joblib"
METADATA_PATH = MODELS_DIR / "model_metadata.json"

RANDOM_SEED = 42
TEST_SIZE = 0.20
CV_FOLDS = 5
CLASS_NAMES = ["LOW", "MODERATE", "HIGH"]


# -------------------------------------------------------
# Model Definitions
# -------------------------------------------------------

def get_models() -> dict[str, object]:
    """Return the three models to compare."""
    return {
        "RandomForest": RandomForestClassifier(
            n_estimators=200,
            max_depth=12,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
        "SVM": CalibratedClassifierCV(
            SVC(
                kernel="rbf",
                C=10.0,
                gamma="scale",
                class_weight="balanced",
                random_state=RANDOM_SEED,
            ),
            ensemble=False,
        ),
        "XGBoost": XGBClassifier(
            n_estimators=200,
            max_depth=8,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            objective="multi:softprob",
            num_class=3,
            random_state=RANDOM_SEED,
            n_jobs=-1,
            eval_metric="mlogloss",
            verbosity=0,
        ),
    }


# -------------------------------------------------------
# Training Pipeline
# -------------------------------------------------------

def train_and_evaluate():
    """Run the full training pipeline."""
    print("=" * 60)
    print("NeuroScreen — Model Training & Comparison")
    print("=" * 60)
    print()
    print("⚠️  Research/Educational Prototype — synthetic data only.")
    print()

    # --- Load Dataset ---
    if not DATASET_PATH.exists():
        print(f"❌ Dataset not found at {DATASET_PATH}")
        print("   Run 'py ml/datasets/generate_synthetic.py' first.")
        sys.exit(1)

    df = pd.read_csv(DATASET_PATH)
    print(f"✅ Dataset loaded: {df.shape[0]} samples, {df.shape[1]} columns")

    # --- Preprocess ---
    preprocessor = NeuroScreenPreprocessor()
    X, y = preprocessor.fit_transform(df)
    print(f"✅ Preprocessing complete. X: {X.shape}, y: {y.shape}")

    # --- Train/Test Split ---
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_SEED
    )
    print(f"   Train: {X_train.shape[0]}, Test: {X_test.shape[0]}")
    print()

    # --- Train Models ---
    models = get_models()
    results = {}
    best_model_name = None
    best_f1 = -1.0
    best_model_obj = None

    for name, model in models.items():
        print(f"--- Training {name} ---")
        t0 = time.time()

        # Train
        model.fit(X_train, y_train)
        train_time = time.time() - t0

        # Predict
        y_pred = model.predict(X_test)

        # Metrics
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, average="weighted", zero_division=0)
        rec = recall_score(y_test, y_pred, average="weighted", zero_division=0)
        f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
        cm = confusion_matrix(y_test, y_pred).tolist()

        # ROC-AUC (one-vs-rest, requires probability predictions)
        try:
            y_proba = model.predict_proba(X_test)
            roc = roc_auc_score(y_test, y_proba, multi_class="ovr", average="weighted")
        except Exception as e:
            roc = None
            logger.warning(f"ROC-AUC computation failed for {name}: {e}")

        # Cross-validation (F1 weighted)
        cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_SEED)
        cv_scores = cross_val_score(model, X, y, cv=cv, scoring="f1_weighted", n_jobs=-1)

        # Feature importance (RF/XGBoost only)
        feature_importance = None
        all_feature_names = FEATURE_COLUMNS + INDICATOR_COLUMNS
        if hasattr(model, "feature_importances_"):
            importance = model.feature_importances_
            feature_importance = dict(zip(all_feature_names, importance.tolist()))

        result = {
            "accuracy": round(acc, 4),
            "precision_weighted": round(prec, 4),
            "recall_weighted": round(rec, 4),
            "f1_weighted": round(f1, 4),
            "roc_auc_weighted": round(roc, 4) if roc is not None else None,
            "confusion_matrix": cm,
            "cv_f1_scores": [round(s, 4) for s in cv_scores.tolist()],
            "cv_f1_mean": round(cv_scores.mean(), 4),
            "cv_f1_std": round(cv_scores.std(), 4),
            "train_time_seconds": round(train_time, 2),
            "feature_importance": feature_importance,
        }
        results[name] = result

        # Print summary
        print(f"  Accuracy:   {acc:.4f}")
        print(f"  Precision:  {prec:.4f}")
        print(f"  Recall:     {rec:.4f}")
        print(f"  F1:         {f1:.4f}")
        if roc is not None:
            print(f"  ROC-AUC:    {roc:.4f}")
        print(f"  CV F1:      {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
        print(f"  Train time: {train_time:.2f}s")
        print()

        # Classification report
        print(f"  Classification Report ({name}):")
        print(classification_report(y_test, y_pred, target_names=CLASS_NAMES, digits=4))

        # Track best
        if f1 > best_f1:
            best_f1 = f1
            best_model_name = name
            best_model_obj = model

    # --- Model Comparison Summary ---
    print("=" * 60)
    print("MODEL COMPARISON SUMMARY")
    print("=" * 60)
    print(f"{'Model':<15} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10} {'ROC-AUC':>10} {'CV F1':>10}")
    print("-" * 75)
    for name, r in results.items():
        marker = " ← BEST" if name == best_model_name else ""
        roc_str = f"{r['roc_auc_weighted']:.4f}" if r['roc_auc_weighted'] else "N/A"
        print(f"{name:<15} {r['accuracy']:>10.4f} {r['precision_weighted']:>10.4f} {r['recall_weighted']:>10.4f} {r['f1_weighted']:>10.4f} {roc_str:>10} {r['cv_f1_mean']:>10.4f}{marker}")
    print()

    # --- Save Best Model ---
    print(f"🏆 Best model: {best_model_name} (F1={best_f1:.4f})")
    print()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Save preprocessor
    preprocessor.save(PREPROCESSOR_PATH)
    print(f"✅ Preprocessor saved: {PREPROCESSOR_PATH}")

    # Save best model
    joblib.dump(best_model_obj, BEST_MODEL_PATH)
    print(f"✅ Best model saved: {BEST_MODEL_PATH}")

    # --- Save Metadata ---
    metadata = {
        "model_name": best_model_name,
        "model_version": "1.0.0",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "dataset_description": (
            "Synthetic multimodal behavioural dataset (2000 samples). "
            "Generated with Gaussian distributions, modality-dropout, "
            "and inter-feature noise. NOT real clinical data."
        ),
        "disclaimer": (
            "Research/Educational Prototype — trained and evaluated on "
            "synthetic data. Not clinically validated."
        ),
        "n_train_samples": int(X_train.shape[0]),
        "n_test_samples": int(X_test.shape[0]),
        "n_features": int(X.shape[1]),
        "feature_schema": {
            "feature_columns": FEATURE_COLUMNS,
            "indicator_columns": INDICATOR_COLUMNS,
            "total_input_features": len(FEATURE_COLUMNS) + len(INDICATOR_COLUMNS),
        },
        "class_names": CLASS_NAMES,
        "best_model": best_model_name,
        "metrics": results[best_model_name],
        "all_model_results": results,
        "hyperparameters": {
            "RandomForest": {"n_estimators": 200, "max_depth": 12, "min_samples_split": 5, "min_samples_leaf": 2, "class_weight": "balanced"},
            "SVM": {"kernel": "rbf", "C": 10.0, "gamma": "scale", "class_weight": "balanced"},
            "XGBoost": {"n_estimators": 200, "max_depth": 8, "learning_rate": 0.1, "subsample": 0.8, "colsample_bytree": 0.8},
        },
        "preprocessing": {
            "imputation": "Median (from training data) for missing modalities",
            "outlier_handling": "IQR × 1.5 capping",
            "scaling": "StandardScaler (zero mean, unit variance)",
            "missing_modality_strategy": (
                "Each module contributes a fixed-size feature block + binary indicator. "
                "Missing modules: impute with median from training data, indicator = 0. "
                "Training data includes randomized modality-dropout."
            ),
        },
        "random_seed": RANDOM_SEED,
        "test_size": TEST_SIZE,
        "cv_folds": CV_FOLDS,
    }

    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"✅ Metadata saved: {METADATA_PATH}")

    print()
    print("✅ Training pipeline complete.")
    print()
    print("⚠️  REMINDER: All metrics above are from synthetic data.")
    print("   Research/Educational Prototype — not clinically validated.")

    return results, best_model_name


if __name__ == "__main__":
    train_and_evaluate()
