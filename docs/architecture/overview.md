# NeuroScreen — Architecture Overview

> **Research/Educational Prototype** — trained and evaluated on synthetic data. Not clinically validated.

---

## 1. System Architecture

NeuroScreen follows a **modular monolith** architecture. All backend logic runs in a single FastAPI process. The ML pipeline is offline (scripts/notebooks), not a live service.

### Why Modular Monolith?

- This is an educational/research project — microservices add deployment and observability complexity with no benefit at this scale
- A single FastAPI process simplifies deployment, debugging, and testing
- The ML layer is decoupled by design — it runs offline and exports artifacts consumed by the backend

---

## 2. Component Diagram

```mermaid
graph TB
    subgraph "Client (Browser)"
        FE["React + TypeScript + Vite<br/>UI, Camera/Mic Handling,<br/>Assessment Interaction"]
    end

    subgraph "Supabase (Managed)"
        AUTH["Supabase Auth<br/>JWT Issuance, User Management"]
        DB["PostgreSQL<br/>Row Level Security"]
        STORE["Supabase Storage<br/>PDF Reports Only"]
    end

    subgraph "Backend (FastAPI)"
        API["REST API Layer<br/>Input Validation, Routing"]
        BIZ["Business Logic<br/>Assessment Processing"]
        FEAT["Feature Extraction<br/>MediaPipe, Librosa, Vosk"]
        INFER["ML Inference<br/>Model Loading, Prediction"]
        PDF["Report Generation<br/>ReportLab"]
    end

    subgraph "ML Pipeline (Offline)"
        SYN["Synthetic Data Generation"]
        TRAIN["Model Training<br/>RF, SVM, XGBoost"]
        EVAL["Evaluation & Comparison"]
        EXPORT["Model Export<br/>.joblib + metadata.json"]
    end

    FE -->|"HTTPS + JWT"| API
    FE -->|"Auth Requests"| AUTH
    AUTH -->|"JWT Token"| FE
    API -->|"Verify JWT"| AUTH
    API --> BIZ
    BIZ --> FEAT
    BIZ --> INFER
    BIZ --> PDF
    API -->|"Parameterized Queries"| DB
    PDF -->|"Upload PDF"| STORE
    EXPORT -.->|"Model Artifacts<br/>(file system)"| INFER
    SYN --> TRAIN --> EVAL --> EXPORT

    classDef client fill:#4F46E5,stroke:#3730A3,color:#fff
    classDef supabase fill:#3ECF8E,stroke:#28A06E,color:#fff
    classDef backend fill:#F59E0B,stroke:#D97706,color:#000
    classDef ml fill:#EC4899,stroke:#DB2777,color:#fff

    class FE client
    class AUTH,DB,STORE supabase
    class API,BIZ,FEAT,INFER,PDF backend
    class SYN,TRAIN,EVAL,EXPORT ml
```

---

## 3. Data Flow

### 3.1 Authentication Flow

```mermaid
sequenceDiagram
    participant User as Browser
    participant SA as Supabase Auth
    participant API as FastAPI
    participant DB as PostgreSQL

    User->>SA: Sign up / Sign in
    SA-->>User: JWT (access_token + refresh_token)
    User->>API: Request + Authorization: Bearer {JWT}
    API->>SA: Verify JWT against JWKS
    SA-->>API: Token valid + user claims
    API->>DB: Query with RLS (user_id from JWT)
    DB-->>API: Filtered results
    API-->>User: Response
```

### 3.2 Assessment & Prediction Flow

```mermaid
sequenceDiagram
    participant User as Browser
    participant API as FastAPI
    participant FE as Feature Extraction
    participant ML as ML Model
    participant DB as PostgreSQL

    User->>API: Submit assessment data<br/>(typing metrics, memory scores, etc.)
    
    Note over API: Validate input (Pydantic)
    
    alt Media module (Speech/Facial)
        User->>API: Upload bounded media clip
        API->>FE: Extract features in memory
        FE-->>API: Feature vector
        Note over API: Discard raw media bytes
    end
    
    API->>API: Fuse features from all<br/>completed modules
    API->>API: Handle missing modules<br/>(median impute + flag=0)
    API->>ML: Preprocessed feature vector
    ML-->>API: Screening prediction
    API->>API: Map to LOW / MODERATE / HIGH
    API->>DB: Store assessment results<br/>(features + prediction, never raw media)
    API-->>User: Behavioural Screening Level<br/>+ Module Scores + Distribution
```

### 3.3 Media Pipeline (Section 6 Compliance)

```mermaid
flowchart LR
    A["Browser: Capture<br/>bounded clip<br/>(explicit permission)"] --> B["HTTPS Upload<br/>to FastAPI endpoint"]
    B --> C["FastAPI: Extract<br/>features IN MEMORY<br/>(MediaPipe / Librosa / Vosk)"]
    C --> D["Feature vector<br/>persisted to DB"]
    C --> E["Raw bytes<br/>DISCARDED immediately"]
    B --> F["Browser: Stop<br/>MediaStreams,<br/>release camera/mic"]

    style E fill:#EF4444,stroke:#DC2626,color:#fff
    style D fill:#22C55E,stroke:#16A34A,color:#fff
```

---

## 4. Technology Justification

