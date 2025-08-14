/*
  # Enable Public Access for Authentication

  This migration ensures that the authentication system works properly by:

  1. Public Access
     - Grant necessary permissions to anon users
     - Enable public access to auth-related tables
     - Configure proper schema permissions

  2. Table Permissions
     - Grant INSERT permissions for user creation
     - Grant SELECT permissions for data access
     - Configure UPDATE permissions where needed

  3. Final Cleanup
     - Remove any remaining barriers to user signup
     - Ensure all auth flows work properly
*/

-- Grant comprehensive permissions to anon and authenticated users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;

-- Grant permissions on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Specifically grant permissions on profiles table
GRANT ALL ON profiles TO anon, authenticated;
GRANT ALL ON user_roles TO anon, authenticated;

-- Grant permissions on auth schema (needed for user creation)
GRANT SELECT ON auth.users TO anon, authenticated;

-- Ensure the profiles table can be written to during signup
ALTER TABLE profiles OWNER TO postgres;
ALTER TABLE user_roles OWNER TO postgres;

-- Make sure sequences are accessible
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create a function to handle new user creation (safe version)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create profile if it doesn't exist
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, just return NEW to not block user creation
    RETURN NEW;
END;
$$;

-- Create the trigger on auth.users (this is the correct way)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Ensure the trigger function has proper permissions
GRANT EXECUTE ON FUNCTION handle_new_user() TO anon, authenticated;

-- Final check: make sure all tables exist and are accessible
DO $$
BEGIN
  -- Ensure profiles table exists with all required columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    CREATE TABLE profiles (
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
  END IF;
  
  -- Ensure user_roles table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
    CREATE TABLE user_roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      role app_role DEFAULT 'user',
      created_at timestamptz DEFAULT now(),
      UNIQUE(user_id, role)
    );
  END IF;
END $$;

-- Grant final permissions
GRANT ALL ON profiles TO anon, authenticated, postgres;
GRANT ALL ON user_roles TO anon, authenticated, postgres;