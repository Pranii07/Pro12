"""
NeuroScreen — Synthetic Dataset Generator
============================================
Generates a synthetic multimodal behavioural dataset for demonstration
and training purposes. This is NOT real clinical data.

Feature blocks (22 features total):
  - Typing  (6): wpm, cpm, accuracy, backspace_rate, avg_hold_time_ms, avg_flight_time_ms
  - Memory  (4): word_recall_accuracy, number_recall_accuracy, pattern_accuracy, avg_response_time_ms
  - Reaction (4): avg_reaction_time_ms, fastest_reaction_ms, slowest_reaction_ms, false_start_count
  - Speech  (4): speech_rate_wpm, avg_pause_duration_ms, fluency_score, transcript_word_count
  - Facial  (4): blink_rate_per_min, avg_head_movement, orientation_stability, attention_score

Plus 5 binary modality-present indicators.
Target: screening_level (0=LOW, 1=MODERATE, 2=HIGH)

Modality dropout: ~20% of samples have 1-3 modules randomly missing.
Missing module features are set to NaN; indicator flag = 0.

IMPORTANT: Research/Educational Prototype — trained and evaluated on
synthetic data. Not clinically validated.

Usage:
    cd project-root
    py ml/datasets/generate_synthetic.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

# -------------------------------------------------------
# Configuration
# -------------------------------------------------------

N_SAMPLES = 2000
RANDOM_SEED = 42
OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_CSV = OUTPUT_DIR / "synthetic_dataset.csv"
OUTPUT_META = OUTPUT_DIR / "dataset_metadata.json"

# Class distribution: ~50% LOW, ~30% MODERATE, ~20% HIGH
CLASS_WEIGHTS = [0.50, 0.30, 0.20]
CLASS_NAMES = ["LOW", "MODERATE", "HIGH"]

# Modality dropout probability
MODALITY_DROPOUT_RATE = 0.30  # 30% of samples have at least one module missing

# -------------------------------------------------------
# Feature Definitions
# -------------------------------------------------------
# Each module defines: (feature_name, mean_per_class, std_per_class)
# Classes: [LOW_risk, MODERATE_risk, HIGH_risk]
# LOW risk  = healthy/normal behavioural patterns
# HIGH risk = more atypical behavioural patterns (NOT disease)

FEATURE_SCHEMA = {
    "typing": {
        "features": {
            # Higher WPM → healthier typing → lower risk
            # Means much closer + stds much wider = realistic overlap
            "wpm":               {"means": [52, 43, 35],  "stds": [20, 18, 16]},
            "cpm":               {"means": [260, 215, 175], "stds": [90, 80, 70]},
            # Higher accuracy → lower risk
            "accuracy":          {"means": [0.91, 0.86, 0.80], "stds": [0.08, 0.09, 0.11]},
            # Higher backspace_rate → higher risk
            "backspace_rate":    {"means": [0.08, 0.13, 0.18], "stds": [0.06, 0.07, 0.08]},
            # Longer hold → higher risk (motor slowness)
            "avg_hold_time_ms":  {"means": [100, 135, 170],  "stds": [35, 40, 48]},
            # Longer flight → higher risk
            "avg_flight_time_ms":{"means": [130, 168, 215], "stds": [40, 48, 55]},
        },
        "indicator": "typing_present",
    },
    "memory": {
        "features": {
            # Higher accuracy → lower risk
            "word_recall_accuracy":   {"means": [0.82, 0.73, 0.62], "stds": [0.12, 0.13, 0.14]},
            "number_recall_accuracy": {"means": [0.80, 0.71, 0.60], "stds": [0.13, 0.14, 0.15]},
            "pattern_accuracy":       {"means": [0.84, 0.76, 0.65], "stds": [0.11, 0.12, 0.14]},
            # Higher response time → higher risk
            "avg_response_time_ms":   {"means": [1400, 1780, 2200], "stds": [400, 440, 480]},
        },
        "indicator": "memory_present",
    },
    "reaction": {
        "features": {
            # Higher reaction time → higher risk
            "avg_reaction_time_ms":   {"means": [320, 420, 540],  "stds": [80, 90, 110]},
            "fastest_reaction_ms":    {"means": [210, 278, 365],  "stds": [50, 58, 68]},
            "slowest_reaction_ms":    {"means": [500, 630, 800],  "stds": [100, 115, 140]},
            # More false starts → higher risk
            "false_start_count":      {"means": [0.6, 1.3, 2.2],  "stds": [0.9, 1.2, 1.5]},
        },
        "indicator": "reaction_present",
    },
    "speech": {
        "features": {
            # Lower speech rate → higher risk (slower speech)
            "speech_rate_wpm":        {"means": [130, 114, 95],   "stds": [24, 25, 26]},
            # Longer pauses → higher risk
            "avg_pause_duration_ms":  {"means": [300, 435, 590],  "stds": [95, 110, 130]},
            # Lower fluency → higher risk
            "fluency_score":          {"means": [0.82, 0.73, 0.60], "stds": [0.11, 0.12, 0.14]},
            # Lower word count → higher risk
            "transcript_word_count":  {"means": [75, 62, 48],     "stds": [20, 18, 16]},
        },
        "indicator": "speech_present",
    },
    "facial": {
        "features": {
            # Abnormal blink rate (too low or too high) → higher risk
            # Normal ~15-20/min; LOW risk is normal, HIGH risk deviates
            "blink_rate_per_min":     {"means": [17, 14, 10],    "stds": [5, 6, 6]},
            # More head movement → higher risk (tremor-like)
            "avg_head_movement":      {"means": [3.0, 5.0, 7.5], "stds": [1.8, 2.4, 3.0]},
            # Higher stability → lower risk
            "orientation_stability":  {"means": [0.86, 0.77, 0.64], "stds": [0.10, 0.11, 0.13]},
            # Higher attention → lower risk
            "attention_score":        {"means": [0.84, 0.75, 0.63], "stds": [0.11, 0.12, 0.14]},
        },
        "indicator": "facial_present",
    },
}


MODULE_NAMES = list(FEATURE_SCHEMA.keys())


# -------------------------------------------------------
# Generation Logic
# -------------------------------------------------------

def generate_class_labels(n: int, weights: list[float], rng: np.random.Generator) -> np.ndarray:
    """Generate class labels with specified distribution."""
    return rng.choice(len(weights), size=n, p=weights)


def generate_features_for_class(
    module_config: dict,
    class_idx: int,
    n: int,
    rng: np.random.Generator,
) -> pd.DataFrame:
    """Generate feature values for a single module and class."""
    data = {}
    for feat_name, params in module_config["features"].items():
        mean = params["means"][class_idx]
        std = params["stds"][class_idx]
        values = rng.normal(loc=mean, scale=std, size=n)

        # Clamp values to sensible ranges
        if "accuracy" in feat_name or "score" in feat_name or "fluency" in feat_name or "stability" in feat_name:
            values = np.clip(values, 0.0, 1.0)
        elif "count" in feat_name:
            values = np.clip(values, 0, None).astype(int)
        elif "time" in feat_name or "wpm" in feat_name or "cpm" in feat_name or "rate" in feat_name or "movement" in feat_name:
            values = np.clip(values, 0, None)

        data[feat_name] = values
    return pd.DataFrame(data)


def apply_modality_dropout(
    df: pd.DataFrame,
    rng: np.random.Generator,
    dropout_rate: float = 0.20,
) -> pd.DataFrame:
    """
    Randomly drop 1-3 modules for a fraction of samples.
    Sets feature values to NaN and indicator to 0.
    """
    n = len(df)
    n_dropout = int(n * dropout_rate)
    dropout_indices = rng.choice(n, size=n_dropout, replace=False)

    for idx in dropout_indices:
        # Drop 1-3 random modules
        n_modules_to_drop = rng.integers(1, 4)  # 1, 2, or 3
        modules_to_drop = rng.choice(MODULE_NAMES, size=n_modules_to_drop, replace=False)

        for module in modules_to_drop:
            indicator = FEATURE_SCHEMA[module]["indicator"]
            feature_names = list(FEATURE_SCHEMA[module]["features"].keys())

            df.loc[idx, indicator] = 0
            for feat in feature_names:
                df.loc[idx, feat] = np.nan

    return df


def add_inter_feature_noise(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """
    Add small correlated noise between related features to make
    the dataset more realistic (not perfectly separable).
    """
    # Add correlation between typing speed and accuracy
    typing_mask = df["typing_present"] == 1
    if typing_mask.any():
        noise = rng.normal(0, 0.04, size=typing_mask.sum())
        df.loc[typing_mask, "accuracy"] += noise
        df.loc[typing_mask, "accuracy"] = df.loc[typing_mask, "accuracy"].clip(0, 1)

    # Add correlation between reaction times
    reaction_mask = df["reaction_present"] == 1
    if reaction_mask.any():
        noise = rng.normal(0, 25, size=reaction_mask.sum())
        df.loc[reaction_mask, "avg_reaction_time_ms"] += noise
        df.loc[reaction_mask, "avg_reaction_time_ms"] = df.loc[reaction_mask, "avg_reaction_time_ms"].clip(50, None)

    # Add noise to memory scores
    memory_mask = df["memory_present"] == 1
    if memory_mask.any():
        noise = rng.normal(0, 0.05, size=memory_mask.sum())
        df.loc[memory_mask, "word_recall_accuracy"] += noise
        df.loc[memory_mask, "word_recall_accuracy"] = df.loc[memory_mask, "word_recall_accuracy"].clip(0, 1)

    # Add noise to speech features
    speech_mask = df["speech_present"] == 1
    if speech_mask.any():
        noise = rng.normal(0, 0.04, size=speech_mask.sum())
        df.loc[speech_mask, "fluency_score"] += noise
        df.loc[speech_mask, "fluency_score"] = df.loc[speech_mask, "fluency_score"].clip(0, 1)

    # Add noise to facial features
    facial_mask = df["facial_present"] == 1
    if facial_mask.any():
        noise = rng.normal(0, 0.04, size=facial_mask.sum())
        df.loc[facial_mask, "attention_score"] += noise
        df.loc[facial_mask, "attention_score"] = df.loc[facial_mask, "attention_score"].clip(0, 1)

    return df


def generate_dataset() -> tuple[pd.DataFrame, dict]:
    """Generate the complete synthetic dataset."""
    rng = np.random.default_rng(RANDOM_SEED)
    labels = generate_class_labels(N_SAMPLES, CLASS_WEIGHTS, rng)

    all_data = []

    for class_idx in range(3):
        class_mask = labels == class_idx
        n_class = class_mask.sum()

        class_dfs = []
        for module_name, module_config in FEATURE_SCHEMA.items():
            module_df = generate_features_for_class(module_config, class_idx, n_class, rng)
            class_dfs.append(module_df)

        class_df = pd.concat(class_dfs, axis=1)

        # All modalities present initially
        for module_name in MODULE_NAMES:
            class_df[FEATURE_SCHEMA[module_name]["indicator"]] = 1

        class_df["screening_level"] = class_idx
        all_data.append(class_df)

    df = pd.concat(all_data, ignore_index=True)

    # Shuffle
    df = df.sample(frac=1, random_state=RANDOM_SEED).reset_index(drop=True)

    # Apply modality dropout
    df = apply_modality_dropout(df, rng, MODALITY_DROPOUT_RATE)

    # Add inter-feature noise for realism
    df = add_inter_feature_noise(df, rng)

    # Compute stats for metadata
    class_counts = df["screening_level"].value_counts().sort_index().to_dict()
    missing_stats = {}
    for module_name in MODULE_NAMES:
        indicator = FEATURE_SCHEMA[module_name]["indicator"]
        n_missing = int((df[indicator] == 0).sum())
        missing_stats[module_name] = {
            "n_missing": n_missing,
            "pct_missing": round(n_missing / N_SAMPLES * 100, 1),
        }

    metadata = {
        "dataset_name": "NeuroScreen Synthetic Behavioural Dataset",
        "description": (
            "Synthetically generated multimodal behavioural dataset for "
            "demonstration and educational purposes. NOT real clinical data. "
            "Features simulate typing, memory, reaction time, speech, and facial "
            "movement patterns across three behavioural screening levels."
        ),
        "disclaimer": (
            "Research/Educational Prototype — trained and evaluated on synthetic data. "
            "Not clinically validated."
        ),
        "generation_date": datetime.now(timezone.utc).isoformat(),
        "n_samples": N_SAMPLES,
        "n_features": 22,
        "n_indicators": 5,
        "n_classes": 3,
        "class_names": CLASS_NAMES,
        "class_distribution": {CLASS_NAMES[k]: int(v) for k, v in class_counts.items()},
        "modality_dropout_rate": MODALITY_DROPOUT_RATE,
        "missing_modality_stats": missing_stats,
        "random_seed": RANDOM_SEED,
        "feature_schema": {
            module: list(config["features"].keys())
            for module, config in FEATURE_SCHEMA.items()
        },
        "indicator_columns": [config["indicator"] for config in FEATURE_SCHEMA.values()],
        "target_column": "screening_level",
        "generation_method": (
            "Gaussian distributions with class-conditional means/stds, "
            "feature clamping, inter-feature noise injection, and "
            "randomized modality dropout (~20% of samples missing 1-3 modules)."
        ),
    }

    return df, metadata


# -------------------------------------------------------
# Main
# -------------------------------------------------------

def main():
    print("=" * 60)
    print("NeuroScreen — Synthetic Dataset Generator")
    print("=" * 60)
    print()
    print("⚠️  Research/Educational Prototype — synthetic data only.")
    print()

    df, metadata = generate_dataset()

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Save CSV
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"✅ Dataset saved: {OUTPUT_CSV}")
    print(f"   Shape: {df.shape}")

    # Save metadata
    with open(OUTPUT_META, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"✅ Metadata saved: {OUTPUT_META}")

    # Print summary
    print()
    print("--- Class Distribution ---")
    for cls_name, count in metadata["class_distribution"].items():
        pct = count / N_SAMPLES * 100
        print(f"  {cls_name}: {count} ({pct:.1f}%)")

    print()
    print("--- Missing Modality Stats ---")
    for module, stats in metadata["missing_modality_stats"].items():
        print(f"  {module}: {stats['n_missing']} missing ({stats['pct_missing']}%)")

    print()
    print("--- Feature Summary (non-missing values) ---")
    feature_cols = []
    for config in FEATURE_SCHEMA.values():
        feature_cols.extend(config["features"].keys())
    print(df[feature_cols].describe().round(2).to_string())

    print()
    print("✅ Dataset generation complete.")
    return df, metadata


if __name__ == "__main__":
    main()
