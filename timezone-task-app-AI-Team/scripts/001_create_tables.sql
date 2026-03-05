-- ユーザープロファイル（作業者/管理者のロール管理）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 日次データ（タスク進捗・日報・担当者割り当て）
CREATE TABLE IF NOT EXISTS public.day_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  completed_tasks JSONB DEFAULT '[]',
  report JSONB DEFAULT '{"newItems":[],"sharedItems":[]}',
  region_assignments JSONB DEFAULT '[]',
  custom_tasks JSONB DEFAULT '[]',
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date)
);

-- RLS ポリシー
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_data ENABLE ROW LEVEL SECURITY;

-- profiles: 認証済みユーザーのみ読み取り可能
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- profiles: 自分のプロファイルのみ更新可能
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- day_data: 認証済みユーザーは読み取り可能
DROP POLICY IF EXISTS "day_data_select_authenticated" ON public.day_data;
CREATE POLICY "day_data_select_authenticated" ON public.day_data
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- day_data: 認証済みユーザーは挿入可能
DROP POLICY IF EXISTS "day_data_insert_authenticated" ON public.day_data;
CREATE POLICY "day_data_insert_authenticated" ON public.day_data
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- day_data: 認証済みユーザーは更新可能
DROP POLICY IF EXISTS "day_data_update_authenticated" ON public.day_data;
CREATE POLICY "day_data_update_authenticated" ON public.day_data
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- day_data: 認証済みユーザーは削除可能
DROP POLICY IF EXISTS "day_data_delete_authenticated" ON public.day_data;
CREATE POLICY "day_data_delete_authenticated" ON public.day_data
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- 自動更新トリガー関数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- profiles の updated_at 自動更新トリガー
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- day_data の updated_at 自動更新トリガー
DROP TRIGGER IF EXISTS update_day_data_updated_at ON public.day_data;
CREATE TRIGGER update_day_data_updated_at
  BEFORE UPDATE ON public.day_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 新規ユーザー作成時にプロファイルを自動作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'user'),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
