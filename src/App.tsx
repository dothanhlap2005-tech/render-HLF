import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Sparkles, 
  ArrowRight, 
  Check, 
  RotateCcw, 
  Layers, 
  Info,
  Maximize2,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  InteriorStyle, 
  DesignState, 
  RoomAnalysis, 
  LightingMode, 
  ShadowIntensity, 
  ColorTemp, 
  LightDirection, 
  CameraLens, 
  RenderEngine,
  RoomType,
  TimeOfDay
} from './types';
import { analyzeRoomImage, generateRestyledRoom } from './services/geminiService';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

const STORAGE_KEY = 'archivision_user_prefs';

const ROOM_TYPE_MAPPING: Record<RoomType, string> = {
  'Auto-detect': 'Tự động nhận diện',
  'Living Room': 'Phòng khách (Living Room)',
  'Bedroom': 'Phòng ngủ (Bedroom)',
  'Kitchen': 'Nhà bếp (Kitchen)',
  'Bathroom': 'Phòng tắm (Bathroom)',
  'Dining Room': 'Phòng ăn (Dining Room)',
  'Office': 'Văn phòng (Office)',
  'Commercial Space': 'Không gian thương mại'
};

const TIME_OF_DAY_MAPPING: Record<TimeOfDay, string> = {
  'Morning': 'Sáng sớm (Morning)',
  'Noon': 'Buổi trưa (Noon / Daylight)',
  'Golden Hour': 'Hoàng hôn (Golden Hour)',
  'Blue Hour': 'Chiều tà (Blue Hour)',
  'Night': 'Ban đêm (Night)'
};

const STYLE_MAPPING: Record<InteriorStyle, string> = {
  'Original': 'Giữ nguyên (Original)',
  'Scandinavian': 'Bắc Âu (Scandinavian)',
  'Industrial': 'Công nghiệp (Industrial)',
  'Minimalist': 'Tối giản (Minimalist)',
  'Mid-Century Modern': 'Hiện đại giữa thế kỷ (Mid-Century)',
  'Bohemian': 'Du mục (Bohemian)',
  'Japandi': 'Japandi'
};

const LIGHTING_MAPPING: Record<LightingMode, { label: string, prompt: string }> = {
  'Daylight': { label: 'Ban ngày (Bright Day)', prompt: 'bright natural daylight, sunbeams' },
  'Night': { label: 'Buổi tối (Cosy Night)', prompt: 'warm evening lighting, indoor lamps, cozy atmosphere' },
  'Golden Hour': { label: 'Hoàng hôn (Sunset)', prompt: 'golden hour sunset lighting, long shadows, warm glow' },
  'Cinematic': { label: 'Điện ảnh (Studio)', prompt: 'cinematic studio lighting, high contrast, dramatic shadows' }
};

const SHADOW_MAPPING: Record<ShadowIntensity, string> = {
  'Soft': 'soft diffused shadows',
  'Moderate': 'natural balanced shadows',
  'Strong': 'sharp dramatic high-contrast shadows'
};

const TEMP_MAPPING: Record<ColorTemp, string> = {
  'Warm': 'warm cozy color temperature (3000K)',
  'Neutral': 'neutral natural color temperature (4500K)',
  'Cool': 'cool crisp color temperature (6000K)'
};

const DIRECTION_MAPPING: Record<LightDirection, string> = {
  'Left': 'lighting coming from the left',
  'Right': 'lighting coming from the right',
  'Front': 'direct frontal lighting',
  'Top': 'overhead top-down lighting'
};

