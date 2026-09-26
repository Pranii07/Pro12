-- ===========================================================
-- NeuroScreen — Initial Database Schema
-- ===========================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- This creates all core tables, enums, indexes, and triggers.
--
-- IMPORTANT: This schema depends on Supabase's `auth.users` table.
-- Make sure Supabase Auth is enabled before running.
-- ===========================================================

-- -------------------------------------------------------
-- 1. Custom Types (Enums)
-- -------------------------------------------------------

-- Role enum for user profiles
CREATE TYPE public.user_role AS ENUM ('USER', 'ADMIN');

-- Assessment session status
CREATE TYPE public.assessment_status AS ENUM ('in_progress', 'completed', 'abandoned');

-- Assessment module types
CREATE TYPE public.module_type AS ENUM ('typing', 'memory', 'reaction', 'speech', 'facial');

-- Module completion status
CREATE TYPE public.module_status AS ENUM ('completed', 'skipped', 'pending');

-- Behavioural Screening Level (never called "diagnosis" or "disease probability")
CREATE TYPE public.screening_level AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- Language support
CREATE TYPE public.language_code AS ENUM ('en', 'kn');


-- -------------------------------------------------------
-- 2. Profiles Table
-- -------------------------------------------------------
-- Extends Supabase auth.users with application-specific data.
-- A trigger auto-creates a row here on signup.

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    role public.user_role NOT NULL DEFAULT 'USER',
    language_preference public.language_code NOT NULL DEFAULT 'en',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for role-based lookups (admin dashboard)
CREATE INDEX idx_profiles_role ON public.profiles(role);

COMMENT ON TABLE public.profiles IS 'User profile data extending Supabase auth.users. One row per user.';
COMMENT ON COLUMN public.profiles.role IS 'USER or ADMIN. Defaults to USER on signup.';
COMMENT ON COLUMN public.profiles.language_preference IS 'Preferred language for assessment prompts (en = English, kn = Kannada).';


-- -------------------------------------------------------
-- 3. Assessments Table
-- -------------------------------------------------------
-- Each row represents one assessment session.

CREATE TABLE public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    language public.language_code NOT NULL DEFAULT 'en',
    status public.assessment_status NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user lookups (dashboard history)
CREATE INDEX idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX idx_assessments_status ON public.assessments(status);
CREATE INDEX idx_assessments_user_status ON public.assessments(user_id, status);

COMMENT ON TABLE public.assessments IS 'Assessment sessions. Each session can include multiple modules.';
COMMENT ON COLUMN public.assessments.status IS 'in_progress = user is still taking it, completed = all chosen modules done, abandoned = user left without completing.';


-- -------------------------------------------------------
-- 4. Module Results Table
-- -------------------------------------------------------
-- Per-module results within an assessment session.
-- Features stored as JSONB for flexibility (each module has different feature shapes).

CREATE TABLE public.module_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    module_type public.module_type NOT NULL,
    status public.module_status NOT NULL DEFAULT 'pending',
    features JSONB DEFAULT '{}',
    score DOUBLE PRECISION,
    duration_seconds DOUBLE PRECISION,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Each module type appears at most once per assessment
    CONSTRAINT uq_module_per_assessment UNIQUE (assessment_id, module_type)
);

-- Index for assessment lookups
CREATE INDEX idx_module_results_assessment_id ON public.module_results(assessment_id);

COMMENT ON TABLE public.module_results IS 'Per-module assessment results. Features stored as JSONB (schema varies per module type).';
COMMENT ON COLUMN public.module_results.features IS 'Module-specific feature vector as JSON. E.g., typing: {wpm, cpm, accuracy, ...}. Schema documented in docs/ml-pipeline.md.';
COMMENT ON COLUMN public.module_results.score IS 'Normalized module score (0-100). NULL if module was skipped.';
COMMENT ON COLUMN public.module_results.status IS 'completed = user finished this module, skipped = user chose to skip, pending = not yet attempted.';


-- -------------------------------------------------------
-- 5. Predictions Table
-- -------------------------------------------------------
-- ML screening predictions for completed assessments.

CREATE TABLE public.predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    model_version TEXT NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'unknown',
    screening_level public.screening_level NOT NULL,
    overall_score DOUBLE PRECISION,
    model_distribution JSONB NOT NULL DEFAULT '{}',
    features_used JSONB NOT NULL DEFAULT '{}',
    modalities_present JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One prediction per assessment (can be regenerated by deleting + reinserting)
    CONSTRAINT uq_prediction_per_assessment UNIQUE (assessment_id)
);

-- Index for assessment lookups
CREATE INDEX idx_predictions_assessment_id ON public.predictions(assessment_id);
CREATE INDEX idx_predictions_screening_level ON public.predictions(screening_level);

COMMENT ON TABLE public.predictions IS 'ML-based behavioural screening predictions. NOT a medical diagnosis.';
COMMENT ON COLUMN public.predictions.screening_level IS 'Behavioural Screening Level: LOW, MODERATE, or HIGH. Never represents a disease diagnosis.';
COMMENT ON COLUMN public.predictions.model_distribution IS 'Model screening distribution across levels (never called "probability"). E.g., {"LOW": 0.65, "MODERATE": 0.25, "HIGH": 0.10}.';
COMMENT ON COLUMN public.predictions.modalities_present IS 'Which modules were completed vs skipped. E.g., {"typing": true, "memory": true, "speech": false, ...}.';
COMMENT ON COLUMN public.predictions.features_used IS 'The preprocessed feature vector used for prediction (for auditability).';


-- -------------------------------------------------------
-- 6. Reports Table
-- -------------------------------------------------------
-- Metadata for generated PDF reports. Actual PDFs stored in Supabase Storage.

CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL DEFAULT 'report.pdf',
    file_size_bytes INTEGER,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user lookups
CREATE INDEX idx_reports_user_id ON public.reports(user_id);
CREATE INDEX idx_reports_assessment_id ON public.reports(assessment_id);

COMMENT ON TABLE public.reports IS 'PDF report metadata. Actual files stored in Supabase Storage bucket.';
COMMENT ON COLUMN public.reports.storage_path IS 'Path within the Supabase Storage bucket where the PDF is stored.';


-- -------------------------------------------------------
-- 7. Updated-At Trigger Function
-- -------------------------------------------------------
-- Automatically updates `updated_at` on row modification.

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all tables with updated_at
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_assessments_updated_at
    BEFORE UPDATE ON public.assessments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_module_results_updated_at
    BEFORE UPDATE ON public.module_results
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- -------------------------------------------------------
-- 8. Auto-Create Profile on Signup
-- -------------------------------------------------------
-- When a new user signs up via Supabase Auth, automatically create
-- a corresponding profiles row with default USER role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, language_preference)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'USER',
        COALESCE(
            (NEW.raw_user_meta_data->>'language_preference')::public.language_code,
            'en'
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on Supabase auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -------------------------------------------------------
-- 9. Storage Bucket for PDF Reports
-- -------------------------------------------------------
-- Create a storage bucket for PDF reports (if using Supabase Storage).
-- NOTE: This must be run AFTER enabling Storage in Supabase dashboard.
-- Uncomment the lines below when ready:

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('reports', 'reports', false);
