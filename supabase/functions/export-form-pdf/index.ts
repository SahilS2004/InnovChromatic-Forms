import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { formId } = await req.json();

    if (!formId) {
      return new Response(
        JSON.stringify({ error: 'formId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ error: 'Form not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: sections } = await supabase
      .from('sections')
      .select('*, questions(*)')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    const { data: responses } = await supabase
      .from('responses')
      .select('*, answers(*)')
      .eq('form_id', formId);

    const html = generateHTMLReport(form, sections || [], responses || []);

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${form.title}-responses.html"`,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateHTMLReport(form: any, sections: any[], responses: any[]): string {
  const totalResponses = responses.length;
  const totalQuestions = sections.reduce((sum, s) => sum + (s.questions?.length || 0), 0);
  const date = new Date().toLocaleDateString();

  let htmlParts: string[] = [];

  htmlParts.push('<!DOCTYPE html>');
  htmlParts.push('<html>');
  htmlParts.push('<head>');
  htmlParts.push('<meta charset="UTF-8">');
  htmlParts.push(`<title>${form.title} - Response Report</title>`);
  htmlParts.push('<style>');
  htmlParts.push('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 1200px; margin: 0 auto; padding: 40px 20px; background: #f9fafb; }');
  htmlParts.push('.header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 30px; }');
  htmlParts.push('h1 { margin: 0 0 10px 0; font-size: 32px; }');
  htmlParts.push('.subtitle { opacity: 0.9; font-size: 16px; }');
  htmlParts.push('.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }');
  htmlParts.push('.stat-card { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }');
  htmlParts.push('.stat-label { color: #6b7280; font-size: 14px; margin-bottom: 8px; }');
  htmlParts.push('.stat-value { font-size: 32px; font-weight: bold; color: #111827; }');
  htmlParts.push('.section { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }');
  htmlParts.push('.section-title { font-size: 24px; font-weight: bold; margin-bottom: 24px; color: #111827; }');
  htmlParts.push('.question { margin-bottom: 32px; padding-bottom: 32px; border-bottom: 1px solid #e5e7eb; }');
  htmlParts.push('.question:last-child { border-bottom: none; }');
  htmlParts.push('.question-text { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #111827; }');
  htmlParts.push('.answer-list { background: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 12px; }');
  htmlParts.push('.answer-item { padding: 8px 0; color: #374151; }');
  htmlParts.push('.chart { margin: 16px 0; }');
  htmlParts.push('.bar { display: flex; align-items: center; margin: 8px 0; }');
  htmlParts.push('.bar-label { min-width: 150px; font-size: 14px; color: #374151; }');
  htmlParts.push('.bar-visual { flex: 1; height: 24px; background: #3b82f6; border-radius: 4px; margin: 0 12px; }');
  htmlParts.push('.bar-count { min-width: 40px; text-align: right; font-weight: 600; color: #111827; }');
  htmlParts.push('.footer { text-align: center; color: #6b7280; margin-top: 40px; padding: 20px; font-size: 14px; }');
  htmlParts.push('</style>');
  htmlParts.push('</head>');
  htmlParts.push('<body>');

  htmlParts.push('<div class="header">');
  htmlParts.push(`<h1>${form.title}</h1>`);
  htmlParts.push(`<div class="subtitle">${form.description || 'Form Response Report'}</div>`);
  htmlParts.push(`<div class="subtitle" style="margin-top: 8px;">Generated on ${date}</div>`);
  htmlParts.push('</div>');

  htmlParts.push('<div class="stats">');
  htmlParts.push('<div class="stat-card">');
  htmlParts.push('<div class="stat-label">Total Responses</div>');
  htmlParts.push(`<div class="stat-value">${totalResponses}</div>`);
  htmlParts.push('</div>');
  htmlParts.push('<div class="stat-card">');
  htmlParts.push('<div class="stat-label">Total Questions</div>');
  htmlParts.push(`<div class="stat-value">${totalQuestions}</div>`);
  htmlParts.push('</div>');
  htmlParts.push('<div class="stat-card">');
  htmlParts.push('<div class="stat-label">Sections</div>');
  htmlParts.push(`<div class="stat-value">${sections.length}</div>`);
  htmlParts.push('</div>');
  htmlParts.push('</div>');

  sections.forEach((section) => {
    htmlParts.push('<div class="section">');
    htmlParts.push(`<div class="section-title">${section.title}</div>`);

    section.questions?.forEach((question: any) => {
      const answers = responses
        .flatMap(r => r.answers)
        .filter((a: any) => a.question_id === question.id);

      htmlParts.push('<div class="question">');
      htmlParts.push(`<div class="question-text">${question.question_text}</div>`);
      htmlParts.push(`<div style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">${answers.length} responses</div>`);

      if (['mcq', 'dropdown', 'scale'].includes(question.type)) {
        const counts: Record<string, number> = {};
        answers.forEach((answer: any) => {
          const value = String(answer.answer_value);
          counts[value] = (counts[value] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(counts), 1);
        htmlParts.push('<div class="chart">');
        Object.entries(counts).forEach(([label, count]) => {
          const width = (count / maxCount) * 100;
          htmlParts.push('<div class="bar">');
          htmlParts.push(`<div class="bar-label">${label}</div>`);
          htmlParts.push(`<div class="bar-visual" style="width: ${width}%;"></div>`);
          htmlParts.push(`<div class="bar-count">${count}</div>`);
          htmlParts.push('</div>');
        });
        htmlParts.push('</div>');
      } else if (question.type === 'checkbox') {
        const counts: Record<string, number> = {};
        answers.forEach((answer: any) => {
          const values = answer.answer_value;
          if (Array.isArray(values)) {
            values.forEach((value: string) => {
              counts[value] = (counts[value] || 0) + 1;
            });
          }
        });

        const maxCount = Math.max(...Object.values(counts), 1);
        htmlParts.push('<div class="chart">');
        Object.entries(counts).forEach(([label, count]) => {
          const width = (count / maxCount) * 100;
          htmlParts.push('<div class="bar">');
          htmlParts.push(`<div class="bar-label">${label}</div>`);
          htmlParts.push(`<div class="bar-visual" style="width: ${width}%; background: #10b981;"></div>`);
          htmlParts.push(`<div class="bar-count">${count}</div>`);
          htmlParts.push('</div>');
        });
        htmlParts.push('</div>');
      } else {
        htmlParts.push('<div class="answer-list">');
        answers.slice(0, 10).forEach((answer: any) => {
          htmlParts.push(`<div class="answer-item">${String(answer.answer_value)}</div>`);
        });
        if (answers.length > 10) {
          htmlParts.push(`<div class="answer-item" style="font-style: italic; color: #6b7280;">... and ${answers.length - 10} more responses</div>`);
        }
        if (answers.length === 0) {
          htmlParts.push('<div class="answer-item" style="font-style: italic; color: #6b7280;">No responses</div>');
        }
        htmlParts.push('</div>');
      }

      htmlParts.push('</div>');
    });

    htmlParts.push('</div>');
  });

  htmlParts.push('<div class="footer">');
  htmlParts.push('<div>This report was generated from a Google Forms-like application</div>');
  htmlParts.push('<div style="margin-top: 8px;">Built with Supabase</div>');
  htmlParts.push('</div>');
  htmlParts.push('</body>');
  htmlParts.push('</html>');

  return htmlParts.join('\n');
}
