import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Form, Section, Question, QuestionType, SectionItem, SectionContent } from '../lib/types';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Save,
  Globe,
  ChevronDown,
  ChevronUp,
  Type,
  AlignLeft,
  Settings,
  X
} from 'lucide-react';
import logo from '../img/image.png';
import RespondentFieldsEditor from '../components/RespondentFieldsEditor';
import PdfTemplateEditor from '../components/PdfTemplateEditor';

export default function FormBuilder() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<Form | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [draggedQuestion, setDraggedQuestion] = useState<{ questionId: string; sectionId: string } | null>(null);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate('/administrator/login');
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userRole = data?.user?.app_metadata?.user_role;

      if (userRole !== 'admin') {
        alert('Access denied. Administrator privileges required.');
        navigate('/dashboard');
        return;
      }

      loadForm();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/dashboard');
    }
  };

  const loadForm = async () => {
    try {
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (formError) throw formError;
      setForm(formData);

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('sections')
        .select('*, questions(*), section_content(*)')
        .eq('form_id', formId)
        .order('order_index', { ascending: true });

      if (sectionsError) throw sectionsError;

      const sortedSections = sectionsData.map((section) => ({
        ...section,
        questions: (section.questions || []).sort((a, b) => a.order_index - b.order_index),
        section_content: (section.section_content || []).sort((a, b) => a.order_index - b.order_index)
      }));

      setSections(sortedSections);
      setExpandedSections(new Set(sortedSections.map(s => s.id)));
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const updateFormDetails = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('forms')
        .update({
          title: form.title,
          description: form.description,
          enable_pdf_download: form.enable_pdf_download,
          allow_response_editing: form.allow_response_editing,
          program_name: form.program_name,
          pdf_template: form.pdf_template,
          access_type: form.access_type,
          allowed_user_emails: form.allowed_user_emails
        })
        .eq('id', formId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating form:', error);
      alert('Failed to update form');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('forms')
        .update({ is_published: !form.is_published })
        .eq('id', formId);

      if (error) throw error;
      setForm({ ...form, is_published: !form.is_published });
    } catch (error) {
      console.error('Error publishing form:', error);
      alert('Failed to update form status');
    } finally {
      setSaving(false);
    }
  };

  const addSection = async () => {
    try {
      const { data, error } = await supabase
        .from('sections')
        .insert({
          form_id: formId,
          title: 'Untitled Section',
          order_index: sections.length
        })
        .select()
        .single();

      if (error) throw error;
      setSections([...sections, { ...data, questions: [] }]);
      setExpandedSections(new Set([...expandedSections, data.id]));
    } catch (error) {
      console.error('Error adding section:', error);
      alert('Failed to add section');
    }
  };

  const updateSectionLocal = (sectionId: string, updates: Partial<Section>) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, ...updates } : s));
  };

  const updateSectionDB = async (sectionId: string, updates: Partial<Section>) => {
    try {
      const { error } = await supabase
        .from('sections')
        .update(updates)
        .eq('id', sectionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating section:', error);
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (!confirm('Delete this section and all its questions?')) return;

    try {
      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;
      setSections(sections.filter(s => s.id !== sectionId));
    } catch (error) {
      console.error('Error deleting section:', error);
      alert('Failed to delete section');
    }
  };

  const getMergedSectionItems = (section: Section): SectionItem[] => {
    const questions: SectionItem[] = (section.questions || []).map(q => ({ type: 'question' as const, data: q }));
    const contents: SectionItem[] = (section.section_content || []).map(c => ({ type: 'content' as const, data: c }));
    return [...questions, ...contents].sort((a, b) => {
      const orderA = a.type === 'question' ? a.data.order_index : a.data.order_index;
      const orderB = b.type === 'question' ? b.data.order_index : b.data.order_index;
      return orderA - orderB;
    });
  };

  const getNextOrderIndex = (section: Section): number => {
    const items = getMergedSectionItems(section);
    if (items.length === 0) return 0;
    const maxOrder = Math.max(...items.map(item =>
      item.type === 'question' ? item.data.order_index : item.data.order_index
    ));
    return maxOrder + 1;
  };

  const addQuestion = async (sectionId: string) => {
    try {
      const section = sections.find(s => s.id === sectionId);
      if (!section) return;

      const { data, error } = await supabase
        .from('questions')
        .insert({
          section_id: sectionId,
          question_text: 'Untitled Question',
          type: 'short',
          order_index: getNextOrderIndex(section)
        })
        .select()
        .single();

      if (error) throw error;

      setSections(sections.map(s => {
        if (s.id === sectionId) {
          return { ...s, questions: [...(s.questions || []), data] };
        }
        return s;
      }));
    } catch (error) {
      console.error('Error adding question:', error);
      alert('Failed to add question');
    }
  };

  const addContent = async (sectionId: string, contentType: 'heading' | 'paragraph') => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    try {
      const { data, error } = await supabase
        .from('section_content')
        .insert({
          section_id: sectionId,
          content_type: contentType,
          content_text: contentType === 'heading' ? 'Untitled Heading' : 'Paragraph text...',
          order_index: getNextOrderIndex(section)
        })
        .select()
        .single();

      if (error) throw error;

      setSections(sections.map(s => {
        if (s.id === sectionId) {
          return { ...s, section_content: [...(s.section_content || []), data] };
        }
        return s;
      }));
    } catch (error) {
      console.error('Error adding content:', error);
      alert('Failed to add content');
    }
  };

  const updateQuestionLocal = (sectionId: string, questionId: string, updates: Partial<Question>) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          questions: s.questions?.map(q => q.id === questionId ? { ...q, ...updates } : q)
        };
      }
      return s;
    }));
  };

  const updateQuestionDB = async (sectionId: string, questionId: string, updates: Partial<Question>) => {
    try {
      const { error } = await supabase
        .from('questions')
        .update(updates)
        .eq('id', questionId);

      if (error) {
        console.error('Error updating question:', error);
        alert(`Failed to update question: ${error.message}`);
        throw error;
      }
    } catch (error) {
      console.error('Error updating question:', error);
    }
  };

  const deleteQuestion = async (sectionId: string, questionId: string) => {
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      setSections(sections.map(s => {
        if (s.id === sectionId) {
          return {
            ...s,
            questions: s.questions?.filter(q => q.id !== questionId)
          };
        }
        return s;
      }));
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question');
    }
  };

  const updateContentLocal = (sectionId: string, contentId: string, updates: Partial<SectionContent>) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          section_content: s.section_content?.map(c => c.id === contentId ? { ...c, ...updates } : c)
        };
      }
      return s;
    }));
  };

  const updateContentDB = async (sectionId: string, contentId: string, updates: Partial<SectionContent>) => {
    try {
      const { error } = await supabase
        .from('section_content')
        .update(updates)
        .eq('id', contentId);

      if (error) {
        console.error('Error updating content:', error);
        alert(`Failed to update content: ${error.message}`);
        throw error;
      }
    } catch (error) {
      console.error('Error updating content:', error);
    }
  };

  const deleteContent = async (sectionId: string, contentId: string) => {
    try {
      const { error } = await supabase
        .from('section_content')
        .delete()
        .eq('id', contentId);

      if (error) throw error;

      setSections(sections.map(s => {
        if (s.id === sectionId) {
          return {
            ...s,
            section_content: s.section_content?.filter(c => c.id !== contentId)
          };
        }
        return s;
      }));
    } catch (error) {
      console.error('Error deleting content:', error);
      alert('Failed to delete content');
    }
  };

  const handleSectionDragStart = (sectionId: string) => {
    setDraggedSection(sectionId);
  };

  const handleSectionDragOver = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    if (!draggedSection || draggedSection === targetSectionId) return;

    const draggedIdx = sections.findIndex(s => s.id === draggedSection);
    const targetIdx = sections.findIndex(s => s.id === targetSectionId);

    const newSections = [...sections];
    const [removed] = newSections.splice(draggedIdx, 1);
    newSections.splice(targetIdx, 0, removed);

    setSections(newSections);
    setDraggedSection(targetSectionId);
  };

  const handleSectionDragEnd = async () => {
    if (!draggedSection) return;

    try {
      const updates = sections.map((section, index) =>
        supabase
          .from('sections')
          .update({ order_index: index })
          .eq('id', section.id)
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating section order:', error);
    }

    setDraggedSection(null);
  };

  const handleQuestionDragStart = (questionId: string, sectionId: string) => {
    setDraggedQuestion({ questionId, sectionId });
  };

  const handleQuestionDragOver = (e: React.DragEvent, targetQuestionId: string, targetSectionId: string) => {
    e.preventDefault();
    if (!draggedQuestion || (draggedQuestion.questionId === targetQuestionId && draggedQuestion.sectionId === targetSectionId)) return;

    const sourceSectionIdx = sections.findIndex(s => s.id === draggedQuestion.sectionId);
    const targetSectionIdx = sections.findIndex(s => s.id === targetSectionId);

    const newSections = [...sections];
    const sourceSection = newSections[sourceSectionIdx];
    const targetSection = newSections[targetSectionIdx];

    const draggedQuestionIdx = sourceSection.questions?.findIndex(q => q.id === draggedQuestion.questionId) ?? -1;
    const targetQuestionIdx = targetSection.questions?.findIndex(q => q.id === targetQuestionId) ?? -1;

    if (draggedQuestionIdx === -1 || targetQuestionIdx === -1) return;

    const [movedQuestion] = sourceSection.questions!.splice(draggedQuestionIdx, 1);

    if (draggedQuestion.sectionId === targetSectionId) {
      targetSection.questions!.splice(targetQuestionIdx, 0, movedQuestion);
    } else {
      movedQuestion.section_id = targetSectionId;
      targetSection.questions!.splice(targetQuestionIdx, 0, movedQuestion);
    }

    setSections(newSections);
    setDraggedQuestion({ questionId: draggedQuestion.questionId, sectionId: targetSectionId });
  };

  const handleQuestionDragEnd = async () => {
    if (!draggedQuestion) return;

    try {
      const section = sections.find(s => s.id === draggedQuestion.sectionId);
      if (section?.questions) {
        const updates = section.questions.map((question, index) =>
          supabase
            .from('questions')
            .update({ order_index: index, section_id: section.id })
            .eq('id', question.id)
        );
        await Promise.all(updates);
      }
    } catch (error) {
      console.error('Error updating question order:', error);
    }

    setDraggedQuestion(null);
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const addAllowedEmail = () => {
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    const currentEmails = form?.allowed_user_emails || [];
    if (currentEmails.includes(trimmedEmail)) {
      alert('This email is already in the list');
      return;
    }

    setForm({ ...form!, allowed_user_emails: [...currentEmails, trimmedEmail] });
    setEmailInput('');
    updateFormDetails();
  };

  const removeAllowedEmail = (emailToRemove: string) => {
    const currentEmails = form?.allowed_user_emails || [];
    setForm({ ...form!, allowed_user_emails: currentEmails.filter(email => email !== emailToRemove) });
    updateFormDetails();
  };

  const handleEmailKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAllowedEmail();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!form) {
    return <div>Form not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-orange-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 sm:space-x-4 w-full lg:w-auto">
              <Link
                to="/administrator/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              >
                <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
              </Link>
              <img src={logo} alt="Logo" className="h-8 sm:h-10 w-auto flex-shrink-0" />
              <div className="border-l border-gray-300 pl-3 sm:pl-4 min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">Edit Form</h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  {form.is_published ? 'Published' : 'Draft'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                onClick={updateFormDetails}
                disabled={saving}
                className="flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg shadow-blue-600/30 disabled:opacity-50 text-xs sm:text-sm flex-1 sm:flex-initial"
              >
                <Save className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span className="hidden xs:inline">Save</span>
              </button>
              {form.is_published && (
                <Link
                  to={`/form/${formId}`}
                  target="_blank"
                  className="flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-xs sm:text-sm"
                >
                  <Eye className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span className="hidden sm:inline">Preview</span>
                </Link>
              )}
              <button
                onClick={togglePublish}
                disabled={saving}
                className={`flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg transition font-semibold text-xs sm:text-sm flex-1 sm:flex-initial ${
                  form.is_published
                    ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-600/30'
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/30'
                }`}
              >
                <Globe className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span>{saving ? 'Updating...' : (form.is_published ? 'Unpublish' : 'Publish')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 shadow-sm">
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Program Name (displayed in navbar)
            </label>
            <input
              type="text"
              value={form.program_name}
              onChange={(e) => setForm({ ...form, program_name: e.target.value })}
              onBlur={updateFormDetails}
              className="text-base sm:text-lg font-semibold text-gray-900 w-full px-4 py-2 border-2 border-gray-300 hover:border-gray-400 focus:border-blue-600 focus:outline-none rounded-lg"
              placeholder="e.g., Residency Program"
            />
          </div>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onBlur={updateFormDetails}
            className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 w-full border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none mb-3 sm:mb-4"
            placeholder="Form Title"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            onBlur={updateFormDetails}
            className="text-sm sm:text-base text-gray-600 w-full border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none resize-none"
            placeholder="Form description"
            rows={2}
          />
        </div>

        <RespondentFieldsEditor formId={formId!} />

        <div className="bg-white rounded-xl border border-gray-200 mb-4 sm:mb-6 shadow-sm overflow-hidden">
          <button
            onClick={() => setAdvancedSettingsOpen(!advancedSettingsOpen)}
            className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-gray-50 transition"
          >
            <div className="flex items-center space-x-3">
              <Settings className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-bold text-gray-900">Advanced Settings</h3>
            </div>
            {advancedSettingsOpen ? (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {advancedSettingsOpen && (
            <div className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="pt-4 border-t border-gray-200">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enable_pdf_download || false}
                    onChange={(e) => {
                      setForm({ ...form, enable_pdf_download: e.target.checked });
                      updateFormDetails();
                    }}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm sm:text-base font-semibold text-gray-900">Enable PDF Download</span>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Allow respondents to download their answers as a formatted PDF after submission</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allow_response_editing || false}
                    onChange={(e) => {
                      setForm({ ...form, allow_response_editing: e.target.checked });
                      updateFormDetails();
                    }}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm sm:text-base font-semibold text-gray-900">Allow Response Editing</span>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Enable users to edit their submitted responses</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-4">Form Access Control</h4>
                <div className="space-y-4">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="access_type"
                      value="public"
                      checked={(form.access_type || 'public') === 'public'}
                      onChange={(e) => {
                        setForm({ ...form, access_type: 'public' });
                        updateFormDetails();
                      }}
                      className="mt-1 border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm sm:text-base font-semibold text-gray-900">Public Access</span>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">Anyone with the link can access this form</p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="access_type"
                      value="restricted"
                      checked={form.access_type === 'restricted'}
                      onChange={(e) => {
                        setForm({ ...form, access_type: 'restricted' });
                        updateFormDetails();
                      }}
                      className="mt-1 border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm sm:text-base font-semibold text-gray-900">Restricted Access</span>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">Only specific users can access this form</p>

                      {form.access_type === 'restricted' && (
                        <div className="mt-4">
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                            Add Allowed User Emails
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="email"
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              onKeyPress={handleEmailKeyPress}
                              className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                              placeholder="user@example.com"
                            />
                            <button
                              onClick={addAllowedEmail}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm whitespace-nowrap"
                            >
                              Add
                            </button>
                          </div>

                          {(form.allowed_user_emails || []).length > 0 && (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs sm:text-sm font-medium text-gray-700">
                                Allowed Users ({(form.allowed_user_emails || []).length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {(form.allowed_user_emails || []).map((email) => (
                                  <div
                                    key={email}
                                    className="group flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
                                  >
                                    <span className="text-xs sm:text-sm font-medium break-all">{email}</span>
                                    <button
                                      onClick={() => removeAllowedEmail(email)}
                                      className="flex-shrink-0 text-blue-600 hover:text-red-600 transition opacity-70 group-hover:opacity-100"
                                      title="Remove"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-4">PDF Template Settings</h4>
                <PdfTemplateEditor
                  template={form.pdf_template}
                  onChange={(template) => {
                    setForm({ ...form, pdf_template: template });
                    updateFormDetails();
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm"
            draggable
            onDragStart={() => handleSectionDragStart(section.id)}
            onDragOver={(e) => handleSectionDragOver(e, section.id)}
            onDragEnd={handleSectionDragEnd}
          >
            <div className="flex items-start sm:items-center justify-between mb-4 gap-2">
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                <GripVertical className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 cursor-move flex-shrink-0 touch-none" />
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => updateSectionLocal(section.id, { title: e.target.value })}
                  onBlur={(e) => updateSectionDB(section.id, { title: e.target.value })}
                  className="text-base sm:text-xl font-bold text-gray-900 flex-1 border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none min-w-0"
                  placeholder="Section Title"
                />
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="p-1.5 sm:p-2 hover:bg-blue-50 rounded-lg transition"
                >
                  {expandedSections.has(section.id) ? (
                    <ChevronUp className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600" />
                  ) : (
                    <ChevronDown className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600" />
                  )}
                </button>
                <button
                  onClick={() => deleteSection(section.id)}
                  className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
              </div>
            </div>

            {expandedSections.has(section.id) && (
              <>
                <textarea
                  value={section.description}
                  onChange={(e) => updateSectionLocal(section.id, { description: e.target.value })}
                  onBlur={(e) => updateSectionDB(section.id, { description: e.target.value })}
                  className="text-gray-600 w-full border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none resize-none mb-6"
                  placeholder="Section description"
                  rows={1}
                />

                <div className="space-y-4">
                  {getMergedSectionItems(section).map((item) => {
                    if (item.type === 'question') {
                      return (
                        <QuestionEditor
                          key={item.data.id}
                          question={item.data}
                          sectionId={section.id}
                          onUpdateLocal={(updates) => updateQuestionLocal(section.id, item.data.id, updates)}
                          onUpdateDB={(updates) => updateQuestionDB(section.id, item.data.id, updates)}
                          onDelete={() => deleteQuestion(section.id, item.data.id)}
                          onDragStart={() => handleQuestionDragStart(item.data.id, section.id)}
                          onDragOver={(e) => handleQuestionDragOver(e, item.data.id, section.id)}
                          onDragEnd={handleQuestionDragEnd}
                        />
                      );
                    } else {
                      return (
                        <div
                          key={item.data.id}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-4 group"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-2">
                              {item.data.content_type === 'heading' ? (
                                <Type className="w-5 h-5 text-gray-500" />
                              ) : (
                                <AlignLeft className="w-5 h-5 text-gray-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              {item.data.content_type === 'heading' ? (
                                <input
                                  type="text"
                                  value={item.data.content_text}
                                  onChange={(e) => updateContentLocal(section.id, item.data.id, { content_text: e.target.value })}
                                  onBlur={() => updateContentDB(section.id, item.data.id, { content_text: item.data.content_text })}
                                  className="w-full px-2 py-1 text-lg font-semibold text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none"
                                  placeholder="Heading text"
                                />
                              ) : (
                                <textarea
                                  value={item.data.content_text}
                                  onChange={(e) => updateContentLocal(section.id, item.data.id, { content_text: e.target.value })}
                                  onBlur={() => updateContentDB(section.id, item.data.id, { content_text: item.data.content_text })}
                                  className="w-full px-2 py-1 text-base text-gray-700 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none resize-none"
                                  placeholder="Paragraph text"
                                  rows={3}
                                />
                              )}
                            </div>
                            <button
                              onClick={() => deleteContent(section.id, item.data.id)}
                              className="flex-shrink-0 p-1.5 text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between hover:text-blue-700"> 
                  <button
                    onClick={() => addQuestion(section.id)}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Question</span>
                  </button>

                  <AddContentButton sectionId={section.id} onAddContent={addContent} />
                </div>
              </>
            )}
          </div>
        ))}

        <button
          onClick={addSection}
          className="w-full flex items-center justify-center space-x-2 py-4 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition font-semibold"
        >
          <Plus className="w-5 h-5" />
          <span>Add Section</span>
        </button>
      </main>
    </div>
  );
}

function QuestionEditor({
  question,
  sectionId,
  onUpdateLocal,
  onUpdateDB,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd
}: {
  question: Question;
  sectionId: string;
  onUpdateLocal: (updates: Partial<Question>) => void;
  onUpdateDB: (updates: Partial<Question>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const questionTypes: { value: QuestionType; label: string }[] = [
    { value: 'short', label: 'Short Answer' },
    { value: 'long', label: 'Paragraph' },
    { value: 'number', label: 'Number' },
    { value: 'money', label: 'Money' },
    { value: 'mcq', label: 'Multiple Choice' },
    { value: 'checkbox', label: 'Checkboxes' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'scale', label: 'Linear Scale' },
    { value: 'date', label: 'Date' }
  ];

  const needsOptions = ['mcq', 'checkbox', 'dropdown'].includes(question.type);
  const needsScale = question.type === 'scale';
  const needsCurrency = question.type === 'money';
  const options = question.options || [];

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CAD'];

  const updateOptionsLocal = (newOptions: string[]) => {
    onUpdateLocal({ options: newOptions });
  };

  const updateOptionsDB = (newOptions: string[]) => {
    onUpdateDB({ options: newOptions });
  };

  return (
    <div
      className="p-3 sm:p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition bg-blue-50/30"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start space-x-2 sm:space-x-4">
        <GripVertical className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 cursor-move mt-2 flex-shrink-0 touch-none" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2 sm:gap-4 mb-3">
            <input
              type="text"
              value={question.question_text}
              onChange={(e) => onUpdateLocal({ question_text: e.target.value })}
              onBlur={(e) => onUpdateDB({ question_text: e.target.value })}
              className="flex-1 text-sm sm:text-base text-gray-900 font-medium border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent min-w-0"
              placeholder="Question"
            />
            <select
              value={question.type}
              onChange={(e) => {
                const newType = e.target.value as QuestionType;
                const updates: Partial<Question> = { type: newType };

                if (newType === 'scale') {
                  updates.scale_min = question.scale_min ?? 1;
                  updates.scale_max = question.scale_max ?? 5;
                } else if (newType === 'money') {
                  updates.currency = question.currency ?? 'USD';
                }

                onUpdateLocal(updates);
                onUpdateDB(updates);
              }}
              className="px-2 sm:px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent font-medium text-xs sm:text-sm flex-shrink-0"
            >
              {questionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {needsOptions && (
            <div className="ml-3 sm:ml-6 space-y-2 mb-3">
              {options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">{index + 1}.</span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index] = e.target.value;
                      updateOptionsLocal(newOptions);
                    }}
                    onBlur={(e) => {
                      const newOptions = [...options];
                      newOptions[index] = e.target.value;
                      updateOptionsDB(newOptions);
                    }}
                    className="flex-1 px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
                    placeholder="Option"
                  />
                  <button
                    onClick={() => {
                      const newOptions = options.filter((_, i) => i !== index);
                      updateOptionsLocal(newOptions);
                      updateOptionsDB(newOptions);
                    }}
                    className="text-red-600 hover:text-red-700 flex-shrink-0 p-1"
                  >
                    <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [...options, ''];
                  updateOptionsLocal(newOptions);
                  updateOptionsDB(newOptions);
                }}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add option
              </button>
            </div>
          )}

          {needsScale && (
            <div className="ml-3 sm:ml-6 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Value</label>
                <input
                  type="number"
                  value={question.scale_min ?? 1}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    onUpdateLocal({ scale_min: value });
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    onUpdateDB({ scale_min: value });
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Max Value (max 10)</label>
                <input
                  type="number"
                  value={question.scale_max ?? 5}
                  onChange={(e) => {
                    const value = Math.min(parseInt(e.target.value) || 5, 10);
                    onUpdateLocal({ scale_max: value });
                  }}
                  onBlur={(e) => {
                    const value = Math.min(parseInt(e.target.value) || 5, 10);
                    onUpdateDB({ scale_max: value });
                  }}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  min="1"
                  max="10"
                />
              </div>
            </div>
          )}

          {needsCurrency && (
            <div className="ml-3 sm:ml-6 mb-3">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={question.currency ?? 'USD'}
                onChange={(e) => {
                  onUpdateLocal({ currency: e.target.value });
                  onUpdateDB({ currency: e.target.value });
                }}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                {currencies.map((curr) => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 text-xs sm:text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={question.is_required}
                onChange={(e) => {
                  onUpdateLocal({ is_required: e.target.checked });
                  onUpdateDB({ is_required: e.target.checked });
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Required</span>
            </label>
            <button
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium px-2 py-1 hover:bg-red-50 rounded transition"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddContentButton({
  sectionId,
  onAddContent
}: {
  sectionId: string;
  onAddContent: (sectionId: string, type: 'heading' | 'paragraph') => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition font-semibold"
      >
        <Plus className="w-4 h-4" />
        <span>Add Heading and paragraph</span>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px]">
            <button
              onClick={() => {
                onAddContent(sectionId, 'heading');
                setShowMenu(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition text-sm"
            >
              <Type className="w-4 h-4 text-gray-600" />
              <span className="text-gray-900 font-medium">Heading</span>
            </button>
            <button
              onClick={() => {
                onAddContent(sectionId, 'paragraph');
                setShowMenu(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition text-sm border-t border-gray-100"
            >
              <AlignLeft className="w-4 h-4 text-gray-600" />
              <span className="text-gray-900 font-medium">Paragraph</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
