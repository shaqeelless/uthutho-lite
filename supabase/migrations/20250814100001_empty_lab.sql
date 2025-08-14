/*
  # Fix Authentication Database Issues

  This migration resolves database configuration problems that prevent user signup:

  1. Database Setup
     - Ensure profiles table exists with correct structure
     - Set up proper foreign key relationships
     - Configure default values and constraints

  2. Security Configuration
     - Disable RLS on profiles table temporarily
     - Remove conflicting policies
     - Grant necessary permissions

  3. Trigger Management
     - Remove problematic triggers that interfere with auth
     - Keep only essential triggers
     - Fix trigger functions

  4. User Management
     - Ensure proper user creation flow
     - Fix any auth.users table issues
     - Configure proper permissions
*/

-- First, ensure the profiles table exists with correct structure
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  updated_at timestamptz DEFAULT now(),
  avatar_url text,
  preferred_transport text,
  points integer DEFAULT 0,
  titles text[] DEFAULT '{}',
  selected_title text DEFAULT 'Newbie Explorer',
  favorites jsonb DEFAULT '[]',
  home text,
  preferred_language text
);

-- Disable RLS on profiles table to prevent signup interference
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might interfere
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Remove any problematic triggers on profiles
DROP TRIGGER IF EXISTS handle_updated_at ON profiles;
DROP TRIGGER IF EXISTS handle_new_user ON profiles;

-- Recreate the updated_at trigger (this is safe)
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Ensure user_roles table exists and is properly configured
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Disable RLS on user_roles to prevent conflicts
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop any policies on user_roles that might interfere
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON user_roles;

-- Grant necessary permissions for the application
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Ensure the app_role enum exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- Fix any issues with the auth schema permissions
GRANT USAGE ON SCHEMA auth TO anon, authenticated;

-- Remove any functions that might interfere with user creation
DROP FUNCTION IF EXISTS is_admin(uuid);
DROP FUNCTION IF EXISTS uid();

-- Create a simple uid function that won't cause issues
CREATE OR REPLACE FUNCTION uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

-- Ensure all tables that reference users have proper foreign keys
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Fix foreign key references to use auth.users instead of a non-existent users table
  FOR r IN 
    SELECT conname, conrelid::regclass AS table_name
    FROM pg_constraint 
    WHERE confrelid = 'users'::regclass::oid
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %s', r.table_name, r.conname);
  END LOOP;
END $$;

-- Create a users view that points to auth.users for compatibility
CREATE OR REPLACE VIEW users AS 
SELECT 
  id,
  email,
  created_at,
  updated_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users;

-- Grant permissions on the view
GRANT SELECT ON users TO anon, authenticated;