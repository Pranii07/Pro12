-- ===========================================================
-- NeuroScreen — Row Level Security Policies
-- ===========================================================
-- Run this AFTER 001_initial_schema.sql in the Supabase SQL Editor.
--
-- Security model:
--   - Users can read/update their own data
--   - Admins can read all data
--   - Inserts to module_results/predictions happen via backend (service role)
--   - Service role bypasses RLS entirely
-- ===========================================================


-- -------------------------------------------------------
-- Helper: Check if current user is an admin
-- -------------------------------------------------------
-- Reads the role from the profiles table using the JWT's auth.uid().
-- Used in RLS policies for admin access.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- -------------------------------------------------------
-- 1. Profiles — RLS Policies
-- -------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin"
    ON public.profiles
    FOR SELECT
    USING (public.is_admin());

-- Users can update their own profile (but not role)
CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        -- Prevent users from escalating their own role
        AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    );

-- Profile insert happens via trigger (service role), not direct user insert
-- No INSERT policy needed for regular users


-- -------------------------------------------------------
-- 2. Assessments — RLS Policies
-- -------------------------------------------------------

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Users can read their own assessments
CREATE POLICY "assessments_select_own"
    ON public.assessments
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can read all assessments
CREATE POLICY "assessments_select_admin"
    ON public.assessments
    FOR SELECT
    USING (public.is_admin());

-- Users can create their own assessments
CREATE POLICY "assessments_insert_own"
    ON public.assessments
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own assessments (e.g., mark as completed/abandoned)
CREATE POLICY "assessments_update_own"
    ON public.assessments
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own assessments
CREATE POLICY "assessments_delete_own"
    ON public.assessments
    FOR DELETE
    USING (auth.uid() = user_id);


-- -------------------------------------------------------
-- 3. Module Results — RLS Policies
-- -------------------------------------------------------

ALTER TABLE public.module_results ENABLE ROW LEVEL SECURITY;

-- Users can read their own module results (via assessment ownership)
CREATE POLICY "module_results_select_own"
    ON public.module_results
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments
            WHERE assessments.id = module_results.assessment_id
            AND assessments.user_id = auth.uid()
        )
    );

-- Admins can read all module results
CREATE POLICY "module_results_select_admin"
    ON public.module_results
    FOR SELECT
    USING (public.is_admin());

-- Users can insert module results for their own assessments
CREATE POLICY "module_results_insert_own"
    ON public.module_results
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessments
            WHERE assessments.id = module_results.assessment_id
            AND assessments.user_id = auth.uid()
        )
    );

-- Users can update their own module results
CREATE POLICY "module_results_update_own"
    ON public.module_results
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments
            WHERE assessments.id = module_results.assessment_id
            AND assessments.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessments
            WHERE assessments.id = module_results.assessment_id
            AND assessments.user_id = auth.uid()
        )
    );


-- -------------------------------------------------------
-- 4. Predictions — RLS Policies
-- -------------------------------------------------------

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Users can read their own predictions (via assessment ownership)
CREATE POLICY "predictions_select_own"
    ON public.predictions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments
            WHERE assessments.id = predictions.assessment_id
            AND assessments.user_id = auth.uid()
        )
    );

-- Admins can read all predictions
CREATE POLICY "predictions_select_admin"
    ON public.predictions
    FOR SELECT
    USING (public.is_admin());

-- Predictions are inserted by the backend (service role bypasses RLS)
-- No INSERT policy for regular users — predictions come from ML pipeline


-- -------------------------------------------------------
-- 5. Reports — RLS Policies
-- -------------------------------------------------------

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users can read their own reports
CREATE POLICY "reports_select_own"
    ON public.reports
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can read all reports
CREATE POLICY "reports_select_admin"
    ON public.reports
    FOR SELECT
    USING (public.is_admin());

-- Reports are generated by the backend (service role bypasses RLS)
-- No INSERT policy for regular users


-- -------------------------------------------------------
-- 6. Storage Policies (for reports bucket)
-- -------------------------------------------------------
-- Uncomment these after creating the 'reports' storage bucket.

-- Users can read their own reports from storage
-- CREATE POLICY "reports_storage_select_own"
--     ON storage.objects
--     FOR SELECT
--     USING (
--         bucket_id = 'reports'
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );

-- Backend uploads reports via service role (bypasses storage policies)
