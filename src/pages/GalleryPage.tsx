import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Download, Eye, X, Copy, Check, Share2, Home as HomeIcon, Grid as GridIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

interface Generation {
  id: string;
  originalImage?: string;
  resultImage: string;
  prompt: string;
  style: string;
  roomType: string;
  createdAt: any;
}

export default function GalleryPage() {
  const { user, loading } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewingGeneration, setViewingGeneration] = useState<Generation | null>(null);
  const [deletingGenerationId, setDeletingGenerationId] = useState<string | null>(null);
  const [isPromptCopied, setIsPromptCopied] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      fetchGenerations();
    } else if (!user && !loading) {
      setLoadingGenerations(false);
    }
  }, [user, loading]);

  const fetchGenerations = async () => {
    setLoadingGenerations(true);
    try {
      const q = query(
        collection(db, 'generations'),
        where('userId', '==', user!.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Generation[];
      setGenerations(docs);
    } catch (err: any) {
      console.error(err);
      setError(`Lỗi tải thư viện ảnh: ${err.message}`);
    } finally {
      setLoadingGenerations(false);
    }
  };

  const deleteGeneration = async () => {
    if (!deletingGenerationId) return;
    try {
      await deleteDoc(doc(db, 'generations', deletingGenerationId));
      setGenerations(generations.filter(g => g.id !== deletingGenerationId));
      setDeletingGenerationId(null);
    } catch (err: any) {
      console.error(err);
      setError(`Lỗi xóa ảnh: ${err.message}`);
      setDeletingGenerationId(null);
    }
  };

  const handleShare = async (imageUrl: string) => {
    if (!imageUrl) return;
    try {
      if (imageUrl.startsWith('data:image')) {
        const response = await fetch(imageUrl);
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
            url: imageUrl,
          });
        } else {
          navigator.clipboard.writeText(imageUrl);
          alert('Đã copy link ảnh!');
        }
      }
    } catch (err) {
      console.error('Lỗi khi share', err);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Important for CORS
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/jpeg', 1.0);
      link.click();
    } catch (err) {
      alert('Không thể tải xuống ảnh lúc này do lỗi CORS. Bạn có thể nhấn chuột phải (hoặc nhấn giữ) vào ảnh và chọn "Lưu hình ảnh thành..."');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Đang tải...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Bạn chưa đăng nhập</h1>
          <Link to="/" className="text-brand hover:underline flex items-center gap-2 justify-center">
            <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </Link>
            <h1 className="text-xl md:text-3xl font-bold font-mono tracking-tighter uppercase italic">THƯ VIỆN CỦA TÔI</h1>
          </div>
          <div className="hidden md:block">
            <span className="mono-label opacity-40">Tình trạng: Đồng bộ</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-200 border border-red-500/50 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {loadingGenerations ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <div className="loading-spinner mb-4" />
            <div className="font-mono text-sm">ĐANG TẢI DỮ LIỆU...</div>
          </div>
        ) : generations.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10 border-dashed">
            <p className="text-white/40 mb-6 uppercase font-mono tracking-widest text-sm">Bạn chưa có thiết kế nào trong kho lưu trữ</p>
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 bg-brand text-black px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform"
            >
              TẠO THIẾT KẾ ĐẦU TIÊN
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {generations.map(gen => (
              <div key={gen.id} className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden glass-panel group flex flex-col hover:border-brand/50 hover:shadow-2xl hover:shadow-brand/10 transition-all duration-300">
                <div 
                  className="aspect-square bg-black/50 overflow-hidden relative cursor-pointer"
                  onClick={() => setViewingGeneration(gen)}
                >
                  <img 
                    src={gen.resultImage} 
                    alt="Result" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                  {/* Desktop Hover Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setViewingGeneration(gen); }}
                      className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); downloadImage(gen.resultImage, `HLF-AI-${gen.id}.jpg`); }}
                      className="p-3 bg-brand text-black rounded-full hover:scale-110 transition-transform"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleShare(gen.resultImage); }}
                      className="p-3 bg-white/20 text-white backdrop-blur rounded-full hover:scale-110 hover:bg-white/30 transition-all"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Mobile Quick Labels */}
                  <div className="md:hidden absolute top-2 right-2 flex flex-col gap-1">
                    <div className="px-2 py-1 bg-black/60 backdrop-blur rounded-md font-mono text-[9px] border border-white/10 uppercase">
                      {gen.style}
                    </div>
                  </div>
                </div>
                
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[10px] text-brand font-mono uppercase tracking-widest bg-brand/10 px-2 py-0.5 rounded border border-brand/20">
                      {gen.roomType}
                    </div>
                    <div className="text-[10px] text-white/40 font-mono italic">
                      {gen.createdAt?.toDate ? gen.createdAt.toDate().toLocaleDateString() : 'Vừa xong'}
                    </div>
                  </div>
                  <p className="text-xs text-white/70 line-clamp-2 mb-4 italic leading-relaxed flex-1">
                    "{gen.prompt}"
                  </p>
                  
                  {/* Mobile Action Bar */}
                  <div className="md:hidden flex items-center gap-2 pt-2 border-t border-white/5">
                    <button 
                      onClick={() => setViewingGeneration(gen)}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold uppercase transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye className="w-4 h-4" /> Chi tiết
                    </button>
                    <button 
                      onClick={() => handleShare(gen.resultImage)}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeletingGenerationId(gen.id)}
                      className="p-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Desktop Delete (Secondary) */}
                  <button 
                    onClick={() => setDeletingGenerationId(gen.id)}
                    className="hidden md:flex items-center gap-2 text-[10px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity mt-2 hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" /> XÓA THIẾT KẾ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile Bottom Navigation (Sync with App.tsx) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-lg border-t border-white/10 z-[49] safe-bottom">
          <div className="flex justify-around items-center h-16">
            <Link to="/" className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors">
              <HomeIcon className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-tighter">Thiết kế</span>
            </Link>
            <Link to="/gallery" className="flex flex-col items-center gap-1 text-brand">
              <GridIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Bộ sưu tập</span>
            </Link>
            <button 
              onClick={() => window.location.reload()}
              className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-colors"
            >
              <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center">
                <GridIcon className="w-3 h-3" />
              </div>
              <span className="text-[10px] uppercase tracking-tighter">Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {viewingGeneration && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-12"
          >
            <div className="bg-[#0a0a0a] border-0 md:border md:border-white/10 rounded-none md:rounded-2xl max-w-6xl w-full h-full flex flex-col overflow-hidden">
              <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center bg-[#111]">
                <div className="flex items-center gap-3 md:gap-4 font-mono">
                  <h2 className="text-sm md:text-xl uppercase italic tracking-tighter whitespace-nowrap">PHỐI CẢNH CHI TIẾT</h2>
                  <span className="px-2 py-0.5 bg-brand/10 text-brand rounded-full text-[9px] md:text-[10px] border border-brand/20 uppercase whitespace-nowrap">
                    {viewingGeneration.style}
                  </span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <button 
                    onClick={() => handleShare(viewingGeneration.resultImage)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => downloadImage(viewingGeneration.resultImage, `HLF-AI-${viewingGeneration.id}.jpg`)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setViewingGeneration(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors bg-white/5 md:bg-transparent"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 min-h-0 relative flex justify-center items-center bg-black overflow-hidden">
                {viewingGeneration.originalImage ? (
                  <div className="w-full h-full">
                    <ReactCompareSlider
                      itemOne={<ReactCompareSliderImage src={viewingGeneration.originalImage} alt="Gốc" />}
                      itemTwo={<ReactCompareSliderImage src={viewingGeneration.resultImage} alt="Kết quả" />}
                      className="w-full h-full"
                    />
                    <div className="absolute top-4 left-4 font-mono text-[9px] md:text-[10px] bg-black/60 backdrop-blur-md px-2 py-1 rounded pointer-events-none z-10 border border-white/10 uppercase">Gốc</div>
                    <div className="absolute top-4 right-4 font-mono text-[9px] md:text-[10px] bg-brand text-black px-2 py-1 rounded font-bold pointer-events-none z-10 shadow-[0_0_10px_rgba(204,255,0,0.5)] uppercase">AI Tái tạo</div>
                  </div>
                ) : (
                  <img src={viewingGeneration.resultImage} alt="Kết quả" className="w-full h-full object-contain" />
                )}
              </div>

              <div className="p-4 md:p-6 bg-[#111] border-t border-white/10 flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                  <div className="flex items-start gap-3">
                    <p className="text-[10px] md:text-xs font-mono opacity-70 italic max-h-12 md:max-h-16 overflow-y-auto leading-tight flex-1">
                      "{viewingGeneration.prompt}"
                    </p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(viewingGeneration.prompt);
                        setIsPromptCopied(true);
                        setTimeout(() => setIsPromptCopied(false), 2000);
                      }}
                      className="p-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded transition-colors shrink-0 flex items-center justify-center font-bold text-[10px]"
                    >
                      {isPromptCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="text-[9px] text-white/30 mt-2 uppercase tracking-widest font-mono">
                    Hoàn thành: {viewingGeneration.createdAt?.toDate ? viewingGeneration.createdAt.toDate().toLocaleString() : 'Vừa xong'}
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => downloadImage(viewingGeneration.resultImage, `HLF-AI-${viewingGeneration.id}.jpg`)}
                        className="flex-1 md:flex-none px-6 py-3 bg-brand text-black font-bold rounded-xl text-xs hover:scale-105 transition-all flex items-center justify-center gap-2"
                    >
                       <Download className="w-4 h-4" /> TẢI ẢNH HD 
                    </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingGenerationId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold font-mono tracking-tighter uppercase mb-2">Xóa thiết kế này?</h3>
                <p className="text-white/60 text-sm">Hành động này không thể hoàn tác. Thiết kế sẽ bị xóa vĩnh viễn khỏi thư viện của bạn.</p>
              </div>
              <div className="p-4 bg-white/5 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setDeletingGenerationId(null)}
                  className="px-4 py-2 hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
                >
                  Hủy
                </button>
                <button 
                  onClick={deleteGeneration}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg transition-colors text-sm font-medium hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                  Xóa Vĩnh Viễn
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
