import { useState } from 'react';
import { Palette, Layout, Type, Settings } from 'lucide-react';

interface PdfTemplate {
  header?: {
    showTitle?: boolean;
    showFounderName?: boolean;
    showLogo?: boolean;
    titleFontSize?: number;
    titleColor?: string;
  };
  footer?: {
    showCredit?: boolean;
    creditText?: string;
    fontSize?: number;
    textColor?: string;
  };
  sections?: {
    colors?: Array<{ bg: string; text: string }>;
    columnLayout?: 'three-column' | 'two-column' | 'single-column';
    columnGap?: number;
    showSectionNumbers?: boolean;
    sectionPageLayout?: 'separate-pages' | 'side-by-side';
  };
  layout?: {
    margin?: number;
    pageSize?: 'a2' | 'a3' | 'a4' | 'letter';
    orientation?: 'portrait' | 'landscape';
    headerHeight?: number;
    bottomMargin?: number;
  };
  fonts?: {
    mainFont?: string;
    headingFontSize?: number;
    bodyFontSize?: number;
  };
}

interface PdfTemplateEditorProps {
  template: PdfTemplate | null;
  onChange: (template: PdfTemplate | null) => void;
}

export default function PdfTemplateEditor({ template, onChange }: PdfTemplateEditorProps) {
  const [activeTab, setActiveTab] = useState<'header' | 'footer' | 'sections' | 'layout'>('header');
  const [useCustomTemplate, setUseCustomTemplate] = useState(!!template);

  const defaultTemplate: PdfTemplate = {
    header: {
      showTitle: true,
      showFounderName: true,
      showLogo: true,
      titleFontSize: 20,
      titleColor: '#505050',
    },
    footer: {
      showCredit: true,
      creditText: 'Credit: InnovChromatic',
      fontSize: 9,
      textColor: '#646464',
    },
    sections: {
      colors: [
        { bg: '#E8EA92', text: '#000000' },
        { bg: '#EAC4D9', text: '#000000' },
        { bg: '#FFD3A5', text: '#000000' },
      ],
      columnLayout: 'three-column',
      columnGap: 5,
      showSectionNumbers: true,
      sectionPageLayout: 'separate-pages',
    },
    layout: {
      margin: 20,
      pageSize: 'a2',
      orientation: 'landscape',
      headerHeight: 30,
      bottomMargin: 20,
    },
    fonts: {
      mainFont: 'helvetica',
      headingFontSize: 11,
      bodyFontSize: 10,
    },
  };

  const currentTemplate = template || defaultTemplate;

  const updateTemplate = (section: keyof PdfTemplate, updates: any) => {
    const newTemplate = {
      ...currentTemplate,
      [section]: {
        ...currentTemplate[section],
        ...updates,
      },
    };
    onChange(newTemplate);
  };

  const handleToggleCustomTemplate = (enabled: boolean) => {
    setUseCustomTemplate(enabled);
    onChange(enabled ? defaultTemplate : null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">PDF Template Settings</h2>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-600">Use Custom Template</span>
          <input
            type="checkbox"
            checked={useCustomTemplate}
            onChange={(e) => handleToggleCustomTemplate(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>

      {useCustomTemplate && (
        <>
          <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('header')}
              className={`px-3 sm:px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'header'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Layout className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span className="text-xs sm:text-base">Header</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('footer')}
              className={`px-3 sm:px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'footer'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Layout className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span className="text-xs sm:text-base">Footer</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className={`px-3 sm:px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'sections'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Palette className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span className="text-xs sm:text-base">Sections</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`px-3 sm:px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'layout'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Type className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                <span className="text-xs sm:text-base">Layout & Fonts</span>
              </div>
            </button>
          </div>

          <div className="space-y-4">
            {activeTab === 'header' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">Header Settings</h3>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentTemplate.header?.showTitle ?? true}
                    onChange={(e) => updateTemplate('header', { showTitle: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Form Title</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentTemplate.header?.showFounderName ?? true}
                    onChange={(e) => updateTemplate('header', { showFounderName: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Founder Name</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentTemplate.header?.showLogo ?? true}
                    onChange={(e) => updateTemplate('header', { showLogo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Logo</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title Font Size
                  </label>
                  <input
                    type="number"
                    value={currentTemplate.header?.titleFontSize ?? 20}
                    onChange={(e) => updateTemplate('header', { titleFontSize: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="12"
                    max="36"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={currentTemplate.header?.titleColor ?? '#505050'}
                      onChange={(e) => updateTemplate('header', { titleColor: e.target.value })}
                      className="w-10 sm:w-12 h-8 sm:h-10 border border-gray-300 rounded cursor-pointer flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={currentTemplate.header?.titleColor ?? '#505050'}
                      onChange={(e) => updateTemplate('header', { titleColor: e.target.value })}
                      className="flex-1 min-w-0 px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="#505050"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'footer' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">Footer Settings</h3>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentTemplate.footer?.showCredit ?? true}
                    onChange={(e) => updateTemplate('footer', { showCredit: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Footer Credit</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Credit Text
                  </label>
                  <input
                    type="text"
                    value={currentTemplate.footer?.creditText ?? 'Credit:  '}
                    onChange={(e) => updateTemplate('footer', { creditText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Font Size
                  </label>
                  <input
                    type="number"
                    value={currentTemplate.footer?.fontSize ?? 9}
                    onChange={(e) => updateTemplate('footer', { fontSize: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="6"
                    max="14"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Text Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={currentTemplate.footer?.textColor ?? '#646464'}
                      onChange={(e) => updateTemplate('footer', { textColor: e.target.value })}
                      className="w-10 sm:w-12 h-8 sm:h-10 border border-gray-300 rounded cursor-pointer flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={currentTemplate.footer?.textColor ?? '#646464'}
                      onChange={(e) => updateTemplate('footer', { textColor: e.target.value })}
                      className="flex-1 min-w-0 px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="#646464"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sections' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">Section Settings</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section Page Layout
                  </label>
                  <select
                    value={currentTemplate.sections?.sectionPageLayout ?? 'separate-pages'}
                    onChange={(e) => updateTemplate('sections', { sectionPageLayout: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="separate-pages">Each Section on Separate Page</option>
                    <option value="side-by-side">Sections Side-by-Side (3 columns)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Column Layout (within sections)
                  </label>
                  <select
                    value={currentTemplate.sections?.columnLayout ?? 'three-column'}
                    onChange={(e) => updateTemplate('sections', { columnLayout: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="single-column">Single Column</option>
                    <option value="two-column">Two Columns</option>
                    <option value="three-column">Three Columns</option>
                  </select>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentTemplate.sections?.showSectionNumbers ?? true}
                    onChange={(e) => updateTemplate('sections', { showSectionNumbers: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Section Numbers</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section Colors
                  </label>
                  {(currentTemplate.sections?.colors ?? []).map((color, index) => (
                    <div key={index} className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Section {index + 1}</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 w-12 flex-shrink-0">BG:</label>
                          <input
                            type="color"
                            value={color.bg}
                            onChange={(e) => {
                              const newColors = [...(currentTemplate.sections?.colors ?? [])];
                              newColors[index] = { ...newColors[index], bg: e.target.value };
                              updateTemplate('sections', { colors: newColors });
                            }}
                            className="w-8 sm:w-10 h-8 border border-gray-300 rounded cursor-pointer flex-shrink-0"
                          />
                          <input
                            type="text"
                            value={color.bg}
                            onChange={(e) => {
                              const newColors = [...(currentTemplate.sections?.colors ?? [])];
                              newColors[index] = { ...newColors[index], bg: e.target.value };
                              updateTemplate('sections', { colors: newColors });
                            }}
                            className="flex-1 min-w-0 px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="#E8EA92"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 w-12 flex-shrink-0">Text:</label>
                          <input
                            type="color"
                            value={color.text}
                            onChange={(e) => {
                              const newColors = [...(currentTemplate.sections?.colors ?? [])];
                              newColors[index] = { ...newColors[index], text: e.target.value };
                              updateTemplate('sections', { colors: newColors });
                            }}
                            className="w-8 sm:w-10 h-8 border border-gray-300 rounded cursor-pointer flex-shrink-0"
                          />
                          <input
                            type="text"
                            value={color.text}
                            onChange={(e) => {
                              const newColors = [...(currentTemplate.sections?.colors ?? [])];
                              newColors[index] = { ...newColors[index], text: e.target.value };
                              updateTemplate('sections', { colors: newColors });
                            }}
                            className="flex-1 min-w-0 px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'layout' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">Layout & Font Settings</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Page Size
                  </label>
                  <select
                    value={currentTemplate.layout?.pageSize ?? 'a2'}
                    onChange={(e) => updateTemplate('layout', { pageSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="a2">A2 (420 x 594 mm)</option>
                    <option value="a3">A3 (297 x 420 mm)</option>
                    <option value="a4">A4 (210 x 297 mm)</option>
                    <option value="letter">Letter (216 x 279 mm)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Orientation
                  </label>
                  <select
                    value={currentTemplate.layout?.orientation ?? 'portrait'}
                    onChange={(e) => updateTemplate('layout', { orientation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Margin (mm)
                  </label>
                  <input
                    type="number"
                    value={currentTemplate.layout?.margin ?? 20}
                    onChange={(e) => updateTemplate('layout', { margin: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="10"
                    max="40"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heading Font Size
                  </label>
                  <input
                    type="number"
                    value={currentTemplate.fonts?.headingFontSize ?? 11}
                    onChange={(e) => updateTemplate('fonts', { headingFontSize: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="8"
                    max="18"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Body Font Size
                  </label>
                  <input
                    type="number"
                    value={currentTemplate.fonts?.bodyFontSize ?? 10}
                    onChange={(e) => updateTemplate('fonts', { bodyFontSize: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="7"
                    max="14"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
