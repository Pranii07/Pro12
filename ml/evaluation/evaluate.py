"""
NeuroScreen — Model Evaluation & Visualization
=================================================
Generates evaluation artifacts from a trained model:
  - Confusion matrix heatmap (PNG)
  - ROC curves per class (PNG)
  - Feature importance chart (PNG)
  - Cross-validation results summary
  - Evaluation report (text)

All output is saved to ml/evaluation/results/.

IMPORTANT: Research/Educational Prototype — trained and evaluated
on synthetic data. Not clinically validated.

Usage:
    cd project-root
    py ml/evaluation/evaluate.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
    auc,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import label_binarize

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.preprocessing.preprocessor import NeuroScreenPreprocessor, FEATURE_COLUMNS, INDICATOR_COLUMNS

# -------------------------------------------------------
# Paths
# -------------------------------------------------------

DATASET_PATH = PROJECT_ROOT / "ml" / "datasets" / "synthetic_dataset.csv"
MODEL_PATH = PROJECT_ROOT / "ml" / "models" / "best_model.joblib"
PREPROCESSOR_PATH = PROJECT_ROOT / "ml" / "models" / "preprocessor.joblib"
METADATA_PATH = PROJECT_ROOT / "ml" / "models" / "model_metadata.json"
RESULTS_DIR = PROJECT_ROOT / "ml" / "evaluation" / "results"

RANDOM_SEED = 42
TEST_SIZE = 0.20
CLASS_NAMES = ["LOW", "MODERATE", "HIGH"]

# Color palette
COLORS = ["#2563eb", "#f59e0b", "#ef4444"]  # Blue, Amber, Red


def evaluate():
    print("=" * 60)
    print("NeuroScreen — Model Evaluation")
    print("=" * 60)
    print()
    print("⚠️  Research/Educational Prototype — synthetic data only.")
    print()

    # --- Load ---
    if not MODEL_PATH.exists():
        print(f"❌ Model not found at {MODEL_PATH}")
        print("   Run 'py ml/training/train_models.py' first.")
        sys.exit(1)

    model = joblib.load(MODEL_PATH)
    preprocessor = NeuroScreenPreprocessor.load(PREPROCESSOR_PATH)
    df = pd.read_csv(DATASET_PATH)

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    model_name = metadata.get("model_name", "Unknown")
    print(f"✅ Model loaded: {model_name}")
    print(f"✅ Dataset: {df.shape[0]} samples")

    # --- Preprocess (same split as training) ---
    X, y = preprocessor.fit_transform(df)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_SEED
    )

    # Use test set for evaluation
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test) if hasattr(model, "predict_proba") else None

    # --- Metrics ---
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    rec = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    roc = None
    if y_proba is not None:
        try:
            roc = roc_auc_score(y_test, y_proba, multi_class="ovr", average="weighted")
        except Exception:
            pass

    print(f"\n--- Test Set Metrics ({model_name}) ---")
    print(f"  Accuracy:   {acc:.4f}")
    print(f"  Precision:  {prec:.4f}")
    print(f"  Recall:     {rec:.4f}")
    print(f"  F1:         {f1:.4f}")
    if roc is not None:
        print(f"  ROC-AUC:    {roc:.4f}")

    print(f"\n--- Classification Report ---")
    report = classification_report(y_test, y_pred, target_names=CLASS_NAMES, digits=4)
    print(report)

    # --- Create output directory ---
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # -------------------------------------------------------
    # 1. Confusion Matrix
    # -------------------------------------------------------
    cm = confusion_matrix(y_test, y_pred)

    fig, ax = plt.subplots(figsize=(8, 6))
    disp = ConfusionMatrixDisplay(cm, display_labels=CLASS_NAMES)
    disp.plot(ax=ax, cmap="Blues", values_format="d")
    ax.set_title(
        f"Confusion Matrix — {model_name}\n"
        "(Research/Educational Prototype — Synthetic Data)",
        fontsize=12, fontweight="bold",
    )
    plt.tight_layout()
    cm_path = RESULTS_DIR / "confusion_matrix.png"
    fig.savefig(cm_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"✅ Confusion matrix saved: {cm_path}")

    # -------------------------------------------------------
    # 2. ROC Curves
    # -------------------------------------------------------
    if y_proba is not None:
        y_test_bin = label_binarize(y_test, classes=[0, 1, 2])

        fig, ax = plt.subplots(figsize=(8, 6))

        for i, (cls_name, color) in enumerate(zip(CLASS_NAMES, COLORS)):
            fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_proba[:, i])
            roc_auc_val = auc(fpr, tpr)
            ax.plot(fpr, tpr, color=color, lw=2,
                    label=f"{cls_name} (AUC = {roc_auc_val:.3f})")

        ax.plot([0, 1], [0, 1], "k--", lw=1, alpha=0.5)
        ax.set_xlim([0.0, 1.0])
        ax.set_ylim([0.0, 1.05])
        ax.set_xlabel("False Positive Rate", fontsize=11)
        ax.set_ylabel("True Positive Rate", fontsize=11)
        ax.set_title(
            f"ROC Curves — {model_name} (One-vs-Rest)\n"
            "(Research/Educational Prototype — Synthetic Data)",
            fontsize=12, fontweight="bold",
        )
        ax.legend(loc="lower right", fontsize=10)
        ax.grid(True, alpha=0.3)
        plt.tight_layout()
        roc_path = RESULTS_DIR / "roc_curves.png"
        fig.savefig(roc_path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        print(f"✅ ROC curves saved: {roc_path}")

    # -------------------------------------------------------
    # 3. Feature Importance
    # -------------------------------------------------------
    if hasattr(model, "feature_importances_"):
        all_feature_names = FEATURE_COLUMNS + INDICATOR_COLUMNS
        importance = model.feature_importances_

        # Sort by importance
        sorted_idx = np.argsort(importance)
        sorted_names = [all_feature_names[i] for i in sorted_idx]
        sorted_values = importance[sorted_idx]

        fig, ax = plt.subplots(figsize=(10, 8))
        bars = ax.barh(range(len(sorted_names)), sorted_values, color="#2563eb", alpha=0.8)
        ax.set_yticks(range(len(sorted_names)))
        ax.set_yticklabels(sorted_names, fontsize=9)
        ax.set_xlabel("Feature Importance", fontsize=11)
        ax.set_title(
            f"Feature Importance — {model_name}\n"
            "(Research/Educational Prototype — Synthetic Data)",
            fontsize=12, fontweight="bold",
        )
        ax.grid(True, axis="x", alpha=0.3)
        plt.tight_layout()
        fi_path = RESULTS_DIR / "feature_importance.png"
        fig.savefig(fi_path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        print(f"✅ Feature importance saved: {fi_path}")

    # -------------------------------------------------------
    # 4. Save evaluation report as text
    # -------------------------------------------------------
    report_lines = [
        "=" * 60,
        "NeuroScreen — Evaluation Report",
        "=" * 60,
        "",
        "⚠️  Research/Educational Prototype — trained and evaluated",
        "    on synthetic data. Not clinically validated.",
        "",
        f"Model: {model_name}",
        f"Model Version: {metadata.get('model_version', 'N/A')}",
        f"Training Date: {metadata.get('training_date', 'N/A')}",
        f"Dataset: Synthetic ({df.shape[0]} samples)",
        f"Test Set: {X_test.shape[0]} samples ({TEST_SIZE*100:.0f}%)",
        "",
        "--- Metrics ---",
        f"Accuracy:   {acc:.4f}",
        f"Precision:  {prec:.4f}",
        f"Recall:     {rec:.4f}",
        f"F1:         {f1:.4f}",
        f"ROC-AUC:    {roc:.4f}" if roc else "ROC-AUC:    N/A",
        "",
        "--- Classification Report ---",
        report,
        "--- Confusion Matrix ---",
        str(cm),
        "",
    ]

    # Add cross-validation from metadata
    best_metrics = metadata.get("metrics", {})
    if "cv_f1_scores" in best_metrics:
        report_lines.extend([
            "--- Cross-Validation (5-Fold F1 Weighted) ---",
            f"Scores: {best_metrics['cv_f1_scores']}",
            f"Mean:   {best_metrics['cv_f1_mean']:.4f} ± {best_metrics['cv_f1_std']:.4f}",
            "",
        ])

    # Add all model comparison
    all_results = metadata.get("all_model_results", {})
    if all_results:
        report_lines.extend([
            "--- Model Comparison ---",
            f"{'Model':<15} {'Accuracy':>10} {'F1':>10} {'ROC-AUC':>10} {'CV F1 Mean':>12}",
            "-" * 57,
        ])
        for name, r in all_results.items():
            roc_str = f"{r['roc_auc_weighted']:.4f}" if r.get('roc_auc_weighted') else "N/A"
            marker = " ← BEST" if name == model_name else ""
            report_lines.append(
                f"{name:<15} {r['accuracy']:>10.4f} {r['f1_weighted']:>10.4f} {roc_str:>10} {r['cv_f1_mean']:>12.4f}{marker}"
            )
        report_lines.append("")

    report_text = "\n".join(report_lines)
    report_path = RESULTS_DIR / "evaluation_report.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"✅ Evaluation report saved: {report_path}")

    print()
    print("✅ Evaluation complete.")
    print()
    print("⚠️  REMINDER: All metrics above are from synthetic data.")
    print("   Research/Educational Prototype — not clinically validated.")


if __name__ == "__main__":
    evaluate()
