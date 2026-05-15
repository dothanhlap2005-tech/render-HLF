import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, updateDoc, serverTimestamp, deleteDoc, setDoc, getDoc, startAfter } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Image as ImageIcon, Users, CheckCircle, XCircle, Trash2, Plus, X, BarChart3, Download } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

interface Generation {
  id: string;
  userId: string;
  prompt: string;
  style: string;
  roomType: string;
  originalImage: string;
  resultImage: string;
  createdAt: any;
}

interface UserData extends UserProfile {
  id: string;
  createdAt: any;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
  const [hasMoreGenerations, setHasMoreGenerations] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isEditingApiKeys, setIsEditingApiKeys] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    OPENAI_API_KEY: '',
    REPLICATE_API_TOKEN: '',
    SEEDANCE_API_KEY: '',
    SEEDANCE_API_URL: ''
  });
  const [savingApiKeys, setSavingApiKeys] = useState(false);

  const fetchApiKeys = async () => {
    try {
      // Temporary solution: API keys should ideally be securely read by the admin backend.
      // But since Admin is authenticated, we can fetch from Firestore directly.
      const docRef = doc(db, 'settings', 'apikeys');
      const docSnap = await getDocs(query(collection(db, 'settings'), limit(1))); // to check connection
      const settingDoc = await getDoc(docRef).catch(() => null);
      if (settingDoc && settingDoc.exists()) {
        const data = settingDoc.data();
        setApiKeys({
          OPENAI_API_KEY: data.OPENAI_API_KEY || '',
          REPLICATE_API_TOKEN: data.REPLICATE_API_TOKEN || '',
          SEEDANCE_API_KEY: data.SEEDANCE_API_KEY || '',
          SEEDANCE_API_URL: data.SEEDANCE_API_URL || ''
        });
      }
    } catch (err) {
      console.error("Lỗi khi tải API keys", err);
    }
  };

  const handleSaveApiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingApiKeys(true);
    try {
      const docRef = doc(db, 'settings', 'apikeys');
      await setDoc(docRef, apiKeys, { merge: true });
      setIsEditingApiKeys(false);
      alert('Đã lưu API Keys thành công!');
    } catch (err: any) {
      setError(`Lỗi lưu API keys: ${err.message}`);
    } finally {
      setSavingApiKeys(false);
    }
  };
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [addingUserProgress, setAddingUserProgress] = useState(false);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUserProgress(true);
    setError(null);
    try {
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);
      const secondaryDb = getFirestore(secondaryApp, firebaseConfig.firestoreDatabaseId);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPassword);
      const newUid = userCredential.user.uid;

      await setDoc(doc(secondaryDb, 'users', newUid), {
        email: newUserEmail,
        displayName: newUserName || null,
        isApproved: false,
        credits: 10,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', newUid), {
        isApproved: true,
        updatedAt: serverTimestamp()
      });

      await signOut(secondaryAuth);
      setIsAddingUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      fetchUsers();
      alert('Tạo người dùng và cấp quyền thành công!');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Lỗi: Cần bật đăng nhập bằng Email/Password trong Firebase Console (Authentication > Sign-in methods).');
      } else {
        setError(`Lỗi tạo user: ${err.message}`);
      }
    } finally {
      setAddingUserProgress(false);
    }
  };

  const fetchGenerations = async (isLoadMore = false) => {
    setLoadingGenerations(true);
    try {
      let q;
      if (isLoadMore && lastVisibleDoc) {
        q = query(
          collection(db, 'generations'),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisibleDoc),
          limit(20)
        );
      } else {
        q = query(
          collection(db, 'generations'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      }
      
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Generation[];
      
      if (docs.length < 20) {
        setHasMoreGenerations(false);
      } else {
        setHasMoreGenerations(true);
      }

      if (isLoadMore) {
        setGenerations(prev => [...prev, ...docs]);
      } else {
        setGenerations(docs);
      }

      if (snapshot.docs.length > 0) {
        setLastVisibleDoc(snapshot.docs[snapshot.docs.length - 1]);
      } else if (!isLoadMore) {
        setLastVisibleDoc(null);
      }
    } catch (err: any) {
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          setError(`Lỗi tạo ảnh: ${parsed.error} (${parsed.operationType})`);
        } catch {
          setError(`Lỗi: ${err.message}`);
        }
      }
    } finally {
      setLoadingGenerations(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];
      setUsers(docs);
    } catch (err: any) {
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          setError(`Lỗi load user: ${parsed.error} (${parsed.operationType})`);
        } catch {
          setError(`Lỗi: ${err.message}`);
        }
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleApproval = async (userId: string, currentStatus: boolean, currentCredits: number) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isApproved: !currentStatus,
        credits: currentCredits,
        updatedAt: serverTimestamp()
      });
      fetchUsers(); // Refresh local list
    } catch (err: any) {
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          setError(`Lỗi update user: ${parsed.error} (${parsed.operationType})`);
        } catch {
          setError(`Lỗi: ${err.message}`);
        }
      }
    }
  };

  const updateCredits = async (userId: string, newCredits: number, isApproved: boolean) => {
    try {
      if (isNaN(newCredits)) return;
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        credits: newCredits,
        isApproved: isApproved, // keeping current isApproved status
        updatedAt: serverTimestamp()
      });
      fetchUsers();
    } catch (err: any) {
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          setError(`Lỗi update credits: ${parsed.error} (${parsed.operationType})`);
        } catch {
          setError(`Lỗi: ${err.message}`);
        }
      }
    }
  };

  const deleteGeneration = async (genId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ảnh này không?')) return;
    try {
      await deleteDoc(doc(db, 'generations', genId));
      setGenerations(generations.filter(g => g.id !== genId));
    } catch (err: any) {
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          setError(`Lỗi xóa ảnh: ${parsed.error} (${parsed.operationType})`);
        } catch {
          setError(`Lỗi: ${err.message}`);
        }
      }
    }
  };

  useEffect(() => {
    if (user && !loading) {
      fetchGenerations();
      fetchUsers();
      fetchApiKeys();
    }
  }, [user, loading]);

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

  const isAdmin = user.email === 'dothanhlap2005@gmail.com'; 

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Quyền truy cập bị từ chối</h1>
          <p className="text-white/50 mb-6">Bạn không có quyền xem trang này.</p>
          <Link to="/" className="text-brand hover:underline flex items-center gap-2 justify-center">
            <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const refreshAll = () => {
    setError(null);
    fetchGenerations();
    fetchUsers();
  };
  
  const exportToCSV = () => {
    if (!generations.length) {
      alert("Không có dữ liệu để xuất.");
      return;
    }
    
    // Define the CSV header
    const headers = ["userId", "prompt", "style", "roomType", "createdAt", "resultImage"];
    
    // Map the generation data into rows
    const rows = generations.map(gen => {
      const prompt = gen.prompt ? `"${gen.prompt.replace(/"/g, '""')}"` : "";
      const date = (gen.createdAt && gen.createdAt.toDate) 
        ? gen.createdAt.toDate().toISOString()
        : gen.createdAt 
          ? new Date(gen.createdAt.seconds * 1000).toISOString()
          : "";
      
      return [
        gen.userId || '',
        prompt,
        gen.style || '',
        gen.roomType || '',
        date,
        gen.resultImage || ''
      ].join(",");
    });
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `generations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const getUserDisplayName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u ? (u.displayName || u.email) : userId.substring(0,8) + '...';
  };

  const filteredGenerations = selectedUserId 
    ? generations.filter(g => g.userId === selectedUserId)
    : generations;

  const today = new Date();
  today.setHours(0,0,0,0);
  const todayGenerations = generations.filter(g => g.createdAt?.toDate && g.createdAt.toDate() >= today).length;
  
  // Get top users
  const userGenCounts: Record<string, number> = {};
  generations.forEach(g => {
    userGenCounts[g.userId] = (userGenCounts[g.userId] || 0) + 1;
  });
  const topUserEntry = Object.entries(userGenCounts).sort((a,b) => b[1] - a[1])[0];
  const topUserId = topUserEntry ? topUserEntry[0] : null;
  const topUserName = topUserId ? getUserDisplayName(topUserId) : 'N/A';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-3xl font-bold font-mono tracking-tight">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportToCSV}
              disabled={loadingGenerations || generations.length === 0}
              className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Xuất CSV"
            >
              <Download className="w-4 h-4" />
              Xuất CSV
            </button>
            <button 
              onClick={refreshAll}
              disabled={loadingGenerations || loadingUsers}
              className="flex items-center gap-2 bg-brand text-black px-4 py-2 rounded-lg font-medium hover:bg-brand/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${(loadingGenerations || loadingUsers) ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            <button 
              onClick={() => setIsEditingApiKeys(true)}
              className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              Sửa API Keys
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-200 border border-red-500/50 p-4 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="glass-panel p-4 flex flex-col">
            <span className="text-white/50 text-sm font-medium mb-1">Số ảnh đang hiển thị</span>
            <span className="text-2xl font-bold font-mono">{generations.length}</span>
          </div>
          <div className="glass-panel p-4 flex flex-col">
            <span className="text-white/50 text-sm font-medium mb-1">Tạo trong hôm nay</span>
            <span className="text-2xl font-bold font-mono text-brand">{todayGenerations}</span>
          </div>
          <div className="glass-panel p-4 flex flex-col">
            <span className="text-white/50 text-sm font-medium mb-1">Top User</span>
            <span className="text-lg font-bold truncate" title={topUserName}>{topUserName}</span>
            <span className="text-xs text-white/40">{topUserEntry ? `${topUserEntry[1]} ảnh` : ''}</span>
          </div>
          <div className="glass-panel p-4 flex flex-col">
            <span className="text-white/50 text-sm font-medium mb-1">Tổng người dùng</span>
            <span className="text-2xl font-bold font-mono">{users.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Users column */}
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium flex items-center gap-2">
                <Users className="w-5 h-5 text-brand" />
                Quản lý người dùng
              </h2>
              <button 
                onClick={() => setIsAddingUser(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
              >
                <Plus className="w-4 h-4" /> Thêm người dùng
              </button>
            </div>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {loadingUsers ? <p className="text-white/50">Đang tải...</p> : users.map(u => (
                <div 
                  key={u.id} 
                  className={`bg-white/5 border p-4 rounded-xl flex items-center justify-between transition-colors ${selectedUserId === u.id ? 'border-brand bg-brand/5' : 'border-white/10 hover:bg-white/10'}`}
                >
                  <div className="cursor-pointer flex-1" onClick={() => setSelectedUserId(selectedUserId === u.id ? null : u.id)}>
                    <div className="font-medium flex items-center gap-2">
                      {u.displayName || u.email}
                      {selectedUserId === u.id && <span className="text-[10px] bg-brand text-black px-1.5 py-0.5 rounded uppercase font-bold">Đang lọc</span>}
                    </div>
                    <div className="text-sm text-white/50">{u.email}</div>
                    <div className="text-xs text-brand mt-1 font-mono">
                      Credits: {u.credits !== undefined ? u.credits : 'N/A'} 
                      <button onClick={(e) => { e.stopPropagation(); updateCredits(u.id, (u.credits || 0) + 10, u.isApproved); }} className="ml-2 px-1.5 py-0.5 bg-brand/20 text-brand rounded hover:bg-brand/40 transition-colors">+10</button>
                      <button onClick={(e) => { e.stopPropagation(); updateCredits(u.id, Math.max(0, (u.credits || 0) - 10), u.isApproved); }} className="ml-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40 transition-colors">-10</button>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleApproval(u.id, u.isApproved, u.credits !== undefined ? u.credits : 10); }}
                    className={`ml-4 shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      u.isApproved 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {u.isApproved ? (
                      <><CheckCircle className="w-4 h-4" /> Đã cấp quyền</>
                    ) : (
                      <><XCircle className="w-4 h-4" /> Chưa cấp quyền</>
                    )}
                  </button>
                </div>
              ))}
              {users.length === 0 && !loadingUsers && <p className="text-white/50 text-center py-4">Chưa có người dùng</p>}
            </div>
          </div>

          {/* Generations column */}
          <div className="glass-panel p-6 flex flex-col h-full max-h-[600px]">
            <h2 className="text-xl font-medium mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-brand" />
                Lịch sử tạo ảnh {selectedUserId && `của ${getUserDisplayName(selectedUserId)}`}
              </div>
              {selectedUserId && (
                <button onClick={() => setSelectedUserId(null)} className="text-xs text-white/50 hover:text-white underline">
                  Bỏ lọc
                </button>
              )}
            </h2>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {filteredGenerations.map(gen => (
                <div key={gen.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-brand/50 transition-colors flex relative group">
                   <div className="w-32 bg-black/50 shrink-0">
                     <img src={gen.resultImage} alt="Result" className="w-full h-full object-cover" />
                   </div>
                   <div className="p-4 flex-1">
                     <div className="text-xs text-brand mb-1">
                       {gen.style} • {gen.roomType}
                     </div>
                     <div className="text-sm text-white/70 line-clamp-2 mb-2 font-mono" title={gen.prompt}>
                       {gen.prompt}
                     </div>
                     <div className="text-xs text-white/40 flex justify-between">
                        <span title={gen.userId}>User: {getUserDisplayName(gen.userId)}</span>
                        <span>{gen.createdAt?.toDate ? gen.createdAt.toDate().toLocaleString() : 'New'}</span>
                     </div>
                   </div>
                   <button 
                     onClick={() => deleteGeneration(gen.id)}
                     title="Xóa ảnh"
                     className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              ))}
              {filteredGenerations.length === 0 && !loadingGenerations && <p className="text-white/50 text-center py-4">Chưa có ảnh nào được tạo</p>}
              
              <div className="pt-4 flex justify-center pb-4">
                {loadingGenerations ? (
                  <p className="text-brand font-medium">Đang tải...</p>
                ) : hasMoreGenerations && !selectedUserId && (
                  <button 
                    onClick={() => fetchGenerations(true)}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Tải thêm
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium">Thêm người dùng mới</h2>
              <button onClick={() => setIsAddingUser(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Email <span className="text-red-500">*</span></label>
                <input 
                  type="email" 
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-2 text-sm focus:border-brand/50 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Mật khẩu <span className="text-red-500">*</span></label>
                <input 
                  type="password" 
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-2 text-sm focus:border-brand/50 focus:outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Tên hiển thị</label>
                <input 
                  type="text" 
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded p-2 text-sm focus:border-brand/50 focus:outline-none"
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAddingUser(false)}
                  className="px-4 py-2 rounded text-sm text-white/70 hover:bg-white/10"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={addingUserProgress}
                  className="px-4 py-2 bg-brand text-black rounded text-sm font-medium hover:bg-brand/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {addingUserProgress && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API Keys Modal */}
      {isEditingApiKeys && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
              <h2 className="text-xl font-medium tracking-tight">Cấu hình API Keys</h2>
              <button onClick={() => setIsEditingApiKeys(false)} className="text-white/50 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveApiKeys} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-white/80">OpenAI API Key (DALL-E 3)</label>
                <input 
                  type="password" 
                  value={apiKeys.OPENAI_API_KEY}
                  onChange={(e) => setApiKeys({...apiKeys, OPENAI_API_KEY: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-brand/50 focus:outline-none transition-colors"
                  placeholder="sk-..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-white/80">Replicate API Token</label>
                <input 
                  type="password" 
                  value={apiKeys.REPLICATE_API_TOKEN}
                  onChange={(e) => setApiKeys({...apiKeys, REPLICATE_API_TOKEN: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-brand/50 focus:outline-none transition-colors"
                  placeholder="r8_..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-white/80">Seedance API Key</label>
                  <input 
                    type="password" 
                    value={apiKeys.SEEDANCE_API_KEY}
                    onChange={(e) => setApiKeys({...apiKeys, SEEDANCE_API_KEY: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-brand/50 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-white/80">Seedance API URL</label>
                  <input 
                    type="url" 
                    value={apiKeys.SEEDANCE_API_URL}
                    onChange={(e) => setApiKeys({...apiKeys, SEEDANCE_API_URL: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-brand/50 focus:outline-none transition-colors"
                    placeholder="https://api.seedance.com/v1"
                  />
                </div>
              </div>
              
              <div className="pt-6 flex justify-end gap-3 border-t border-white/5 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsEditingApiKeys(false)}
                  className="px-5 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 font-medium transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={savingApiKeys}
                  className="px-5 py-2.5 bg-brand text-black rounded-lg text-sm font-bold hover:bg-brand/90 disabled:opacity-50 flex items-center gap-2 transition-transform active:scale-95"
                >
                  {savingApiKeys && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Lưu cấu hình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
