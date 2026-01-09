import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Form, Section, Question, Response, Answer } from '../lib/types';
import { ArrowLeft, Download, Users, Calendar, Eye, X, FileText } from 'lucide-react';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, LineElement, PointElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { generateFormPDF } from '../lib/pdfGenerator';
import logo from '../img/image.png';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

interface ResponseWithAnswers extends Response {
  answers: Answer[];
}

export default function ResponseAnalytics() {
  const { formId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [responses, setResponses] = useState<ResponseWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<ResponseWithAnswers | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

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

      loadData();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/dashboard');
    }
  };

  const loadData = async () => {
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

      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('*, answers(*)')
        .eq('form_id', formId)
        .order('created_at', { ascending: false });

      if (responsesError) throw responsesError;
      setResponses(responsesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load responses');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-form-pdf`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formId })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form?.title || 'form'}-responses.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('PDF export feature is being set up. Please try again later.');
    }
  };

  const getQuestionAnalytics = (question: Question) => {
    const answers = responses.flatMap(r => r.answers).filter(a => a.question_id === question.id);

    if (['mcq', 'dropdown'].includes(question.type)) {
      const counts: Record<string, number> = {};
      answers.forEach(answer => {
        const value = answer.answer_value as string;
        counts[value] = (counts[value] || 0) + 1;
      });

      return {
        type: 'bar',
        data: {
          labels: Object.keys(counts),
          datasets: [{
            label: 'Responses',
            data: Object.values(counts),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1
          }]
        }
      };
    }

    if (question.type === 'checkbox') {
      const counts: Record<string, number> = {};
      answers.forEach(answer => {
        const values = answer.answer_value as string[];
        if (Array.isArray(values)) {
          values.forEach(value => {
            counts[value] = (counts[value] || 0) + 1;
          });
        }
      });

      const colors = [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)'
      ];

      return {
        type: 'pie',
        data: {
          labels: Object.keys(counts),
          datasets: [{
            data: Object.values(counts),
            backgroundColor: colors.slice(0, Object.keys(counts).length),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        }
      };
    }

    if (question.type === 'scale') {
      const counts: Record<number, number> = {};
      answers.forEach(answer => {
        const value = answer.answer_value as number;
        counts[value] = (counts[value] || 0) + 1;
      });

      return {
        type: 'bar',
        data: {
          labels: Object.keys(counts).sort(),
          datasets: [{
            label: 'Responses',
            data: Object.keys(counts).sort().map(k => counts[Number(k)]),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1
          }]
        }
      };
    }

    return null;
  };

  const getOverallAnalytics = () => {
    const responsesOverTime: Record<string, number> = {};

    responses.forEach(response => {
      const date = new Date(response.created_at).toLocaleDateString();
      responsesOverTime[date] = (responsesOverTime[date] || 0) + 1;
    });

    const sortedDates = Object.keys(responsesOverTime).sort((a, b) =>
      new Date(a).getTime() - new Date(b).getTime()
    );

    return {
      labels: sortedDates,
      datasets: [{
        label: 'Responses',
        data: sortedDates.map(date => responsesOverTime[date]),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    };
  };

  const getAnswerForQuestion = (response: ResponseWithAnswers, questionId: string) => {
    const answer = response.answers.find(a => a.question_id === questionId);
    if (!answer) return 'No answer';

    if (Array.isArray(answer.answer_value)) {
      return answer.answer_value.join(', ');
    }

    return String(answer.answer_value);
  };

  const openResponseModal = (response: ResponseWithAnswers) => {
    setSelectedResponse(response);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedResponse(null);
  };

  const downloadSingleResponsePDF = async (response: ResponseWithAnswers) => {
    if (!form) return;

    try {
      const respondentData: Record<string, string> = {};
      if (response.respondent_name) {
        respondentData['Founder Name'] = response.respondent_name;
      }
      if (response.respondent_email) {
        respondentData['Email'] = response.respondent_email;
      }

      const answersData = response.answers
        .map(answer => {
          const question = allQuestions.find(q => q.id === answer.question_id);
          return question ? { question, answer } : null;
        })
        .filter(Boolean) as Array<{ question: Question; answer: Answer }>;

      if (answersData.length === 0) {
        alert('No answers found for this response.');
        return;
      }

      generateFormPDF(form, sections, answersData, respondentData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
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

  const allQuestions = sections.flatMap(s => s.questions || []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-orange-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto min-w-0">
              <Link to="/administrator/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0">
                <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
              </Link>
              <img src={logo} alt="Logo" className="h-8 sm:h-10 w-auto flex-shrink-0" />
              <div className="border-l border-gray-300 pl-3 sm:pl-4 min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">{form.title}</h1>
                <p className="text-xs sm:text-sm text-gray-600">Form Responses</p>
              </div>
            </div>
            <button
              onClick={downloadPDF}
              className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg shadow-blue-600/30 text-xs sm:text-sm w-full sm:w-auto justify-center"
            >
              <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Responses</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{responses.length}</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Questions</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {sections.reduce((sum, s) => sum + (s.questions?.length || 0), 0)}
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm hover:shadow-md transition sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Latest Response</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">
                  {responses.length > 0
                    ? new Date(responses[0].created_at).toLocaleDateString()
                    : 'No responses'}
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {responses.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">Response Trend</h2>
            <div className="h-48 sm:h-64">
              <Line
                data={getOverallAnalytics()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => `Responses: ${context.parsed.y}`
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        stepSize: 1
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        )}

        {responses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No responses yet</h3>
            <p className="text-gray-600 mb-6">
              Share your form to start collecting responses
            </p>
            {form.is_published && (
              <div className="max-w-md mx-auto">
                <p className="text-sm text-gray-600 mb-2">Public URL:</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/form/${formId}`}
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/form/${formId}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-md shadow-blue-600/30"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-blue-50 border-b border-blue-100">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Submitted At
                      </th>
                      <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {responses.map((response, index) => (
                      <tr key={response.id} className="hover:bg-gray-50 transition">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <span className="text-xs sm:text-sm font-medium text-gray-900">
                            #{index + 1}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className="text-xs sm:text-sm text-gray-900 font-medium">
                            {response.respondent_name || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className="text-xs sm:text-sm text-gray-600">
                            {response.respondent_email || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <span className="text-xs sm:text-sm text-gray-600">
                            {new Date(response.created_at).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => openResponseModal(response)}
                            className="inline-flex items-center space-x-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs sm:text-sm font-semibold shadow-md shadow-blue-600/30"
                          >
                            <Eye className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 sm:mt-8 space-y-6 sm:space-y-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Question Analytics</h2>
              {sections.map((section) => (
                <div key={section.id} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 sm:mb-6">{section.title}</h3>
                  <div className="space-y-6 sm:space-y-8">
                    {section.questions?.map((question) => {
                      const analytics = getQuestionAnalytics(question);
                      const textAnswers = responses
                        .flatMap(r => r.answers)
                        .filter(a => a.question_id === question.id)
                        .map(a => a.answer_value);

                      return (
                        <div key={question.id} className="border-t border-gray-200 pt-4 sm:pt-6 first:border-0 first:pt-0">
                          <h4 className="font-medium text-sm sm:text-base text-gray-900 mb-3 sm:mb-4">{question.question_text}</h4>

                          {analytics ? (
                            <div className="max-w-full sm:max-w-2xl">
                              {analytics.type === 'bar' && (
                                <Bar
                                  data={analytics.data}
                                  options={{
                                    responsive: true,
                                    plugins: {
                                      legend: { display: false }
                                    }
                                  }}
                                />
                              )}
                              {analytics.type === 'pie' && (
                                <div className="max-w-full sm:max-w-md mx-auto">
                                  <Pie
                                    data={analytics.data}
                                    options={{
                                      responsive: true,
                                      plugins: {
                                        legend: { position: 'bottom' }
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {textAnswers.length > 0 ? (
                                textAnswers.map((answer, index) => (
                                  <div key={index} className="p-2 sm:p-3 bg-gray-50 rounded-lg">
                                    <p className="text-gray-700 text-xs sm:text-sm break-words">{String(answer)}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-gray-500 italic text-xs sm:text-sm">No responses</p>
                              )}
                            </div>
                          )}

                          <p className="text-xs sm:text-sm text-gray-600 mt-3">
                            {textAnswers.length} {textAnswers.length === 1 ? 'response' : 'responses'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {showModal && selectedResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div className="flex-1 min-w-0 mr-2">
                <h2 className="text-base sm:text-xl font-bold text-gray-900">Response Details</h2>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  Submitted on {new Date(selectedResponse.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={() => downloadSingleResponsePDF(selectedResponse)}
                  className="p-1.5 sm:p-2 hover:bg-blue-50 rounded-lg transition text-blue-600"
                  title="Download PDF"
                >
                  <Download className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
                <button
                  onClick={closeModal}
                  className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-4 sm:w-5 h-4 sm:h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
              <div className="space-y-4 sm:space-y-6">
                {(selectedResponse.respondent_name || selectedResponse.respondent_email) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Respondent Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedResponse.respondent_name && (
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Name</p>
                          <p className="text-sm font-medium text-gray-900">{selectedResponse.respondent_name}</p>
                        </div>
                      )}
                      {selectedResponse.respondent_email && (
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Email</p>
                          <p className="text-sm font-medium text-gray-900">{selectedResponse.respondent_email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {sections.map((section) => (
                  <div key={section.id}>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 pb-2 border-b border-gray-200">
                      {section.title}
                    </h3>
                    <div className="space-y-3 sm:space-y-4">
                      {section.questions?.map((question) => {
                        const answer = getAnswerForQuestion(selectedResponse, question.id);
                        return (
                          <div key={question.id} className="bg-gray-50 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                              {question.question_text}
                            </p>
                            <p className="text-sm sm:text-base text-gray-900 break-words">
                              {answer}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeModal}
                className="w-full px-4 py-2 sm:py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition text-sm sm:text-base font-medium"
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
