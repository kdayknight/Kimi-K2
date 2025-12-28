import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateImage, editImage } from '../lib/fal';

interface Slide {
  id: string;
  presentation_id: string;
  slide_order: number;
  title: string;
  content: {
    bullets?: string[];
    text?: string;
  };
  image_url: string;
  layout_type: string;
}

interface SlideEditorProps {
  presentationId: string;
}

export function SlideEditor({ presentationId }: SlideEditorProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSlides();
  }, [presentationId]);

  const loadSlides = async () => {
    const { data, error } = await supabase
      .from('slides')
      .select('*')
      .eq('presentation_id', presentationId)
      .order('slide_order', { ascending: true });

    if (error) {
      console.error('Error loading slides:', error);
      return;
    }

    setSlides(data || []);
  };

  const currentSlide = slides[currentSlideIndex];

  const handleEditSlide = (slide: Slide) => {
    setEditingSlide({ ...slide });
  };

  const handleSaveSlide = async () => {
    if (!editingSlide) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('slides')
        .update({
          title: editingSlide.title,
          content: editingSlide.content,
          image_url: editingSlide.image_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingSlide.id);

      if (error) throw error;

      setSlides(slides.map(s => s.id === editingSlide.id ? editingSlide : s));
      setEditingSlide(null);
    } catch (err) {
      console.error('Error saving slide:', err);
      alert('Failed to save slide');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateImage = async (prompt: string) => {
    setGeneratingImage(true);
    try {
      const imageUrl = await generateImage(prompt);
      if (editingSlide) {
        setEditingSlide({ ...editingSlide, image_url: imageUrl });
      }
    } catch (err) {
      console.error('Error generating image:', err);
      alert('Failed to generate image. Please check your FAL API key.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleEditImage = async (prompt: string) => {
    if (!editingSlide?.image_url) return;

    setGeneratingImage(true);
    try {
      const imageUrl = await editImage(editingSlide.image_url, prompt);
      setEditingSlide({ ...editingSlide, image_url: imageUrl });
    } catch (err) {
      console.error('Error editing image:', err);
      alert('Failed to edit image. Please check your FAL API key.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleAddSlide = async () => {
    const newSlide = {
      presentation_id: presentationId,
      slide_order: slides.length,
      title: 'New Slide',
      content: { bullets: ['Point 1', 'Point 2', 'Point 3'] },
      image_url: '',
      layout_type: 'title-content',
    };

    const { data, error } = await supabase
      .from('slides')
      .insert(newSlide)
      .select()
      .single();

    if (error) {
      console.error('Error adding slide:', error);
      return;
    }

    setSlides([...slides, data]);
    setCurrentSlideIndex(slides.length);
  };

  const handleDeleteSlide = async (slideId: string) => {
    const { error } = await supabase
      .from('slides')
      .delete()
      .eq('id', slideId);

    if (error) {
      console.error('Error deleting slide:', error);
      return;
    }

    const newSlides = slides.filter(s => s.id !== slideId);
    setSlides(newSlides);
    if (currentSlideIndex >= newSlides.length) {
      setCurrentSlideIndex(Math.max(0, newSlides.length - 1));
    }
  };

  if (slides.length === 0) {
    return (
      <div className="slide-editor-empty">
        <p>No slides yet. Start by asking Pitch to create slides for you!</p>
      </div>
    );
  }

  return (
    <div className="slide-editor">
      <div className="slide-navigator">
        <button
          onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
          disabled={currentSlideIndex === 0}
        >
          ← Previous
        </button>
        <span>
          Slide {currentSlideIndex + 1} of {slides.length}
        </span>
        <button
          onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
          disabled={currentSlideIndex === slides.length - 1}
        >
          Next →
        </button>
      </div>

      {editingSlide ? (
        <div className="slide-edit-panel">
          <h3>Edit Slide</h3>
          <input
            type="text"
            value={editingSlide.title}
            onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
            placeholder="Slide title"
            className="slide-title-input"
          />

          <textarea
            value={JSON.stringify(editingSlide.content, null, 2)}
            onChange={(e) => {
              try {
                const content = JSON.parse(e.target.value);
                setEditingSlide({ ...editingSlide, content });
              } catch (err) {

              }
            }}
            placeholder="Slide content (JSON)"
            className="slide-content-input"
            rows={10}
          />

          <div className="image-controls">
            <input
              type="text"
              placeholder="Image prompt"
              id="image-prompt-input"
              className="image-prompt-input"
            />
            <button
              onClick={() => {
                const input = document.getElementById('image-prompt-input') as HTMLInputElement;
                if (input.value) handleGenerateImage(input.value);
              }}
              disabled={generatingImage}
            >
              {generatingImage ? 'Generating...' : 'Generate Image'}
            </button>
            {editingSlide.image_url && (
              <button
                onClick={() => {
                  const input = document.getElementById('image-prompt-input') as HTMLInputElement;
                  if (input.value) handleEditImage(input.value);
                }}
                disabled={generatingImage}
              >
                {generatingImage ? 'Editing...' : 'Edit Image'}
              </button>
            )}
          </div>

          {editingSlide.image_url && (
            <img src={editingSlide.image_url} alt="Slide" className="slide-preview-image" />
          )}

          <div className="edit-actions">
            <button onClick={handleSaveSlide} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditingSlide(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="slide-preview">
          {currentSlide && (
            <>
              <h2>{currentSlide.title}</h2>
              {currentSlide.content.bullets && (
                <ul>
                  {currentSlide.content.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              )}
              {currentSlide.content.text && <p>{currentSlide.content.text}</p>}
              {currentSlide.image_url && (
                <img src={currentSlide.image_url} alt={currentSlide.title} />
              )}
              <div className="slide-actions">
                <button onClick={() => handleEditSlide(currentSlide)}>Edit</button>
                <button onClick={() => handleDeleteSlide(currentSlide.id)}>Delete</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="slide-list">
        <button onClick={handleAddSlide} className="add-slide-btn">+ Add Slide</button>
        <div className="slide-thumbnails">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className={`slide-thumbnail ${idx === currentSlideIndex ? 'active' : ''}`}
              onClick={() => setCurrentSlideIndex(idx)}
            >
              <div className="slide-number">{idx + 1}</div>
              <div className="slide-thumbnail-title">{slide.title}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
