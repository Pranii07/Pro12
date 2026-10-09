-- ===========================================================
-- NeuroScreen — Cognitive Lab Benchmarks Schema
-- ===========================================================
-- Stores practice and benchmark test sessions from the Cognitive Lab.
-- Tests: 'reaction', 'verbal', 'number', 'visual', 'chimp', 'aim'.
-- ===========================================================

CREATE TABLE IF NOT EXISTS public.user_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    test_type VARCHAR(32) NOT NULL, -- 'reaction', 'verbal', 'number', 'visual', 'chimp', 'aim'
    score DOUBLE PRECISION NOT NULL,
    unit VARCHAR(16) NOT NULL DEFAULT '',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_best BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for rapid lookup
CREATE INDEX IF NOT EXISTS idx_benchmarks_user_test ON public.user_benchmarks(user_id, test_type);
CREATE INDEX IF NOT EXISTS idx_benchmarks_test_type ON public.user_benchmarks(test_type);
CREATE INDEX IF NOT EXISTS idx_benchmarks_created ON public.user_benchmarks(created_at DESC);

-- RLS Policies
ALTER TABLE public.user_benchmarks ENABLE ROW LEVEL SECURITY;

-- 1. Users can insert their own benchmark results
CREATE POLICY "Users can insert their own benchmarks"
    ON public.user_benchmarks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 2. Users can read their own benchmark results
CREATE POLICY "Users can read their own benchmarks"
    ON public.user_benchmarks
    FOR SELECT
    USING (auth.uid() = user_id);

-- 3. Admins can view all benchmark results
CREATE POLICY "Admins can view all benchmarks"
    ON public.user_benchmarks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );
