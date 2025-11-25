/*
  # Create Chat Application Schema

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key) - Unique conversation identifier
      - `title` (text) - Conversation title
      - `created_at` (timestamptz) - When conversation was created
      - `updated_at` (timestamptz) - Last message timestamp
      - `user_id` (uuid) - Owner of the conversation (for future auth)
    
    - `messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `conversation_id` (uuid, foreign key) - Links to conversation
      - `role` (text) - Message role: 'user', 'assistant', 'system'
      - `content` (text) - Message content
      - `is_thinking` (boolean) - Whether this is a thinking message
      - `created_at` (timestamptz) - When message was created
      - `metadata` (jsonb) - Additional metadata for slides, images, etc.
  
  2. Security
    - Enable RLS on both tables
    - Add policies for public access (will be restricted with auth later)
  
  3. Indexes
    - Add index on conversation_id for faster message queries
    - Add index on created_at for ordering
*/

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  is_thinking boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (temporary - will be restricted with auth)
CREATE POLICY "Allow all access to conversations"
  ON conversations
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to messages"
  ON messages
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);