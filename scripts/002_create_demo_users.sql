-- Create demo users for testing
-- Note: In Supabase, users are created via the auth API, not directly in SQL
-- This script sets up the profiles for users that need to be created via the Supabase auth API

-- First, let's make sure we can insert profiles for demo purposes
-- The actual user creation should be done via Supabase Auth API

-- For local development/testing, you can use these credentials:
-- User: user@example.com / user123
-- Admin: admin@example.com / admin123

-- Insert default profile data for when users sign up
-- This is handled by the trigger, but we can also manually insert for testing

-- Note: The user IDs below are placeholders - actual IDs come from auth.users
-- Run this after creating users via Supabase Auth

-- If you need to update existing profiles to admin role:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';

SELECT 'Demo users should be created via Supabase Auth API or the application signup flow.' as message;
SELECT 'After creating users, update roles using: UPDATE public.profiles SET role = ''admin'' WHERE id = ''<user-id>'';' as note;
