import jsPDF from 'jspdf';
import { Form, Section, Question, Answer, SectionContent } from './types';
import logoImage from '../img/image.png';

interface RespondentData {
  [key: string]: string;
}

interface AnswerData {
  question: Question;
  answer: Answer;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

export function generateFormPDF(
  form: Form,
  sections: Section[],
  answers: AnswerData[],
  respondentData: RespondentData
) {
  const template = form.pdf_template || {};
  const layout = template.layout || {};
  const header = template.header || {};
  const footer = template.footer || {};
  const sectionConfig = template.sections || {};
  const fonts = template.fonts || {};

  const doc = new jsPDF({
    orientation: layout.orientation || 'landscape',
    unit: 'mm',
    format: layout.pageSize || 'a2'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = layout.margin || 15;
  const usableWidth = pageWidth - (margin * 2);
  const bottomMargin = layout.bottomMargin || 20;
  const headerHeight = layout.headerHeight || 40;

  const founderName = Object.entries(respondentData).find(([key]) =>
    key.toLowerCase().includes('founder') || key.toLowerCase().includes('name')
  )?.[1] || 'Founder Name';

  const addHeader = () => {
    if (header.showTitle !== false) {
      const titleFontSize = header.titleFontSize || 20;
      const titleColor = hexToRgb(header.titleColor || '#505050');

      doc.setFontSize(titleFontSize);
      doc.setFont(fonts.mainFont || 'helvetica', 'bold');
      doc.setTextColor(...titleColor);
      doc.text(form.title, margin, 22);
    }

    if (header.showFounderName !== false) {
      doc.setFontSize(11);
      doc.setFont(fonts.mainFont || 'helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(founderName, margin + 120, 22);
    }

    if (header.showLogo !== false) {
      try {
        const logoWidth = 30;
        const logoHeight = 12;
        doc.addImage(logoImage, 'PNG', pageWidth - margin - logoWidth, 12, logoWidth, logoHeight);
      } catch (error) {
        console.warn('Could not add logo:', error);
      }
    }

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, 28, pageWidth - margin, 28);

    doc.setTextColor(0, 0, 0);
  };

  const addFooter = () => {
    if (footer.showCredit !== false) {
      const footerFontSize = footer.fontSize || 9;
      const footerTextColor = hexToRgb(footer.textColor || '#646464');
      const creditText = footer.creditText || 'Credit: InnovChromatic';

      doc.setFontSize(footerFontSize);
      doc.setFont(fonts.mainFont || 'helvetica', 'normal');
      doc.setTextColor(...footerTextColor);
      doc.text(creditText, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }
  };

  const defaultSectionColors = [
    { bg: [232, 234, 146], text: [0, 0, 0] },
    { bg: [234, 196, 217], text: [0, 0, 0] },
    { bg: [255, 211, 165], text: [0, 0, 0] }
  ];

  const sectionColors = sectionConfig.colors
    ? sectionConfig.colors.map((color: { bg: string; text: string }) => ({
        bg: hexToRgb(color.bg),
        text: hexToRgb(color.text)
      }))
    : defaultSectionColors;

  addHeader();
  addFooter();

  const sectionPageLayout = sectionConfig.sectionPageLayout || 'separate-pages';

  if (sectionPageLayout === 'side-by-side') {
    drawSectionsSideBySide(
      doc,
      sections,
      answers,
      sectionColors,
      pageWidth,
      pageHeight,
      margin,
      usableWidth,
      bottomMargin,
      headerHeight,
      addHeader,
      addFooter,
      fonts
    );
  } else {
    sections.forEach((section, index) => {
      const color = sectionColors[index % sectionColors.length];

      if (index > 0) {
        doc.addPage();
        addHeader();
        addFooter();
      }

      drawSectionThreeColumn(
        doc,
        section,
        answers,
        color,
        index + 1,
        pageWidth,
        pageHeight,
        margin,
        usableWidth,
        bottomMargin,
        headerHeight,
        addHeader,
        addFooter,
        fonts
      );
    });
  }

  doc.save(`${form.title.replace(/\s+/g, '_')}_Response.pdf`);
}

interface HeadingGroup {
  heading: string;
  questions: Question[];
  answers: AnswerData[];
}

function groupQuestionsByHeading(
  section: Section,
  answers: AnswerData[]
): HeadingGroup[] {
  const groups: HeadingGroup[] = [];
  const allItems: Array<{ type: 'heading' | 'question'; data: SectionContent | Question; order: number }> = [];

  (section.section_content || []).forEach(content => {
    if (content.content_type === 'heading') {
      allItems.push({ type: 'heading', data: content, order: content.order_index });
    }
  });

  (section.questions || []).forEach(question => {
    allItems.push({ type: 'question', data: question, order: question.order_index });
  });

  allItems.sort((a, b) => a.order - b.order);

  let currentHeading = '';
  let currentQuestions: Question[] = [];

  allItems.forEach(item => {
    if (item.type === 'heading') {
      if (currentHeading && currentQuestions.length > 0) {
        const questionAnswers = currentQuestions
          .map(q => answers.find(a => a.question.id === q.id))
          .filter(a => a !== undefined) as AnswerData[];
        groups.push({ heading: currentHeading, questions: currentQuestions, answers: questionAnswers });
      }
      currentHeading = (item.data as SectionContent).content_text;
      currentQuestions = [];
    } else if (item.type === 'question') {
      currentQuestions.push(item.data as Question);
    }
  });

  if (currentHeading && currentQuestions.length > 0) {
    const questionAnswers = currentQuestions
      .map(q => answers.find(a => a.question.id === q.id))
      .filter(a => a !== undefined) as AnswerData[];
    groups.push({ heading: currentHeading, questions: currentQuestions, answers: questionAnswers });
  }

  return groups;
}

function calculateHeadingBoxHeight(
  doc: jsPDF,
  heading: string,
  answers: AnswerData[],
  width: number,
  fonts: any
): number {
  const padding = 6;
  const lineHeight = 3.5;
  const minHeight = 20;
  const topPadding = 8;

  const mainFont = fonts.mainFont || 'helvetica';

  doc.setFont(mainFont, 'bold');
  const headingLines = doc.splitTextToSize(`• ${heading}`, width - padding);
  const headingHeight = headingLines.length * lineHeight;

  doc.setFont(mainFont, 'normal');
  let totalAnswerHeight = 0;
  const arrowWidth = 4;

  answers.forEach(answer => {
    const answerValue = formatAnswerValue(answer.answer.answer_value);
    if (answerValue) {
      const answerLines = doc.splitTextToSize(answerValue, width - padding - arrowWidth);
      totalAnswerHeight += answerLines.length * lineHeight + 2;
    }
  });

  const totalContentHeight = topPadding + headingHeight + 4 + totalAnswerHeight + topPadding;

  return Math.max(minHeight, totalContentHeight);
}

function drawSectionThreeColumn(
  doc: jsPDF,
  section: Section,
  answers: AnswerData[],
  color: { bg: number[]; text: number[] },
  sectionNumber: number,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  usableWidth: number,
  bottomMargin: number,
  headerHeight: number,
  addHeader: () => void,
  addFooter: () => void,
  fonts: any
) {
  const columnGap = 5;
  const columnWidth = (usableWidth - columnGap * 2) / 3;
  const sectionHeaderHeight = 10;
  const sectionTitleMargin = 5;

  const headingGroups = groupQuestionsByHeading(section, answers);

  let currentY = headerHeight;
  let currentColumn = 0;
  const columnXPositions = [
    margin,
    margin + columnWidth + columnGap,
    margin + (columnWidth + columnGap) * 2
  ];

  const drawSectionHeader = (x: number, y: number, continued: boolean = false) => {
    doc.setFillColor(color.bg[0], color.bg[1], color.bg[2]);
    doc.rect(x, y, columnWidth, sectionHeaderHeight, 'F');

    const mainFont = fonts.mainFont || 'helvetica';
    const headingFontSize = fonts.headingFontSize || 11;
    const bodyFontSize = fonts.bodyFontSize || 8;

    doc.setTextColor(color.text[0], color.text[1], color.text[2]);
    doc.setFontSize(headingFontSize);
    doc.setFont(mainFont, 'bold');

    const sectionTitle = section.title.toUpperCase();
    const titleText = continued ? `${sectionTitle} (continued)` : sectionTitle;
    const numberText = String(sectionNumber).padStart(2, '0');

    doc.text(titleText, x + 3, y + 7);
    doc.text(numberText, x + columnWidth - 3, y + 7, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(bodyFontSize);
    doc.setFont(mainFont, 'normal');

    return y + sectionHeaderHeight + sectionTitleMargin;
  };

  currentY = drawSectionHeader(columnXPositions[0], currentY, false);

  headingGroups.forEach((group) => {
    const boxHeight = calculateHeadingBoxHeight(doc, group.heading, group.answers, columnWidth, fonts);

    if (currentY + boxHeight > pageHeight - bottomMargin) {
      if (currentColumn < 2) {
        currentColumn++;
        currentY = drawSectionHeader(columnXPositions[currentColumn], headerHeight, true);
      } else {
        doc.addPage();
        addHeader();
        addFooter();
        currentColumn = 0;
        currentY = headerHeight;
        currentY = drawSectionHeader(columnXPositions[currentColumn], currentY, true);
      }
    }

    const x = columnXPositions[currentColumn];

    drawHeadingBox(doc, group.heading, group.answers, x, currentY, columnWidth, boxHeight, fonts);

    currentY += boxHeight + 3;
  });
}

function drawSectionsSideBySide(
  doc: jsPDF,
  sections: Section[],
  answers: AnswerData[],
  sectionColors: Array<{ bg: number[]; text: number[] }>,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  usableWidth: number,
  bottomMargin: number,
  headerHeight: number,
  addHeader: () => void,
  addFooter: () => void,
  fonts: any
) {
  const sectionColumnGap = 8;
  const sectionColumnWidth = (usableWidth - sectionColumnGap * 2) / 3;

  let currentColumn = 0;
  let currentY = headerHeight;

  const columnXPositions = [
    margin,
    margin + sectionColumnWidth + sectionColumnGap,
    margin + (sectionColumnWidth + sectionColumnGap) * 2
  ];

  sections.forEach((section, sectionIndex) => {
    const color = sectionColors[sectionIndex % sectionColors.length];
    const sectionAnswers = answers.filter(a =>
      section.questions?.some(q => q.id === a.question.id)
    );

    const headingGroups = groupQuestionsByHeading(section, sectionAnswers);

    const sectionHeaderHeight = 10;
    const sectionTitleMargin = 5;

    if (currentY + sectionHeaderHeight > pageHeight - bottomMargin) {
      if (currentColumn < 2) {
        currentColumn++;
        currentY = headerHeight;
      } else {
        doc.addPage();
        addHeader();
        addFooter();
        currentColumn = 0;
        currentY = headerHeight;
      }
    }

    const x = columnXPositions[currentColumn];

    doc.setFillColor(color.bg[0], color.bg[1], color.bg[2]);
    doc.rect(x, currentY, sectionColumnWidth, sectionHeaderHeight, 'F');

    const mainFont = fonts.mainFont || 'helvetica';
    const headingFontSize = fonts.headingFontSize || 11;
    const bodyFontSize = fonts.bodyFontSize || 8;

    doc.setTextColor(color.text[0], color.text[1], color.text[2]);
    doc.setFontSize(headingFontSize);
    doc.setFont(mainFont, 'bold');

    const sectionTitle = section.title.toUpperCase();
    const numberText = String(sectionIndex + 1).padStart(2, '0');

    doc.text(sectionTitle, x + 3, currentY + 7);
    doc.text(numberText, x + sectionColumnWidth - 3, currentY + 7, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    currentY += sectionHeaderHeight + sectionTitleMargin;

    headingGroups.forEach((group) => {
      const boxHeight = calculateHeadingBoxHeight(doc, group.heading, group.answers, sectionColumnWidth, fonts);

      if (currentY + boxHeight > pageHeight - bottomMargin) {
        if (currentColumn < 2) {
          currentColumn++;
          currentY = headerHeight;
        } else {
          doc.addPage();
          addHeader();
          addFooter();
          currentColumn = 0;
          currentY = headerHeight;
        }
      }

      const currentX = columnXPositions[currentColumn];
      drawHeadingBox(doc, group.heading, group.answers, currentX, currentY, sectionColumnWidth, boxHeight, fonts);
      currentY += boxHeight + 3;
    });

    if (currentColumn < 2) {
      currentColumn++;
      currentY = headerHeight;
    } else {
      doc.addPage();
      addHeader();
      addFooter();
      currentColumn = 0;
      currentY = headerHeight;
    }
  });
}

function drawHeadingBox(
  doc: jsPDF,
  heading: string,
  answers: AnswerData[],
  x: number,
  y: number,
  width: number,
  height: number,
  fonts: any
) {
  doc.setDrawColor(200, 200, 200);
  doc.rect(x, y, width, height);

  const padding = 3;
  const lineHeight = 3.5;

  const mainFont = fonts.mainFont || 'helvetica';
  const headingFontSize = fonts.headingFontSize || 9;
  const bodyFontSize = fonts.bodyFontSize || 8;

  doc.setFont(mainFont, 'bold');
  doc.setFontSize(headingFontSize);
  const headingLines = doc.splitTextToSize(`• ${heading}`, width - (padding * 2));
  doc.text(headingLines, x + padding, y + padding + lineHeight);

  const headingTextHeight = headingLines.length * lineHeight;
  let currentY = y + padding + headingTextHeight + 4;

  doc.setFont(mainFont, 'normal');
  doc.setFontSize(bodyFontSize);

  answers.forEach(answer => {
    const answerValue = formatAnswerValue(answer.answer.answer_value);
    if (answerValue) {
      const arrowWidth = 4;
      const answerLines = doc.splitTextToSize(answerValue, width - (padding * 2) - arrowWidth);

      doc.setTextColor(100, 100, 100);
      doc.text('→', x + padding, currentY + lineHeight);

      doc.setTextColor(0, 0, 0);
      doc.text(answerLines, x + padding + arrowWidth, currentY + lineHeight);
      currentY += answerLines.length * lineHeight + 2;
    }
  });

  doc.setTextColor(0, 0, 0);
}

function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}
