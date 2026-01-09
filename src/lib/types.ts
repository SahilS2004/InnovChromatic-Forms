export type QuestionType = 'short' | 'long' | 'mcq' | 'checkbox' | 'dropdown' | 'scale' | 'date' | 'number' | 'money';
export type RespondentFieldType = 'text' | 'email' | 'phone' | 'number';
export type SectionContentType = 'heading' | 'paragraph';

export interface Database {
  public: {
    Tables: {
      forms: {
        Row: {
          id: string;
          admin_id: string;
          title: string;
          description: string;
          is_published: boolean;
          enable_pdf_download: boolean;
          allow_response_editing: boolean;
          program_name: string;
          pdf_template: any;
          access_type: string;
          allowed_user_emails: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          title?: string;
          description?: string;
          is_published?: boolean;
          enable_pdf_download?: boolean;
          allow_response_editing?: boolean;
          program_name?: string;
          pdf_template?: any;
          access_type?: string;
          allowed_user_emails?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          title?: string;
          description?: string;
          is_published?: boolean;
          enable_pdf_download?: boolean;
          allow_response_editing?: boolean;
          program_name?: string;
          pdf_template?: any;
          access_type?: string;
          allowed_user_emails?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      sections: {
        Row: {
          id: string;
          form_id: string;
          title: string;
          description: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          title?: string;
          description?: string;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          title?: string;
          description?: string;
          order_index?: number;
          created_at?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          section_id: string;
          question_text: string;
          type: QuestionType;
          options: string[] | null;
          is_required: boolean;
          order_index: number;
          created_at: string;
          scale_min: number | null;
          scale_max: number | null;
          currency: string | null;
        };
        Insert: {
          id?: string;
          section_id: string;
          question_text?: string;
          type?: QuestionType;
          options?: string[] | null;
          is_required?: boolean;
          order_index?: number;
          created_at?: string;
          scale_min?: number | null;
          scale_max?: number | null;
          currency?: string | null;
        };
        Update: {
          id?: string;
          section_id?: string;
          question_text?: string;
          type?: QuestionType;
          options?: string[] | null;
          is_required?: boolean;
          order_index?: number;
          created_at?: string;
          scale_min?: number | null;
          scale_max?: number | null;
          currency?: string | null;
        };
      };
      responses: {
        Row: {
          id: string;
          form_id: string;
          respondent_name: string | null;
          respondent_email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          respondent_name?: string | null;
          respondent_email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          respondent_name?: string | null;
          respondent_email?: string | null;
          created_at?: string;
        };
      };
      answers: {
        Row: {
          id: string;
          response_id: string;
          question_id: string;
          answer_value: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          response_id: string;
          question_id: string;
          answer_value: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          response_id?: string;
          question_id?: string;
          answer_value?: unknown;
          created_at?: string;
        };
      };
      respondent_fields: {
        Row: {
          id: string;
          form_id: string;
          field_label: string;
          field_type: RespondentFieldType;
          is_required: boolean;
          placeholder: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          field_label?: string;
          field_type?: RespondentFieldType;
          is_required?: boolean;
          placeholder?: string;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          field_label?: string;
          field_type?: RespondentFieldType;
          is_required?: boolean;
          placeholder?: string;
          order_index?: number;
          created_at?: string;
        };
      };
      section_content: {
        Row: {
          id: string;
          section_id: string;
          content_type: SectionContentType;
          content_text: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          section_id: string;
          content_type?: SectionContentType;
          content_text?: string;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          section_id?: string;
          content_type?: SectionContentType;
          content_text?: string;
          order_index?: number;
          created_at?: string;
        };
      };
    };
  };
}

export interface Form {
  id: string;
  admin_id: string;
  title: string;
  description: string;
  is_published: boolean;
  enable_pdf_download: boolean;
  allow_response_editing: boolean;
  program_name: string;
  pdf_template?: any;
  access_type?: string;
  allowed_user_emails?: string[];
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  form_id: string;
  title: string;
  description: string;
  order_index: number;
  created_at: string;
  questions?: Question[];
  section_content?: SectionContent[];
}

export interface Question {
  id: string;
  section_id: string;
  question_text: string;
  type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  order_index: number;
  created_at: string;
  scale_min?: number;
  scale_max?: number;
  currency?: string;
}

export interface Response {
  id: string;
  form_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  created_at: string;
  answers?: Answer[];
}

export interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  answer_value: unknown;
  created_at: string;
}

export interface FormWithSections extends Form {
  sections: Section[];
}

export interface RespondentField {
  id: string;
  form_id: string;
  field_label: string;
  field_type: RespondentFieldType;
  is_required: boolean;
  placeholder: string;
  order_index: number;
  created_at: string;
}

export interface SectionContent {
  id: string;
  section_id: string;
  content_type: SectionContentType;
  content_text: string;
  order_index: number;
  created_at: string;
}

export type SectionItem =
  | { type: 'question'; data: Question }
  | { type: 'content'; data: SectionContent };
