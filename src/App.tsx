import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Routes, Route, Link } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import GalleryPage from './pages/GalleryPage';
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
  ChevronUp,
  LogOut,
  User as UserIcon,
  Copy,
  HelpCircle,
  ImageIcon,
  Settings,
  Sun,
  Camera,
  Droplets,
  Box,
  DropShadow,
  Wand2,
  Share2,
  Home as HomeIcon,
  Grid
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
  TimeOfDay,
  CameraAngle,
  Material,
  AIEngine
} from './types';
import { analyzeRoomImage, generateRestyledRoom } from './services/geminiService';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import { useAuth } from './contexts/AuthContext';
import { db, handleFirestoreError, OperationType, storage } from './firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

const STORAGE_KEY = 'archivision_user_prefs';

const ROOM_TYPE_MAPPING: Record<RoomType, string> = {
  'Auto-detect': 'Tự động nhận diện',
  'Living Room': 'Phòng khách (Living Room)',
  'Bedroom': 'Phòng ngủ (Bedroom)',
  'Kitchen': 'Nhà bếp (Kitchen)',
  'Bathroom': 'Phòng tắm (Bathroom)',
  'Dining Room': 'Phòng ăn (Dining Room)',
  'Office': 'Văn phòng (Office)',
  'Commercial Space': 'Không gian thương mại',
  'Studio': 'Phòng Studio'
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

const CAMERA_ANGLE_MAPPING: Record<CameraAngle, string> = {
  'Default': 'Giữ nguyên (Default)',
  'Eye Level': 'Ngang tầm mắt (Eye Level)',
  'Low Angle': 'Nhìn từ dưới lên (Low Angle)',
  'High Angle': 'Nhìn góc cao (High Angle)',
  'Bird\'s Eye View': 'Nhìn từ trên xuống (Bird\'s Eye)',
  'Isometric': 'Cục bộ đẳng cự (Isometric)'
};

export function Home() {
  const { user, profile, loginWithGoogle, loginWithEmail, logout } = useAuth();
  
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
      materialOverrides: { Floor: '', Wall: '', Ceiling: '', Furniture: '', General: '' },
      roomType: 'Auto-detect',
      timeOfDay: 'Noon',
      lightingMode: 'Daylight',
      shadowIntensity: 'Moderate',
      colorTemp: 'Neutral',
      lightDirection: 'Left',
      cameraLens: 'Standard 35mm',
      cameraAngle: 'Default',
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
    selectedStyle: (initialPrefs.selectedStyle || 'Scandinavian') as InteriorStyle,
    materialOverrides: initialPrefs.materialOverrides || { Floor: '', Wall: '', Ceiling: '', Furniture: '', General: '' },
    roomType: (initialPrefs.roomType || 'Auto-detect') as RoomType,
    timeOfDay: (initialPrefs.timeOfDay || 'Noon') as TimeOfDay,
    lightingMode: (initialPrefs.lightingMode || 'Daylight') as LightingMode,
    shadowIntensity: (initialPrefs.shadowIntensity || 'Moderate') as ShadowIntensity,
    colorTemp: (initialPrefs.colorTemp || 'Neutral') as ColorTemp,
    lightDirection: (initialPrefs.lightDirection || 'Left') as LightDirection,
    cameraLens: initialPrefs.cameraLens || 'Standard 35mm',
    cameraAngle: initialPrefs.cameraAngle || 'Default',
    renderEngine: initialPrefs.renderEngine || 'Corona Render',
    preserveLayout: initialPrefs.preserveLayout ?? true,
    preserveMaterials: initialPrefs.preserveMaterials ?? false,
    addDecor: initialPrefs.addDecor ?? false,
    addLEDs: initialPrefs.addLEDs ?? false,
    aiEngine: initialPrefs.aiEngine as AIEngine || 'gemini',
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

  const [showTutorial, setShowTutorial] = useState(false);

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
      cameraAngle: state.cameraAngle,
      renderEngine: state.renderEngine,
      preserveLayout: state.preserveLayout,
      preserveMaterials: state.preserveMaterials,
      materialOverrides: state.materialOverrides,
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
    state.cameraAngle,
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
    const lightingBase = LIGHTING_MAPPING[s.lightingMode]?.prompt || 'natural daylight';
    const shadowP = SHADOW_MAPPING[s.shadowIntensity] || 'natural balanced shadows';
    const tempP = TEMP_MAPPING[s.colorTemp] || 'neutral color temperature';
    const directionP = DIRECTION_MAPPING[s.lightDirection] || 'lighting from the left';
    
    // Technical camera tokens
    const angleP = s.cameraAngle && s.cameraAngle !== 'Default' ? `shot from a ${s.cameraAngle.toLowerCase()} perspective` : '';
    const qualityTokens = `masterpiece, best quality, ultra-detailed, photorealistic, 8k resolution, raw photo, architectural photography, shot on ${s.cameraLens}, ${s.renderEngine}, global illumination, ray tracing, sharp focus`;
    
    let promptParts = [];
    
    // Core Subject
    if (s.roomType && s.roomType !== 'Auto-detect') {
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
    const litTime = s.timeOfDay && s.timeOfDay !== 'Noon' ? `captured during ${s.timeOfDay.toLowerCase()}` : 'captured with balanced daylight';
    promptParts.push(`${litTime}`);
    promptParts.push(`featuring ${lightingBase?.toLowerCase() || ''} with ${shadowP?.toLowerCase() || ''} shadows`);
    promptParts.push(`overall color temperature is ${tempP?.toLowerCase() || ''}`);
    promptParts.push(`main light source directed from the ${directionP?.toLowerCase() || ''}`);
    if (angleP) promptParts.push(angleP);

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
        state
      );
      setState(prev => ({ 
        ...prev, 
        analysis, 
        customPrompt: initialPrompt,
        isAnalyzing: false,
        error: null // Clear any previous error
      }));
    } catch (err: any) {
      const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      console.error("Analysis error caught:", err);
      let errorMessage = `Không thể phân tích hình ảnh: ${errStr}`;
      
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
    if (!state.originalImage && !state.customPrompt) {
      setState(prev => ({ ...prev, error: 'Vui lòng tải ảnh gốc lên hoặc nhập Prompt.' }));
      return;
    }
    if (state.originalImage && !state.analysis) return;
    
    // Check approval and credits
    const isAdmin = user?.email === 'dothanhlap2005@gmail.com';
    if (!profile?.isApproved && !isAdmin) {
      setState(prev => ({ 
        ...prev, 
        error: 'Tài khoản của bạn chưa được cấp quyền để tạo ảnh. Vui lòng liên hệ Admin.' 
      }));
      return;
    }
    
    if (!isAdmin && (profile?.credits === undefined || profile.credits <= 0)) {
      setState(prev => ({ 
        ...prev, 
        error: 'Tài khoản của bạn đã hết lượt (Credits) tạo ảnh. Vui lòng liên hệ Admin.' 
      }));
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const { image: resultImage, prompt: generatedPrompt } = await generateRestyledRoom(
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
        state.addLEDs,
        state.roomType,
        state.timeOfDay,
        state.negativePrompt,
        state.cameraAngle,
        state.materialOverrides
      );
      
      setState(prev => ({ ...prev, resultImage, generatedPrompt, isGenerating: false, error: null }));

      let uploadedResultUrl = resultImage;
      let uploadedOriginalUrl = state.originalImage;
      if (user) {
        try {
          if (resultImage && resultImage.startsWith('data:image')) {
            const resultRef = ref(storage, `generations/${user.uid}/result_${Date.now()}.png`);
            await uploadString(resultRef, resultImage, 'data_url');
            uploadedResultUrl = await getDownloadURL(resultRef);
            setState(prev => ({ ...prev, resultImage: uploadedResultUrl }));
          }
          if (state.originalImage && state.originalImage.startsWith('data:image')) {
            const originalRef = ref(storage, `generations/${user.uid}/original_${Date.now()}.png`);
            await uploadString(originalRef, state.originalImage, 'data_url');
            uploadedOriginalUrl = await getDownloadURL(originalRef);
          }
        } catch (uploadErr) {
          console.error("Lỗi upload ảnh lên Storage:", uploadErr);
        }
      }
      
      if (user && uploadedResultUrl) {
        try {
          await addDoc(collection(db, 'generations'), {
            userId: user.uid,
            originalImage: uploadedOriginalUrl || null,
            resultImage: uploadedResultUrl,
            prompt: generatedPrompt,
            style: state.selectedStyle,
            roomType: state.roomType,
            createdAt: serverTimestamp()
          });
          
          if (!isAdmin && profile?.credits !== undefined) {
             const userRef = doc(db, 'users', user.uid);
             await updateDoc(userRef, {
                credits: profile.credits - 1,
                updatedAt: serverTimestamp()
             });
          }
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.CREATE, 'generations');
        }
      }
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
      materialOverrides: { Floor: '', Wall: '', Ceiling: '', Furniture: '', General: '' },
      lightingMode: 'Daylight',
      shadowIntensity: 'Moderate',
      colorTemp: 'Neutral',
      lightDirection: 'Left',
      cameraLens: 'Standard 35mm',
      cameraAngle: 'Default',
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
    link.download = `archivision-${(state.selectedStyle || 'modern').toLowerCase()}-${resolution}p.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleShare = async () => {
    if (!state.resultImage) return;
    try {
      if (state.resultImage.startsWith('data:image')) {
        const response = await fetch(state.resultImage);
        const blob = await response.blob();
        const file = new File([blob], 'archivision-design.png', { type: blob.type });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'ArchiVision Design',
            text: 'Chỉnh sửa không gian với AI bởi ArchiVision',
          });
        } else {
           alert('Trình duyệt không hỗ trợ chia sẻ ảnh trực tiếp. Vui lòng tải xuống.');
        }
      } else {
        if (navigator.share) {
          await navigator.share({
            title: 'ArchiVision Design',
            text: 'Chỉnh sửa không gian với AI bởi ArchiVision',
            url: state.resultImage,
          });
        } else {
          navigator.clipboard.writeText(state.resultImage);
          alert('Đã copy link ảnh!');
        }
      }
    } catch (err) {
      console.error('Lỗi khi share', err);
    }
  };

  const [showResMenu, setShowResMenu] = useState(false);
  const [isPromptCopied, setIsPromptCopied] = useState(false);
  const [isCustomPromptCopied, setIsCustomPromptCopied] = useState(false);
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await loginWithEmail(loginEmail, loginPassword);
      setShowLoginModal(false);
    } catch (err: any) {
      setLoginError(err.message || 'Lỗi đăng nhập');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      setShowLoginModal(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCopyPrompt = () => {
    const promptToCopy = state.generatedPrompt || state.customPrompt;
    if (promptToCopy) {
      navigator.clipboard.writeText(promptToCopy);
      setIsPromptCopied(true);
      setTimeout(() => setIsPromptCopied(false), 2000);
    }
  };

  const handleCopyCustomPrompt = () => {
    if (state.customPrompt || state.analysis?.suggestedPrompt) {
      navigator.clipboard.writeText(state.customPrompt || state.analysis!.suggestedPrompt);
      setIsCustomPromptCopied(true);
      setTimeout(() => setIsCustomPromptCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-brand selection:text-black">
      {/* Header */}
      <header className="border-b border-white/10 py-4 md:py-6 px-4 md:px-8 flex justify-between items-center sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand rounded-sm flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.3)]">
            <Layers className="text-black w-5 h-5" />
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tighter uppercase italic">
            HLF <span className="opacity-40">AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <span className="mono-label hidden lg:block">Hệ thống: Tối ưu</span>
          <div className="flex items-center gap-1 md:gap-2">
            <button 
              onClick={() => setShowTutorial(true)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors group"
              title="Hướng dẫn"
            >
              <HelpCircle className="w-5 h-5 opacity-40 group-hover:opacity-100" />
            </button>
            <button 
              onClick={reset}
              className="p-2 hover:bg-white/5 rounded-full transition-colors group"
              title="Tạo mới"
            >
              <RotateCcw className="w-5 h-5 opacity-40 group-hover:opacity-100" />
            </button>
          </div>
          
          <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>
          
          {user ? (
            <div className="flex items-center gap-2 md:gap-4">
              <Link to="/gallery" className="text-sm text-white/70 hover:text-white transition-colors hidden md:block">
                Thư viện
              </Link>
              
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4 opacity-50" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium hidden lg:block truncate max-w-[100px]">{user.displayName || user.email}</span>
                  {user.email !== 'dothanhlap2005@gmail.com' && profile?.credits !== undefined && (
                    <span className="text-[10px] md:text-xs bg-brand/10 text-brand px-2 py-0.5 rounded font-mono border border-brand/20">
                      {profile.credits} <span className="hidden sm:inline">Credits</span>
                    </span>
                  )}
                </div>
              </div>
              
              {user.email === 'dothanhlap2005@gmail.com' && (
                <Link to="/admin" className="text-[10px] bg-brand/20 text-brand px-2 py-0.5 rounded hover:bg-brand/30 transition-colors hidden md:block uppercase font-bold">
                  Admin
                </Link>
              )}

              <button 
                onClick={logout}
                className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5 opacity-40 group-hover:text-red-400 group-hover:opacity-100 transition-colors" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="bg-brand text-black hover:bg-brand/90 transition-all px-3 py-1.5 md:px-4 md:py-2 rounded font-bold text-[11px] md:text-sm flex items-center gap-2"
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline">ĐĂNG NHẬP</span>
              <span className="sm:hidden">LOGIN</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 pb-24 md:pb-8">
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
                <p className="font-mono text-sm opacity-60 px-4 text-center">KÉO ẢNH VÀO HOẶC NHẤP ĐỂ CHỌN</p>
                <p className="text-[10px] opacity-30 mt-2 italic px-4 text-center uppercase tracking-widest">Sử dụng camera hoặc chọn từ album</p>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] opacity-40 uppercase font-mono text-brand">Kiến trúc</span>
                    <p className="text-sm font-medium leading-relaxed">{state.analysis.architecture}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] opacity-40 uppercase font-mono text-brand">Không khí</span>
                    <p className="text-sm font-medium capitalize">{state.analysis.spatialAtmosphere}</p>
                  </div>
                  
                  <div className="space-y-1 col-span-2 border-t border-white/5 pt-3">
                    <span className="text-[10px] opacity-40 uppercase font-mono text-brand mb-2 block">Cấu trúc & Bố cục</span>
                    <div className="flex flex-wrap gap-1 mt-1 mb-3">
                      {state.analysis.structuralElements.map((el, i) => (
                        <span key={i} className="text-[10px] bg-white/10 px-2 py-1 rounded border border-white/5 font-medium">
                          {el}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-white/80">{state.analysis.layoutAndFurniture}</p>
                  </div>

                  <div className="space-y-1 col-span-2 border-t border-white/5 pt-3">
                    <span className="text-[10px] opacity-40 uppercase font-mono text-brand">Bề mặt & Vật liệu</span>
                    <p className="text-sm leading-relaxed text-white/80">
                      <strong>Sàn:</strong> {state.analysis.flooring} <br/>
                      <strong>Chất liệu khác:</strong> {state.analysis.materials}
                    </p>
                  </div>

                  <div className="space-y-1 col-span-2 border-t border-white/5 pt-3">
                     <span className="text-[10px] opacity-40 uppercase font-mono text-brand">Ánh sáng</span>
                     <p className="text-sm leading-relaxed text-white/80">{state.analysis.lighting}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] opacity-40 uppercase font-mono">Gợi ý tạo ảnh (AI Prompt)</span>
                    <button 
                      onClick={handleCopyCustomPrompt}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white"
                      title="Copy prompt"
                    >
                      {isCustomPromptCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="relative">
                    <textarea 
                      value={state.customPrompt}
                      onChange={(e) => setState(prev => ({ ...prev, customPrompt: e.target.value }))}
                      className="w-full bg-black/40 rounded border border-white/10 p-3 text-[11px] font-mono opacity-80 leading-relaxed focus:border-brand/40 focus:ring-0 outline-none min-h-[160px] resize-none pb-8"
                    />
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
                <AnimatePresence initial={false}>
                  {expandedSections['basic'] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>
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
                <AnimatePresence initial={false}>
                  {expandedSections['lighting'] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>
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
                <AnimatePresence initial={false}>
                  {expandedSections['advanced'] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
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

                    {!state.preserveMaterials && (
                      <div className="pt-4 border-t border-white/5 space-y-4">
                        <label className="mono-label mb-3 block text-brand">3.3 Chỉ định vật liệu</label>
                        {(['Floor', 'Wall', 'Ceiling', 'Furniture', 'General'] as ('Floor'|'Wall'|'Ceiling'|'Furniture'|'General')[]).map(surface => (
                          <div key={surface} className="space-y-2">
                            <span className="text-[10px] uppercase text-white/50">{surface === 'Floor' ? 'Sàn' : surface === 'Wall' ? 'Tường' : surface === 'Ceiling' ? 'Trần' : surface === 'Furniture' ? 'Nội thất' : 'Chung'}</span>
                            <div className="flex flex-wrap gap-1">
                               <button
                                 onClick={() => handleStateChange({ materialOverrides: { ...state.materialOverrides, [surface]: '' } })}
                                 className={`px-2 py-1 rounded text-[10px] border transition-all ${!state.materialOverrides[surface] ? 'bg-brand/20 border-brand/50 text-brand' : 'bg-white/5 border-white/10 opacity-50 hover:bg-white/10 hover:opacity-100'}`}
                               >
                                 Mặc định
                               </button>
                              {(['Wood', 'Marble', 'Concrete', 'Velvet', 'Leather', 'Metal', 'Glass', 'Linen', 'Boucle', 'Terrazzo', 'Microcement', 'Exposed Brick', 'Plaster'] as Material[]).map((mat) => (
                                <button
                                  key={mat}
                                  onClick={() => handleStateChange({ materialOverrides: { ...state.materialOverrides, [surface]: mat } })}
                                  className={`px-2 py-1 rounded text-[10px] border transition-all ${state.materialOverrides[surface] === mat ? 'bg-brand/20 border-brand/50 text-brand' : 'bg-white/5 border-white/10 opacity-50 hover:bg-white/10 hover:opacity-100'}`}
                                >
                                  {mat}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div>
                        <label className="mono-label">3.4 Thêm đồ decor</label>
                        <p className="text-[10px] opacity-40 mt-1">Thêm tranh ảnh, cây cảnh, đồ trang trí</p>
                      </div>
                      <button 
                        onClick={() => handleStateChange({ addDecor: !state.addDecor })}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ml-4 ${state.addDecor ? 'bg-brand' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${state.addDecor ? 'right-1 bg-black' : 'left-1 bg-white/40'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <label className="mono-label">3.5 Thêm đèn LEDs/Neon</label>
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
                       <label className="mono-label mb-2 block">3.6 Loại trừ yếu tố (Negative Prompt)</label>
                       <textarea 
                          value={state.negativePrompt}
                          onChange={(e) => handleStateChange({ negativePrompt: e.target.value })}
                          placeholder="Ví dụ: no people, no plants, no messy clutter..."
                          className="w-full bg-black/40 rounded border border-white/10 p-2 text-xs font-mono opacity-80 min-h-[60px] resize-none focus:border-brand/40 focus:ring-0 outline-none"
                       />
                    </div>
                  </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                <AnimatePresence initial={false}>
                  {expandedSections['camera'] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
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
                      <label className="mono-label mb-3 block">4.2 Góc nhìn (Camera Angle)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(CAMERA_ANGLE_MAPPING) as CameraAngle[]).map((angle) => (
                          <button
                            key={angle}
                            onClick={() => handleStateChange({ cameraAngle: angle })}
                            className={`py-2 rounded text-[10px] border transition-all text-center ${state.cameraAngle === angle ? 'bg-brand/10 border-brand text-brand' : 'bg-white/5 border-white/10 opacity-50 hover:bg-white/10 hover:opacity-100'}`}
                          >
                            {CAMERA_ANGLE_MAPPING[angle]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <label className="mono-label mb-3 block">4.3 Render Engine Simulator</label>
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
                      <label className="mono-label mb-3 block">4.4 Lõi AI (AI Engine)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleStateChange({ aiEngine: 'gemini' })}
                          className={`py-2 rounded text-[11px] border transition-all font-medium ${state.aiEngine === 'gemini' ? 'bg-brand/10 border-brand text-brand' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'}`}
                        >
                          Gemini 2.5 Flash
                        </button>
                        <button
                          onClick={() => handleStateChange({ aiEngine: 'replicate' })}
                          className={`py-2 rounded text-[11px] border transition-all font-medium flex items-center justify-center gap-1 ${state.aiEngine === 'replicate' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'}`}
                        >
                          <Sparkles className="w-3 h-3" /> SDXL (Replicate)
                        </button>
                        <button
                          onClick={() => handleStateChange({ aiEngine: 'chatgpt' })}
                          className={`py-2 rounded text-[11px] border transition-all font-medium flex items-center justify-center gap-1 ${state.aiEngine === 'chatgpt' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'}`}
                        >
                          ChatGPT (DALL-E)
                        </button>
                        <button
                          onClick={() => handleStateChange({ aiEngine: 'seedance' })}
                          className={`py-2 rounded text-[11px] border transition-all font-medium flex items-center justify-center gap-1 ${state.aiEngine === 'seedance' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'}`}
                        >
                          Seedance
                        </button>
                      </div>
                    </div>
                  </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                {(!state.analysis && state.originalImage) ? (
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
                    disabled={state.isGenerating || (!state.originalImage && !state.customPrompt)}
                    onClick={handleGenerate}
                    className="w-full bg-brand text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {state.isGenerating ? <div className="loading-spinner" /> : <Layers className="w-5 h-5" />}
                    {state.isGenerating ? 'ĐANG TẠO THIẾT KẾ...' : (state.originalImage ? 'TẠO PHỐI CẢNH MỚI' : 'TẠO ẢNH BẰNG PROMPT')}
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
          <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl">
            <img 
              src={state.resultImage} 
              alt="Thiết kế được tạo" 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
              <div className={`px-2 py-1 backdrop-blur rounded font-mono text-[9px] uppercase ${state.aiEngine === 'replicate' ? 'bg-black/60 text-purple-400' : state.aiEngine === 'chatgpt' ? 'bg-black/60 text-green-400' : state.aiEngine === 'seedance' ? 'bg-black/60 text-blue-400' : 'bg-black/60 text-white'}`}>
                Mẫu: {state.aiEngine === 'replicate' ? 'SDXL (Replicate)' : state.aiEngine === 'chatgpt' ? 'ChatGPT (DALL-E)' : state.aiEngine === 'seedance' ? 'Seedance' : 'Gemini 2.5 Flash'}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Mobile Sticky Action Button */}
      {state.originalImage && !state.resultImage && (
        <div className="md:hidden fixed bottom-20 left-4 right-4 z-40">
          <button 
            onClick={!state.analysis ? handleAnalyze : handleGenerate}
            disabled={state.isAnalyzing || state.isGenerating}
            className={`
              w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all active:scale-95
              ${!state.analysis ? 'bg-white text-black' : 'bg-brand text-black'}
            `}
          >
            {state.isAnalyzing || state.isGenerating ? (
              <div className="loading-spinner" />
            ) : (
              !state.analysis ? <Sparkles className="w-5 h-5" /> : <Layers className="w-5 h-5" />
            )}
            {!state.analysis ? 'PHÂN TÍCH KHÔNG GIAN' : 'TẠO THIẾT KẾ AI'}
          </button>
        </div>
      )}
    </section>
  </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-lg border-t border-white/10 z-[49] safe-bottom">
          <div className="flex justify-around items-center h-16">
            <Link to="/" className="flex flex-col items-center gap-1 text-brand">
              <HomeIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Thiết kế</span>
            </Link>
            <Link to="/gallery" className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors">
              <Grid className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-tighter">Bộ sưu tập</span>
            </Link>
            {(user?.email === 'dothanhlap2005@gmail.com') && (
              <Link to="/admin" className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors">
                <Settings className="w-5 h-5" />
                <span className="text-[10px] uppercase tracking-tighter">Quản trị</span>
              </Link>
            )}
            <button 
              onClick={() => setShowTutorial(true)}
              className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors"
            >
              <HelpCircle className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-tighter">Hướng dẫn</span>
            </button>
          </div>
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
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-12"
          >
            <div className="bg-[#0a0a0a] border-0 md:border md:border-white/10 rounded-none md:rounded-2xl max-w-6xl w-full h-full flex flex-col overflow-hidden">
              <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a]">
                <div className="flex items-center gap-3 md:gap-4">
                  <h2 className="font-mono text-sm md:text-xl uppercase italic tracking-tighter">PHỐI CẢNH AI</h2>
                  <span className="px-2 py-0.5 bg-brand/10 text-brand rounded-full text-[9px] md:text-[10px] font-mono border border-brand/20 uppercase whitespace-nowrap">
                    {STYLE_MAPPING[state.selectedStyle]}
                  </span>
                </div>
                <button 
                  onClick={() => setState(prev => ({ ...prev, resultImage: null }))}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 min-h-0 relative flex justify-center items-center bg-black overflow-hidden">
                {state.originalImage ? (
                  <div className="w-full h-full">
                    <ReactCompareSlider
                      itemOne={<ReactCompareSliderImage src={state.originalImage} alt="Gốc" />}
                      itemTwo={<ReactCompareSliderImage src={state.resultImage} alt="Kết quả" />}
                      className="w-full h-full"
                    />
                    <div className="absolute top-4 left-4 font-mono text-[9px] md:text-[10px] bg-black/60 backdrop-blur-md px-2 py-1 rounded pointer-events-none z-10 border border-white/10 uppercase">Gốc</div>
                    <div className="absolute top-4 right-4 font-mono text-[9px] md:text-[10px] bg-brand text-black px-2 py-1 rounded font-bold pointer-events-none z-10 shadow-[0_0_10px_rgba(204,255,0,0.5)] uppercase">AI Tái tạo</div>
                  </div>
                ) : (
                  <img src={state.resultImage} alt="Kết quả" className="w-full h-full object-contain" />
                )}
              </div>

              <div className="p-4 md:p-6 bg-[#0a0a0a] border-t border-white/10 flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 w-full md:max-w-2xl">
                  <div className="flex items-start gap-3">
                    <p className="text-[10px] font-mono opacity-50 italic max-h-12 md:max-h-16 overflow-y-auto cursor-help flex-1 leading-tight">
                      Gợi ý: "{state.generatedPrompt || state.customPrompt}"
                    </p>
                    <button 
                      onClick={handleCopyPrompt}
                      className="p-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded transition-colors shrink-0 flex items-center justify-center"
                      title="Copy prompt"
                    >
                      {isPromptCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto items-center relative shrink-0">
                  <button 
                    onClick={handleShare}
                    className="p-3 border border-white/20 rounded-xl shrink-0 text-white hover:bg-brand hover:text-black hover:border-brand transition-all active:scale-95"
                    title="Chia sẻ"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setState(prev => ({ ...prev, resultImage: null }))}
                    className="hidden md:block px-6 py-3 border border-white/20 rounded-xl text-sm font-bold hover:bg-white/5 transition-colors"
                  >
                    CHỈNH SỬA TIẾP
                  </button>
                  
                  <div className="relative flex-1 md:flex-none">
                    <button 
                      onClick={() => setShowResMenu(!showResMenu)}
                      className="w-full px-6 py-3 bg-brand text-black font-bold rounded-xl text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(204,255,0,0.2)]"
                    >
                      LƯU ẢNH
                      <ChevronUp className={`w-4 h-4 transition-transform ${showResMenu ? 'rotate-180' : ''}`} />
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
        .safe-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
        @media (max-width: 768px) {
          .glass-panel {
            border-radius: 1.5rem;
          }
        }
      `}</style>

      {/* Tutorial Modal */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-5xl my-8 overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-white/5 bg-[#1a1a1a] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand/20 rounded-full flex items-center justify-center">
                    <HelpCircle className="w-6 h-6 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-mono tracking-tighter uppercase text-white">Hướng Dẫn Sử Dụng ArchiVision</h2>
                    <p className="text-sm opacity-60">Khám phá các tính năng mạnh mẽ để thiết kế không gian</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTutorial(false)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-12">
                {/* 1. Basic Workflow */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-px bg-brand flex-1 opacity-20"></div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-widest font-mono text-center">
                      <span className="text-brand mr-2">01.</span>Quy Trình Cơ Bản
                    </h3>
                    <div className="h-px bg-brand flex-1 opacity-20"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 hover:border-brand/30 transition-colors group">
                      <div className="w-12 h-12 bg-[#222] group-hover:bg-brand/10 text-white group-hover:text-brand rounded-xl flex items-center justify-center mb-4 transition-colors">
                        <Upload className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-lg mb-2">Bước 1: Tải Ảnh Lên</h4>
                      <p className="text-sm text-white/60 leading-relaxed">
                        Chụp hoặc chọn một bức ảnh rõ nét về căn phòng hiện tại của bạn. Kéo thả vào ô "Click hoặc Kéo thả ảnh vào đây".
                      </p>
                    </div>
                    <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 hover:border-brand/30 transition-colors group">
                      <div className="w-12 h-12 bg-[#222] group-hover:bg-brand/10 text-white group-hover:text-brand rounded-xl flex items-center justify-center mb-4 transition-colors">
                        <Wand2 className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-lg mb-2">Bước 2: Chọn Phong Cách</h4>
                      <p className="text-sm text-white/60 leading-relaxed">
                        Lựa chọn một trong các phong cách có sẵn (Minimalist, Japandi, Industrial...) ở cột bên phải.
                      </p>
                    </div>
                    <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 hover:border-brand/30 transition-colors group">
                      <div className="w-12 h-12 bg-[#222] group-hover:bg-brand/10 text-white group-hover:text-brand rounded-xl flex items-center justify-center mb-4 transition-colors">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-lg mb-2">Bước 3: Tạo Thiết Kế</h4>
                      <p className="text-sm text-white/60 leading-relaxed">
                        Nhấp "Tạo Thiết Kế Mới". Hệ thống AI sẽ phân tích không gian và tạo ra hình ảnh nội thất mới trong vài giây.
                      </p>
                    </div>
                  </div>
                </section>

                {/* 2. Preserve Layout Modifiers */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-px bg-white/20 flex-1"></div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-widest font-mono text-center">
                      <span className="text-brand mr-2">02.</span>Chế Độ Thiết Kế (Nâng Cao)
                    </h3>
                    <div className="h-px bg-white/20 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#151515] rounded-2xl border border-white/5 overflow-hidden flex flex-col h-full">
                      <div className="h-48 bg-[#0a0a0a] relative flex items-center justify-center border-b border-white/5 overflow-hidden">
                         {/* Visual Placeholder: Preserve Layout */}
                         <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' }}></div>
                         <Layers className="w-16 h-16 text-brand opacity-50 relative z-10" />
                      </div>
                      <div className="p-6 flex-1">
                        <h4 className="font-bold text-lg text-brand flex items-center gap-2 mb-2">
                          <Check className="w-5 h-5" /> Bật: Giữ Nguyên Bố Cục (Preserve Layout)
                        </h4>
                        <p className="text-sm text-white/70 leading-relaxed mb-4">
                          Phù hợp khi bạn muốn <strong>cải tạo bề mặt (Renovation)</strong>. AI sẽ giữ lại toàn bộ hình dáng căn phòng, vị trí cửa sổ, và các khối đồ nội thất chính (giường, tủ...). 
                        </p>
                        <div className="bg-brand/10 p-3 rounded-lg border border-brand/20">
                          <p className="text-xs text-brand/80 font-mono">💡 Mẹo: Hữu ích khi bạn không muốn thay đổi vị trí đồ đạc mà chỉ muốn thay áo mới cho chúng.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#151515] rounded-2xl border border-white/5 overflow-hidden flex flex-col h-full">
                      <div className="h-48 bg-[#0a0a0a] relative flex items-center justify-center border-b border-white/5 overflow-hidden">
                         {/* Visual Placeholder: Redesign */}
                         <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-transparent"></div>
                         <Sparkles className="w-16 h-16 text-white opacity-50 relative z-10" />
                      </div>
                      <div className="p-6 flex-1">
                        <h4 className="font-bold text-lg text-white flex items-center gap-2 mb-2">
                          <X className="w-5 h-5 text-red-400" /> Tắt: Thiết Kế Lại Toàn Bộ
                        </h4>
                        <p className="text-sm text-white/70 leading-relaxed mb-4">
                          Phù hợp khi bạn muốn <strong>sáng tạo không gian mới</strong> hoặc thiết kế từ một <strong>căn phòng trống</strong>. AI sẽ tự động phân bổ đồ nội thất sao cho hợp lý nhất với phong cách.
                        </p>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                          <p className="text-xs text-white/60 font-mono">💡 Mẹo: Có thể dẫn đến sự thay đổi lớn về vị trí giường, bàn ghế hoặc cửa sổ để tạo tỷ lệ đẹp hơn.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
                
                {/* 3. Granular Controls */}
                <section>
                   <div className="flex items-center gap-3 mb-6">
                    <div className="h-px bg-white/20 flex-1"></div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-widest font-mono text-center">
                      <span className="text-brand mr-2">03.</span>Tùy Chỉnh Chuyên Sâu
                    </h3>
                    <div className="h-px bg-white/20 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 bg-gradient-to-b from-[#151515] to-[#111] rounded-xl border border-white/5 hover:-translate-y-1 transition-transform">
                      <Box className="w-8 h-8 text-brand mb-4 opacity-70" />
                      <h4 className="font-bold mb-2 text-sm uppercase tracking-widest text-white">Vật liệu ép buộc</h4>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Bạn có thể chọn cụ thể vật liệu cho Tường (VD: Gạch trần), Sàn (Gỗ tối màu), hay Trần bê tông trong phần Cơ Bản. Tính năng này sẽ ghi đè lên thiết lập mặc định của phong cách.
                      </p>
                    </div>

                    <div className="p-5 bg-gradient-to-b from-[#151515] to-[#111] rounded-xl border border-white/5 hover:-translate-y-1 transition-transform">
                      <Sun className="w-8 h-8 text-brand mb-4 opacity-70" />
                      <h4 className="font-bold mb-2 text-sm uppercase tracking-widest text-white">Ánh Sáng & Bóng</h4>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Kết hợp "Thời gian (Hoàng hôn)", "Ánh sáng (Điện ảnh)", và "Bóng đổ (Sắc nét)" để tạo ra những bức ảnh có chiều sâu và tính nghệ thuật cao.
                      </p>
                    </div>

                    <div className="p-5 bg-gradient-to-b from-[#151515] to-[#111] rounded-xl border border-white/5 hover:-translate-y-1 transition-transform">
                      <Camera className="w-8 h-8 text-brand mb-4 opacity-70" />
                      <h4 className="font-bold mb-2 text-sm uppercase tracking-widest text-white">Ống Kính Camera</h4>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Hãy dùng ống siêu rộng (14mm/24mm) cho phòng hẹp như nhà tắm. Dùng ống tiêu chuẩn (35mm/50mm) cho phòng khách để tránh bị méo hình góc.
                      </p>
                    </div>

                    <div className="p-5 bg-gradient-to-b from-[#151515] to-[#111] rounded-xl border border-white/5 hover:-translate-y-1 transition-transform">
                      <Settings className="w-8 h-8 text-brand mb-4 opacity-70" />
                      <h4 className="font-bold mb-2 text-sm uppercase tracking-widest text-white">Prompt Cụ Thể</h4>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Khung prompt dưới hình gốc cho phép bạn giao tiếp trực tiếp với AI. VD: "add a large modern art painting, green velvet sofa".
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-6 border-t border-white/10 bg-[#1a1a1a] shrink-0 flex justify-end">
                <button
                  onClick={() => setShowTutorial(false)}
                  className="px-8 py-3 bg-brand text-black font-bold uppercase tracking-widest rounded hover:bg-brand/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(204,255,0,0.2)]"
                >
                  Bắt Đầu Thiết Kế Ngay
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-xl p-8 w-full max-w-sm relative">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-medium mb-6 text-center font-mono">ĐĂNG NHẬP</h2>
            
            {loginError && (
              <div className="bg-red-500/20 text-red-200 p-3 rounded mb-4 text-sm text-center">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4 mb-6">
              <div>
                <input 
                  type="email" 
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm focus:border-brand/50 focus:outline-none"
                  required
                />
              </div>
              <div>
                <input 
                  type="password" 
                  placeholder="Mật khẩu"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-3 text-sm focus:border-brand/50 focus:outline-none"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 bg-brand text-black font-medium rounded hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoggingIn && <div className="loading-spinner w-4 h-4" />}
                ĐĂNG NHẬP
              </button>
            </form>

            <div className="relative flex items-center py-2 mb-6">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-white/30 text-xs">HOẶC</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-white/5 border border-white/10 text-white font-medium rounded hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
    </Routes>
  );
}
