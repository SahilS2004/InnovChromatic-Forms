/*
  # Consolidated Schema
  
  1. Tables
    - forms (with pdf_template, program_name, allow_response_editing)
    - sections
    - questions (with scale_min, scale_max, currency)
    - responses
    - answers
    - respondent_fields
    - section_content
    
  2. Functions & Triggers
    - update_updated_at_column
    - set_user_role (on auth.users)
    - is_admin, get_user_role
    - get_all_user_emails
    
  3. Security
    - RLS is intentionally DISABLED as per latest project state.
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create forms table
CREATE TABLE IF NOT EXISTS forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Form',
  description text DEFAULT '',
  is_published boolean DEFAULT false,
  program_name text DEFAULT 'Program' NOT NULL,
  pdf_template JSONB DEFAULT NULL,
  allow_response_editing boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create sections table
CREATE TABLE IF NOT EXISTS sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Section',
  description text DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  question_text text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'short',
  options jsonb DEFAULT '[]'::jsonb,
  is_required boolean DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  scale_min integer,
  scale_max integer,
  currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_question_type CHECK (type IN ('short', 'long', 'mcq', 'checkbox', 'dropdown', 'scale', 'date', 'number', 'money')),
  CONSTRAINT questions_scale_max_check CHECK (scale_max IS NULL OR scale_max <= 10)
);

-- 4. Create responses table
CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 5. Create answers table
CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_value jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 6. Create respondent_fields table
CREATE TABLE IF NOT EXISTS respondent_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
  field_label text NOT NULL DEFAULT '',
  field_type text NOT NULL DEFAULT 'text',
  is_required boolean DEFAULT true,
  placeholder text DEFAULT '',
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_respondent_field_type CHECK (field_type = ANY (ARRAY['text'::text, 'email'::text, 'phone'::text, 'number'::text]))
);

-- 7. Create section_content table
CREATE TABLE IF NOT EXISTS section_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES sections(id) ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL DEFAULT 'paragraph',
  content_text text NOT NULL DEFAULT '',
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_section_content_type CHECK (content_type = ANY (ARRAY['heading'::text, 'paragraph'::text]))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forms_admin_id ON forms(admin_id);
CREATE INDEX IF NOT EXISTS idx_forms_published ON forms(is_published);
CREATE INDEX IF NOT EXISTS idx_sections_form_id ON sections(form_id);
CREATE INDEX IF NOT EXISTS idx_sections_order ON sections(form_id, order_index);
CREATE INDEX IF NOT EXISTS idx_questions_section_id ON questions(section_id);
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(section_id, order_index);
CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);
CREATE INDEX IF NOT EXISTS idx_answers_response_id ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_respondent_fields_form_id ON respondent_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_respondent_fields_order ON respondent_fields(form_id, order_index);
CREATE INDEX IF NOT EXISTS idx_section_content_section_id ON section_content(section_id);
CREATE INDEX IF NOT EXISTS idx_section_content_order ON section_content(section_id, order_index);

-- Functions & Triggers

-- Update forms.updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Set user role on signup
CREATE OR REPLACE FUNCTION public.set_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Set default role to 'user' for new signups
  NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"user_role": "user"}'::jsonb;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_role();

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT (raw_app_meta_data->>'user_role') = 'admin'
    FROM auth.users
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT COALESCE(raw_app_meta_data->>'user_role', 'user')
    FROM auth.users
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to get complete user details
CREATE OR REPLACE FUNCTION public.get_complete_user_list()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (raw_app_meta_data->>'user_role') = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Return all users with their details
  RETURN QUERY
  SELECT 
    auth.users.id,
    auth.users.email,
    auth.users.created_at,
    auth.users.last_sign_in_at,
    auth.users.raw_app_meta_data,
    auth.users.raw_user_meta_data
  FROM auth.users
  WHERE auth.users.email IS NOT NULL
  ORDER BY auth.users.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_complete_user_list() TO authenticated;

-- Disable RLS explicitly (in case it defaults to on)
ALTER TABLE forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE respondent_fields DISABLE ROW LEVEL SECURITY;
ALTER TABLE section_content DISABLE ROW LEVEL SECURITY;
