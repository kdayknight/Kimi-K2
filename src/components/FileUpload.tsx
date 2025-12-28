import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface FileUploadProps {
  conversationId: string;
  onFileUploaded: (file: UploadedFile) => void;
}

interface UploadedFile {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extracted_content: string;
  created_at: string;
}

export function FileUpload({ conversationId, onFileUploaded }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedFileTypes = [
    '.pdf',
    '.doc',
    '.docx',
    '.ppt',
    '.pptx',
    '.txt',
    '.md',
  ].join(',');

  const extractTextContent = async (file: File): Promise<string> => {
    if (file.type === 'text/plain' || file.type === 'text/markdown') {
      return await file.text();
    }

    return `[${file.name}] - Content extraction for this file type will be processed by the AI.`;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${conversationId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file);

      if (uploadError) {
        if (uploadError.message.includes('not found')) {
          throw new Error('Storage bucket not configured. Please contact support.');
        }
        throw uploadError;
      }

      const extractedContent = await extractTextContent(file);

      const { data: fileRecord, error: dbError } = await supabase
        .from('uploaded_files')
        .insert({
          conversation_id: conversationId,
          filename: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: uploadData.path,
          extracted_content: extractedContent,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      onFileUploaded(fileRecord);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFileTypes}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        id="file-upload-input"
      />
      <label htmlFor="file-upload-input" className="file-upload-button">
        <span>📎</span>
        {uploading && <span>Uploading...</span>}
      </label>
      {error && <div className="file-upload-error">{error}</div>}
    </div>
  );
}