export default function App() {
  // Load saved preferences
  const getInitialPrefs = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved preferences');
    }
    return {
      selectedStyle: 'Scandinavian',
      roomType: 'Auto-detect',
      timeOfDay: 'Noon',
      lightingMode: 'Daylight',
      shadowIntensity: 'Moderate',
      colorTemp: 'Neutral',
      lightDirection: 'Left',
      cameraLens: 'Standard 35mm',
      renderEngine: 'Corona Render',
      preserveLayout: true,
      preserveMaterials: false,
      addDecor: false,
      addLEDs: false,
      aiEngine: 'gemini',
      negativePrompt: ''
    };
  };

  const initialPrefs = getInitialPrefs();

  const [state, setState] = useState<DesignState>({
    originalImage: null,
    analysis: null,
    selectedStyle: initialPrefs.selectedStyle as InteriorStyle,
    roomType: (initialPrefs.roomType || 'Auto-detect') as RoomType,
    timeOfDay: (initialPrefs.timeOfDay || 'Noon') as TimeOfDay,
    lightingMode: initialPrefs.lightingMode as LightingMode,
    shadowIntensity: initialPrefs.shadowIntensity as ShadowIntensity,
    colorTemp: initialPrefs.colorTemp as ColorTemp,
    lightDirection: initialPrefs.lightDirection as LightDirection,
    cameraLens: initialPrefs.cameraLens || 'Standard 35mm',
    renderEngine: initialPrefs.renderEngine || 'Corona Render',
    preserveLayout: initialPrefs.preserveLayout ?? true,
    preserveMaterials: initialPrefs.preserveMaterials ?? false,
    addDecor: initialPrefs.addDecor ?? false,
    addLEDs: initialPrefs.addLEDs ?? false,
    aiEngine: initialPrefs.aiEngine as 'gemini' | 'replicate' || 'gemini',
    customPrompt: '',
    negativePrompt: initialPrefs.negativePrompt || '',
    isAnalyzing: false,
    isGenerating: false,
    resultImage: null,
    error: null,
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'basic': true,
    'advanced': false,
    'lighting': false,
    'camera': false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({...prev, [section]: !prev[section]}));
  };

  // Save preferences when they change
  useEffect(() => {
    const prefs = {
      selectedStyle: state.selectedStyle,
      roomType: state.roomType,
      timeOfDay: state.timeOfDay,
      lightingMode: state.lightingMode,
      shadowIntensity: state.shadowIntensity,
      colorTemp: state.colorTemp,
      lightDirection: state.lightDirection,
      cameraLens: state.cameraLens,
      renderEngine: state.renderEngine,
      preserveLayout: state.preserveLayout,
      preserveMaterials: state.preserveMaterials,
      addDecor: state.addDecor,
      addLEDs: state.addLEDs,
      aiEngine: state.aiEngine,
      negativePrompt: state.negativePrompt
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [
    state.selectedStyle, 
    state.roomType,
    state.timeOfDay,
    state.lightingMode, 
    state.shadowIntensity, 
    state.colorTemp, 
    state.lightDirection, 
    state.cameraLens,
    state.renderEngine,
    state.preserveLayout,
    state.preserveMaterials,
    state.addDecor,
    state.addLEDs,
    state.aiEngine,
    state.negativePrompt
  ]);

  // Automatically update suggested prompt when style or layout changes, 
  // but only if the user hasn't manually edited it significantly yet
  const syncPrompt = (
    analysis: RoomAnalysis | null, 
    s: DesignState
  ) => {
    if (!analysis) return '';
    const styleName = s.selectedStyle === 'Original' ? 'high-end interior materials' : `${s.selectedStyle} interior design style`;
    const lightingBase = LIGHTING_MAPPING[s.lightingMode].prompt;
    const shadowP = SHADOW_MAPPING[s.shadowIntensity];
    const tempP = TEMP_MAPPING[s.colorTemp];
    const directionP = DIRECTION_MAPPING[s.lightDirection];
    
    // Technical camera tokens
    const qualityTokens = `masterpiece, best quality, ultra-detailed, photorealistic, 8k resolution, raw photo, architectural photography, shot on ${s.cameraLens} lens, ${s.renderEngine}, global illumination, ray tracing, sharp focus`;
    
    let promptParts = [];
    
    // Core Subject
    if (s.roomType !== 'Auto-detect') {
      promptParts.push(`A highly detailed professional architectural visualization of a ${s.roomType.toLowerCase()}`);
    } else {
      promptParts.push(`A highly detailed professional architectural visualization of an interior space`);
    }

    // Action and Style
    if (s.preserveLayout) {
      if (s.preserveMaterials || s.selectedStyle === 'Original') {
        promptParts.push(`enhancing lighting and overall image quality while strictly preserving the existing layout, exact furniture, original materials, and colors`);
      } else {
        promptParts.push(`redesigned in a gorgeous ${styleName}, completely transforming materials, texturing, and surfaces while strictly keeping the exact furniture placement and structural layout`);
      }
    } else {
      promptParts.push(`completely reimagined and remodeled in a stunning ${styleName}, featuring premium furniture arrangements and high-end finishes`);
    }

    // Decor & Details
    if (s.addDecor) promptParts.push('curated with tasteful designer interior decor, elegant art pieces, and vibrant indoor plants');
    if (s.addLEDs) promptParts.push('illuminated by stylish ambient LED strip lights, colorful neon accents, and modern architectural lighting fixtures');

    // Lighting Situation
    const litTime = s.timeOfDay !== 'Noon' ? `captured during ${s.timeOfDay.toLowerCase()}` : 'captured with balanced daylight';
    promptParts.push(`${litTime}`);
    promptParts.push(`featuring ${lightingBase.toLowerCase()} with ${shadowP.toLowerCase()} shadows`);
    promptParts.push(`overall color temperature is ${tempP.toLowerCase()}`);
    promptParts.push(`main light source directed from the ${directionP.toLowerCase()}`);

    // Specific Scene base
    promptParts.push(`scene details include: ${analysis.suggestedPrompt}`);

    // Append technical details
    promptParts.push(qualityTokens);

    return promptParts.join(', ') + '.';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setState(prev => ({
        ...prev,
        originalImage: event.target?.result as string,
        analysis: null,
        customPrompt: '',
        resultImage: null,
        error: null
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!state.originalImage) return;
    setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
    
    try {
      const analysis = await analyzeRoomImage(state.originalImage);
      const initialPrompt = syncPrompt(
        analysis, 
        state.selectedStyle, 
        state.preserveLayout, 
        state.lightingMode,
        state.shadowIntensity,
        state.colorTemp,
        state.lightDirection,
        state.cameraLens,
        state.renderEngine,
        state.preserveMaterials,
        state.addDecor,
        state.addLEDs
      );
      setState(prev => ({ 
        ...prev, 
        analysis, 
        customPrompt: initialPrompt,
        isAnalyzing: false,
        error: null // Clear any previous error
      }));
    } catch (err: any) {
      console.error("Analysis error caught:", err);
      let errorMessage = 'Không thể phân tích hình ảnh. Vui lòng thử lại.';
      const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      
      if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'Giới hạn phân tích AI hôm nay đã hết. Vui lòng quay lại sau 24h.';
      }
      
      setState(prev => ({ 
        ...prev, 
        isAnalyzing: false, 
        error: errorMessage 
      }));
    }
  };

  const handleGenerate = async () => {
    if (!state.originalImage || !state.analysis) return;
    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const result = await generateRestyledRoom(
        state.originalImage,
        state.analysis,
        state.selectedStyle,
        state.preserveLayout,
        state.customPrompt,
        state.aiEngine,
        state.cameraLens,
        state.renderEngine,
        state.preserveMaterials,
        state.addDecor,
        state.addLEDs
      );
      setState(prev => ({ ...prev, resultImage: result, isGenerating: false, error: null }));
    } catch (err: any) {
      console.error("Generation error details:", err);
      let errorMessage = 'Quá trình chuyển đổi thất bại. Vui lòng thử lại.';
      const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      
      if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'Hết lượt sử dụng AI hôm nay (Quota 1k/ngày). Vui lòng quay lại sau 24h hoặc đổi tài khoản.';
      } else if (errStr.includes('safety') || errStr.includes('blocked')) {
        errorMessage = 'Hình ảnh bị chặn bởi bộ lọc an toàn của AI. Hãy thử phong cách hoặc ảnh khác.';
      } else if (errStr.includes('fetch') || errStr.includes('network')) {
        errorMessage = 'Lỗi kết nối mạng. Hãy kiểm tra lại đường truyền.';
      }
      
      setState(prev => ({ ...prev, isGenerating: false, error: errorMessage }));
    }
  };

  const reset = () => {
    setState({
      originalImage: null,
      analysis: null,
      selectedStyle: 'Scandinavian',
      lightingMode: 'Daylight',
      shadowIntensity: 'Moderate',
      colorTemp: 'Neutral',
      lightDirection: 'Left',
      cameraLens: 'Standard 35mm',
      renderEngine: 'Corona Render',
      preserveLayout: true,
      preserveMaterials: false,
      addDecor: false,
      addLEDs: false,
      aiEngine: 'gemini',
      customPrompt: '',
      isAnalyzing: false,
      isGenerating: false,
      resultImage: null,
      error: null,
    });
  };

  const handleStateChange = (updates: Partial<DesignState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      const newPrompt = syncPrompt(newState.analysis, newState);
      return { ...newState, customPrompt: newPrompt };
    });
  };

  const downloadImage = async (resolution: number) => {
    if (!state.resultImage) return;

    const img = new Image();
    img.src = state.resultImage;
    await new Promise((resolve) => (img.onload = resolve));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate aspect ratio
    const ratio = img.height / img.width;
    canvas.width = resolution;
    canvas.height = resolution * ratio;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const link = document.createElement('a');
    link.download = `archivision-${state.selectedStyle.toLowerCase()}-${resolution}p.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const [showResMenu, setShowResMenu] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-brand selection:text-black">
      {/* Header */}
      <header className="border-b border-white/10 py-6 px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand rounded-sm flex items-center justify-center">
            <Layers className="text-black w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter uppercase italic">
            NỘI THẤT HLF <span className="opacity-40">AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <span className="mono-label hidden md:block">Trạng thái hệ thống: Tối ưu</span>
          <button 
            onClick={reset}
            className="p-2 hover:bg-white/5 rounded-full transition-colors group"
          >
            <RotateCcw className="w-5 h-5 opacity-40 group-hover:opacity-100" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input/Editor */}
        <div className="lg:col-span-7 space-y-8">
          <section className="glass-panel p-6 neon-glow overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
              <Upload className="w-24 h-24" />
            </div>
            
            <h2 className="text-lg mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
              Chụp ảnh không gian gốc
            </h2>

            {!state.originalImage ? (
              <label 
                className="border-2 border-dashed border-white/10 rounded-xl h-[400px] flex flex-col items-center justify-center cursor-pointer hover:border-brand/40 hover:bg-brand/5 transition-all group"
                id="dropzone"
              >
                <div className="p-4 bg-white/5 rounded-full mb-4 group-hover:bg-brand/10 transition-colors">
                  <Upload className="w-8 h-8 text-white/40 group-hover:text-brand transition-colors" />
                </div>
                <p className="font-mono text-sm opacity-60">KÉO ẢNH VÀO HOẶC NHẤP ĐỂ CHỌN</p>
                <p className="text-[10px] opacity-30 mt-2">HỖ TRỢ: PNG, JPG, WEBP</p>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileUpload}
                  id="file-input"
                />
              </label>
            ) : (
              <div className="relative rounded-xl overflow-hidden group">
                <img 
                  src={state.originalImage} 
                  alt="Phòng gốc" 
                  className="w-full h-[400px] object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button 
                    onClick={() => setState(prev => ({ ...prev, originalImage: null }))}
                    className="bg-white/10 hover:bg-red-500/80 backdrop-blur px-4 py-2 rounded-lg text-xs font-mono transition-colors"
                  >
                    GỠ BỎ
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Analysis View */}
          <AnimatePresence>
            {state.analysis && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6 space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h2 className="mono-label">Giải mã bối cảnh AI</h2>
                  <div className="h-px bg-white/10 flex-1 mx-4" />
                  <Sparkles className="w-4 h-4 text-brand opacity-60" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] opacity-40 uppercase font-mono">Kiến trúc</span>
                    <p className="text-sm font-medium leading-relaxed">{state.analysis.architecture}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] opacity-40 uppercase font-mono">Ánh sáng</span>
                    <p className="text-sm font-medium capitalize">{state.analysis.lighting}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] opacity-40 uppercase font-mono">Sàn nhà</span>
                    <p className="text-sm font-medium capitalize">{state.analysis.flooring}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] opacity-40 uppercase font-mono">Yếu tố chính</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {state.analysis.structuralElements.map((el, i) => (
                        <span key={i} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded border border-white/5 uppercase">
                          {el}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <span className="text-[10px] opacity-40 uppercase font-mono">Gợi ý tạo ảnh (AI Prompt)</span>
                  <div className="mt-2 relative">
                    <textarea 
                      value={state.customPrompt}
                      onChange={(e) => setState(prev => ({ ...prev, customPrompt: e.target.value }))}
                      className="w-full bg-black/40 rounded border border-white/10 p-3 text-[11px] font-mono opacity-80 leading-relaxed focus:border-brand/40 focus:ring-0 outline-none min-h-[160px] resize-none"
                    />
                    <div className="absolute top-2 right-2 opacity-20">
                      <Info className="w-3 h-3" />
                    </div>
                  </div>
                  <p className="text-[9px] opacity-30 mt-1 italic leading-tight">
                    * Bạn có thể thêm các yêu cầu cụ thể như "add yellow pillows" hoặc "dark oak floor" vào phần gợi ý này.
                  </p>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Style & Control */}
        <div className="lg:col-span-5 space-y-6">
          <section className="glass-panel p-6 sticky top-8">
            <h2 className="text-sm font-mono uppercase tracking-widest opacity-40 mb-8">Thông số thiết kế</h2>

            <div className="space-y-8">
            <div className="space-y-2">
              {/* Basic Settings */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                <button 
                  onClick={() => toggleSection('basic')}
                  className="w-full p-4 flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <span className="mono-label">1. CƠ BẢN (BASIC)</span>
                  {expandedSections['basic'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections['basic'] && (
                  <div className="p-4 pt-0 space-y-6">
                    <div>
                      <label className="mono-label mb-3 block">1.1 Thẩm mỹ nội thất</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(STYLE_MAPPING) as InteriorStyle[]).map((styleKey) => (
                          <button
                            key={styleKey}
                            onClick={() => handleStateChange({ selectedStyle: styleKey })}
                            className={`
                              text-left p-3 rounded-lg border text-sm transition-all relative overflow-hidden group
                              ${state.selectedStyle === styleKey 
                                ? 'bg-brand/10 border-brand text-brand' 
                                : 'bg-white/5 border-white/10 hover:border-white/30'}
                            `}
                          >
                            {STYLE_MAPPING[styleKey]}
                            {state.selectedStyle === styleKey && (
                              <div className="absolute top-1 right-1">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mono-label mb-3 block">1.2 Loại phòng</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(ROOM_TYPE_MAPPING) as RoomType[]).map((rt) => (
                          <button
                            key={rt}
                            onClick={() => handleStateChange({ roomType: rt })}
                            className={`
                              text-left p-2.5 rounded border text-[11px] transition-all
                              ${state.roomType === rt 
                                ? 'bg-brand/10 border-brand text-brand font-medium' 
                                : 'bg-white/5 border-white/10 hover:border-white/30 text-white/60'}
                            `}
                          >
                            {ROOM_TYPE_MAPPING[rt]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lighting Settings */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                <button 
                  onClick={() => toggleSection('lighting')}
                  className="w-full p-4 flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <span className="mono-label">2. ÁNH SÁNG (LIGHTING)</span>
                  {expandedSections['lighting'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections['lighting'] && (
                  <div className="p-4 pt-0 space-y-6">
                    <div>
                      <label className="mono-label mb-3 block">2.1 Chế độ ánh sáng</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(LIGHTING_MAPPING) as LightingMode[]).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => handleStateChange({ lightingMode: mode })}
                            className={`
                              text-left p-2.5 rounded border text-[11px] transition-all relative overflow-hidden
                              ${state.lightingMode === mode 
                                ? 'bg-brand/10 border-brand text-brand font-medium' 
                                : 'bg-white/5 border-white/10 hover:border-white/30 text-white/60'}
                            `}
                          >
                            {LIGHTING_MAPPING[mode].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mono-label mb-3 block">2.2 Thời gian chiếu sáng</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(TIME_OF_DAY_MAPPING) as TimeOfDay[]).map((tod) => (
                          <button
                            key={tod}
                            onClick={() => handleStateChange({ timeOfDay: tod })}
                            className={`
                              text-left p-2.5 rounded border text-[11px] transition-all
                              ${state.timeOfDay === tod 
                                ? 'bg-brand/10 border-brand text-brand font-medium' 
                                : 'bg-white/5 border-white/10 hover:border-white/30 text-white/60'}
                            `}
                          >
                            {TIME_OF_DAY_MAPPING[tod]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mono-label mb-3 block">2.3 Chi tiết ánh sáng</label>
                      <div className="space-y-4 border-l-2 border-brand/20 pl-3">
                        <div>
                          <p className="text-[10px] opacity-60 mb-2">Cường độ bóng</p>
                          <div className="flex gap-2">
                            {(Object.keys(SHADOW_MAPPING) as ShadowIntensity[]).map((intensity) => (
                              <button
                                key={intensity}
                                onClick={() => handleStateChange({ shadowIntensity: intensity })}
                                className={`flex-1 py-1.5 rounded text-[10px] border transition-all ${state.shadowIntensity === intensity ? 'bg-brand/10 border-brand text-brand' : 'bg-white/5 border-white/10 opacity-50'}`}
                              >
                                {intensity === 'Soft' ? 'Mềm' : intensity === 'Moderate' ? 'Vừa' : 'Mạnh'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] opacity-60 mb-2">Nhiệt độ màu</p>
                          <div className="flex gap-2">
                            {(Object.keys(TEMP_MAPPING) as ColorTemp[]).map((temp) => (
                              <button
                                key={temp}
                                onClick={() => handleStateChange({ colorTemp: temp })}
                                className={`flex-1 py-1.5 rounded text-[10px] border transition-all ${state.colorTemp === temp ? (temp === 'Warm' ? 'bg-orange-500/20 border-orange-500 text-orange-500' : temp === 'Cool' ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'bg-white/20 border-white text-white') : 'bg-white/5 border-white/10 opacity-50'}`}
                              >
                                {temp === 'Warm' ? 'Ấm' : temp === 'Neutral' ? 'Trung tính' : 'Lạnh'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] opacity-60 mb-2">Hướng sáng</p>
                          <div className="grid grid-cols-4 gap-2">
                            {(Object.keys(DIRECTION_MAPPING) as LightDirection[]).map((dir) => (
                              <button
                                key={dir}
                                onClick={() => handleStateChange({ lightDirection: dir })}
                                className={`py-1.5 rounded text-[10px] border transition-all ${state.lightDirection === dir ? 'bg-brand/10 border-brand text-brand' : 'bg-white/5 border-white/10 opacity-50'}`}
                              >
                                {dir === 'Left' ? 'Trái' : dir === 'Right' ? 'Phải' : dir === 'Front' ? 'Trước' : 'Trên'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Settings */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                <button 
                  onClick={() => toggleSection('advanced')}
                  className="w-full p-4 flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <span className="mono-label">3. NÂNG CAO (ADVANCED)</span>
                  {expandedSections['advanced'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections['advanced'] && (
                  <div className="p-4 pt-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="mono-label">3.1 Giữ nguyên bố cục</label>
                        <p className="text-[10px] opacity-40 mt-1">Chỉ thay đổi vật liệu & màu sắc</p>
                      </div>
                      <button 
                        onClick={() => handleStateChange({ preserveLayout: !state.preserveLayout })}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ml-4 ${state.preserveLayout ? 'bg-brand' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${state.preserveLayout ? 'right-1 bg-black' : 'left-1 bg-white/40'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="mono-label">3.2 Giữ nguyên vật liệu</label>
                        <p className="text-[10px] opacity-40 mt-1">Không thay đổi vật liệu & màu sắc</p>
                      </div>
                      <button 
                        onClick={() => handleStateChange({ preserveMaterials: !state.preserveMaterials })}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ml-4 ${state.preserveMaterials ? 'bg-brand' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${state.preserveMaterials ? 'right-1 bg-black' : 'left-1 bg-white/40'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="mono-label">3.3 Thêm đồ decor</label>
                        <p className="text-[10px] opacity-40 mt-1">Thêm tranh ảnh, cây cảnh, đồ trang trí</p>
                      </div>
                      <button 
                        onClick={() => handleStateChange({ addDecor: !state.addDecor })}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ml-4 ${state.addDecor ? 'bg-brand' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${state.addDecor ? 'right-1 bg-black' : 'left-1 bg-white/40'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="mono-label">3.4 Thêm đèn LEDs/Neon</label>
                        <p className="text-[10px] opacity-40 mt-1">Bổ sung ánh sáng led viền trang trí</p>
                      </div>
                      <button 
                        onClick={() => handleStateChange({ addLEDs: !state.addLEDs })}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ml-4 ${state.addLEDs ? 'bg-brand' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${state.addLEDs ? 'right-1 bg-black' : 'left-1 bg-white/40'}`} />
                      </button>
                    </div>

                    <div className="pt-2">
                       <label className="mono-label mb-2 block">3.5 Loại trừ yếu tố (Negative Prompt)</label>
                       <textarea 
                          value={state.negativePrompt}
                          onChange={(e) => handleStateChange({ negativePrompt: e.target.value })}
                          placeholder="Ví dụ: no people, no plants, no messy clutter..."
                          className="w-full bg-black/40 rounded border border-white/10 p-2 text-xs font-mono opacity-80 min-h-[60px] resize-none focus:border-brand/40 focus:ring-0 outline-none"
                       />
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Specs */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                <button 
                  onClick={() => toggleSection('camera')}
                  className="w-full p-4 flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <span className="mono-label">4. MÁY ẢNH & AI (CAMERA)</span>
                  {expandedSections['camera'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSections['camera'] && (
                  <div className="p-4 pt-0 space-y-6">
                    <div>
                      <div className="flex items-center gap-1 mb-3">
                        <label className="mono-label">4.1 Ống kính (Lens)</label>
                        <div className="group relative">
                          <Info className="w-3 h-3 opacity-50 cursor-help" />
                          <div className="absolute min-w-[200px] left-1/2 -translate-x-1/2 bottom-full mb-2 bg-black/90 text-white text-[10px] p-2 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-10 border border-white/10 leading-relaxed font-sans">
                            Các loại ống kính quyết định góc nhìn và chiều sâu ảnh.
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Standard 35mm', 'Wide 24mm', 'Ultra-wide 16mm', 'Telephoto 85mm', 'Cinematic Anamorphic'] as CameraLens[]).map((lens) => (
                          <button
                            key={lens}
                            onClick={() => handleStateChange({ cameraLens: lens })}
                            className={`py-2 rounded text-[10px] border transition-all text-center ${state.cameraLens === lens ? 'bg-brand/10 border-brand text-brand' : 'bg-white/5 border-white/10 opacity-50 hover:bg-white/10 hover:opacity-100'}`}
                          >
                            {lens}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mono-label mb-3 block">4.2 Render Engine Simulator</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Corona Render', 'V-Ray', 'Octane Render', 'Unreal Engine 5 (Lumen)', 'Redshift'] as RenderEngine[]).map((engine) => (
                          <button
                            key={engine}
                            onClick={() => handleStateChange({ renderEngine: engine })}
                            className={`py-2 rounded text-[10px] border transition-all text-center ${state.renderEngine === engine ? 'bg-brand/10 border-brand text-brand' : 'bg-white/5 border-white/10 opacity-50 hover:bg-white/10 hover:opacity-100'}`}
                          >
                            {engine}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-white/5">
                      <label className="mono-label mb-3 block">4.3 Lõi AI (AI Engine)</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStateChange({ aiEngine: 'gemini' })}
                          className={`flex-1 py-2 rounded text-[11px] border transition-all font-medium ${state.aiEngine === 'gemini' ? 'bg-brand/10 border-brand text-brand' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'}`}
                        >
                          Gemini 2.5 Flash
                        </button>
                        <button
                          onClick={() => handleStateChange({ aiEngine: 'replicate' })}
                          className={`flex-1 py-2 rounded text-[11px] border transition-all font-medium flex items-center justify-center gap-1 ${state.aiEngine === 'replicate' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'}`}
                        >
                          <Sparkles className="w-3 h-3" /> SDXL (Replicate)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                {!state.analysis ? (
                  <button 
                    disabled={!state.originalImage || state.isAnalyzing}
                    onClick={handleAnalyze}
                    className="w-full bg-white text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:hover:scale-100"
                  >
                    {state.isAnalyzing ? <div className="loading-spinner" /> : <Sparkles className="w-5 h-5" />}
                    {state.isAnalyzing ? 'ĐANG GIẢI MÃ...' : 'PHÂN TÍCH ẢNH'}
                  </button>
                ) : (
                  <button 
                    disabled={state.isGenerating}
                    onClick={handleGenerate}
                    className="w-full bg-brand text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {state.isGenerating ? <div className="loading-spinner" /> : <Layers className="w-5 h-5" />}
                    {state.isGenerating ? 'ĐANG TẠO THIẾT KẾ...' : 'TẠO PHỐI CẢNH MỚI'}
                  </button>
                )}

                {state.error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-xs text-red-400 flex gap-2 items-center">
                    <Info className="w-4 h-4 shrink-0" />
                    {state.error}
                  </div>
                )}
              </div>
            </div>

            {/* Results Preview (Small) */}
            {state.resultImage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 pt-8 border-t border-white/10"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="mono-label">Kết quả được tạo</h3>
                  <button className="p-1 hover:bg-white/10 rounded">
                    <Maximize2 className="w-4 h-4 opacity-40" />
                  </button>
                </div>
                <div className="relative aspect-video rounded-xl overflow-hidden">
                  <img 
                    src={state.resultImage} 
                    alt="Thiết kế được tạo" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
                    <div className={`px-2 py-1 bg-black/60 backdrop-blur rounded font-mono text-[9px] uppercase ${state.aiEngine === 'replicate' ? 'text-purple-400' : ''}`}>
                      Mẫu: {state.aiEngine === 'replicate' ? 'SDXL (Replicate)' : 'Gemini 2.5 Flash'}
                    </div>
                    {state.aiEngine === 'gemini' && (
                      <div className="px-2 py-1 bg-white/10 backdrop-blur rounded font-mono text-[7px] opacity-40">
                        Giới hạn: 1000 ảnh/ngày (Free Tier)
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </section>
        </div>
      </main>

      {/* Fullscreen Overlay for Loading/Result */}
      <AnimatePresence>
        {(state.isAnalyzing || state.isGenerating) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1] 
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-32 h-32 border-[1px] border-brand/20 rounded-full relative mb-8"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand rounded-full neon-glow" />
            </motion.div>
            <h3 className="text-3xl font-mono uppercase italic mb-2">
              {state.isAnalyzing ? 'Giải mã Kiến trúc' : 'Tổng hợp Vật liệu'}
            </h3>
            <p className="font-mono text-sm opacity-40 max-w-sm">
              {state.isAnalyzing 
                ? 'Đang phân tích hình học ranh giới căn phòng và dữ liệu ánh sáng.' 
                : `Đang áp dụng kết cấu ${STYLE_MAPPING[state.selectedStyle]} và bộ lọc ánh sáng thể tích.`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Result Modal */}
      <AnimatePresence>
        {state.resultImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-12"
          >
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl max-w-6xl w-full h-full flex flex-col overflow-hidden">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="font-mono text-xl uppercase italic">Phối cảnh Chuyển đổi</h2>
                  <span className="px-3 py-1 bg-brand/10 text-brand rounded-full text-[10px] font-mono border border-brand/20 uppercase">
                    Phong cách {STYLE_MAPPING[state.selectedStyle]}
                  </span>
                </div>
                <button 
                  onClick={() => setState(prev => ({ ...prev, resultImage: null }))}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 min-h-0 relative">
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage src={state.originalImage!} alt="Gốc" />}
                  itemTwo={<ReactCompareSliderImage src={state.resultImage} alt="Kết quả" />}
                  className="w-full h-full"
                />
                <div className="absolute top-4 left-4 font-mono text-[10px] bg-black/60 px-2 py-1 rounded pointer-events-none z-10">BỐI CẢNH GỐC</div>
                <div className="absolute top-4 right-4 font-mono text-[10px] bg-brand text-black px-2 py-1 rounded font-bold pointer-events-none z-10">TÁI TẠO BỞI AI</div>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/10 flex items-center justify-between">
                <p className="text-xs font-mono opacity-50 italic max-w-2xl">
                  Gợi ý đã dùng: "{state.customPrompt}"
                </p>
                <div className="flex gap-4 items-center relative">
                  <button 
                    onClick={() => setState(prev => ({ ...prev, resultImage: null }))}
                    className="px-6 py-2 border border-white/20 rounded-lg text-sm hover:bg-white/5 transition-colors"
                  >
                    TIẾP TỤC CHỈNH SỬA
                  </button>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setShowResMenu(!showResMenu)}
                      className="px-6 py-2 bg-brand text-black font-bold rounded-lg text-sm hover:scale-105 transition-transform flex items-center gap-2"
                    >
                      LƯU HÌNH ẢNH
                    </button>

                    <AnimatePresence>
                      {showResMenu && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[70] min-w-[200px]"
                        >
                          <div className="p-3 border-b border-white/5 bg-white/5">
                            <span className="mono-label text-[9px]">Chọn độ phân giải</span>
                          </div>
                          {[
                            { label: 'SD (720p)', res: 1280 },
                            { label: 'HD (1080p)', res: 1920 },
                            { label: '4K Ultra (2160p)', res: 3840 }
                          ].map((opt) => (
                            <button
                              key={opt.res}
                              onClick={() => {
                                downloadImage(opt.res);
                                setShowResMenu(false);
                              }}
                              className="w-full text-left px-4 py-3 text-xs hover:bg-brand hover:text-black transition-colors border-b border-white/5 last:border-0 flex justify-between items-center group"
                            >
                              {opt.label}
                              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
