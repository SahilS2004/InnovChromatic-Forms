import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RespondentField, RespondentFieldType } from '../lib/types';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface RespondentFieldsEditorProps {
  formId: string;
}

export default function RespondentFieldsEditor({ formId }: RespondentFieldsEditorProps) {
  const [fields, setFields] = useState<RespondentField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFields();
  }, [formId]);

  const loadFields = async () => {
    try {
      const { data, error } = await supabase
        .from('respondent_fields')
        .select('*')
        .eq('form_id', formId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('Error loading respondent fields:', error);
    } finally {
      setLoading(false);
    }
  };

  const addField = async () => {
    try {
      const { data, error } = await supabase
        .from('respondent_fields')
        .insert({
          form_id: formId,
          field_label: 'Untitled Field',
          field_type: 'text',
          is_required: true,
          placeholder: 'Enter your answer',
          order_index: fields.length
        })
        .select()
        .single();

      if (error) throw error;
      setFields([...fields, data]);
    } catch (error) {
      console.error('Error adding field:', error);
      alert('Failed to add field');
    }
  };

  const updateFieldLocal = (fieldId: string, updates: Partial<RespondentField>) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const updateFieldDB = async (fieldId: string, updates: Partial<RespondentField>) => {
    try {
      const { error } = await supabase
        .from('respondent_fields')
        .update(updates)
        .eq('id', fieldId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating field:', error);
    }
  };

  const deleteField = async (fieldId: string) => {
    if (!confirm('Delete this field?')) return;

    try {
      const { error } = await supabase
        .from('respondent_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;
      setFields(fields.filter(f => f.id !== fieldId));
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Failed to delete field');
    }
  };

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-blue-200 rounded w-48 mb-4"></div>
          <div className="h-4 bg-blue-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Your Information</h3>
          <p className="text-sm text-gray-600 mt-1">
            Collect personal details from respondents before they fill out the form
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {fields.map((field) => (
          <div
            key={field.id}
            className="bg-white border border-blue-200 rounded-lg p-4"
          >
            <div className="flex items-start gap-3 mb-3">
              <GripVertical className="w-5 h-5 text-gray-400 cursor-move flex-shrink-0 mt-2" />
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Field Label
                    </label>
                    <input
                      type="text"
                      value={field.field_label}
                      onChange={(e) => updateFieldLocal(field.id, { field_label: e.target.value })}
                      onBlur={() => updateFieldDB(field.id, { field_label: field.field_label })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="e.g., Full Name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Field Type
                    </label>
                    <select
                      value={field.field_type}
                      onChange={(e) => {
                        const newType = e.target.value as RespondentFieldType;
                        updateFieldLocal(field.id, { field_type: newType });
                        updateFieldDB(field.id, { field_type: newType });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={field.placeholder}
                    onChange={(e) => updateFieldLocal(field.id, { placeholder: e.target.value })}
                    onBlur={() => updateFieldDB(field.id, { placeholder: field.placeholder })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="e.g., Enter your full name"
                  />
                </div>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={field.is_required}
                    onChange={(e) => {
                      updateFieldLocal(field.id, { is_required: e.target.checked });
                      updateFieldDB(field.id, { is_required: e.target.checked });
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Required field</span>
                </label>
              </div>
              <button
                onClick={() => deleteField(field.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addField}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
        >
          <Plus className="w-5 h-5" />
          <span>Add Field</span>
        </button>
      </div>
    </div>
  );
}
