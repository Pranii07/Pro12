# NeuroScreen

**Behavioural AI Framework for Early Neurological Risk Detection**

> ⚠️ **Disclaimer:** This application is intended for behavioural screening and educational/research purposes only. It is NOT a medical diagnosis and cannot replace evaluation by a qualified healthcare professional.

> ⚠️ **Research/Educational Prototype** — trained and evaluated on synthetic data. Not clinically validated.

---

## What is NeuroScreen?

NeuroScreen is a behavioural-screening research and educational web application. It collects measurable behavioural signals across interactive assessments, fuses them into features, compares classical ML models, and reports a non-diagnostic **Behavioural Screening Level** (LOW / MODERATE / HIGH).

### What NeuroScreen Does

- Collects behavioural signals through 5 interactive assessment modules
- Extracts quantitative features from typing patterns, memory performance, reaction time, speech, and facial movement
- Compares multiple ML models (Random Forest, SVM, XGBoost) on the extracted features
- Reports an overall Behavioural Screening Level with per-module breakdowns
- Generates downloadable PDF reports for research/educational use
- Provides admin dashboard with system statistics and ML model metadata

### What NeuroScreen Does NOT Do

- ❌ Does not diagnose any disease or neurological condition
- ❌ Does not predict disease probability
- ❌ Does not replace clinical evaluation by healthcare professionals
- ❌ Does not store raw audio or video data

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Animation | Framer Motion |
| Charts | Recharts |
| API Client | Axios + TanStack Query |
| Backend | FastAPI (Python 3.11+) |
| Database / Auth | Supabase (PostgreSQL + Auth + RLS) |
| ML | scikit-learn, XGBoost |
| Computer Vision | OpenCV + MediaPipe Face Mesh |
| Audio Processing | Librosa + Vosk (speech-to-text) |
| Model Persistence | Joblib |
| PDF Generation | ReportLab |
| Deployment | Vercel (frontend), Render/Railway (backend), Supabase (DB/Auth) |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18 (with npm)
- **Python** ≥ 3.11
- **Supabase** account ([supabase.com](https://supabase.com))

### 1. Clone the Repository

```bash
git clone <repository-url>
cd neuroscreen
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database schema: copy `database/schema/001_initial_schema.sql` into the Supabase SQL Editor and execute
3. Note your project URL, anon key, service role key, and JWT secret from Settings → API

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 4. Start the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with docs at `http://localhost:8000/docs`.

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### 6. (Optional) Train ML Models

```bash
cd ml
python -m training.train_pipeline
```

Pre-trained models are included in `ml/models/`.

---

## Project Structure

```
neuroscreen/
├── frontend/              # React + TypeScript + Vite
│   └── src/
│       ├── components/        # Reusable UI components (shadcn/ui)
│       ├── pages/             # Route-level pages
│       │   └── dashboard/     # Dashboard pages (overview, results, admin, etc.)
│       ├── layouts/           # Page layouts (dashboard layout)
│       ├── contexts/          # React contexts (auth)
│       ├── services/          # API client services
│       ├── types/             # TypeScript type definitions
│       └── lib/               # Utility functions
├── backend/               # FastAPI (Python)
│   ├── app/
│   │   ├── api/               # API route handlers
│   │   ├── core/              # Config, security, middleware, exceptions
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── ml/                # ML model loading + inference
│   │   ├── reports/           # PDF report generation (ReportLab)
│   │   ├── services/          # Business logic services
│   │   └── assessments/       # Assessment processing logic
│   ├── tests/                 # Backend test suite (pytest)
│   ├── main.py                # FastAPI app entry point
│   ├── Dockerfile             # Production Docker image
│   └── requirements.txt
├── ml/                    # Offline ML pipeline
│   ├── datasets/              # Synthetic dataset generation
│   ├── preprocessing/         # Feature preprocessing + scaling
│   ├── training/              # Model training scripts
│   ├── evaluation/            # Model evaluation + comparison
│   └── models/                # Exported models (.joblib) + metadata
├── database/              # Database management
│   └── schema/                # SQL schema definitions
├── docs/                  # Documentation
│   ├── architecture/          # System architecture (with Mermaid diagrams)
│   ├── DEPLOYMENT.md          # Production deployment guide
│   └── ml-pipeline.md         # ML pipeline documentation
├── .env.example           # Environment variable template
├── .gitignore
├── docker-compose.yml     # Local development with Docker
└── README.md
```

---

## Assessment Modules

| Module | Signals Measured | Hardware Required |
|---|---|---|
| **Typing Analysis** | WPM, CPM, accuracy, backspace count, hold/flight time | Keyboard |
| **Memory Tests** | Word/number recall, image memory, pattern memory, accuracy | None |
| **Reaction Time** | Response time, false starts, consistency | None |
| **Speech Analysis** | Speech rate, pause duration, fluency, transcript | Microphone (optional) |
| **Facial Analysis** | Blink rate, head movement, orientation, attention | Camera (optional) |

All modules are **skippable**. At least one module must be completed for a screening result. Missing modules are handled via median imputation with modality-present indicator flags.

---

## ML Models

Three classical ML models are trained and compared on synthetic data:

| Model | Accuracy | F1 (weighted) | ROC-AUC |
|---|---|---|---|
| **SVM (RBF)** ★ | 94.25% | 94.21% | 98.86% |
| Random Forest | 92.75% | 92.70% | 98.92% |
| XGBoost | 93.75% | 93.66% | 99.22% |

★ Best model selected based on F1 score with 5-fold cross-validation.

> **Note:** All metrics are based on synthetic data and are NOT clinically validated.

---

## Language Support

- English
- Kannada (transliterated — no Kannada keyboard required)

---

## Testing

### Backend Tests

```bash
cd backend
pip install pytest
python -m pytest tests/ -v
```

### Frontend Build Verification

```bash
cd frontend
npm run build
```

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for detailed deployment instructions covering:
- Supabase project setup
- Backend deployment (Render / Railway / Docker)
- Frontend deployment (Vercel)
- Environment variables reference
- Post-deployment checklist

---

## Architecture

See [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) for:
- System overview diagrams
- Frontend/backend architecture
- ML pipeline (offline training + online inference)
- Database ER diagram
- Security architecture (JWT flow, RLS)
- Media pipeline (transient processing)
- Deployment architecture

---

## Development Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Project setup + architecture inspection | ✅ Complete |
| 2 | Frontend foundation + design system | ✅ Complete |
| 3 | Supabase integration + database schema + auth | ✅ Complete |
| 4 | FastAPI backend + API skeleton + JWT verification | ✅ Complete |
| 5 | Landing page + auth pages + dashboard shell | ✅ Complete |
| 6 | Assessment selection + language + skip/continue logic | ✅ Complete |
| 7 | Typing + Memory + Reaction modules | ✅ Complete |
| 8 | Media pipeline → Speech + Facial modules | ✅ Complete |
| 9 | Preprocessing + feature fusion + synthetic dataset + ML | ✅ Complete |
| 10 | Prediction + results UI + charts + recommendations | ✅ Complete |
| 11 | PDF reports + history + admin dashboard + ML metadata | ✅ Complete |
| 12 | Security hardening + tests + deployment | ✅ Complete |

---

## License

This project is developed for educational and research purposes.
