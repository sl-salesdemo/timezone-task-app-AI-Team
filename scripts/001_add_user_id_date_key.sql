-- Migration: Add user_id and date_key columns to day_data table
-- This migration adds the missing columns required by lib/storage.ts

-- Add user_id column (references profiles.id)
ALTER TABLE public.day_data 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add date_key column (string format: YYYY-MM-DD)
ALTER TABLE public.day_data 
ADD COLUMN IF NOT EXISTS date_key text;

-- Populate date_key from existing date column if data exists
UPDATE public.day_data 
SET date_key = TO_CHAR(date, 'YYYY-MM-DD')
WHERE date_key IS NULL AND date IS NOT NULL;

-- Create unique constraint for user_id + date_key combination
-- This is required for upsert operations in storage.ts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'day_data_user_id_date_key_key'
  ) THEN
    ALTER TABLE public.day_data 
    ADD CONSTRAINT day_data_user_id_date_key_key UNIQUE (user_id, date_key);
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_day_data_user_id ON public.day_data(user_id);
CREATE INDEX IF NOT EXISTS idx_day_data_date_key ON public.day_data(date_key);
CREATE INDEX IF NOT EXISTS idx_day_data_user_date ON public.day_data(user_id, date_key);

-- Update RLS policies to use user_id
DROP POLICY IF EXISTS day_data_select_authenticated ON public.day_data;
DROP POLICY IF EXISTS day_data_insert_authenticated ON public.day_data;
DROP POLICY IF EXISTS day_data_update_authenticated ON public.day_data;
DROP POLICY IF EXISTS day_data_delete_authenticated ON public.day_data;

-- Users can only see their own data
CREATE POLICY day_data_select_authenticated ON public.day_data
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can only insert their own data
CREATE POLICY day_data_insert_authenticated ON public.day_data
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own data
CREATE POLICY day_data_update_authenticated ON public.day_data
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own data
CREATE POLICY day_data_delete_authenticated ON public.day_data
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
