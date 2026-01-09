import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Form } from '../lib/types';
import { Plus, Copy, Trash2, LogOut, BarChart, CreditCard as Edit, ChevronDown, ChevronUp, Users, Shield, Search } from 'lucide-react';
import logo from '../img/image.png';

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  app_metadata: {
    provider: string;
    providers: string[];
    user_role?: string;
  };
  user_metadata: {
    email: string;
    email_verified: boolean;
    phone_verified: boolean;
    sub: string;
  };
}

export default function AdminDashboard() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<AuthUser[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadRegisteredUsers();
    }
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

      loadForms();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/dashboard');
    }
  };

  const loadRegisteredUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.rpc('get_complete_user_list');

      if (error) throw error;

      // Map the RPC response to the AuthUser interface
      const users: AuthUser[] = (data || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        app_metadata: u.raw_app_meta_data || {},
        user_metadata: u.raw_user_meta_data || {}
      }));

      setRegisteredUsers(users);
    } catch (error) {
      console.error('Error loading registered users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const makeUserAdmin = async (userId: string) => {
    if (!confirm('Are you sure you want to make this user an admin?')) {
      return;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_metadata: {
            user_role: 'admin',
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to update user');

      alert('User has been promoted to admin successfully!');
      loadRegisteredUsers();
    } catch (error) {
      console.error('Error making user admin:', error);
      alert('Failed to update user role');
    }
  };

  const removeAdminRole = async (userId: string) => {
    if (!confirm('Are you sure you want to remove admin privileges from this user?')) {
      return;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_metadata: {
            user_role: 'user',
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to update user');

      alert('Admin privileges have been removed successfully!');
      loadRegisteredUsers();
    } catch (error) {
      console.error('Error removing admin role:', error);
      alert('Failed to update user role');
    }
  };

  const loadForms = async () => {
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setForms(data || []);
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewForm = async () => {
    try {
      const { data: form, error: formError } = await supabase
        .from('forms')
        .insert({
          admin_id: user!.id,
          title: 'Untitled Form',
          description: ''
        })
        .select()
        .single();

      if (formError) throw formError;

      const { error: sectionError } = await supabase
        .from('sections')
        .insert({
          form_id: form.id,
          title: 'Untitled Section',
          order_index: 0
        });

      if (sectionError) throw sectionError;

      navigate(`/administrator/forms/${form.id}/edit`);
    } catch (error) {
      console.error('Error creating form:', error);
      alert('Failed to create form');
    }
  };

  const duplicateForm = async (formId: string) => {
    try {
      const { data: originalForm } = await supabase
        .from('forms')
        .select('*, sections(*, questions(*))')
        .eq('id', formId)
        .single();

      if (!originalForm) return;

      const { data: newForm, error: formError } = await supabase
        .from('forms')
        .insert({
          admin_id: user!.id,
          title: `${originalForm.title} (Copy)`,
          description: originalForm.description,
          is_published: false
        })
        .select()
        .single();

      if (formError) throw formError;

      for (const section of originalForm.sections) {
        const { data: newSection, error: sectionError } = await supabase
          .from('sections')
          .insert({
            form_id: newForm.id,
            title: section.title,
            description: section.description,
            order_index: section.order_index
          })
          .select()
          .single();

        if (sectionError) throw sectionError;

        for (const question of section.questions) {
          await supabase.from('questions').insert({
            section_id: newSection.id,
            question_text: question.question_text,
            type: question.type,
            options: question.options,
            is_required: question.is_required,
            order_index: question.order_index
          });
        }
      }

      loadForms();
    } catch (error) {
      console.error('Error duplicating form:', error);
      alert('Failed to duplicate form');
    }
  };

  const deleteForm = async (formId: string) => {
    if (!confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', formId);

      if (error) throw error;
      loadForms();
    } catch (error) {
      console.error('Error deleting form:', error);
      alert('Failed to delete form');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filteredUsers = registeredUsers.filter(authUser =>
    authUser.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const displayedUsers = showAllUsers ? filteredUsers : filteredUsers.slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-orange-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <img src={logo} alt="Logo" className="h-8 sm:h-10 w-auto" />
              <div className="border-l border-gray-300 pl-3 sm:pl-4">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Residency Forms</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate max-w-[200px] sm:max-w-none">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-3 sm:px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">My Forms</h2>
          <button
            onClick={createNewForm}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 sm:px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg shadow-blue-600/30 text-sm sm:text-base"
          >
            <Plus className="w-5 h-5" />
            <span>New Form</span>
          </button>
        </div>

        {forms.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 text-center py-16 px-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No forms yet</h3>
            <p className="text-gray-600 mb-6">Create your first form to get started</p>
            <button
              onClick={createNewForm}
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg shadow-blue-600/30"
            >
              <Plus className="w-5 h-5" />
              <span>Create Form</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {forms.map((form) => (
              <div
                key={form.id}
                className="bg-white rounded-xl border border-gray-200 hover:shadow-xl transition-all overflow-hidden"
              >
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 truncate">{form.title}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{form.description || 'No description'}</p>
                    </div>
                    <span
                      className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                        form.is_published
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {form.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Link
                      to={`/administrator/forms/${form.id}/edit`}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs sm:text-sm font-semibold shadow-md shadow-blue-600/30"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </Link>
                    <Link
                      to={`/administrator/forms/${form.id}/responses`}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition text-xs sm:text-sm font-semibold"
                    >
                      <BarChart className="w-4 h-4" />
                      <span>Responses</span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => duplicateForm(form.id)}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-xs sm:text-sm font-medium"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="xs:inline">Duplicate</span>
                    </button>
                    <button
                      onClick={() => deleteForm(form.id)}
                      className="flex items-center justify-center px-3 py-2 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition text-xs sm:text-sm"
                      title="Delete form"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {form.is_published && (
                  <div className="px-4 sm:px-6 py-3 sm:py-4 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs font-medium text-gray-700 mb-2">Public URL:</p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={`${window.location.origin}/form/${form.id}`}
                        readOnly
                        className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 sm:px-3 py-1.5 min-w-0 truncate"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/form/${form.id}`);
                          setCopiedFormId(form.id);
                          setTimeout(() => setCopiedFormId(null), 2000);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-3 py-1.5 hover:bg-blue-100 rounded transition whitespace-nowrap"
                      >
                        {copiedFormId === form.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Registered Users</h3>
                <p className="text-sm text-gray-600">Manage user accounts and permissions</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              {filteredUsers.length > 10 && (
                <button
                  onClick={() => setShowAllUsers(!showAllUsers)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm whitespace-nowrap"
                >
                  {showAllUsers ? 'Show Less' : `View All (${filteredUsers.length})`}
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                {userSearchQuery ? 'No users match your search' : 'No registered users found'}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedUsers.map((authUser) => (
                  <div
                    key={authUser.id}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition"
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedUserId(expandedUserId === authUser.id ? null : authUser.id)}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 font-semibold text-sm">
                            {authUser.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-gray-900 truncate">{authUser.email}</p>
                            {authUser.app_metadata?.user_role === 'admin' && (
                              <span className="flex items-center space-x-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                                <Shield className="w-3 h-3" />
                                <span>Admin</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            Joined {new Date(authUser.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                        {expandedUserId === authUser.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>

                    {expandedUserId === authUser.id && (
                      <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">User ID</p>
                            <p className="text-sm text-gray-900 font-mono break-all">{authUser.id}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Email</p>
                            <p className="text-sm text-gray-900">{authUser.email}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Email Verified</p>
                            <p className="text-sm text-gray-900">
                              {authUser.user_metadata.email_verified ? 'Yes' : 'No'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Last Sign In</p>
                            <p className="text-sm text-gray-900">
                              {authUser.last_sign_in_at
                                ? new Date(authUser.last_sign_in_at).toLocaleString()
                                : 'Never'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Provider</p>
                            <p className="text-sm text-gray-900 capitalize">{authUser.app_metadata.provider}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Current Role</p>
                            <p className="text-sm text-gray-900 capitalize">
                              {authUser.app_metadata?.user_role || 'user'}
                            </p>
                          </div>
                        </div>

                        {authUser.app_metadata?.user_role === 'admin' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeAdminRole(authUser.id);
                            }}
                            className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition font-semibold shadow-md shadow-gray-600/30"
                          >
                            <Users className="w-4 h-4" />
                            <span>Make User</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              makeUserAdmin(authUser.id);
                            }}
                            className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition font-semibold shadow-md shadow-orange-600/30"
                          >
                            <Shield className="w-4 h-4" />
                            <span>Make Admin</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {!showAllUsers && filteredUsers.length > 10 && (
                  <div className="mt-4 text-center py-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-3">
                      Showing 10 of {filteredUsers.length} users
                    </p>
                    <button
                      onClick={() => setShowAllUsers(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
                    >
                      View All Users
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
