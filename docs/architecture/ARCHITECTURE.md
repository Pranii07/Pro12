# NeuroScreen — System Architecture

> ⚠️ **Disclaimer:** This application is intended for behavioural screening and educational/research purposes only. It is NOT a medical diagnosis.

> ⚠️ **Research/Educational Prototype** — trained and evaluated on synthetic data. Not clinically validated.

---

## 1. System Overview

NeuroScreen is a modular monolith consisting of three main components:

```mermaid
graph TB
    subgraph Frontend["Frontend (React + Vite)"]
        LP[Landing Page]
        Auth[Auth Pages]
        Dashboard[Dashboard]
        Assessments[Assessment Modules]
        Results[Results + Charts]
        Reports[Reports]
        Admin[Admin Dashboard]
    end

    subgraph Backend["Backend (FastAPI)"]
        API[API Layer]
        Security[JWT Security]
        ML[ML Inference]
        PDF[PDF Generator]
        Middleware[Security Middleware]
    end

    subgraph External["External Services (Supabase)"]
        DB[(PostgreSQL + RLS)]
        AuthSvc[Auth Service]
        Storage[File Storage]
    end

    Frontend -->|REST API + JWT| Backend
    Frontend -->|Auth + RLS| External
    Backend -->|Service Role| External
    ML -->|joblib models| Models[(Model Files)]
```

---

## 2. Frontend Architecture

### Technology Stack
- **React 19** with TypeScript
- **Vite 8** for build tooling
- **Tailwind CSS 4** + shadcn/ui for styling
- **Framer Motion** for animations
- **Recharts** for data visualization
- **TanStack Query** for server state management
- **React Router** for client-side routing
- **Axios** for HTTP requests with JWT injection

### Component Hierarchy

```mermaid
graph TD
    App --> ThemeProvider
    ThemeProvider --> AuthProvider
    AuthProvider --> QueryProvider
    QueryProvider --> Router

    Router --> PublicRoutes
    Router --> ProtectedRoutes

    PublicRoutes --> Landing
    PublicRoutes --> Login
    PublicRoutes --> Signup

    ProtectedRoutes --> DashboardLayout
    DashboardLayout --> Sidebar
    DashboardLayout --> TopBar
    DashboardLayout --> PageContent

    PageContent --> Overview
    PageContent --> NewAssessment
    PageContent --> ResultsPage
    PageContent --> ReportsPage
    PageContent --> AdminPage
    PageContent --> ProfilePage
    PageContent --> SettingsPage
```

### State Management
- **Auth state**: React Context (`AuthProvider`) wrapping Supabase Auth
- **Server state**: TanStack Query with stale-time caching
- **UI state**: Component-local `useState`
- **Theme**: `next-themes` for dark/light mode persistence

### API Client
All API calls go through a shared Axios instance (`services/api.ts`) that:
1. Reads the JWT from Supabase Auth session
2. Attaches `Authorization: Bearer <token>` header
3. Auto-refreshes expired tokens via response interceptor
4. Retries the original request with the new token

---

## 3. Backend Architecture

### Technology Stack
- **FastAPI** (Python 3.11+)
- **Pydantic v2** for request/response validation
- **python-jose** for JWT verification
- **Supabase Python SDK** for database access
- **ReportLab** for PDF generation

### Layered Architecture

```mermaid
graph TD
    Client[HTTP Client] --> MW[Middleware Stack]
    MW --> Router[API Router]

    Router --> AuthEP[Auth Endpoints]
    Router --> AssessEP[Assessment Endpoints]
    Router --> PredictEP[Prediction Endpoints]
    Router --> ReportEP[Report Endpoints]
    Router --> AdminEP[Admin Endpoints]
    Router --> HealthEP[Health Check]

    AssessEP --> Security[JWT Verification]
    PredictEP --> Security
    ReportEP --> Security
    AdminEP --> AdminSec[Admin Role Check]

    PredictEP --> MLEngine[ML Predictor]
    MLEngine --> ModelLoader[Model Loader]
    ModelLoader --> Models[(joblib Models)]

    ReportEP --> PDFGen[PDF Generator]

    Security --> Supabase[(Supabase DB)]
    AdminSec --> Supabase
```

### Middleware Stack (order of execution)
1. **RequestIDMiddleware** — Adds unique `X-Request-ID` for tracing
2. **SecurityHeadersMiddleware** — CSP, X-Frame-Options, HSTS, etc.
3. **RequestLoggingMiddleware** — Logs method, path, status, duration
4. **CORSMiddleware** — Cross-origin request handling

### API Endpoints

| Prefix | Auth | Description |
|--------|------|-------------|
| `/api/health` | Public | Health check |
| `/api/auth` | Public | Auth helpers (profile sync) |
| `/api/assessments` | JWT | Assessment CRUD + module results |
| `/api/predictions` | JWT | ML predictions + history |
| `/api/reports` | JWT | PDF generation + download |
| `/api/admin` | Admin | Dashboard stats, users, model info |

---

## 4. ML Pipeline Architecture

### Offline Pipeline (Training)

```mermaid
graph LR
    SynGen[Synthetic Data Generator] --> Dataset[2000 Samples]
    Dataset --> Preprocess[Feature Preprocessing]
    Preprocess --> Split[Train/Test Split 80/20]
    Split --> Train[Model Training]
    Train --> RF[Random Forest]
    Train --> SVM[SVM - RBF Kernel]
    Train --> XGB[XGBoost]
    RF --> Eval[Evaluation + CV]
    SVM --> Eval
    XGB --> Eval
    Eval --> Best[Best Model Selection]
    Best --> Export[Export: joblib + metadata JSON]
```

