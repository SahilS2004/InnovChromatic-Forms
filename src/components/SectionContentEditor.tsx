import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SectionContent, SectionContentType } from '../lib/types';
import { Plus, Trash2, Type, AlignLeft } from 'lucide-react';

interface SectionContentEditorProps {
  sectionId: string;
}

interface SectionContentEditorWithItemsProps {
  sectionId: string;
  showItems?: boolean;
}

export default function SectionContentEditor({ sectionId, showItems = true }: SectionContentEditorWithItemsProps) {
  const [contents, setContents] = useState<SectionContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    loadContents();
  }, [sectionId]);

  const loadContents = async () => {
    try {
      const { data, error } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_id', sectionId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setContents(data || []);
    } catch (error) {
      console.error('Error loading section content:', error);
    } finally {
      setLoading(false);
    }
  };

  const addContent = async (type: SectionContentType) => {
    try {
      const { data, error } = await supabase
        .from('section_content')
        .insert({
          section_id: sectionId,
          content_type: type,
          content_text: type === 'heading' ? 'Untitled Heading' : 'Add description text here',
          order_index: contents.length
        })
        .select()
        .single();

      if (error) throw error;
      setContents([...contents, data]);
      setShowAddMenu(false);
    } catch (error) {
      console.error('Error adding content:', error);
      alert('Failed to add content');
    }
  };

  const updateContentLocal = (contentId: string, updates: Partial<SectionContent>) => {
    setContents(contents.map(c => c.id === contentId ? { ...c, ...updates } : c));
  };

  const updateContentDB = async (contentId: string, updates: Partial<SectionContent>) => {
    try {
      const { error } = await supabase
        .from('section_content')
        .update(updates)
        .eq('id', contentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating content:', error);
    }
  };

  const deleteContent = async (contentId: string) => {
    if (!confirm('Delete this content?')) return;

    try {
      const { error } = await supabase
        .from('section_content')
        .delete()
        .eq('id', contentId);

      if (error) throw error;
      setContents(contents.filter(c => c.id !== contentId));
    } catch (error) {
      console.error('Error deleting content:', error);
      alert('Failed to delete content');
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="space-y-3">
      {showItems && contents.map((content) => (
        <div
          key={content.id}
          className="bg-gray-50 border border-gray-200 rounded-lg p-3 group mb-4"
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-2">
              {content.content_type === 'heading' ? (
                <Type className="w-4 h-4 text-gray-500" />
              ) : (
                <AlignLeft className="w-4 h-4 text-gray-500" />
              )}
            </div>
            <div className="flex-1">
              {content.content_type === 'heading' ? (
                <input
                  type="text"
                  value={content.content_text}
                  onChange={(e) => updateContentLocal(content.id, { content_text: e.target.value })}
                  onBlur={() => updateContentDB(content.id, { content_text: content.content_text })}
                  className="w-full px-2 py-1 text-base font-semibold text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                  placeholder="Heading text"
                />
              ) : (
                <textarea
                  value={content.content_text}
                  onChange={(e) => updateContentLocal(content.id, { content_text: e.target.value })}
                  onBlur={() => updateContentDB(content.id, { content_text: content.content_text })}
                  className="w-full px-2 py-1 text-sm text-gray-700 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="Paragraph text"
                  rows={2}
                />
              )}
            </div>
            <button
              onClick={() => deleteContent(content.id)}
              className="flex-shrink-0 p-1 text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>Add Heading and paragraph</span>
        </button> 

        {showAddMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowAddMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px]">
              <button
                onClick={() => addContent('heading')}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition text-sm"
              >
                <Type className="w-4 h-4 text-gray-600" />
                <span className="text-gray-900 font-medium">Heading</span>
              </button>
              <button
                onClick={() => addContent('paragraph')}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition text-sm border-t border-gray-100"
              >
                <AlignLeft className="w-4 h-4 text-gray-600" />
                <span className="text-gray-900 font-medium">Paragraph</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
