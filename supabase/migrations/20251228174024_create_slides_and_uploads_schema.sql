/*
  # Create Slides and File Uploads Schema

  ## Overview
  This migration creates tables for storing slide presentations and uploaded files for the Pitch application.

  ## New Tables
  
  ### `uploaded_files`
  - `id` (uuid, primary key) - Unique identifier for uploaded files
  - `conversation_id` (uuid, foreign key) - Links to conversations table
  - `filename` (text) - Original filename
  - `file_type` (text) - MIME type of the file
  - `file_size` (bigint) - Size in bytes
  - `storage_path` (text) - Path in Supabase storage
  - `extracted_content` (text) - Extracted text content from file
  - `created_at` (timestamptz) - Upload timestamp
  
  ### `presentations`
  - `id` (uuid, primary key) - Unique identifier for presentations
  - `conversation_id` (uuid, foreign key) - Links to conversations table
  - `title` (text) - Presentation title
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### `slides`
  - `id` (uuid, primary key) - Unique identifier for slides
  - `presentation_id` (uuid, foreign key) - Links to presentations table
  - `slide_order` (integer) - Order of slide in presentation
  - `title` (text) - Slide title
  - `content` (jsonb) - Slide content (text, bullet points, etc.)
  - `image_url` (text) - URL to generated image for slide
  - `layout_type` (text) - Layout template type
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage their own data
*/

-- Create uploaded_files table
CREATE TABLE IF NOT EXISTS uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL,
  extracted_content text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uploaded files"
  ON uploaded_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = uploaded_files.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own uploaded files"
  ON uploaded_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = uploaded_files.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own uploaded files"
  ON uploaded_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = uploaded_files.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Create presentations table
CREATE TABLE IF NOT EXISTS presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Presentation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own presentations"
  ON presentations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = presentations.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own presentations"
  ON presentations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = presentations.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own presentations"
  ON presentations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = presentations.conversation_id
      AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = presentations.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own presentations"
  ON presentations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = presentations.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Create slides table
CREATE TABLE IF NOT EXISTS slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid REFERENCES presentations(id) ON DELETE CASCADE,
  slide_order integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '',
  content jsonb DEFAULT '{}',
  image_url text DEFAULT '',
  layout_type text DEFAULT 'title-content',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own slides"
  ON slides FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presentations p
      JOIN conversations c ON c.id = p.conversation_id
      WHERE p.id = slides.presentation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own slides"
  ON slides FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM presentations p
      JOIN conversations c ON c.id = p.conversation_id
      WHERE p.id = slides.presentation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own slides"
  ON slides FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presentations p
      JOIN conversations c ON c.id = p.conversation_id
      WHERE p.id = slides.presentation_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM presentations p
      JOIN conversations c ON c.id = p.conversation_id
      WHERE p.id = slides.presentation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own slides"
  ON slides FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM presentations p
      JOIN conversations c ON c.id = p.conversation_id
      WHERE p.id = slides.presentation_id
      AND c.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_uploaded_files_conversation_id ON uploaded_files(conversation_id);
CREATE INDEX IF NOT EXISTS idx_presentations_conversation_id ON presentations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_slides_presentation_id ON slides(presentation_id);
CREATE INDEX IF NOT EXISTS idx_slides_order ON slides(presentation_id, slide_order);
