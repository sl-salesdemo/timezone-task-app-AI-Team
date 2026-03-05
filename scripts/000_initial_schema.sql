-- Initial Database Schema for BPO業務進捗チェックシステム
-- This script creates the base tables and RLS policies

-- ================================================
-- Table: profiles
-- ユーザープロファイル情報を保存
-- ================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ================================================
-- Table: day_data
-- 日次の作業データを保存
-- ================================================
CREATE TABLE IF NOT EXISTS day_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  date_key TEXT NOT NULL,
  completed_tasks JSONB DEFAULT '[]'::jsonb,
  report JSONB DEFAULT '{"newItems": [], "sharedItems": []}'::jsonb,
  region_assignments JSONB DEFAULT '[]'::jsonb,
  custom_tasks JSONB DEFAULT '[]'::jsonb,
  saved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date_key)
);

-- Enable RLS
ALTER TABLE day_data ENABLE ROW LEVEL SECURITY;

-- Day data policies (users can only access their own data)
CREATE POLICY "day_data_select_authenticated" ON day_data
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "day_data_insert_authenticated" ON day_data
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_data_update_authenticated" ON day_data
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_data_delete_authenticated" ON day_data
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ================================================
-- Function: Update timestamp trigger
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to day_data
DROP TRIGGER IF EXISTS update_day_data_updated_at ON day_data;
CREATE TRIGGER update_day_data_updated_at
  BEFORE UPDATE ON day_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- Function: Auto-create profile on user signup
-- ================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
