import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Form, Section, Question, RespondentField, SectionContent, SectionItem, Answer } from '../lib/types';
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { generateFormPDF } from '../lib/pdfGenerator';
import logo from '../img/image.png';

interface ValidationError {
  sectionIndex: number;
  sectionTitle: string;
  missingFields: string[];
}

export default function PublicForm() {
  const { formId, responseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState<Form | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [respondentFields, setRespondentFields] = useState<RespondentField[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [respondentData, setRespondentData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedResponseId, setSubmittedResponseId] = useState<string | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const isEditMode = !!responseId;

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      } else {
        loadForm();
      }
    }
  }, [formId, responseId, user, authLoading]);

  const loadForm = async () => {
    try {
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .eq('is_published', true)
        .maybeSingle();

      if (formError) throw formError;
      if (!formData) {
        alert('This form is not available');
        return;
      }

      if (formData.access_type === 'restricted') {
        const allowedEmails = formData.allowed_user_emails || [];
        const userEmail = user?.email;

        if (!userEmail || !allowedEmails.includes(userEmail)) {
          alert('Access denied. You do not have permission to access this form.');
          navigate('/dashboard');
          return;
        }
      }

      setForm(formData);

      const { data: fieldsData, error: fieldsError } = await supabase
        .from('respondent_fields')
        .select('*')
        .eq('form_id', formId)
        .order('order_index', { ascending: true });

      if (fieldsError) throw fieldsError;
      setRespondentFields(fieldsData || []);

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

      if (isEditMode && responseId) {
        await loadExistingResponse(responseId);
      }
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingResponse = async (respId: string) => {
    try {
      const { data: responseData, error: responseError } = await supabase
        .from('responses')
        .select('*, answers(*)')
        .eq('id', respId)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (responseError) throw responseError;

      if (!responseData) {
        alert('Response not found or you do not have permission to view it');
        navigate('/dashboard');
        return;
      }

      const existingAnswers: Record<string, any> = {};
      const existingRespondentData: Record<string, string> = {};

      responseData.answers?.forEach((answer: Answer) => {
        existingAnswers[answer.question_id] = answer.answer_value;
      });

      if (responseData.respondent_name) {
        const nameField = respondentFields.find(f => f.field_label.toLowerCase().includes('name'));
        if (nameField) {
          existingRespondentData[nameField.id] = responseData.respondent_name;
        }
      }
      if (responseData.respondent_email) {
        const emailField = respondentFields.find(f => f.field_type === 'email');
        if (emailField) {
          existingRespondentData[emailField.id] = responseData.respondent_email;
        }
      }

      setAnswers(existingAnswers);
      setRespondentData(existingRespondentData);
      setSubmittedResponseId(respId);
    } catch (error) {
      console.error('Error loading existing response:', error);
      alert('Failed to load existing response');
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

  const validateRespondentFields = () => {
    const newErrors: Record<string, string> = {};

    respondentFields.forEach((field) => {
      if (field.is_required) {
        const value = respondentData[field.id] || '';
        if (!value.trim()) {
          newErrors[field.id] = `${field.field_label} is required`;
        } else if (field.field_type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors[field.id] = 'Please enter a valid email address';
        } else if (field.field_type === 'phone' && !/^[0-9+\-\s()]+$/.test(value)) {
          newErrors[field.id] = 'Please enter a valid phone number';
        }
      }
    });

    return newErrors;
  };

  const validateCurrentSection = () => {
    const newErrors: Record<string, string> = {};

    const currentSection = sections[currentSectionIndex];
    if (currentSection) {
      currentSection.questions?.forEach((question) => {
        if (question.is_required) {
          const answer = answers[question.id];

          if (question.type === 'checkbox') {
            if (!answer || !Array.isArray(answer) || answer.length === 0) {
              newErrors[question.id] = 'Please select at least one option';
            }
          } else {
            if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
              newErrors[question.id] = 'This question is required';
            }
          }
        }
      });
    }

    return newErrors;
  };

  const handleNext = () => {
    const respondentErrors = validateRespondentFields();
    const sectionErrors = validateCurrentSection();
    const allErrors = { ...respondentErrors, ...sectionErrors };

    setErrors(allErrors);

    if (Object.keys(allErrors).length === 0) {
      if (currentSectionIndex < sections.length - 1) {
        setCurrentSectionIndex(currentSectionIndex + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      setErrors({});
    }
  };

  const validateAllSections = () => {
    const allValidationErrors: ValidationError[] = [];
    const allFieldErrors: Record<string, string> = {};

    const respondentErrors = validateRespondentFields();
    if (Object.keys(respondentErrors).length > 0) {
      const missingFields = respondentFields
        .filter(field => respondentErrors[field.id])
        .map(field => field.field_label);

      allValidationErrors.push({
        sectionIndex: -1,
        sectionTitle: 'Respondent Information',
        missingFields
      });

      Object.assign(allFieldErrors, respondentErrors);
    }

    sections.forEach((section, index) => {
      const missingFields: string[] = [];

      section.questions?.forEach((question) => {
        if (question.is_required) {
          const answer = answers[question.id];

          if (question.type === 'checkbox') {
            if (!answer || !Array.isArray(answer) || answer.length === 0) {
              missingFields.push(question.question_text);
              allFieldErrors[question.id] = 'This question is required';
            }
          } else {
            if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
              missingFields.push(question.question_text);
              allFieldErrors[question.id] = 'This question is required';
            }
          }
        }
      });

      if (missingFields.length > 0) {
        allValidationErrors.push({
          sectionIndex: index,
          sectionTitle: section.title,
          missingFields
        });
      }
    });

    return { allValidationErrors, allFieldErrors };
  };

  const handleSubmit = async () => {
    if (isEditMode && !form?.allow_response_editing) {
      alert('Editing is disabled for this form');
      return;
    }

    const { allValidationErrors, allFieldErrors } = validateAllSections();

    setErrors(allFieldErrors);

    if (allValidationErrors.length > 0) {
      setValidationErrors(allValidationErrors);
      setShowValidationModal(true);
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode && responseId) {
        const nameField = respondentFields.find(f => f.field_label.toLowerCase().includes('name'));
        const emailField = respondentFields.find(f => f.field_type === 'email');

        const { error: responseUpdateError } = await supabase
          .from('responses')
          .update({
            user_id: user!.id,
            respondent_name: nameField ? respondentData[nameField.id]?.trim() : null,
            respondent_email: emailField ? respondentData[emailField.id]?.trim().toLowerCase() : null,
            last_updated: new Date().toISOString()
          })
          .eq('id', responseId);

        if (responseUpdateError) throw responseUpdateError;

        await supabase
          .from('answers')
          .delete()
          .eq('response_id', responseId);

        const answerInserts = Object.entries(answers).map(([questionId, value]) => ({
          response_id: responseId,
          question_id: questionId,
          answer_value: value
        }));

        const { error: answersError } = await supabase
          .from('answers')
          .insert(answerInserts);

        if (answersError) throw answersError;

        alert('Form updated successfully!');
        navigate('/dashboard');
      } else {
        const nameField = respondentFields.find(f => f.field_label.toLowerCase().includes('name'));
        const emailField = respondentFields.find(f => f.field_type === 'email');

        const newResponseId = crypto.randomUUID();

        const { error: responseError } = await supabase
          .from('responses')
          .insert({
            id: newResponseId,
            form_id: formId!,
            user_id: user!.id,
            respondent_name: nameField ? respondentData[nameField.id]?.trim() : null,
            respondent_email: emailField ? respondentData[emailField.id]?.trim().toLowerCase() : null
          });

        if (responseError) throw responseError;

        const answerInserts = Object.entries(answers).map(([questionId, value]) => ({
          response_id: newResponseId,
          question_id: questionId,
          answer_value: value
        }));

        const { error: answersError } = await supabase
          .from('answers')
          .insert(answerInserts);

        if (answersError) throw answersError;

        setSubmittedResponseId(newResponseId);
        setSubmitted(true);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!form || !submittedResponseId) return;

    const answersData = Object.entries(answers).map(([questionId, answerValue]) => {
      const question = sections
        .flatMap(s => s.questions || [])
        .find(q => q.id === questionId);

      if (!question) return null;

      return {
        question,
        answer: {
          id: '',
          response_id: submittedResponseId,
          question_id: questionId,
          answer_value: answerValue,
          created_at: new Date().toISOString()
        } as Answer
      };
    }).filter(Boolean) as { question: Question; answer: Answer }[];

    generateFormPDF(form, sections, answersData, respondentData);
  };

  const handleDownloadCurrentPDF = () => {
    if (!form) return;

    const answersData = Object.entries(answers).map(([questionId, answerValue]) => {
      const question = sections
        .flatMap(s => s.questions || [])
        .find(q => q.id === questionId);

      if (!question) return null;

      return {
        question,
        answer: {
          id: '',
          response_id: 'draft',
          question_id: questionId,
          answer_value: answerValue,
          created_at: new Date().toISOString()
        } as Answer
      };
    }).filter(Boolean) as { question: Question; answer: Answer }[];

    generateFormPDF(form, sections, answersData, respondentData);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h1>
          <p className="text-gray-600">This form is not available or has been unpublished.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-orange-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Response Submitted!</h1>
          <p className="text-gray-600 mb-6">Thank you for completing this form.</p>
          <div className="flex flex-col gap-3">
            {form?.enable_pdf_download && (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center justify-center space-x-2 px-4 sm:px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold shadow-lg shadow-green-600/30"
              >
                <Download className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm sm:text-base">Download Your Answers as PDF</span>
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg shadow-blue-600/30 text-sm sm:text-base"
            >
              View My Submissions
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSection = sections[currentSectionIndex];
  const isLastSection = currentSectionIndex === sections.length - 1;
  const canEdit = !isEditMode || form?.allow_response_editing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-orange-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <img src={logo} alt="Logo" className="h-8 sm:h-10 w-auto flex-shrink-0" />

              {/* Vertical Divider */}
              <div className="h-8 sm:h-10 border-l border-gray-300 flex-shrink-0"></div>

              {/* Text Content */}
              <div className="flex flex-col min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                  {form.program_name || "Program"}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  {form.title}
                </p>
              </div>
            </div>

            {/* Download PDF Button */}
            {form.enable_pdf_download && (
              <button
                onClick={handleDownloadCurrentPDF}
                className="flex items-center space-x-2 px-3 py-2 sm:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-md hover:shadow-lg"
              >
                <Download className="w-5 h-5" />
                <span className="hidden sm:inline">Download Template</span>
              </button>
            )}
          </div>
        </div>
      </nav>


      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-white px-4 sm:px-8 py-6 border-b border-gray-200">
            <div className="mb-6">
              {user && (
                <div className="mb-4 md:mb-0 md:absolute md:right-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm inline-block">
                    <p className="text-gray-600 font-medium">Signed as: <span className="text-blue-700 font-semibold">{user.email}</span></p>
                  </div>
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{form.title}</h1>
              {form.description && (
                <p className="text-gray-600">{form.description}</p>
              )}
            </div>
          </div>

          <div className="p-8">
            {respondentFields.length > 0 && (
              <div className="mb-8">
                <div className="bg-blue-50 border border-blue-500 rounded-xl p-6 mt-4">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 border-gray-900 pb-2 inline-block">
                    Your Information
                  </h2>
                  {!canEdit && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                      <p className="text-sm text-yellow-800 font-medium">Viewing mode - Editing is disabled for this form</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {respondentFields.map((field) => (
                      <div key={field.id}>
                        <label className="block text-gray-900 font-medium mb-3">
                          {field.field_label}
                          {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type={field.field_type}
                          value={respondentData[field.id] || ''}
                          onChange={(e) => {
                            if (!canEdit) return;
                            setRespondentData({ ...respondentData, [field.id]: e.target.value });
                            setErrors({ ...errors, [field.id]: '' });
                          }}
                          disabled={!canEdit}
                          className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${canEdit ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'}`}
                          placeholder={field.placeholder}
                        />
                        {errors[field.id] && (
                          <p className="mt-2 text-sm text-red-600">{errors[field.id]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 pb-2">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() => setCurrentSectionIndex(index)}
                  className={`px-6 py-3 rounded-t-lg font-semibold transition ${
                    currentSectionIndex === index
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </div>

            {currentSection && (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {currentSection.title}
                  </h2>
                  {currentSection.description && (
                    <p className="text-gray-600">{currentSection.description}</p>
                  )}
                </div>

                <div className="space-y-6">
                  {getMergedSectionItems(currentSection).map((item) => {
                    if (item.type === 'question') {
                      return (
                        <QuestionInput
                          key={item.data.id}
                          question={item.data}
                          value={answers[item.data.id]}
                          onChange={(value) => {
                            if (!canEdit) return;
                            setAnswers({ ...answers, [item.data.id]: value });
                            setErrors({ ...errors, [item.data.id]: '' });
                          }}
                          error={errors[item.data.id]}
                          disabled={!canEdit}
                        />
                      );
                    } else {
                      return (
                        <div key={item.data.id} className="my-6 pb-4 border-b-4 border-blue-100">
                          {item.data.content_type === 'heading' ? (
                            <h3 className="text-xl font-bold text-gray-900">
                              {item.data.content_text}
                            </h3>
                          ) : (
                            <p className="text-base text-gray-700 leading-relaxed">
                              {item.data.content_text}
                            </p>
                          )}
                        </div>
                      );
                    }
                  })}
                </div>
              </>
            )}
          </div>

          <div className="px-8 py-6 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentSectionIndex === 0}
              className="flex items-center space-x-2 px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white font-medium"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Previous</span>
            </button>

            {canEdit && isLastSection ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-blue-600/30"
              >
                <span>{submitting ? 'Submitting...' : 'Submit'}</span>
              </button>
            ) : canEdit ? (
              <button
                onClick={handleNext}
                className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg shadow-blue-600/30"
              >
                <span>Next</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={isLastSection}
                className="flex items-center space-x-2 px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold shadow-lg shadow-gray-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isLastSection ? 'Viewing' : 'Next'}</span>
                {!isLastSection && <ChevronRight className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {showValidationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 text-white" />
                <h3 className="text-xl font-bold text-white">Required Fields Missing</h3>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="text-white hover:bg-red-700 rounded-lg p-1 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-4 max-h-[calc(80vh-8rem)] overflow-y-auto">
              <p className="text-gray-700 mb-6">
                Please complete all required fields before submitting the form. The following sections have missing information:
              </p>

              <div className="space-y-4">
                {validationErrors.map((error, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-semibold text-red-900 mb-2 flex items-center">
                      <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">
                        {index + 1}
                      </span>
                      {error.sectionTitle}
                    </h4>
                    <ul className="ml-8 space-y-1">
                      {error.missingFields.map((field, fieldIndex) => (
                        <li key={fieldIndex} className="text-red-800 text-sm list-disc">
                          {field}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={() => {
                  setShowValidationModal(false);
                  if (validationErrors.length > 0 && validationErrors[0].sectionIndex >= 0) {
                    setCurrentSectionIndex(validationErrors[0].sectionIndex);
                  } else if (validationErrors[0]?.sectionIndex === -1) {
                    setCurrentSectionIndex(0);
                  }
                }}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Go to First Missing Section
              </button>
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  error,
  disabled = false
}: {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
}) {
  const renderInput = () => {
    switch (question.type) {
      case 'short':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            placeholder="Your answer"
          />
        );

      case 'long':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            placeholder="Your answer"
            rows={4}
          />
        );

      case 'mcq':
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label
                key={index}
                className={`flex items-center space-x-3 p-3 border border-gray-300 rounded-lg ${disabled ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer hover:bg-gray-50'} transition`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={disabled}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-900">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        const selectedOptions = value || [];
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label
                key={index}
                className={`flex items-center space-x-3 p-3 border border-gray-300 rounded-lg ${disabled ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer hover:bg-gray-50'} transition`}
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selectedOptions, option]);
                    } else {
                      onChange(selectedOptions.filter((o: string) => o !== option));
                    }
                  }}
                  disabled={disabled}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-900">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'dropdown':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          >
            <option value="">Choose an option</option>
            {question.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'scale':
        const scaleMin = question.scale_min ?? 1;
        const scaleMax = question.scale_max ?? 5;
        const scaleValues = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);
        return (
          <div className="flex items-center space-x-4 flex-wrap">
            {scaleValues.map((num) => (
              <label
                key={num}
                className={`flex flex-col items-center space-y-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={num}
                  checked={value === num}
                  onChange={() => onChange(num)}
                  disabled={disabled}
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">{num}</span>
              </label>
            ))}
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            placeholder="Enter a number"
          />
        );

      case 'money':
        const currency = question.currency ?? 'USD';
        const currencySymbols: Record<string, string> = {
          'USD': '$',
          'EUR': '€',
          'GBP': '£',
          'JPY': '¥',
          'CNY': '¥',
          'INR': '₹',
          'AUD': 'A$',
          'CAD': 'C$'
        };
        return (
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className={`w-full pl-4 pr-16 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              placeholder="0.00"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 font-medium">
              {currencySymbols[currency] || currency}
            </span>
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <label className="block mb-3">
        <span className="text-gray-900 font-medium">
          {question.question_text}
          {question.is_required && <span className="text-red-500 ml-1">*</span>}
        </span>
      </label>
      {renderInput()}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
