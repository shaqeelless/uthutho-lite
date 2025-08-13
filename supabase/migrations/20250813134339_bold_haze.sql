/*
  # Fix User Roles RLS Issues

  This migration disables problematic RLS on user_roles table that might interfere
  with user creation and profile setup.

  ## Changes Made
  1. Disable RLS on user_roles table
  2. Remove problematic policies
  3. Allow proper user role assignment
*/

-- Disable RLS on user_roles table
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop any problematic policies
DROP POLICY IF EXISTS "Allow admins full access" ON user_roles;

-- Allow public access for user role creation
GRANT ALL ON user_roles TO anon;
GRANT ALL ON user_roles TO authenticated;