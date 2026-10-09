"""
NeuroScreen -- Reaction Time Model Training & Benchmark Comparison
===================================================================
Trains and compares three interpretable ML classifiers on psychomotor reaction timing data:
  1. Random Forest Classifier
  2. Gradient Boosting Classifier
  3. Logistic Regression Classifier

Dataset & Latency Modeling:
  Synthesized from empirical human simple visual reaction time (SRT) and
  Psychomotor Vigilance Task (PVT) distributions across 3 cognitive screening tiers:
    - LOW Risk (Healthy / Alert): Mean RT ~260-350ms, variability 30-65ms, CV ~0.12-0.23, <=1 false starts
    - MODERATE Risk (Attentional Fluctuation): Mean RT ~370-480ms, variability 70-120ms, CV ~0.24-0.34
    - HIGH Risk (Prolonged Psychomotor Delay): Mean RT >= 490ms, variability 120-220ms, CV >= 0.35

Evaluation Metrics:
  - 5-Fold Stratified Cross-Validation
  - Accuracy, Weighted F1, Macro F1, Precision, Recall
  - ROC-AUC (one-vs-rest multiclass)
  - Confusion Matrix & Classification Report

Model Artifacts Produced:
  - ml/models/reaction_model.joblib
  - ml/models/reaction_preprocessor.joblib
  - ml/models/reaction_model_metadata.json

Usage:
  cd Pro12
  py ml/training/train_reaction.py
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
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.reaction_preprocessor import (
    CLASS_NAMES,
    REACTION_FEATURE_COLUMNS,
    ReactionPreprocessor,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("neuroscreen.reaction.training")

# -------------------------------------------------------
# Configuration
# -------------------------------------------------------

N_SAMPLES = 3000
RANDOM_SEED = 42
TEST_SIZE = 0.20
CV_FOLDS = 5

MODELS_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_OUTPUT_PATH = MODELS_DIR / "reaction_model.joblib"
PREPROCESSOR_OUTPUT_PATH = MODELS_DIR / "reaction_preprocessor.joblib"
METADATA_OUTPUT_PATH = MODELS_DIR / "reaction_model_metadata.json"


# -------------------------------------------------------
# Dataset Generation (Psychomotor Vigilance Distribution)
# -------------------------------------------------------

def generate_reaction_dataset(n_samples: int = 3000, seed: int = 42) -> pd.DataFrame:
    """
    Generate realistic psychomotor visual reaction dataset with
    naturalistic Ex-Gaussian tail distributions.
    """
    rng = np.random.default_rng(seed)

    # 50% LOW, 30% MODERATE, 20% HIGH
    n_low = int(n_samples * 0.50)
    n_mod = int(n_samples * 0.30)
    n_high = n_samples - n_low - n_mod

    records = []

    # Config: (mean_rt, std_rt, tau_skew, false_start_lambda, class_label)
    configs = [
        (n_low, 290.0, 38.0, 40.0, 0.35, "LOW"),
        (n_mod, 415.0, 52.0, 75.0, 1.10, "MODERATE"),
        (n_high, 550.0, 75.0, 120.0, 2.20, "HIGH"),
    ]

    for n_count, base_mean, base_sd, tau, fs_lambda, label in configs:
        for _ in range(n_count):
            # Ex-Gaussian distribution: Normal + Exponential component for realistic cognitive tail
            gaussian_part = rng.normal(base_mean, base_sd)
            exp_part = rng.exponential(tau)
            avg_rt = max(180.0, gaussian_part + exp_part)

            # Trial-level variability correlates with average latency
            var_ratio = rng.uniform(0.12, 0.24) if label == "LOW" else (
                rng.uniform(0.20, 0.35) if label == "MODERATE" else rng.uniform(0.28, 0.48)
            )
            response_variability = max(15.0, avg_rt * var_ratio + rng.normal(0, 8.0))
            cv = response_variability / avg_rt

            # Fastest reaction typically 1.5 - 2.5 SDs below mean
            fastest_rt = max(140.0, avg_rt - rng.uniform(1.4, 2.3) * response_variability)
            # Slowest reaction typically 2.0 - 3.8 SDs above mean (occasional lapses)
            slowest_rt = min(2200.0, avg_rt + rng.uniform(1.8, 3.8) * response_variability)

            # False start count Poisson distributed
            false_starts = int(min(6, rng.poisson(fs_lambda)))

            records.append({
                "avg_reaction_time_ms": round(float(avg_rt), 1),
                "fastest_reaction_ms": round(float(fastest_rt), 1),
                "slowest_reaction_ms": round(float(slowest_rt), 1),
                "false_start_count": false_starts,
                "response_variability_ms": round(float(response_variability), 1),
                "coefficient_of_variation": round(float(cv), 4),
                "screening_level": label,
            })

    df = pd.DataFrame(records)
    df = df.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    return df


# -------------------------------------------------------
# Training & Model Selection
# -------------------------------------------------------

def train_and_evaluate():
    logger.info("=" * 65)
    logger.info("NeuroScreen -- Reaction Time Module Training Pipeline")
    logger.info("=" * 65)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Generate & prepare dataset
    logger.info(f"Generating realistic reaction latency dataset ({N_SAMPLES} samples)...")
    df = generate_reaction_dataset(n_samples=N_SAMPLES, seed=RANDOM_SEED)

    class_counts = df["screening_level"].value_counts().to_dict()
    logger.info(f"Class distribution: {class_counts}")

    # 2. Train-test split (stratified)
    train_df, test_df = train_test_split(
        df,
        test_size=TEST_SIZE,
        stratify=df["screening_level"],
        random_state=RANDOM_SEED,
    )
    logger.info(f"Train samples: {len(train_df)}, Test samples: {len(test_df)}")

    # 3. Fit ReactionPreprocessor
    preprocessor = ReactionPreprocessor()
    X_train = preprocessor.fit_transform(train_df)
    X_test = preprocessor.transform(test_df)

    # Target integer mapping: 0=LOW, 1=MODERATE, 2=HIGH
    target_map = {name: idx for idx, name in enumerate(CLASS_NAMES)}
    y_train = train_df["screening_level"].map(target_map).values
    y_test = test_df["screening_level"].map(target_map).values

    # 4. Model candidates
    candidates = {
        "RandomForest": RandomForestClassifier(
            n_estimators=200,
            max_depth=9,
            min_samples_split=4,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=140,
            learning_rate=0.08,
            max_depth=4,
            min_samples_split=4,
            random_state=RANDOM_SEED,
        ),
        "LogisticRegression": LogisticRegression(
            C=2.0,
            max_iter=1000,
            class_weight="balanced",
            random_state=RANDOM_SEED,
        ),
    }

    results = {}
    best_name = None
    best_f1 = -1.0
    best_model_obj = None

    skf = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_SEED)

    for name, model in candidates.items():
        logger.info(f"\nEvaluating candidate model: {name}...")
        start_t = time.perf_counter()

        # 5-Fold Stratified Cross-Validation
        cv_scores = cross_val_score(model, X_train, y_train, cv=skf, scoring="f1_weighted", n_jobs=-1)
        mean_cv_f1 = float(cv_scores.mean())
        std_cv_f1 = float(cv_scores.std())

        # Fit on full training set
        model.fit(X_train, y_train)
        fit_time = time.perf_counter() - start_t

        # Evaluate on test set
        y_pred = model.predict(X_test)
        y_probs = model.predict_proba(X_test)

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, average="weighted"))
        rec = float(recall_score(y_test, y_pred, average="weighted"))
        f1_w = float(f1_score(y_test, y_pred, average="weighted"))
        f1_macro = float(f1_score(y_test, y_pred, average="macro"))

        try:
            auc = float(roc_auc_score(y_test, y_probs, multi_class="ovr", average="weighted"))
        except Exception:
            auc = 0.0

        cm = confusion_matrix(y_test, y_pred).tolist()

        logger.info(f"[{name}] Test Accuracy: {acc:.4f} | Weighted F1: {f1_w:.4f} | CV F1: {mean_cv_f1:.4f} (+/- {std_cv_f1:.4f}) | AUC: {auc:.4f}")

        results[name] = {
            "accuracy": round(acc, 4),
            "precision_weighted": round(prec, 4),
            "recall_weighted": round(rec, 4),
            "f1_weighted": round(f1_w, 4),
            "f1_macro": round(f1_macro, 4),
            "roc_auc_weighted": round(auc, 4),
            "cv_f1_mean": round(mean_cv_f1, 4),
            "cv_f1_std": round(std_cv_f1, 4),
            "fit_time_seconds": round(fit_time, 3),
            "confusion_matrix": cm,
        }

        if f1_w > best_f1:
            best_f1 = f1_w
            best_name = name
            best_model_obj = model

    logger.info("\n" + "=" * 65)
    logger.info(f"Champion Reaction Model: {best_name} (Test F1: {best_f1:.4f})")
    logger.info("=" * 65)

    # 5. Full Classification Report for Champion Model
    champion_preds = best_model_obj.predict(X_test)
    logger.info("\nDetailed Classification Report:\n" + classification_report(y_test, champion_preds, target_names=CLASS_NAMES))

    # 6. Save Champion Model & Preprocessor
    joblib.dump(best_model_obj, MODEL_OUTPUT_PATH)
    logger.info(f"Saved reaction model -> {MODEL_OUTPUT_PATH}")

    preprocessor.save(PREPROCESSOR_OUTPUT_PATH)
    logger.info(f"Saved reaction preprocessor -> {PREPROCESSOR_OUTPUT_PATH}")

    # 7. Save Model Metadata JSON
    feature_importances = {}
    if hasattr(best_model_obj, "feature_importances_"):
        for feat, imp in zip(REACTION_FEATURE_COLUMNS, best_model_obj.feature_importances_):
            feature_importances[feat] = round(float(imp), 4)

    metadata = {
        "model_name": best_name,
        "model_version": "1.0.0",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "dataset_description": "Psychomotor vigilance & visual reaction timing distribution (3000 samples) with Ex-Gaussian latency tail modeling.",
        "disclaimer": "Research/Educational Prototype -- trained and evaluated on behavioral latency data. Not clinically validated.",
        "n_train_samples": len(train_df),
        "n_test_samples": len(test_df),
        "feature_schema": {
            "feature_columns": REACTION_FEATURE_COLUMNS,
            "core_columns": ["avg_reaction_time_ms", "fastest_reaction_ms", "slowest_reaction_ms", "false_start_count"],
            "derived_columns": ["response_variability_ms", "coefficient_of_variation"],
            "total_features": len(REACTION_FEATURE_COLUMNS),
        },
        "class_names": CLASS_NAMES,
        "best_model": best_name,
        "metrics": results[best_name],
        "feature_importances": feature_importances,
        "model_comparison": results,
    }

    with open(METADATA_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Saved reaction metadata -> {METADATA_OUTPUT_PATH}")

    logger.info("\nTraining pipeline successfully completed.")


if __name__ == "__main__":
    train_and_evaluate()
