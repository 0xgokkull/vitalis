-- ==========================================================
-- Fitbit Air Dashboard - Supabase Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==========================================================

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. OAuth Tokens table (Stores encrypted Google OAuth refresh & access tokens)
CREATE TABLE IF NOT EXISTS public.fitbit_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Daily Biometrics Rollup (Kept forever on free tier ~10 KB / year)
CREATE TABLE IF NOT EXISTS public.daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    date DATE NOT NULL,
    recovery_score INTEGER CHECK (recovery_score BETWEEN 0 AND 100),
    recovery_status TEXT CHECK (recovery_status IN ('optimal', 'moderate', 'low')),
    resting_heart_rate INTEGER,
    resting_heart_rate_baseline INTEGER,
    hrv_rmssd NUMERIC(5, 2),
    hrv_baseline_low NUMERIC(5, 2),
    hrv_baseline_high NUMERIC(5, 2),
    spo2_avg NUMERIC(4, 2),
    spo2_min NUMERIC(4, 2),
    respiratory_rate NUMERIC(4, 2),
    skin_temp_deviation NUMERIC(4, 2),
    steps INTEGER DEFAULT 0,
    steps_goal INTEGER DEFAULT 10000,
    azm_total INTEGER DEFAULT 0,
    azm_fat_burn INTEGER DEFAULT 0,
    azm_cardio INTEGER DEFAULT 0,
    azm_peak INTEGER DEFAULT 0,
    calories_burned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT daily_metrics_user_date_unique UNIQUE (user_email, date)
);

-- 3. Sleep Sessions & Architecture Hypnograms
CREATE TABLE IF NOT EXISTS public.sleep_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    date DATE NOT NULL,
    score INTEGER CHECK (score BETWEEN 0 AND 100),
    total_sleep_minutes INTEGER NOT NULL,
    time_in_bed_minutes INTEGER NOT NULL,
    efficiency INTEGER CHECK (efficiency BETWEEN 0 AND 100),
    deep_minutes INTEGER DEFAULT 0,
    light_minutes INTEGER DEFAULT 0,
    rem_minutes INTEGER DEFAULT 0,
    wake_minutes INTEGER DEFAULT 0,
    stages JSONB DEFAULT '[]'::jsonb, -- Array of {stage, startTime, endTime, durationMinutes}
    restless_events_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT sleep_sessions_user_date_unique UNIQUE (user_email, date)
);

-- 4. High-Resolution Heart Rate Samples (Kept for 90 days to respect 500 MB cap)
CREATE TABLE IF NOT EXISTS public.heart_rate_samples (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_email TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    bpm INTEGER NOT NULL,
    zone TEXT CHECK (zone IN ('out_of_range', 'fat_burn', 'cardio', 'peak'))
);

CREATE INDEX IF NOT EXISTS idx_hr_user_recorded_at 
ON public.heart_rate_samples (user_email, recorded_at DESC);

-- 5. Auto-Pruner Function: Prune HR samples older than 90 days to preserve free storage
CREATE OR REPLACE FUNCTION public.prune_old_heart_rate_samples()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.heart_rate_samples
    WHERE recorded_at < (now() - INTERVAL '90 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Sync Log (Tracks Google Health API sync operations)
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    records_synced INTEGER DEFAULT 0,
    api_calls_used INTEGER DEFAULT 0,
    error_message TEXT
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.fitbit_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heart_rate_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: with RLS on and no policy, the public anon key can read
-- and write nothing. The app reads and writes only on the server with the service
-- role key, which bypasses RLS.
DROP POLICY IF EXISTS "Allow authenticated read and write" ON public.daily_metrics;
DROP POLICY IF EXISTS "Allow authenticated read and write on sleep" ON public.sleep_sessions;
