# NeuroScreen — ML Pipeline Documentation

> **Research/Educational Prototype** — trained and evaluated on synthetic data. Not clinically validated.

## Overview

NeuroScreen's ML pipeline classifies assessment results into three **Behavioural Screening Levels**: LOW, MODERATE, and HIGH. This is **NOT** a medical diagnosis and cannot replace evaluation by a qualified healthcare professional.

## Feature Schema

### Assessment Modules (22 features total)

| Module | Feature | Description | Unit | Direction |
|--------|---------|-------------|------|-----------|
| **Typing** | `wpm` | Words per minute | count | ↑ = lower risk |
| | `cpm` | Characters per minute | count | ↑ = lower risk |
| | `accuracy` | Typing accuracy | 0-1 | ↑ = lower risk |
| | `backspace_rate` | Backspace usage rate | 0-1 | ↑ = higher risk |
| | `avg_hold_time_ms` | Average key hold duration | ms | ↑ = higher risk |
| | `avg_flight_time_ms` | Average inter-key interval | ms | ↑ = higher risk |
| **Memory** | `word_recall_accuracy` | Word recall correctness | 0-1 | ↑ = lower risk |
| | `number_recall_accuracy` | Number recall correctness | 0-1 | ↑ = lower risk |
| | `pattern_accuracy` | Pattern matching accuracy | 0-1 | ↑ = lower risk |
| | `avg_response_time_ms` | Average response time | ms | ↑ = higher risk |
| **Reaction** | `avg_reaction_time_ms` | Average reaction time | ms | ↑ = higher risk |
| | `fastest_reaction_ms` | Fastest reaction time | ms | ↑ = higher risk |
| | `slowest_reaction_ms` | Slowest reaction time | ms | ↑ = higher risk |
| | `false_start_count` | Number of false starts | count | ↑ = higher risk |
| **Speech** | `speech_rate_wpm` | Speech rate | WPM | ↓ = higher risk |
| | `avg_pause_duration_ms` | Average pause duration | ms | ↑ = higher risk |
| | `fluency_score` | Speech fluency | 0-1 | ↓ = higher risk |
| | `transcript_word_count` | Words in transcript | count | ↓ = higher risk |
| **Facial** | `blink_rate_per_min` | Blink rate | /min | deviation = higher risk |
| | `avg_head_movement` | Head movement magnitude | arbitrary | ↑ = higher risk |
| | `orientation_stability` | Head orientation stability | 0-1 | ↓ = higher risk |
| | `attention_score` | Visual attention score | 0-1 | ↓ = higher risk |

### Modality Indicators (5 binary flags)

| Indicator | Module | Value |
|-----------|--------|-------|
| `typing_present` | Typing | 1 = completed, 0 = skipped |
| `memory_present` | Memory | 1 = completed, 0 = skipped |
| `reaction_present` | Reaction | 1 = completed, 0 = skipped |
| `speech_present` | Speech | 1 = completed, 0 = skipped |
| `facial_present` | Facial | 1 = completed, 0 = skipped |

**Total model input:** 27 features (22 behavioural + 5 indicators)

## Media Pipeline (Section 6 — Speech + Facial)

The speech and facial modules require server-side processing because the browser cannot run OpenCV, MediaPipe, or Librosa. To reconcile this with the "minimise raw media retention" principle, we use a **transient in-memory processing** pipeline:

### Pipeline Flow

```
Browser ──capture──► HTTPS upload ──► FastAPI endpoint
                                           │
                                    ┌──────▼──────┐
                                    │ Load bytes   │
                                    │ in memory    │
                                    ├──────────────┤
                                    │ Extract      │
                                    │ features     │
                                    ├──────────────┤
                                    │ Discard raw  │
                                    │ bytes        │
                                    └──────┬───────┘
                                           │
                              numeric feature vector returned
```

1. Browser captures a **bounded** clip (max 30s audio / 15s × 2fps = 30 frames of video) after explicit, clearly-explained permission.
2. Single HTTPS upload to a dedicated FastAPI endpoint (`POST /api/media/speech` or `POST /api/media/facial`).
3. FastAPI extracts numeric features **in memory** — raw bytes are never written to disk or Supabase Storage.
4. Raw bytes are discarded immediately after feature extraction (explicit `del` + garbage collection).
5. MediaStreams are explicitly stopped/released client-side after capture.

### Speech Processing

**Engine:** [Vosk](https://alphacephei.com/vosk/) (offline, open-source STT)

**Why Vosk over alternatives:**
- **Offline**: Runs entirely on-device/server, no external API calls — better for privacy and no ongoing API costs.
- **Lightweight**: Small model variants (~40-50MB) suitable for deployment on free-tier hosting (Render/Railway).
- **Kannada support**: Available language model for Kannada, matching our bilingual requirement.
- **No GPU required**: Unlike Whisper (which benefits from GPU for reasonable speed), Vosk runs efficiently on CPU.
- **Open source**: MIT-licensed, no usage restrictions.

**Alternative considered:** OpenAI Whisper — more accurate but requires PyTorch (~2GB), benefits from GPU, and is overkill for a research prototype on free-tier hosting.

**Feature extraction (Librosa + Vosk):**

| Feature | Method | Description |
|---------|--------|-------------|
| `speech_rate_wpm` | Vosk transcript word count / speech time | Words per minute |
| `avg_pause_duration_ms` | Librosa RMS energy segmentation | Average silence gap duration |
| `fluency_score` | Speech time / total time × 100 | Percentage of time spent speaking |
| `transcript` | Vosk STT | Best-effort transcript (display-only) |

**Fallback:** If Vosk models are unavailable, the processor falls back to energy-based speech rate estimation using Librosa onset detection. The transcript will be empty, and a processing note is attached.

**Dependencies:**
- `librosa` — audio analysis, RMS energy, onset detection
- `soundfile` — WAV file I/O
- `vosk` — speech-to-text (requires downloaded model files)
- `pydub` — audio format conversion (requires FFmpeg on system PATH)

**Model files:** Must be downloaded separately (too large for git):
```bash
python backend/scripts/download_vosk_models.py
```

### Facial Processing

**Engine:** [MediaPipe Face Mesh](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (Google)

**Why MediaPipe:**
- 468 3D facial landmarks with sub-frame latency.
- Runs on CPU (no GPU required).
- Proven eye/face tracking library used in production.
- Includes iris landmarks when `refine_landmarks=True` for better EAR (Eye Aspect Ratio) computation.

**Feature extraction (OpenCV + MediaPipe):**

| Feature | Method | Description |
|---------|--------|-------------|
| `blink_rate_per_minute` | Eye Aspect Ratio (EAR) threshold detection | Blinks detected from consecutive low-EAR frames |
| `avg_head_movement` | Nose tip displacement across frames | Normalised average pixel displacement |
| `head_orientation_stability` | solvePnP yaw/pitch variance | Lower variance = more stable (0-100) |
| `attention_score` | % frames with detected face | Higher = more engagement (0-100) |

**Emotion indicators (EXPERIMENTAL):**
- `smile_likelihood` — Mouth Aspect Ratio (width/height) as a rough smile proxy.
- Always labeled **"Experimental / Non-diagnostic"**.
- **Never used as a screening signal** — display-only, excluded from the ML feature vector.

### Privacy Model

- Raw audio/video exists **only in RAM** during the HTTP request handler.
- Explicit `del` statements ensure bytes go out of scope.
- No raw media is written to disk, Supabase Storage, or any persistent store.
- Only the extracted numeric feature vector is returned and can be persisted.
- Camera/mic permissions are requested with **plain-language explanations** of what data is collected and how it's processed.
- Both modules are **skippable** — hardware access is never forced.

## Missing-Modality Strategy

Each assessment module is **skippable**. The ML pipeline handles missing modules as follows:

1. **Feature block**: Each module contributes a fixed-size feature block (4-6 features).
2. **Binary indicator**: Each module has a binary "modality present" flag (1 = completed, 0 = skipped).
3. **Imputation**: When a module is skipped (indicator = 0), its feature values are imputed with the **median from training data**.
4. **Training data**: The synthetic training dataset includes **randomized modality-dropout** (~20% of samples have 1-3 modules randomly missing), so the model is not naïve about missingness at inference time.

### Limitations

- Median imputation is a simplistic strategy. More sophisticated approaches (e.g., learned embeddings for missingness) could improve robustness.
- The model's accuracy may degrade when many modules are skipped. At least one module must be completed.
- The modality indicators help the model distinguish between "low feature value" and "feature not measured."

## Synthetic Dataset

### Disclosure

**There is no publicly available labeled dataset matching this exact multimodal feature set.** The dataset used for training is **entirely synthetic**, generated for demonstration and educational purposes.

### Generation Method

- **Samples**: 2,000
- **Classes**: 3 (LOW: ~50%, MODERATE: ~30%, HIGH: ~20%)
- **Feature distributions**: Gaussian with class-conditional means and standard deviations, tuned for realistic inter-class overlap (targeting 85-95% model accuracy)
- **Feature clamping**: Values clamped to sensible ranges (e.g., accuracy ∈ [0, 1], times ≥ 0)
- **Inter-feature noise**: Correlated noise injected across typing accuracy, reaction times, memory scores, fluency, and attention for realism
- **Modality dropout**: ~30% of samples have 1-3 modules randomly set to missing (features → NaN, indicator → 0)
- **Random seed**: 42 (reproducible)

### Script

```bash
py ml/datasets/generate_synthetic.py
```

Output: `ml/datasets/synthetic_dataset.csv` + `ml/datasets/dataset_metadata.json`

## Preprocessing Pipeline

Implemented in `ml/preprocessing/preprocessor.py`. Steps in order:

1. **Schema validation**: Verify expected columns exist; add defaults for missing ones.
2. **Indicator validation**: Ensure modality indicators are binary (0 or 1).
3. **Median imputation**: Missing feature values filled with training-set medians.
4. **IQR-based outlier capping**: Features clipped to [Q1 - 1.5×IQR, Q3 + 1.5×IQR].
5. **StandardScaler**: Zero-mean, unit-variance normalization on the 22 feature columns.
6. **Indicator passthrough**: The 5 binary indicators are appended without scaling.

The fitted preprocessor (scaler, medians, IQR bounds) is saved as `ml/models/preprocessor.joblib`.

## Model Training & Comparison

Three models are trained and compared:

| Model | Library | Key Hyperparameters |
|-------|---------|-------------------|
| **Random Forest** | scikit-learn | n_estimators=200, max_depth=12, balanced class weights |
| **SVM** | scikit-learn (CalibratedClassifierCV) | RBF kernel, C=10, balanced class weights |
| **XGBoost** | xgboost | n_estimators=200, max_depth=8, lr=0.1, multi:softprob |

### Latest Training Results (Synthetic Data)

> **Research/Educational Prototype** — all metrics below are from synthetic data. Not clinically validated.

| Model | Accuracy | Precision | Recall | F1 (Weighted) | ROC-AUC | CV F1 Mean |
|-------|----------|-----------|--------|---------------|---------|------------|
| Random Forest | 0.9275 | 0.9271 | 0.9275 | 0.9270 | 0.9892 | 0.9380 |
| **SVM** ← Best | **0.9425** | **0.9420** | **0.9425** | **0.9421** | **0.9886** | **0.9439** |
| XGBoost | 0.9375 | 0.9374 | 0.9375 | 0.9366 | 0.9922 | 0.9367 |

**Best model selected**: SVM (by weighted F1 score)

### Evaluation Metrics

- **Accuracy**
- **Precision** (weighted)
- **Recall** (weighted)
- **F1 Score** (weighted) — used for model selection
- **ROC-AUC** (one-vs-rest, weighted)
- **Confusion matrix**
- **5-fold stratified cross-validation** (F1 weighted)
- **Feature importance** (RF, XGBoost only — SVM does not expose feature importances)

### Training Script

```bash
py ml/training/train_models.py
```

Output:
- `ml/models/best_model.joblib` — best model by F1 score
- `ml/models/preprocessor.joblib` — fitted preprocessor
- `ml/models/model_metadata.json` — comprehensive metadata

### Evaluation Script

```bash
py ml/evaluation/evaluate.py
```

Output (in `ml/evaluation/results/`):
- `confusion_matrix.png`
- `roc_curves.png`
- `feature_importance.png` (when best model supports it)
- `evaluation_report.txt`

## Inference Pipeline

Implemented in `backend/app/ml/predictor.py`. Flow:

```
Module Results → Feature Fusion → Preprocessing → Model Prediction → Screening Level
```

1. **Feature Fusion** (`build_feature_dataframe`): Converts per-module results dict into a single-row DataFrame with all 27 columns.
2. **Preprocessing** (`preprocess_features`): Applies the fitted preprocessor (imputation, capping, scaling).
3. **Prediction**: Runs the loaded model, returns:
   - **Screening Level**: LOW / MODERATE / HIGH
   - **Overall Behaviour Score**: 0-100 (weighted from model distribution)
   - **Model Screening Distribution**: Per-level values (NOT called "probability")
   - **Modalities Present**: Which modules were completed vs skipped

### Model Loading

The model, preprocessor, and metadata are loaded once at FastAPI startup via `app/ml/model_loader.py`. The loader is a singleton — thread-safe for read access.

### Important Notes

- Predictions are **Behavioural Screening Levels**, not diagnoses.
- The "Model Screening Distribution" is NOT calibrated probability. It represents the model's output distribution.
- All predictions include the mandatory disclaimer.
- The admin dashboard shows model metadata (read-only) and never triggers retraining.

## File Map

```
ml/
├── datasets/
│   ├── generate_synthetic.py      # Synthetic dataset generator
│   ├── synthetic_dataset.csv      # Generated dataset (2000 samples)
│   └── dataset_metadata.json      # Dataset generation metadata
├── preprocessing/
│   └── preprocessor.py            # NeuroScreenPreprocessor class
├── training/
│   └── train_models.py            # Training + comparison script
├── evaluation/
│   ├── evaluate.py                # Evaluation + visualization script
│   └── results/
│       ├── confusion_matrix.png   # Confusion matrix heatmap
│       ├── roc_curves.png         # ROC curves (one-vs-rest)
│       └── evaluation_report.txt  # Full evaluation report
├── models/
│   ├── best_model.joblib          # Trained model
│   ├── preprocessor.joblib        # Fitted preprocessor
│   ├── model_metadata.json        # Model metadata + metrics
│   ├── vosk-model-small-en-us/    # Vosk English model (downloaded separately)
│   └── vosk-model-small-kn/       # Vosk Kannada model (downloaded separately)
└── notebooks/                     # (For future exploratory work)

backend/
├── app/
│   ├── api/
│   │   ├── media.py               # Speech + facial upload endpoints
│   │   └── predictions.py         # ML prediction trigger endpoint
│   ├── services/
│   │   ├── speech_processor.py    # Librosa + Vosk speech feature extraction
│   │   └── facial_processor.py    # OpenCV + MediaPipe facial feature extraction
│   ├── schemas/
│   │   └── media.py               # Pydantic response models for media endpoints
│   └── ml/
│       ├── model_loader.py        # Singleton model loader
│       └── predictor.py           # Inference service
├── scripts/
│   └── download_vosk_models.py    # Vosk model download utility
└── tests/
    ├── conftest.py                # Shared test fixtures
    ├── test_ml_pipeline.py        # ML pipeline unit tests (21 tests)
    ├── test_speech_processor.py   # Speech processor unit tests
    ├── test_facial_processor.py   # Facial processor unit tests
    └── test_media_api.py          # Media API endpoint tests
```