| Technology | Purpose | Why Chosen | Alternative Considered |
|---|---|---|---|
| **React + Vite** | Frontend framework | Fast HMR, TypeScript-first, large ecosystem | Next.js — SSR not needed for this SPA |
| **Tailwind CSS + shadcn/ui** | Styling | Utility-first + accessible components, consistent design system | Plain CSS — less productive for complex UIs |
| **Recharts** | Data visualization | Native React components, declarative API, covers all chart types needed | Chart.js — requires wrapper, imperative config |
| **FastAPI** | Backend API | Async Python, auto OpenAPI docs, Pydantic validation, ML ecosystem | Flask — no async, no auto-docs, manual validation |
| **Supabase** | Auth + DB + Storage | Managed PostgreSQL + Auth + RLS + Storage in one service | Firebase — less SQL flexibility; self-hosted Postgres — more ops burden |
| **scikit-learn + XGBoost** | ML models | Industry standard for classical ML, well-documented, Joblib export | Deep learning — overkill for tabular features, less explainable |
| **Vosk** | Speech-to-text | Offline, privacy-preserving, supports English + Kannada, no API keys | Whisper — heavier model, requires GPU/more RAM |
| **MediaPipe Face Mesh** | Facial feature extraction | Lightweight, well-documented, 468 landmarks, works on CPU | dlib — fewer landmarks, slower |
| **Librosa** | Audio feature extraction | Standard Python audio analysis library, extensive feature set | torchaudio — heavier dependency, GPU-oriented |
| **ReportLab** | PDF generation | Server-side, Python-native, full control over layout | WeasyPrint — HTML-to-PDF has rendering inconsistencies |
| **Joblib** | Model persistence | Standard for scikit-learn model serialization, handles numpy arrays | Pickle — less safe, Joblib handles large arrays better |

---

## 5. Database Architecture (Preview)

> Full ER diagram and schema will be created in Phase 3 (Supabase integration).

### Core Tables (planned)

| Table | Purpose |
|---|---|
| `profiles` | User profile data (extends Supabase auth.users) |
| `assessments` | Assessment sessions (user, language, status, timestamps) |
| `module_results` | Per-module results (assessment_id, module_type, features, scores) |
| `predictions` | ML predictions (assessment_id, model_version, screening_level, distribution) |
| `reports` | Generated PDF report metadata (assessment_id, storage_path, generated_at) |

### Row Level Security

- Users can only read/write their own data
- Admins can read all data (never write user assessments)
- Service role used only by backend (never exposed to frontend)

---

## 6. Missing Modality Strategy

Each of the 5 assessment modules produces:
1. A **fixed-size feature vector** (e.g., typing → 6 features, memory → 4 features)
2. A **binary `modality_present` indicator** (1 = completed, 0 = skipped)

When a module is skipped:
- Feature values are imputed with the **median** from the training data
- The `modality_present` flag is set to **0**
- The model was trained with randomized modality dropout, so it is not naive about missingness

### Limitations
- Imputed values are population medians, not personalized — they add noise
- Screening accuracy degrades with more skipped modules
- Results with many skipped modules should be interpreted cautiously

Full documentation will be in `docs/ml-pipeline.md` (Phase 9).

---

## 7. Security Architecture

```mermaid
flowchart TB
    subgraph "Defense Layers"
        L1["Layer 1: Supabase Auth<br/>JWT issuance, email verification"]
        L2["Layer 2: FastAPI JWT Verification<br/>Every protected route checks JWT via JWKS"]
        L3["Layer 3: Role-Based Authorization<br/>USER vs ADMIN checked server-side"]
        L4["Layer 4: Row Level Security<br/>PostgreSQL RLS policies"]
        L5["Layer 5: Input Validation<br/>Pydantic schemas on all endpoints"]
        L6["Layer 6: Transport Security<br/>HTTPS, CORS restricted, rate limiting"]
    end

    L1 --> L2 --> L3 --> L4 --> L5 --> L6

    style L1 fill:#6366F1,stroke:#4F46E5,color:#fff
    style L2 fill:#8B5CF6,stroke:#7C3AED,color:#fff
    style L3 fill:#A855F7,stroke:#9333EA,color:#fff
    style L4 fill:#C084FC,stroke:#A855F7,color:#fff
    style L5 fill:#D8B4FE,stroke:#C084FC,color:#000
    style L6 fill:#F3E8FF,stroke:#D8B4FE,color:#000
```

---

## 8. Deployment Architecture

```mermaid
graph LR
    subgraph "Production"
        V["Vercel<br/>Frontend (React)"]
        R["Render / Railway<br/>Backend (FastAPI)"]
        S["Supabase<br/>Auth + PostgreSQL + Storage"]
        G["GitHub<br/>Source Control"]
    end

    V -->|"HTTPS API calls"| R
    R -->|"Supabase client"| S
    G -->|"CI/CD Deploy"| V
    G -->|"CI/CD Deploy"| R

    classDef vercel fill:#000,stroke:#333,color:#fff
    classDef render fill:#46E3B7,stroke:#2CB88A,color:#000
    classDef supa fill:#3ECF8E,stroke:#28A06E,color:#fff
    classDef gh fill:#24292E,stroke:#1B1F23,color:#fff

    class V vercel
    class R render
    class S supa
    class G gh
```
