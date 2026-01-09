import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Form, Response, Section, Question, Answer } from '../lib/types';
import { FileText, Edit, LogOut, Calendar, Eye, Download } from 'lucide-react';
import { generateFormPDF } from '../lib/pdfGenerator';
import logo from '../img/image.png';

interface ResponseWithForm extends Response {
  forms: Form;
}

export default function PublicDashboard() {
  const [responses, setResponses] = useState<ResponseWithForm[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadResponses();
  }, [user, navigate]);

  const loadResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('responses')
        .select('*, forms(*), answers(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error('Error loading responses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (response: ResponseWithForm) => {
    try {
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('sections')
        .select('*, questions(*), section_content(*)')
        .eq('form_id', response.form_id)
        .order('order_index', { ascending: true });

      if (sectionsError) throw sectionsError;

      const sortedSections = sectionsData.map((section) => ({
        ...section,
        questions: (section.questions || []).sort((a, b) => a.order_index - b.order_index),
        section_content: (section.section_content || []).sort((a, b) => a.order_index - b.order_index)
      }));

      const answersData = (response.answers || []).map((answer: Answer) => {
        const question = sortedSections
          .flatMap(s => s.questions || [])
          .find(q => q.id === answer.question_id);

        if (!question) return null;

        return {
          question,
          answer
        };
      }).filter(Boolean) as { question: Question; answer: Answer }[];

      const { data: respondentFieldsData } = await supabase
        .from('respondent_fields')
        .select('*')
        .eq('form_id', response.form_id)
        .order('order_index', { ascending: true });

      const respondentData: Record<string, string> = {};
      if (response.respondent_name) {
        const nameField = respondentFieldsData?.find(f => f.field_label.toLowerCase().includes('name'));
        if (nameField) {
          respondentData[nameField.id] = response.respondent_name;
        }
      }
      if (response.respondent_email) {
        const emailField = respondentFieldsData?.find(f => f.field_type === 'email');
        if (emailField) {
          respondentData[emailField.id] = response.respondent_email;
        }
      }

      generateFormPDF(response.forms, sortedSections, answersData, respondentData);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-orange-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-orange-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
              <img src={logo} alt="Logo" className="h-8 sm:h-10 w-auto flex-shrink-0" />
              <div className="border-l border-gray-300 pl-3 sm:pl-4 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">My Forms</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-md w-full sm:w-auto justify-center"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Forms You've Filled</h2>
          <p className="text-gray-600">View and edit your submitted forms</p>
        </div>

        {responses.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Forms Yet</h3>
            <p className="text-gray-600">You haven't filled any forms yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {responses.map((response) => (
              <div
                key={response.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition p-6 border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">
                      {response.forms.title}
                    </h3>
                    {response.forms.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {response.forms.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs text-gray-500 mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>Submitted {formatDate(response.created_at)}</span>
                </div>

                <div className="flex flex-col gap-2">
                  <Link
                    to={`/form/${response.form_id}/edit/${response.id}`}
                    className="flex items-center justify-center space-x-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-md shadow-blue-600/30"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Response</span>
                  </Link>

                  <div className="flex gap-2">
                    {response.forms.allow_response_editing && (
                      <Link
                        to={`/form/${response.form_id}/edit/${response.id}`}
                        className="flex items-center justify-center space-x-2 flex-1 px-4 py-2.5 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition text-sm font-semibold"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </Link>
                    )}

                    {response.forms.enable_pdf_download && (
                      <button
                        onClick={() => handleDownloadPDF(response)}
                        className="flex items-center justify-center space-x-2 flex-1 px-4 py-2.5 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition text-sm font-semibold"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                        <span className="sm:inline hidden">PDF</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