### Online Pipeline (Inference)

```mermaid
graph LR
    Features[Module Features] --> Fuse[Feature Fusion]
    Fuse --> Impute[Median Imputation for Missing Modules]
    Impute --> Scale[StandardScaler]
    Scale --> Predict[Model Predict]
    Predict --> Level[Screening Level: LOW / MODERATE / HIGH]
    Level --> Score[Overall Behaviour Score]
```

### Feature Schema
- **22 behavioural features** from 5 modules
- **5 modality-present indicators** (binary flags)
- **27 total input features** to the ML model
- Missing modules → median imputation from training data + indicator = 0

---

## 5. Database Architecture

### Entity Relationship

```mermaid
erDiagram
    PROFILES ||--o{ ASSESSMENTS : "has"
    ASSESSMENTS ||--o{ MODULE_RESULTS : "contains"
    ASSESSMENTS ||--o| PREDICTIONS : "produces"
    ASSESSMENTS ||--o| REPORTS : "generates"
    PROFILES ||--o{ REPORTS : "owns"

    PROFILES {
        uuid id PK
        text full_name
        user_role role
        language_code language_preference
        text avatar_url
    }

    ASSESSMENTS {
        uuid id PK
        uuid user_id FK
        language_code language
        assessment_status status
        timestamptz started_at
        timestamptz completed_at
    }

    MODULE_RESULTS {
        uuid id PK
        uuid assessment_id FK
        module_type module_type
        module_status status
        jsonb features
        float score
        int duration_seconds
    }

    PREDICTIONS {
        uuid id PK
        uuid assessment_id FK
        text model_version
        text model_name
        screening_level screening_level
        float overall_score
        jsonb model_distribution
        jsonb features_used
        jsonb modalities_present
    }

    REPORTS {
        uuid id PK
        uuid assessment_id FK
        uuid user_id FK
        text storage_path
        text file_name
        int file_size_bytes
    }
```

### Row Level Security (RLS)
All tables have RLS enabled. Key policies:
- **profiles**: Users can read/update only their own profile
- **assessments**: Users can CRUD only their own assessments
- **module_results**: Access tied to assessment ownership
- **predictions**: Read-only access for assessment owner
- **reports**: Users can read only their own reports

---

## 6. Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Supabase Auth
    participant Backend
    participant DB

    User->>Frontend: Sign In (email + password)
    Frontend->>Supabase Auth: signInWithPassword()
    Supabase Auth-->>Frontend: JWT + Session
    Frontend->>Backend: API Request + Bearer JWT
    Backend->>Backend: verify_jwt() with HS256
    Backend->>DB: Query with service role (bypasses RLS)
    DB-->>Backend: Data
    Backend-->>Frontend: Response
```

### Security Layers
1. **Transport**: HTTPS enforced (HSTS in production)
2. **Authentication**: Supabase-issued JWT verified via HS256
3. **Authorization**: Role-based (USER / ADMIN) checked at endpoint level
4. **Data Access**: PostgreSQL RLS as secondary defense
5. **Response Headers**: CSP, X-Frame-Options, X-Content-Type-Options
6. **Request Tracing**: X-Request-ID for audit trails
7. **Production Hardening**: OpenAPI docs disabled, explicit CORS origins

---

## 7. Media Pipeline

### Design Principle
**No raw media is ever stored.** Audio and video are processed transiently in-memory.

```mermaid
graph LR
    Upload[Client Upload: audio/video blob] --> FastAPI[FastAPI Endpoint]
    FastAPI --> Memory[In-Memory Processing]

    Memory --> Speech[Speech: Librosa + Vosk]
    Memory --> Facial[Facial: OpenCV + MediaPipe]

    Speech --> Features1[Speech Features: rate, pauses, fluency]
    Facial --> Features2[Facial Features: blinks, head movement, attention]

    Features1 --> DB[(Store features only)]
    Features2 --> DB

    Memory --> Discard[Raw media discarded after extraction]
```

---

## 8. Assessment Flow

```mermaid
stateDiagram-v2
    [*] --> SelectLanguage
    SelectLanguage --> SelectModules
    SelectModules --> RunModules

    state RunModules {
        [*] --> Typing
        Typing --> Memory: Complete/Skip
        Memory --> Reaction: Complete/Skip
        Reaction --> Speech: Complete/Skip
        Speech --> Facial: Complete/Skip
        Facial --> [*]: Complete/Skip
    }

    RunModules --> SubmitResults
    SubmitResults --> MLPrediction
    MLPrediction --> ViewResults
    ViewResults --> DownloadPDF
    DownloadPDF --> [*]
```

---

## 9. Deployment Architecture

```mermaid
graph TB
    subgraph Internet
        Users[Users / Browser]
    end

    subgraph Vercel["Vercel (Frontend)"]
        CDN[Global CDN]
        SPA[React SPA Bundle]
    end

    subgraph Render["Render / Railway (Backend)"]
        API[FastAPI + Uvicorn]
        Models[ML Models on Disk]
    end

    subgraph Supabase["Supabase (Managed)"]
        PG[(PostgreSQL)]
        Auth[Auth Service]
        Store[Storage Buckets]
    end

    Users --> CDN
    CDN --> SPA
    SPA --> API
    API --> PG
    API --> Store
    SPA --> Auth
```
