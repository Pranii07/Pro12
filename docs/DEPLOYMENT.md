# NeuroScreen — Deployment Guide

> ⚠️ **Disclaimer:** This application is intended for behavioural screening and educational/research purposes only. It is NOT a medical diagnosis.

> ⚠️ **Research/Educational Prototype** — trained and evaluated on synthetic data. Not clinically validated.

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend       │     │   Supabase      │
│   (Vercel)      │────▶│   (Render)      │────▶│   (Managed)     │
│   React + Vite  │     │   FastAPI       │     │   PostgreSQL    │
│                 │     │   + ML Models   │     │   + Auth        │
│                 │────▶│                 │     │   + Storage     │
│                 │     │                 │     │   + RLS         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

| Service | Platform | Cost |
|---------|----------|------|
| Frontend | Vercel (Hobby/Pro) | Free tier available |
| Backend | Render / Railway | Free tier available |
| Database + Auth | Supabase | Free tier (500MB, 50K MAU) |

---

## Prerequisites

- Node.js ≥ 18
- Python ≥ 3.11
- Supabase account
- Vercel account (for frontend deployment)
- Render or Railway account (for backend deployment)

---

## Step 1: Supabase Setup

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down:
   - **Project URL** (`https://your-project-id.supabase.co`)
   - **Anon Key** (safe for frontend)
   - **Service Role Key** (backend only — never expose to frontend)
   - **JWT Secret** (Settings → API → JWT Secret)

### 1.2 Run Database Schema

1. Go to **SQL Editor** in the Supabase dashboard
2. Open and run [`database/schema/001_initial_schema.sql`](../database/schema/001_initial_schema.sql)
3. This creates all tables, enums, triggers, RLS policies, and indexes

### 1.3 Create Storage Bucket

Run this SQL in the Supabase SQL Editor to create the reports storage bucket:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('reports', 'reports', false, 10485760);  -- 10MB limit

-- RLS: Users can only access their own report files
CREATE POLICY "Users can read own reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role can insert reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'reports');
```

### 1.4 Enable Email Auth

1. Go to **Authentication → Providers**
2. Ensure **Email** provider is enabled
3. (Optional) Configure email templates

---

## Step 2: Backend Deployment

### Option A: Render

1. Connect your GitHub repository to [render.com](https://render.com)
2. Create a **Web Service**:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2`
   - **Environment:** Python 3.11
3. Add environment variables (see [Environment Variables](#environment-variables) below)
4. Deploy

### Option B: Docker (any platform)

```bash
# Build
docker build -t neuroscreen-backend ./backend

# Run
docker run -p 8000:8000 --env-file .env neuroscreen-backend
```

### Option C: Railway

1. Connect your GitHub repository to [railway.app](https://railway.app)
2. Set **Root Directory** to `backend`
3. Railway auto-detects the Dockerfile
4. Add environment variables
5. Deploy

---

## Step 3: Frontend Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Vercel auto-detects Vite and uses `vercel.json` configuration
4. Add environment variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
   - `VITE_API_BASE_URL` = your deployed backend URL (e.g., `https://neuroscreen-api.onrender.com`)
5. Deploy

### Manual Build

```bash
cd frontend
npm install
npm run build
# Deploy the `dist/` directory to any static hosting
```

---

## Environment Variables

### Backend (`.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only) | ✅ |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret for token verification | ✅ |
| `BACKEND_HOST` | Server bind host | Default: `0.0.0.0` |
| `BACKEND_PORT` | Server port | Default: `8000` |
| `BACKEND_ENV` | Environment (`development` / `production`) | Default: `development` |
| `CORS_ORIGINS` | Comma-separated allowed origins | Default: `http://localhost:5173` |
| `ML_MODEL_PATH` | Path to trained model file | Default: `ml/models/best_model.joblib` |
| `ML_MODEL_METADATA_PATH` | Path to model metadata JSON | Default: `ml/models/model_metadata.json` |
| `RATE_LIMIT_AUTH` | Rate limit for auth endpoints (req/min) | Default: `20` |
| `RATE_LIMIT_PREDICT` | Rate limit for prediction endpoints (req/min) | Default: `10` |

### Frontend (Vite)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ |
| `VITE_API_BASE_URL` | Backend API base URL | ✅ |

---

## Post-Deployment Checklist

- [ ] Frontend loads at deployed URL
- [ ] Sign up / sign in works
- [ ] Health endpoint returns 200: `GET {backend_url}/api/health`
- [ ] OpenAPI docs are disabled in production
- [ ] CORS allows requests from frontend domain
- [ ] Assessment creation works end-to-end
- [ ] ML prediction returns screening level
- [ ] PDF report generation and download works
- [ ] Admin dashboard loads for ADMIN role users
- [ ] Security headers are present in responses
- [ ] HTTPS is enforced on all endpoints

---

## Troubleshooting

### CORS Errors
Set `CORS_ORIGINS` to include your frontend deployment URL (e.g., `https://neuroscreen.vercel.app`).

### JWT Verification Failures
Ensure `SUPABASE_JWT_SECRET` matches the JWT secret from your Supabase dashboard (Settings → API → JWT Secret).

### ML Model Not Loading
Ensure the model files (`best_model.joblib`, `preprocessor.joblib`, `model_metadata.json`) exist in the `ml/models/` directory relative to the backend root.

### Storage Upload Failures
Ensure the `reports` storage bucket exists in Supabase and the service role key has insert permissions.

---

## Security Considerations

- **Never expose** `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- **Never commit** `.env` files to version control
- Set `BACKEND_ENV=production` in production to:
  - Disable OpenAPI docs (`/docs`, `/redoc`)
  - Enable HSTS header
  - Disable debug mode
- Row Level Security (RLS) on all tables ensures users can only access their own data
- JWT tokens are verified on every protected endpoint
- Media files (audio/video) are processed transiently in memory — never persisted
