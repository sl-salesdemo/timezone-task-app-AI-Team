-- =====================================================
-- テストユーザー作成スクリプト
-- =====================================================
-- 注意: Supabase Authユーザーはauth.usersテーブルに直接挿入
-- パスワードはSupabase Auth標準のbcryptハッシュ形式

-- テスト用作業者ユーザーを作成
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '00000000-0000-0000-0000-000000000000',
  'worker@test.com',
  crypt('worker123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "テスト作業者"}',
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- テスト用管理者ユーザーを作成
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  '00000000-0000-0000-0000-000000000000',
  'admin@test.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "テスト管理者"}',
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- 作業者プロフィールを作成
INSERT INTO public.profiles (id, email, display_name, role, created_at, updated_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'worker@test.com',
  'テスト作業者',
  'worker',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  updated_at = NOW();

-- 管理者プロフィールを作成
INSERT INTO public.profiles (id, email, display_name, role, created_at, updated_at)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'admin@test.com',
  'テスト管理者',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  updated_at = NOW();
