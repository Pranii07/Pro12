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

### What NeuroScreen Does NOT Do

- ❌ Does not diagnose any disease or neurological condition
- ❌ Does not predict disease probability
- ❌ Does not replace clinical evaluation by healthcare professionals
- ❌ Does not store raw audio or video data

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Charts | Recharts |
| API Client | Axios + TanStack Query |
| Backend | FastAPI (Python) |
| Database / Auth | Supabase (PostgreSQL + Auth + RLS) |
| ML | scikit-learn, XGBoost |
| Computer Vision | OpenCV + MediaPipe Face Mesh |
| Audio Processing | Librosa + Vosk (speech-to-text) |
| Model Persistence | Joblib |
| PDF Generation | ReportLab |
| Deployment | Vercel (frontend), Render/Railway (backend), Supabase (DB/Auth) |

---

## Project Structure

```
neuroscreen/
├── frontend/          # React + TypeScript + Vite
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route-level pages
│       ├── layouts/       # Page layouts
│       ├── routes/        # Routing configuration
│       ├── hooks/         # Custom React hooks
│       ├── services/      # Business logic services
│       ├── api/           # API client & endpoints
│       ├── store/         # State management
│       ├── types/         # TypeScript type definitions
│       ├── utils/         # Utility functions
│       ├── charts/        # Chart components (Recharts)
│       ├── assessments/   # Assessment module components
│       └── assets/        # Static assets
├── backend/           # FastAPI (Python)
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── core/          # Config, security, dependencies
│   │   ├── models/        # Database models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Data access layer
│   │   ├── ml/            # ML inference integration
│   │   ├── assessments/   # Assessment processing logic
│   │   └── reports/       # PDF report generation
│   ├── tests/
│   └── main.py
├── ml/                # Offline ML pipeline
│   ├── datasets/          # Synthetic dataset generation
│   ├── preprocessing/     # Feature preprocessing
│   ├── training/          # Model training scripts
│   ├── evaluation/        # Model evaluation scripts
│   ├── models/            # Exported model files (.joblib)
│   └── notebooks/         # Jupyter notebooks
├── database/          # Database management
│   ├── migrations/        # SQL migrations
│   └── schema/            # Schema definitions
├── docs/              # Documentation
│   ├── architecture/      # Architecture docs & diagrams
│   ├── diagrams/          # UML & system diagrams
│   ├── api/               # API documentation
│   └── project-report/    # Project report
├── .env.example       # Environment variable template
├── .gitignore
├── docker-compose.yml # Optional local development
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

## Language Support

- English
- Kannada (transliterated — no Kannada keyboard required)

---

## Development Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Project setup + architecture inspection | ✅ Complete |
| 2 | Frontend foundation + design system | ⬜ Pending |
| 3 | Supabase integration + database schema + auth | ⬜ Pending |
| 4 | FastAPI backend + API skeleton + JWT verification | ⬜ Pending |
| 5 | Landing page + auth pages + dashboard shell | ⬜ Pending |
| 6 | Assessment selection + language + skip/continue logic | ⬜ Pending |
| 7 | Typing + Memory + Reaction modules | ⬜ Pending |
| 8 | Media pipeline → Speech + Facial modules | ⬜ Pending |
| 9 | Preprocessing + feature fusion + synthetic dataset + ML | ⬜ Pending |
| 10 | Prediction + results UI + charts + recommendations | ⬜ Pending |
| 11 | PDF reports + history + admin dashboard + ML metadata | ⬜ Pending |
| 12 | Security hardening + tests + deployment | ⬜ Pending |

---

## Setup

Detailed setup instructions will be provided as each phase is implemented. See `.env.example` for required environment variables.

---

## License

This project is developed for educational and research purposes.
