import React, { useState, useEffect, useRef } from 'react';
import { 
  Vote, 
  MessageCircle, 
  Award, 
  Trophy, 
  UserCheck, 
  LogOut, 
  ChevronRight, 
  Home, 
  History as HistoryIcon,
  Mic,
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Play,
  Languages,
  X,
  ExternalLink,
  Camera,
  Search,
  Share2,
  Download,
  Volume2,
  VolumeX,
  Rocket,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, signInWithGoogle, logout } from './lib/firebase';
import { 
  getUserProfile,
  createUserProfile,
  saveChatMessage, 
  getChatHistory,
  saveQuizAttempt,
  getQuizHistory,
  getAnsweredQuestionTexts,
  handleFirestoreError,
  OperationType
} from './lib/db';
import { generateProfileQuestion, generateQuiz, chatWithAI } from './lib/gemini';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { translations } from './lib/translations';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import confetti from 'canvas-confetti';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import { toPng, toSvg } from 'html-to-image';
import gsap from 'gsap';

// --- UTILITIES & HOOKS ---

const useTranslation = (profile: any) => {
  return { ...translations.English, ...(profile?.language ? (translations[profile.language] || {}) : {}) };
};

const triggerHaptic = (intensity: number = 50) => {
  if ('vibrate' in navigator) navigator.vibrate(intensity);
};

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center p-10 bg-white text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
            <AlertCircle size={40} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-500 mb-8 max-w-xs mx-auto text-sm font-medium">The application encountered an unexpected error. Try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-navy text-white rounded-2xl font-bold active:scale-95 transition-all shadow-lg"
          >
            Refresh App
          </button>
          {process.env.NODE_ENV !== 'production' && (
            <pre className="mt-8 p-4 bg-slate-50 rounded-xl text-[10px] text-red-800 text-left overflow-auto max-w-full">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

type View = 'loading' | 'login' | 'language' | 'profiling' | 'dashboard' | 'chat' | 'quiz' | 'history' | 'profile_edit' | 'daily_lesson' | 'badge';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [view, setView] = useState<View>('loading');
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string>('default_chat');
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslation(profile);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const items = containerRef.current.querySelectorAll('.reveal-item');
        if (items.length > 0) {
          // Set initial state via GSAP to avoid flash
          gsap.set(items, { autoAlpha: 0, y: 15, scale: 0.98 });
          
          gsap.to(items, { 
            autoAlpha: 1, 
            y: 0, 
            scale: 1, 
            duration: 0.5, 
            stagger: 0.08, 
            ease: 'power2.out',
            clearProps: 'all'
          });
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [view]);

  const startNewSession = () => {
    setSessionId(`session_${Date.now()}`);
  };

  // Add this to make it accessible to components inside renderView
  (window as any).setSessionIdExternal = (id: string) => setSessionId(id);

  useEffect(() => {
    let fired = false;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (fired) return;
      
      if (u) {
        setUser(u);
        getUserProfile(u.uid).then(p => {
          if (p) {
            setProfile(p);
            if (!p.language) setView('language');
            else if (!p.onboarded) setView('profiling');
            else setView('dashboard');
          } else {
            setView('language');
          }
        }).catch(() => {
          setView('language');
        });
      } else {
        setUser(null);
        setProfile(null);
        setView('login');
      }
      fired = true;
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const path = `users/${user.uid}`;
      return onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      const u = await signInWithGoogle();
      if (u) {
        let p;
        try {
          p = await getUserProfile(u.uid);
        } catch (e) {
          // getUserProfile already handles error
        }
        if (p) {
          setProfile(p);
          if (!p.language) setView('language');
          else if (!p.onboarded) setView('profiling');
          else setView('dashboard');
        } else {
          setView('language');
        }
      }
    } catch (e) {
      console.error("Login Error", e);
    }
  };

  const handleLanguageSelect = async (lang: string) => {
    if (!user) return;
    const existing = await getUserProfile(user.uid);
    if (!existing) {
      await createUserProfile(user.uid, { 
        language: lang,
        knowledgeLevel: 'Beginner',
        points: 0,
        onboarded: false
      });
    } else {
      const { updateDoc, doc } = await import('firebase/firestore');
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), { language: lang, onboarded: false });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
    setView('profiling');
  };

  const completeProfiling = async (level: string) => {
    if (!user) return;
    const { updateDoc, doc } = await import('firebase/firestore');
    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), { 
        knowledgeLevel: level,
        onboarded: true,
        lastActive: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    setView('dashboard');
  };

  const awardPoints = (amount: number) => {
    setPointsEarned(amount);
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f97316', '#15803d', '#ffffff']
    });
    setTimeout(() => setPointsEarned(null), 3000);
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  const renderView = () => {
    switch (view) {
      case 'loading': return <LoadingView />;
      case 'login': return <LoginView onLogin={handleLogin} />;
      case 'language': return <LanguageSelection onSelect={handleLanguageSelect} />;
      case 'profiling': return <ProfilingView profile={profile} onComplete={completeProfiling} />;
      case 'dashboard': return <Dashboard profile={profile} setView={setView} onLogout={handleLogout} />;
      case 'chat': return <ChatView profile={profile} user={user} setView={setView} sessionId={sessionId} startNewSession={startNewSession} handleSend={handleSendGlobal} />;
      case 'quiz': return <QuizView profile={profile} user={user} awardPoints={awardPoints} setView={setView} />;
      case 'history': return <HistoryView user={user} setView={setView} profile={profile} />;
      case 'profile_edit': return <ProfileEditView profile={profile} setView={setView} onComplete={completeProfiling} onLangSelect={handleLanguageSelect} />;
      case 'daily_lesson': return <DailyLessonView profile={profile} user={user} setView={setView} awardPoints={awardPoints} />;
      case 'badge': return <PledgeView profile={profile} setView={setView} />;
      default: return <LoadingView />;
    }
  };

  const handleSendGlobal = async (text: string, currentMessages: any[]) => {
    if (!user || !profile) return;
    try {
      const { addDoc, setDoc, doc, getDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const messagesRef = collection(db, 'users', user.uid, 'sessions', sessionId, 'messages');
      const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);

      // Create/Update session metadata for history
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) {
        await setDoc(sessionRef, {
          title: text.length > 40 ? text.substring(0, 40) + '...' : text,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: text
        });
      } else {
        await setDoc(sessionRef, {
          updatedAt: serverTimestamp(),
          lastMessage: text
        }, { merge: true });
      }
      
      await addDoc(messagesRef, {
        text,
        role: 'user',
        timestamp: serverTimestamp()
      });

      const answeredTexts = await getAnsweredQuestionTexts(user.uid);
      const response = await chatWithAI(currentMessages, text, profile.language, profile, answeredTexts);
      
      // Save MCQs to bank
      const mediaRegex = /:::MEDIA_BLOCK\s*([\s\S]*?)\s*:::/i;
      const mediaMatch = response.match(mediaRegex);
      if (mediaMatch) {
        try {
          let jsonContent = mediaMatch[1].trim();
          jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/```$/, '').trim();
          const finalJson = jsonContent.startsWith('{') ? jsonContent : `{${jsonContent}}`;
          const mediaData = JSON.parse(finalJson);
          if (mediaData.type === 'mcq') {
            await addDoc(collection(db, 'questions_bank'), {
              ...mediaData,
              createdAt: serverTimestamp(),
              createdBy: user.uid
            });
          }
        } catch (e) {
          console.error("Failed to save MCQ to bank", e);
        }
      }
      
      const pointsMatch = response.match(/POINTS_AWARDED: (\d+)/);
      const points = pointsMatch ? parseInt(pointsMatch[1]) : 10;
      
      await addDoc(messagesRef, {
        text: response, 
        role: 'model',
        timestamp: serverTimestamp(),
        pointsEarned: points
      });

      // Update session with model's response too
      await setDoc(sessionRef, {
        updatedAt: serverTimestamp(),
        lastMessage: response.length > 60 ? response.substring(0, 60) + '...' : response
      }, { merge: true });

      const { updateDoc, increment } = await import('firebase/firestore');
      try {
        await updateDoc(doc(db, 'users', user.uid), { points: increment(points) });
      } catch (e) { console.error(e); }

    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ErrorBoundary>
      <div className="h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full max-w-md mx-auto relative overflow-hidden ring-1 ring-slate-100 bg-white shadow-2xl"
          >
            {renderView()}
            
            <AnimatePresence>
              {pointsEarned && (
                <motion.div 
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: -50, opacity: 1 }}
                  exit={{ y: -100, opacity: 0 }}
                  className="fixed bottom-32 left-0 right-0 p-4 pointer-events-none z-50 flex justify-center"
                >
                  <div className="bg-white border-2 border-primary text-slate-900 p-6 rounded-[32px] shadow-2xl flex flex-col items-center gap-2 max-w-xs ring-4 ring-orange-500/10">
                    <Trophy size={40} className="text-primary animate-bounce" />
                    <h2 className="text-xl font-black">{t.congrats || 'Great!'}</h2>
                    <p className="text-primary font-black text-2xl">+{pointsEarned} {t.pointsEarned || 'Points'}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- SUB-VIEWS ---

function LoadingView() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOffline(true);
    }, 15000); // 15 seconds is more reasonable for slow connections
    return () => clearTimeout(timer);
  }, []);

  const handleRetry = () => {
    setIsOffline(false);
    // Force a small delay then reload to give infra a chance
    setTimeout(() => window.location.reload(), 100);
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-white p-8 text-center">
      {!isOffline ? (
        <div className="space-y-6 flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-orange-500/10" />
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Initializing Civic Guard...</p>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h2 className="text-xl font-bold">Connecting...</h2>
          <p className="text-slate-500 max-w-xs mx-auto">We're having trouble reaching the voter guide server. Please check your internet.</p>
          <button 
            onClick={handleRetry}
            className="px-8 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
          >
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const performLogin = async () => {
    setIsLoggingIn(true);
    await onLogin();
    setIsLoggingIn(false);
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-between p-8 text-center bg-white">
      <div className="mt-20 reveal-item">
        <div className="w-20 h-20 bg-primary rounded-[30px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/20">
          <Vote size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Matdaan Mitra</h1>
        <p className="text-slate-600 text-lg px-4">Every Vote Counts. Every Voice Matters.</p>
      </div>

      <div className="w-full max-w-sm space-y-4 reveal-item">
        <button
          disabled={isLoggingIn}
          onClick={performLogin}
          className="w-full bg-slate-900 text-white rounded-2xl py-4 px-6 font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform disabled:opacity-50"
        >
          {isLoggingIn ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 rounded-full" alt="Google" />
          )}
          {isLoggingIn ? 'Signing in...' : 'Continue with Google'}
        </button>
        <p className="text-xs text-slate-400 px-8 leading-relaxed">By continuing, you agree to our terms of service and voter privacy policy.</p>
      </div>
    </div>
  );
}

function LanguageSelection({ onSelect }: { onSelect: (lang: string) => void }) {
  const languages = [
    { name: 'English', code: 'English' },
    { name: 'हिन्दी', code: 'Hindi' },
    { name: 'বাংলা', code: 'Bengali' },
    { name: 'தமிழ்', code: 'Tamil' },
    { name: 'తెలుగు', code: 'Telugu' },
    { name: 'मराठी', code: 'Marathi' },
    { name: 'ગુજરાતી', code: 'Gujarati' },
    { name: 'ಕನ್ನಡ', code: 'Kannada' },
  ];
  
  return (
    <div className="h-full w-full p-8 flex flex-col bg-white overflow-y-auto native-scroller pb-24">
      <header className="mb-12 pt-12 reveal-item">
        <div className="w-14 h-14 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
          <Languages className="text-primary" size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Choose your Language</h1>
        <p className="text-slate-500 font-medium">Select the language you are comfortable with</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {languages.map((l) => (
          <button
            key={l.code}
            onClick={() => onSelect(l.code)}
            className="p-6 rounded-[32px] bg-slate-50 border-2 border-slate-100 text-left font-bold text-lg hover:border-primary active:scale-95 transition-all flex flex-col justify-between h-40 reveal-item"
          >
            <span>{l.name}</span>
            <span className="text-xs text-slate-400 font-black uppercase mt-2 tracking-widest">{l.code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfilingView({ profile, onComplete }: { profile: any, onComplete: (level: string) => void }) {
  const t = useTranslation(profile);
  const levels = [
    { id: 'Beginner', title: t.beginner, desc: t.beginnerDesc, color: 'bg-green-50 text-green-600', icon: Vote },
    { id: 'Intermediate', title: t.intermediate, desc: t.intermediateDesc, color: 'bg-blue-50 text-blue-600', icon: UserCheck },
    { id: 'Advanced', title: t.advanced, desc: t.advancedDesc, color: 'bg-purple-50 text-purple-600', icon: Award },
  ];

  return (
    <div className="h-full w-full p-8 flex flex-col bg-white">
      <header className="mb-12 pt-12 text-left reveal-item">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">{t.selectLevel}</h1>
        <p className="text-slate-500 font-bold leading-relaxed">{t.langSub}</p>
      </header>

      <div className="flex-1 space-y-4">
        {levels.map((level) => (
          <button
            key={level.id}
            onClick={() => onComplete(level.id)}
            className="w-full p-6 h-32 rounded-[32px] border-4 border-slate-50 hover:border-primary bg-white flex items-center gap-6 transition-all active:scale-95 group text-left shadow-sm hover:shadow-xl reveal-item"
          >
            <div className={`w-16 h-16 rounded-2xl ${level.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <level.icon size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 leading-none mb-1">{level.title}</h3>
              <p className="text-sm text-slate-500 font-bold">{level.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PledgeView({ profile, setView }: { profile: any, setView: (v: View) => void }) {
  const t = useTranslation(profile);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const generateAvatarUrl = () => {
    const seed = encodeURIComponent(profile?.displayName || 'Citizen');
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=e2e8f0`;
  };

  const handleShareClick = async () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    if (badgeRef.current) gsap.fromTo(badgeRef.current, { scale: 0.9, rotation: -2 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.5)' });
    
    setIsGenerating(true);
    try {
      if (badgeRef.current) {
         const dataUrl = await toPng(badgeRef.current, { cacheBust: true, pixelRatio: 2, quality: 1.0 });
         setShareImage(dataUrl);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (type: 'png' | 'svg') => {
    if (!badgeRef.current) return;
    const download = async () => {
      try {
        const method = type === 'svg' ? toSvg : toPng;
        const dataUrl = await method(badgeRef.current!, { cacheBust: true, pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `matdan-mitra-badge.${type}`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error(err);
      }
    };
    download();
  };

  const nativeShare = async () => {
    if (!shareImage) return;
    try {
      const res = await fetch(shareImage);
      const blob = await res.blob();
      const file = new File([blob], `matdan-mitra-badge.png`, { type: blob.type });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "My Active Voter Badge",
          text: "I pledged my vote on Matdan Mitra! Be an active citizen.",
          files: [file]
        });
      } else {
        alert("Native sharing is not supported on this device. Please use download.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 text-slate-900 overflow-y-auto native-scroller relative pb-20">
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100/50 blur-[100px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100/50 blur-[100px] rounded-full" />
      
      <header className="p-6 flex items-center justify-between relative z-10">
        <button onClick={() => setView('dashboard')} className="w-12 h-12 bg-white border border-slate-200 rounded-[20px] shadow-sm flex items-center justify-center text-slate-500 active:scale-95 transition-transform"><X size={24} /></button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 pb-4 relative z-10 w-full max-w-md mx-auto">
        <h2 className="text-4xl font-black text-center mb-2 tracking-tight text-slate-900 drop-shadow-sm">Social Badge</h2>
        <p className="text-slate-500 font-bold text-center mb-8 max-w-[80%] mx-auto leading-relaxed text-sm">Share your verified voter status to inspire others.</p>

        {/* Outer container for aspect ratio and scaling */}
        <div className="w-full max-w-sm relative group scale-100 origin-center transition-transform hover:scale-[1.02] duration-500">
          
          {/* THE ACTUAL BADGE CAPTURED BY html-to-image */}
          <div ref={badgeRef} className="bg-white rounded-[40px] border-4 border-white shadow-2xl overflow-hidden flex flex-col ring-1 ring-slate-100 relative"
               style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(230,235,245,0.5) 1px, transparent 0)', backgroundSize: '16px 16px' }}
          >
             
             {/* Ticket cutouts */}
             <div className="absolute -left-5 top-[55%] -translate-y-1/2 w-10 h-10 bg-slate-50 rounded-full border-r-4 border-white z-20 shadow-inner ring-1 ring-slate-100" />
             <div className="absolute -right-5 top-[55%] -translate-y-1/2 w-10 h-10 bg-slate-50 rounded-full border-l-4 border-white z-20 shadow-inner ring-1 ring-slate-100" />
             <div className="absolute top-[55%] outline-dashed outline-2 outline-slate-200/60 w-full z-10" />

             {/* Shiny Glitter Overlay */}
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/80 to-transparent -translate-x-[150%] animate-[shimmer_3s_infinite] skew-x-[-20deg] z-10 pointer-events-none mix-blend-overlay" />
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/5 z-0" />

             <div className="p-10 pb-12 flex flex-col items-center text-center relative z-10">
               {/* ID Card Header */}
               <div className="w-full flex justify-between items-center mb-8">
                 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                   <Vote size={20} className="text-white"/>
                 </div>
                 <span className="font-black text-[10px] tracking-widest text-primary uppercase bg-orange-50 px-4 py-2 rounded-full border border-orange-100 flex items-center gap-1.5 shadow-sm">
                   <CheckCircle2 size={12} strokeWidth={3} /> Verified
                 </span>
               </div>

               <div className="w-36 h-36 rounded-full border-4 border-white bg-slate-200 mb-6 shadow-2xl relative z-10 overflow-hidden flex-shrink-0 group-hover:shadow-[0_0_40px_rgba(255,153,51,0.3)] transition-shadow duration-500">
                  <img src={generateAvatarUrl()} alt="Avatar" className="w-full h-full object-cover bg-slate-100 transform group-hover:scale-110 transition-transform duration-700" crossOrigin="anonymous" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
                  <div className="absolute -bottom-1 -right-1 w-12 h-12 bg-green-500 rounded-full border-4 border-white flex items-center justify-center text-white shadow-xl">
                    <CheckCircle2 size={20} strokeWidth={3}/>
                  </div>
               </div>

               <h3 className="text-3xl font-black text-slate-900 leading-tight mb-1">{profile?.displayName || 'Citizen'}</h3>
               <p className="text-primary font-black tracking-[0.2em] uppercase text-xs opacity-90 relative inline-block">
                 Active Voter
                 <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary/30 rounded-full" />
               </p>
             </div>

             {/* Bottom Ticket Stub */}
             <div className="p-8 pt-10 flex flex-col justify-center relative z-10 bg-gradient-to-b from-slate-50/50 to-slate-100/50">
               <div className="w-full bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center justify-between shadow-slate-200/50">
                 <div className="text-left">
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Knowledge Level</p>
                   <h4 className="text-3xl font-black text-slate-900 leading-none">{profile?.points || 0} <span className="text-sm font-bold text-slate-400">XP</span></h4>
                 </div>
                 <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-primary shadow-inner">
                   <Award size={28} />
                 </div>
               </div>
             </div>
          </div>
        </div>
      </main>

      <footer className="p-6 pb-8 relative z-10 w-full max-w-md mx-auto mt-auto flex-shrink-0">
        <button 
          disabled={isGenerating}
          onClick={handleShareClick}
          className="w-full bg-primary text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all text-center group disabled:opacity-70 disabled:active:scale-100"
        >
          {isGenerating ? <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin" /> : <Share2 size={22} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />}
          {isGenerating ? 'Capturing...' : (t.shareBadge || 'Share Milestone')}
        </button>
      </footer>

      <AnimatePresence>
        {shareImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-50 flex flex-col p-6 items-center justify-center">
             <button onClick={() => setShareImage(null)} className="absolute top-8 right-8 text-white/50 hover:text-white p-4 bg-white/10 rounded-full active:scale-95 transition-transform">
               <X size={24} />
             </button>
             
             <h3 className="text-2xl font-black text-white mb-8">Share Milestone</h3>
             
             <motion.img 
               initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 20 }}
               src={shareImage} alt="Badge Preview" 
               className="w-full max-w-sm rounded-[32px] shadow-[0_20px_50px_rgba(255,153,51,0.3)] mb-10 border border-white/10"
             />

             <div className="w-full max-w-sm flex flex-col gap-3">
               {/* Device Native Share */}
               <button onClick={nativeShare} className="w-full bg-slate-100 text-slate-900 py-4 rounded-[20px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
                 <Share2 size={18} /> Share via Apps (Instagram, WhatsApp, etc.)
               </button>
               
               {/* Direct Web Intent Fallbacks if they want (though image is hard for web intent, text works) */}
               <div className="flex gap-3">
                 <a href={`https://wa.me/?text=I+pledged+my+vote+on+Matdan+Mitra!`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#25D366] text-white py-4 rounded-[20px] font-bold flex items-center justify-center transition-all active:scale-95">
                    WhatsApp
                 </a>
                 <a href={`https://twitter.com/intent/tweet?text=I+pledged+my+vote+on+Matdan+Mitra!`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-black text-white py-4 rounded-[20px] font-bold flex items-center justify-center transition-all active:scale-95">
                    X (Twitter)
                 </a>
               </div>

               <div className="flex gap-3 mt-1">
                 <button onClick={() => downloadImage('png')} className="flex-1 bg-white/10 text-white border border-white/20 py-4 rounded-[20px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-all backdrop-blur-md hover:bg-white/20">
                   <ImageIcon size={18} /> Download PNG
                 </button>
                 <button onClick={() => downloadImage('svg')} className="flex-1 bg-white/10 text-white border border-white/20 py-4 rounded-[20px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-all backdrop-blur-md hover:bg-white/20">
                   <Download size={18} /> Download SVG
                 </button>
               </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Dashboard({ profile, setView, onLogout }: { profile: any, setView: (v: View) => void, onLogout: () => void }) {
  const t = useTranslation(profile);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-y-auto native-scroller pb-32">
      <header className="px-6 pt-12 pb-6 bg-white relative shadow-sm border-b border-slate-100/50">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
        <div className="flex justify-between items-center">
          <button onClick={() => setView('profile_edit')} className="flex items-center gap-4 active:scale-95 transition-transform group text-left">
            <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-md flex-shrink-0">
               <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile?.displayName || 'Citizen')}&backgroundColor=e2e8f0`} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-1">Voter ID</p>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none group-hover:text-primary transition-colors">{profile?.displayName?.split(' ')[0] || 'Citizen'}</h2>
            </div>
          </button>
          <button 
            onClick={onLogout}
            className="w-12 h-12 rounded-2xl bg-slate-50 hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors shadow-sm"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-4">
        
        {/* Status Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-primary to-orange-500 p-5 rounded-[28px] text-white shadow-xl shadow-orange-500/10 flex flex-col justify-between">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <Trophy size={16} className="text-white" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{t.points}</p>
               <h3 className="text-3xl font-black leading-none">{profile?.points || 0}</h3>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-[28px] shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4">
              <UserCheck size={16} />
            </div>
            <div>
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{t.expertise}</p>
               <h3 className="text-xl font-black text-slate-900 leading-none">{profile?.knowledgeLevel || 'Beginner'}</h3>
            </div>
          </div>
        </div>

        {/* Daily Lesson Card */}
        <button 
          onClick={() => setView('daily_lesson')}
          className={`w-full p-6 rounded-[32px] text-white shadow-xl text-left relative overflow-hidden group hover:scale-[0.98] transition-transform ${profile?.lastDailyLesson === new Date().toISOString().split('T')[0] ? 'bg-green-600 shadow-green-600/20 cursor-pointer' : 'bg-navy shadow-navy/20 cursor-pointer'}`}
        >
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white/10 to-transparent" />
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className={`px-3 py-1 bg-white/10 rounded-full text-[10px] font-black tracking-widest flex items-center gap-1.5 uppercase border border-white/10 backdrop-blur-md`}>
              <div className={`w-1.5 h-1.5 rounded-full ${profile?.lastDailyLesson === new Date().toISOString().split('T')[0] ? 'bg-white' : 'bg-primary animate-pulse'}`} />
              {t.dailyLesson}
            </div>
            <div className="text-[10px] bg-black/20 text-white px-3 py-1 rounded-full font-black tracking-widest uppercase">
              {t.activeStreak}: 3
            </div>
          </div>
          <h3 className="text-2xl font-black mb-1 relative z-10">{profile?.lastDailyLesson === new Date().toISOString().split('T')[0] ? 'Briefing Completed' : "Today's Briefing"}</h3>
          <p className="text-white/80 text-sm font-medium pr-10 relative z-10">{profile?.lastDailyLesson === new Date().toISOString().split('T')[0] ? "Great job! Check back tomorrow." : "Expand your knowledge with bite-sized daily modules."}</p>
          <div className={`absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-transform shadow-lg ${profile?.lastDailyLesson === new Date().toISOString().split('T')[0] ? 'bg-green-500 text-white' : 'bg-white text-primary group-hover:scale-110'}`}>
            {profile?.lastDailyLesson === new Date().toISOString().split('T')[0] ? <CheckCircle2 size={24} strokeWidth={3} /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </div>
        </button>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setView('chat')}
            className="col-span-2 p-6 bg-white rounded-[32px] flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/50 transition-all group"
          >
            <div className="text-left flex items-center gap-5">
              <div className="w-16 h-16 rounded-[20px] bg-orange-50 text-primary flex items-center justify-center group-hover:rotate-6 group-hover:scale-110 transition-all duration-500 shadow-inner">
                 <MessageCircle size={32} />
              </div>
              <div>
                <h4 className="font-black text-2xl text-slate-900 leading-none mb-1">{t.interactiveChat}</h4>
                <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">{t.chatSub}</p>
              </div>
            </div>
            <ChevronRight className="text-slate-300 group-hover:text-primary transition-colors" />
          </button>
          
          <button 
            onClick={() => setView('quiz')}
            className="p-6 bg-white rounded-[32px] flex flex-col justify-between h-48 border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all group text-left relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full blur-2xl group-hover:bg-orange-100 transition-colors duration-500" />
             <div className="relative w-12 h-12 rounded-[16px] bg-white border border-slate-100 text-slate-900 flex items-center justify-center shadow-sm group-hover:-rotate-6 group-hover:scale-110 transition-all duration-300">
               <span className="font-black text-xl">Q</span>
             </div>
             <div className="relative">
               <h4 className="font-black text-xl text-slate-900 leading-tight mb-1">{t.masterQuiz}</h4>
               <p className="text-[10px] text-orange-500 font-black tracking-widest uppercase">{t.quizSub}</p>
             </div>
          </button>

          <button 
            onClick={() => setView('history')}
            className="p-6 bg-white rounded-[32px] flex flex-col justify-between h-48 border border-slate-100 shadow-sm hover:shadow-md transition-all group text-left relative overflow-hidden"
          >
             <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full blur-2xl transition-colors duration-500" />
             <div className="relative w-12 h-12 rounded-[16px] bg-slate-50 text-slate-500 flex items-center justify-center shadow-sm group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">
               <HistoryIcon size={24} />
             </div>
             <div className="relative">
               <h4 className="font-black text-xl text-slate-900 leading-tight mb-1">{t.history}</h4>
               <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">{t.historySub}</p>
             </div>
          </button>

          <button 
            onClick={() => setView('badge')}
            className="col-span-2 p-6 bg-gradient-to-tr from-indigo-900 to-slate-900 rounded-[32px] flex items-center justify-between shadow-xl shadow-indigo-900/10 transition-all group overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-2xl rounded-full" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/20 blur-2xl rounded-full" />
            <div className="text-left flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-sm text-white flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-inner">
                 <Camera size={24} />
              </div>
              <div>
                <h4 className="font-black text-xl text-white leading-none mb-1">{t.shareBadge || 'My Social Badge'}</h4>
                <p className="text-xs text-white/50 font-bold tracking-widest uppercase">Generate & Share Banner</p>
              </div>
            </div>
            <ChevronRight className="text-white/30 group-hover:text-primary transition-colors relative z-10" />
          </button>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-8 pt-10 pointer-events-none bg-gradient-to-t from-white via-white to-transparent">
        <div className="max-w-md mx-auto h-20 bg-slate-950 rounded-[35px] shadow-2xl flex items-center justify-around px-8 pointer-events-auto border border-white/5">
          <button onClick={() => setView('dashboard')} className="p-3 text-primary relative">
             <Home size={28} strokeWidth={2.5} />
             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
          </button>
          <button onClick={() => setView('chat')} className="p-3 text-slate-500 hover:text-white transition-colors"><MessageCircle size={28} /></button>
          <button onClick={() => setView('quiz')} className="p-3 text-slate-500 hover:text-white transition-colors"><Award size={28} /></button>
          <button onClick={() => setView('history')} className="p-3 text-slate-500 hover:text-white transition-colors"><HistoryIcon size={28} /></button>
        </div>
      </div>
    </div>
  );
}

function ProfileEditView({ profile, setView, onComplete, onLangSelect }: { profile: any, setView: (v: View) => void, onComplete: (level: string) => void, onLangSelect: (lang: string) => void }) {
  const t = useTranslation(profile);
  const languages = [
    { name: 'English', code: 'English' },
    { name: 'हिन्दी', code: 'Hindi' },
    { name: 'বাংলা', code: 'Bengali' },
    { name: 'தமிழ்', code: 'Tamil' },
    { name: 'తెలుగు', code: 'Telugu' },
    { name: 'मराठी', code: 'Marathi' },
    { name: 'ગુજરાતી', code: 'Gujarati' },
    { name: 'ಕನ್ನಡ', code: 'Kannada' },
  ];

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col p-8 overflow-y-auto">
      <header className="flex items-center gap-4 mb-8 pt-4">
        <button onClick={() => setView('dashboard')} className="p-3 bg-white text-slate-400 rounded-2xl shadow-sm"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-black text-slate-900">Edit Profile</h1>
      </header>

      <div className="flex flex-col items-center mb-10">
        <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-200 mb-4 shadow-xl overflow-hidden flex-shrink-0 relative">
           <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile?.displayName || 'Citizen')}&backgroundColor=e2e8f0`} alt="Avatar" className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 leading-tight">{profile?.displayName || 'Citizen'}</h2>
        <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">{profile?.knowledgeLevel || 'Beginner'}</p>
      </div>

      <section className="mb-10 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Change Language</h3>
        <div className="grid grid-cols-2 gap-3">
          {languages.map(l => (
            <button
              key={l.code}
              onClick={() => onLangSelect(l.code)}
              className={`p-4 rounded-2xl border-2 text-sm font-bold transition-all ${profile?.language === l.code ? 'border-primary bg-orange-50 text-primary' : 'border-slate-50 bg-slate-50 text-slate-600 hover:border-slate-200'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Update Level</h3>
        <div className="space-y-3">
          {['Beginner', 'Intermediate', 'Advanced'].map(l => (
            <button
              key={l}
              onClick={() => onComplete(l)}
              className={`w-full p-5 rounded-2xl border-2 text-left font-bold transition-all ${profile?.knowledgeLevel === l ? 'border-primary bg-orange-50 text-primary' : 'border-slate-100 bg-white text-slate-600'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function ChatBubble({ message, onSelectMCQ, onSpeak }: { message: any, onSelectMCQ: (option: string, correct: boolean, explanation: string, category?: string, difficulty?: number, correctAnswer?: string) => void, onSpeak?: (text: string) => void }) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  
  const mediaRegex = /:::MEDIA_BLOCK\s*([\s\S]*?)\s*:::/i;
  const mediaMatch = message.text.match(mediaRegex);
  
  const ytRegex = /:::YOUTUBE_LINK\s*(https?:\/\/[^\s]+)\s*:::/i;
  const ytMatch = message.text.match(ytRegex);
  const imgRegex = /:::IMAGE_LINK\s*(https?:\/\/[^\s]+)\s*:::/i;
  const imgMatch = message.text.match(imgRegex);
  const searchRegex = /:::SEARCH_QUERIES\s*([\s\S]*?)\s*:::/i;
  const searchMatch = message.text.match(searchRegex);
  
  // Extract explicit Google Images and YouTube links that AI hallucinates despite prompts
  const legacyGoogleImageRegex = /Google Images:\s*(https?:\/\/[^\s]+)/i;
  const legacyGoogleImageMatch = message.text.match(legacyGoogleImageRegex);
  const legacyYouTubeRegex = /YouTube:\s*(https?:\/\/[^\s]+)/i;
  const legacyYouTubeMatch = message.text.match(legacyYouTubeRegex);
  
  const cleanText = message.text
    .replace(/:::MEDIA_BLOCK[\s\S]*?:::/gi, '')
    .replace(/:::YOUTUBE_LINK[\s\S]*?:::/gi, '')
    .replace(/:::IMAGE_LINK[\s\S]*?:::/gi, '')
    .replace(/:::SEARCH_QUERIES[\s\S]*?:::/gi, '')
    .replace(/SUGGESTED_QUESTIONS[\s\S]*/gi, '')
    .replace(/SUGGESTION[\s\S]*/gi, '')
    .replace(/Verification Tasks?:/gi, '')
    .replace(/Google Images:.*$/gim, '')
    .replace(/YouTube:.*$/gim, '')
    .trim();

  useEffect(() => {
    if (bubbleRef.current) {
      gsap.fromTo(bubbleRef.current, 
        { opacity: 0, y: 30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.7)' }
      );
    }
  }, []);
  
  let mediaData: any = null;
  if (mediaMatch) {
    try {
      let jsonContent = mediaMatch[1].trim();
      jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      const finalJson = jsonContent.startsWith('{') ? jsonContent : `{${jsonContent}}`;
      mediaData = JSON.parse(finalJson);
    } catch (e) {
      console.error("Failed to parse media block", e);
    }
  }

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleOptionClick = (i: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(i);
    setTimeout(() => setShowExplanation(true), 400);

    const isCorrect = i === mediaData.answer_index;
    onSelectMCQ(
      mediaData.options[i], 
      isCorrect, 
      mediaData.explanation, 
      mediaData.category, 
      mediaData.difficulty, 
      mediaData.options[mediaData.answer_index]
    );
    
    if (isCorrect) {
      confetti({
        particleCount: 80,
        spread: 40,
        origin: { y: 0.7 },
        colors: ['#FF9933', '#ffffff', '#138808']
      });
    }
  };

  return (
    <div ref={bubbleRef} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full mb-8`}>
      <div className={`max-w-[90%] p-6 rounded-[32px] shadow-lg text-left relative ${message.role === 'user' ? 'bg-primary text-white rounded-tr-none shadow-primary/20' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-slate-200/40'}`}>
        {message.role === 'model' && onSpeak && (
           <button 
             onClick={() => onSpeak(message.text)}
             className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-primary hover:bg-orange-50 transition-all z-10"
             title="Listen to message"
           >
             <Volume2 size={16} />
           </button>
        )}
        {cleanText && (
          <div className="markdown-body">
            <Markdown remarkPlugins={[remarkGfm]}>{cleanText}</Markdown>
          </div>
        )}

        {(ytMatch || imgMatch) && !mediaData && (
          <div className="space-y-4">
            {ytMatch && ytMatch[1] && (
              <div className="space-y-2 mt-4">
                <div className="rounded-2xl overflow-hidden shadow-lg aspect-video w-full ring-1 ring-slate-100 bg-slate-900 mt-4">
                  <LiteYouTubeEmbed 
                    id={getYoutubeId(ytMatch[1]) || ''} 
                    title="Recommended Video"
                  />
                </div>
              </div>
            )}
            
            {imgMatch && imgMatch[1] && (
              <div className="space-y-2 text-right mt-4">
                <img src={imgMatch[1]} alt="Recommended Visual" className="rounded-2xl w-full border border-slate-100 shadow-md" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
        )}

        {mediaData && (
          <div className="mt-6 space-y-5">
            {mediaData.type === 'mcq' && (
              <div className="p-5 bg-slate-50 rounded-[28px] border-2 border-slate-100/50 space-y-4">
                <div className="flex justify-between items-start gap-3">
                   <h4 className="font-extrabold text-slate-900 tracking-tight flex-1 text-lg leading-tight">{mediaData.question}</h4>
                   <div className="bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{mediaData.category || 'Voter Quiz'}</span>
                   </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {mediaData.options.map((opt: string, i: number) => {
                    const isSelected = selectedOption === i;
                    const isCorrect = i === mediaData.answer_index;
                    
                    return (
                      <button
                        key={i}
                        disabled={selectedOption !== null}
                        onClick={() => handleOptionClick(i)}
                        className={`p-4 rounded-2xl text-sm font-bold transition-all text-left shadow-sm flex items-center gap-4 group relative overflow-hidden border-2
                          ${selectedOption === null 
                            ? 'bg-white border-slate-100 hover:border-primary active:scale-[0.98]' 
                            : isCorrect 
                              ? 'bg-green-50 border-accent text-accent' 
                              : isSelected 
                                ? 'bg-red-50 border-red-500 text-red-700' 
                                : 'bg-slate-50 border-transparent opacity-60'}`}
                      >
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all shrink-0
                          ${selectedOption === null 
                            ? 'bg-slate-100 text-slate-400 group-hover:bg-primary group-hover:text-white' 
                            : isCorrect 
                              ? 'bg-accent text-white' 
                              : isSelected 
                                ? 'bg-red-500 text-white' 
                                : 'bg-slate-200 text-slate-400'}`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {selectedOption !== null && isCorrect && <CheckCircle2 size={18} className="text-accent" />}
                        {isSelected && !isCorrect && <AlertCircle size={18} className="text-red-600" />}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {showExplanation && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="overflow-hidden"
                    >
                      <div className={`mt-2 p-4 rounded-2xl border-l-[6px] ${selectedOption === mediaData.answer_index ? 'bg-green-50 border-accent' : 'bg-orange-50 border-primary'}`}>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                          {selectedOption === mediaData.answer_index ? '🎉 BRILLIANT! Correct Answer.' : '💡 Fact Check'}
                        </p>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{mediaData.explanation}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {ytMatch && ytMatch[1] && (
              <div className="space-y-2">
                <div className="rounded-2xl overflow-hidden shadow-lg aspect-video w-full ring-1 ring-slate-100 bg-slate-900 mt-4">
                  <LiteYouTubeEmbed 
                    id={getYoutubeId(ytMatch[1]) || ''} 
                    title="Recommended Video"
                  />
                </div>
              </div>
            )}
            
            {imgMatch && imgMatch[1] && (
              <div className="space-y-2 text-right mt-4">
                <img src={imgMatch[1]} alt="Recommended Visual" className="rounded-2xl w-full border border-slate-100 shadow-md" referrerPolicy="no-referrer" />
              </div>
            )}
            
            {mediaData.type === 'video' && mediaData.url && (
              <div className="space-y-2">
                <div className="rounded-2xl overflow-hidden shadow-lg aspect-video w-full ring-1 ring-slate-100 bg-slate-900">
                  <LiteYouTubeEmbed 
                    id={getYoutubeId(mediaData.url) || ''} 
                    title="ECI Learning"
                  />
                </div>
                {mediaData.source && <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Source: {mediaData.source}</p>}
              </div>
            )}
            
            {mediaData.type === 'image' && mediaData.url && (
              <div className="space-y-2 text-right">
                <img src={mediaData.url} alt="Educational" className="rounded-2xl w-full border border-slate-100 shadow-md" referrerPolicy="no-referrer" />
                {mediaData.source && <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Source: {mediaData.source}</p>}
              </div>
            )}
            
            {/* Search Grounding Links and Legacy Links */}
            {(searchMatch?.[1] || legacyGoogleImageMatch?.[1] || legacyYouTubeMatch?.[1]) && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2"><CheckCircle2 size={12} className="text-secondary" /> Verification Resources</p>
                <div className="grid grid-col-1 gap-2">
                  {searchMatch?.[1] && searchMatch[1].split('\n').filter(Boolean).map((q: string, idx: number) => (
                    <a 
                      key={idx}
                      href={`https://www.google.com/search?q=${encodeURIComponent(q.trim())}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-between hover:bg-slate-50 hover:border-primary hover:text-primary transition-all shadow-sm group active:scale-[0.98]"
                    >
                      <span className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-orange-100 group-hover:text-primary transition-colors">
                           <Search size={14} />
                        </div>
                        <span className="truncate">{q.trim()}</span>
                      </span>
                      <ExternalLink size={14} className="text-slate-400 group-hover:text-primary transition-colors" />
                    </a>
                  ))}
                  {legacyGoogleImageMatch && (
                    <a 
                      href={legacyGoogleImageMatch[1]} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-between hover:bg-slate-50 hover:border-blue-500 hover:text-blue-500 transition-all shadow-sm group active:scale-[0.98]"
                    >
                      <span className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                           <ImageIcon size={14} />
                        </div>
                        <span className="truncate">View Google Images</span>
                      </span>
                      <ExternalLink size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </a>
                  )}
                  {legacyYouTubeMatch && (
                    <a 
                      href={legacyYouTubeMatch[1]} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-between hover:bg-slate-50 hover:border-red-500 hover:text-red-500 transition-all shadow-sm group active:scale-[0.98]"
                    >
                      <span className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                           <Play size={14} fill="currentColor" />
                        </div>
                        <span className="truncate">Watch on YouTube</span>
                      </span>
                      <ExternalLink size={14} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                    </a>
                  )}
                </div>
              </div>
            )}
            
            {/* Direct Verification Links removed */}
          </div>
        )}

        {message.role === 'model' && message.pointsEarned && (
          <div className="absolute -top-3 -right-3 bg-white border border-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-primary shadow-sm flex items-center gap-1 group overflow-hidden">
            <Trophy size={10} className="text-primary" /> +{message.pointsEarned} XP
          </div>
        )}
      </div>
    </div>
  );
}

function DailyLessonView({ profile, user, setView, awardPoints }: { profile: any, user: any, setView: (v: View) => void, awardPoints: (n: number) => void }) {
  const [complete, setComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [quiz, setQuiz] = useState<any[]>([]);
  const [selection, setSelection] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(true);
  const t = useTranslation(profile);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!fetchedRef.current) {
        fetchedRef.current = true;
        loadDailyQuiz();
    }
  }, []);

  const triggerHaptic = () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
  };

  const loadDailyQuiz = async () => {
    if (quiz.length === 0) setLoading(true);
    try {
      const texts = await getAnsweredQuestionTexts(user.uid);
      const newQuizzes = await generateQuiz(profile, texts);
      if (newQuizzes && newQuizzes.length > 0) {
        setQuiz(newQuizzes);
      } else {
        throw new Error("Missing items");
      }
    } catch (e) {
      console.error(e);
      setQuiz([]);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (selection === null) return;
    triggerHaptic();
    setShowExplanation(true);
  };

  const handleNext = async () => {
    if (selection === null) return;
    triggerHaptic();
    const isCorrect = selection === quiz[currentStep].answer_index;
    
    if (isCorrect) {
      await saveQuizAttempt(user.uid, {
        question: quiz[currentStep].question,
        selected_option: quiz[currentStep].options[selection],
        correct_answer: quiz[currentStep].options[quiz[currentStep].answer_index],
        is_correct: true,
        points_earned: currentStep === 2 ? 150 : 0,
        category: quiz[currentStep].category || 'Daily Lesson',
        difficulty: quiz[currentStep].difficulty || 0.5,
        timestamp: new Date().toISOString()
      });

      if (currentStep === 2) {
        const today = new Date().toISOString().split('T')[0];
        if (profile?.lastDailyLesson !== today) {
          awardPoints(150);
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          const { updateDoc, doc, increment } = await import('firebase/firestore');
          try {
            await updateDoc(doc(db, 'users', user.uid), { 
              points: increment(150),
              lastDailyLesson: today
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
          }
        }
        setComplete(true);
      } else {
        if (containerRef.current) gsap.fromTo(containerRef.current, { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 0.4 });
        setCurrentStep(s => s + 1);
        setSelection(null);
        setShowExplanation(false);
      }
    } else {
      setSelection(null);
      setShowExplanation(false);
    }
  };

  if (loading) return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 p-8">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6 shadow-xl" />
      <p className="text-slate-400 font-bold italic text-lg tracking-widest uppercase text-[10px]">Assembling Daily Briefing...</p>
    </div>
  );

  if (complete) return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 text-center relative overflow-hidden">
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 blur-[100px] rounded-full flex-shrink-0" />
       
       <div className="w-32 h-32 bg-gradient-to-br from-primary to-orange-500 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/20 relative z-10 border-4 border-slate-800">
          <Trophy size={64} className="text-white" />
       </div>
       <h1 className="text-5xl font-black mb-4 tracking-tighter relative z-10 text-white">Objective Complete</h1>
       <p className="text-slate-400 font-bold mb-2 uppercase tracking-widest text-xs relative z-10">+150 Civic XP Earned</p>
       <p className="text-slate-300 font-medium mb-10 leading-relaxed max-w-[80%] mx-auto relative z-10">You've mastered today's core concepts. Return tomorrow to build your streak.</p>
       <button onClick={() => { triggerHaptic(); setView('dashboard'); }} className="w-full max-w-sm py-5 bg-white text-slate-900 rounded-[32px] font-black text-xl shadow-2xl relative z-10 active:scale-95 transition-transform">Return to Hub</button>
    </div>
  );

  if (quiz.length === 0) return <div className="p-8 text-center"><p>Error loading lesson.</p><button onClick={() => setView('dashboard')}>Back</button></div>;

  const currentQ = quiz[currentStep];

  return (
    <div ref={containerRef} className="h-full w-full bg-white flex flex-col p-8 overflow-y-auto relative pb-56">
      <header className="mb-10 pt-4 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10 py-4 -mt-4 border-b border-slate-50">
         <button onClick={() => { triggerHaptic(); setView('dashboard'); }} className="p-3 bg-slate-50 text-slate-400 rounded-[20px] active:scale-95 transition-transform"><X size={20} /></button>
         <div className="flex gap-2">
           {[0, 1, 2].map(i => (
             <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i < currentStep ? 'w-10 bg-green-500' : i === currentStep ? 'w-10 bg-primary shadow-[0_0_8px_rgba(255,153,51,0.6)]' : 'w-4 bg-slate-100'}`} />
           ))}
         </div>
         <div className="text-[10px] font-black text-primary uppercase bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">Module {currentStep + 1}</div>
      </header>

      <div className="flex-1 mt-6">
        <div className="inline-block px-4 py-1.5 bg-slate-100 rounded-full mb-6 border border-slate-200">
           <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase flex items-center gap-2">
             <Trophy size={14} className="text-primary"/> Level <span className="text-slate-900">{profile?.knowledgeLevel || 'Beginner'}</span>
           </span>
        </div>
        
        <h2 className="text-2xl font-black text-slate-900 mb-8 leading-snug tracking-tight text-left">{currentQ?.question}</h2>

        <div className="space-y-4">
          {currentQ?.options.map((opt: string, i: number) => {
            const isSelected = selection === i;
            const isCorrect = i === currentQ.answer_index;
            return (
              <motion.button 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1, duration: 0.3 }}
                key={i}
                disabled={showExplanation}
                onClick={() => { triggerHaptic(); setSelection(i); }}
                className={`w-full p-5 text-left rounded-[24px] border-2 transition-all flex items-center justify-between group shadow-sm active:scale-[0.98] ${
                  isSelected && !showExplanation ? 'bg-primary/5 border-primary shadow-lg shadow-primary/10' 
                  : (!showExplanation ? 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md' 
                  : (showExplanation && isCorrect ? 'bg-green-50/50 border-green-500 shadow-lg shadow-green-500/10' 
                  : (showExplanation && isSelected && !isCorrect ? 'bg-red-50/50 border-red-500 shadow-lg shadow-red-500/10' 
                  : 'bg-white border-slate-100 opacity-40')))
                }`}
              >
                <div className="flex items-center gap-4">
                   <div className={`w-10 h-10 flex-shrink-0 rounded-[14px] flex items-center justify-center font-black text-[15px] transition-all 
                      ${isSelected && !showExplanation ? 'bg-primary text-white shadow-md shadow-primary/20 scale-110' : 
                        showExplanation && isCorrect ? 'bg-green-500 text-white shadow-md shadow-green-500/20' : 
                        showExplanation && isSelected && !isCorrect ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 
                        'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                       {String.fromCharCode(65 + i)}
                   </div>
                   <span className={`font-bold text-[16px] leading-[1.3] ${isSelected && !showExplanation ? 'text-primary' : showExplanation && isCorrect ? 'text-green-700' : showExplanation && isSelected && !isCorrect ? 'text-red-700' : 'text-slate-700'}`}>{opt}</span>
                </div>
                {showExplanation && isCorrect && <CheckCircle2 className="text-green-500 flex-shrink-0" size={24} strokeWidth={3} />}
                {showExplanation && isSelected && !isCorrect && <X className="text-red-500 flex-shrink-0" size={24} strokeWidth={3} />}
              </motion.button>
            )
          })}
        </div>

        <AnimatePresence>
          {showExplanation && (
            <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} className={`mt-8 p-6 rounded-[28px] text-white overflow-hidden relative group shadow-2xl ${selection === currentQ.answer_index ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700'}`}>
               <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  {selection === currentQ.answer_index ? <Award size={120} /> : <AlertCircle size={120} />}
               </div>
               <div className="relative z-10 flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selection === currentQ.answer_index ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-400'}`}>
                    {selection === currentQ.answer_index ? <Award size={20} /> : <X size={20} />}
                  </div>
                  <h4 className={`font-black uppercase tracking-widest text-sm ${selection === currentQ.answer_index ? 'text-white' : 'text-red-400'}`}>{selection === currentQ.answer_index ? "Correct Answer!" : "Not Quite"}</h4>
               </div>
               <p className="relative z-10 font-semibold text-white/90 text-[15px] leading-relaxed pl-1">{currentQ.explanation}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 p-8 pt-12 pointer-events-none bg-gradient-to-t from-white via-white/90 to-transparent z-20">
        <div className="max-w-md mx-auto pointer-events-auto">
          {!showExplanation ? (
             <button disabled={selection === null} onClick={handleSubmit} className="w-full bg-slate-950 text-white py-6 rounded-[32px] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all text-center">Lock Answer</button>
          ) : (
             <button onClick={handleNext} className={`w-full text-white py-6 rounded-[32px] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-center ${selection === currentQ.answer_index ? 'bg-primary shadow-primary/20' : 'bg-slate-900 shadow-slate-900/20'}`}>
                {selection === currentQ.answer_index ? (currentStep === 2 ? 'Complete Briefing' : 'Next Module') : 'Try Again'}
                {selection === currentQ.answer_index && <ChevronRight size={24} />}
                {selection !== currentQ.answer_index && <ArrowLeft size={24} />}
             </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function ChatView({ profile, user, setView, sessionId, startNewSession, handleSend }: { profile: any, user: any, setView: (v: View) => void, sessionId: string, startNewSession: () => void, handleSend: (t: string, m: any[]) => Promise<void> }) {
  const t = useTranslation(profile);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionList, setSessionList] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch session list
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'sessions'), 
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      setSessionList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/sessions`);
    });
  }, [user]);

  const initialSuggestions = {
    Beginner: ["How to register as a voter?", "What is an EVM?", "Who can vote?"],
    Intermediate: ["What is Model Code of Conduct?", "Powers of Election Commission?", "What are electoral bonds?"],
    Advanced: ["Constitutional validity of VVPAT?", "Delimitation process in India", "Role of Governor in state elections"]
  };

  useEffect(() => {
    setMessages([]); // Clear previous messages immediately on session switch
    setSuggestions([]);
    
    const q = query(
      collection(db, 'users', user.uid, 'sessions', sessionId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => doc.data());
      setMessages(msgs);
      
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.role === 'model') {
           const found = lastMsg.text.match(/SUGGESTED_QUESTIONS:\s*(\[.*\])/);
           if (found) {
             try {
               setSuggestions(JSON.parse(found[1]));
             } catch (e) {
               setSuggestions([]);
             }
           } else {
             setSuggestions([]);
           }
        } else {
           setSuggestions([]);
        }
      } else {
        const level = profile?.knowledgeLevel || 'Beginner';
        setSuggestions(initialSuggestions[level as keyof typeof initialSuggestions] || initialSuggestions.Beginner);
      }
      
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/sessions/${sessionId}/messages`);
    });
    return () => unsubscribe();
  }, [sessionId]);

  const handleMCQSelect = async (opt: string, correct: boolean, exp: string, category?: string, difficulty?: number, correctAnswer?: string) => {
    const points = correct ? 10 : 0;
    
    // Save to history
    await saveQuizAttempt(user.uid, {
      question: "Chat Question", 
      selected_option: opt,
      correct_answer: correctAnswer || 'Unknown',
      is_correct: correct,
      points_earned: points,
      category: category || 'Chat',
      difficulty: difficulty || 0.5,
      timestamp: new Date().toISOString()
    });

    if (correct) {
      const { updateDoc, doc, increment } = await import('firebase/firestore');
      try {
        await updateDoc(doc(db, 'users', user.uid), { points: increment(points) });
      } catch (e) { console.error(e); }
    }
  };

  const waitQuotes = [
    "A citizen's voice is their vote.",
    "Democracy is a dialogue.",
    "Verifying the constitution...",
    "Consulting ECI guidelines...",
    "Every vote counts.",
    "Preparing your insights..."
  ];
  const [waitQuote, setWaitQuote] = useState('');

  const onSend = async (textOverride?: string) => {
    const text = textOverride || input;
    if (!text.trim() || loading) return;
    
    setInput('');
    setSuggestions([]);
    setWaitQuote(waitQuotes[Math.floor(Math.random() * waitQuotes.length)]);
    setLoading(true);
    await handleSend(text, messages);
    setLoading(false);
  };

  const [speechError, setSpeechError] = useState<string | null>(null);

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("Speech recognition is not supported in this browser.");
      setTimeout(() => setSpeechError(null), 3000);
      return;
    }
    
    if (recording) return;

    setSpeechError(null);
    const recognition = new SpeechRecognition();
    recognition.lang = profile?.language === 'Hindi' ? 'hi-IN' : 
                      profile?.language === 'Bengali' ? 'bn-IN' :
                      profile?.language === 'Tamil' ? 'ta-IN' :
                      profile?.language === 'Telugu' ? 'te-IN' :
                      profile?.language === 'Marathi' ? 'mr-IN' :
                      profile?.language === 'Gujarati' ? 'gu-IN' :
                      profile?.language === 'Kannada' ? 'kn-IN' : 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setRecording(true);
    
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      if (transcript.trim()) {
        setTimeout(() => onSend(transcript), 100);
      }
    };

    recognition.onend = () => setRecording(false);
    recognition.onerror = (e: any) => {
      console.error('Speech error:', e.error);
      setRecording(false);
      if (e.error === 'not-allowed') {
        const msg = (window as any).isSecureContext === false 
          ? "Voice features require a secure (HTTPS) connection." 
          : "Microphone access denied. Please allow microphone permissions in browser settings (click lock icon next to URL).";
        setSpeechError(msg);
      } else if (e.error === 'network') {
        setSpeechError("Network error. Please check your connection.");
      } else if (e.error === 'no-speech') {
        setSpeechError("No speech detected. Please try again.");
      } else {
        setSpeechError(`Voice error: ${e.error}`);
      }
      setTimeout(() => setSpeechError(null), 6000);
    };
    
    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setRecording(false);
    }
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    
    // Clean text for cleaner speech
    const cleanSpeech = text
      .replace(/:::MEDIA_BLOCK[\s\S]*?:::/gi, '')
      .replace(/:::YOUTUBE_LINK[\s\S]*?:::/gi, '')
      .replace(/:::IMAGE_LINK[\s\S]*?:::/gi, '')
      .replace(/:::SEARCH_QUERIES[\s\S]*?:::/gi, '')
      .replace(/SUGGESTED_QUESTIONS[\s\S]*/gi, '')
      .replace(/SUGGESTION[\s\S]*/gi, '')
      .replace(/\[MCQ_QUIZ\]/gi, 'Here is a quick question for you.') // Humanize MCQ markers
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
      .replace(/\[.*?\]\(.*?\)/g, '$1') // Keep link text, remove URL
      .trim();

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    
    // Set language based on profile
    const langMap: Record<string, string> = {
      'English': 'en-US',
      'Hindi': 'hi-IN',
      'Bengali': 'bn-IN',
      'Tamil': 'ta-IN',
      'Telugu': 'te-IN',
      'Marathi': 'mr-IN',
      'Gujarati': 'gu-IN',
      'Kannada': 'kn-IN'
    };
    utterance.lang = langMap[profile?.language] || 'en-US';
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error('TTS error:', e);
      setIsSpeaking(false);
    };
    
    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Failed to speak:', err);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const toggleAutoSpeak = () => {
    if (autoSpeak) {
      stopSpeaking();
    }
    setAutoSpeak(!autoSpeak);
  };

  useEffect(() => {
    if (autoSpeak && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'model' && !loading) {
        speak(lastMsg.text);
      }
    }
  }, [messages.length, autoSpeak, loading]);

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden relative">
      {/* Session Drawer Overlay */}
      <AnimatePresence>
        {showSessions && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSessions(false)}
            className="absolute inset-0 bg-navy/60 z-[60] backdrop-blur-sm"
          >
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-4/5 h-full bg-white shadow-2xl p-6 overflow-y-auto"
            >
              <h3 className="text-xl font-black text-navy border-b border-slate-100 pb-4 mb-6">Chat Sessions</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => { startNewSession(); setShowSessions(false); }}
                  className="w-full p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 text-primary font-black"
                >
                  <MessageCircle size={20} /> Start Fresh
                </button>
                {sessionList.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { (window as any).setSessionIdExternal(s.id); setShowSessions(false); }}
                    className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3 transition-colors ${sessionId === s.id ? 'bg-navy border-navy text-white' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                  >
                    <HistoryIcon size={18} className={sessionId === s.id ? 'text-white' : 'text-slate-400'} />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-black truncate">{s.title || 'Untitled Session'}</p>
                      <p className={`text-[10px] font-bold ${sessionId === s.id ? 'text-white/60' : 'text-slate-400'}`}>
                        {s.updatedAt?.toDate ? s.updatedAt.toDate().toLocaleDateString() : 'Just now'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="p-6 bg-white flex items-center gap-4 sticky top-0 z-10 border-b-4 border-accent shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
        <button onClick={() => setShowSessions(true)} className="p-3 -ml-2 text-navy bg-slate-50 rounded-2xl"><HistoryIcon size={20} /></button>
        <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center text-white shadow-lg">
          <Vote size={24} />
        </div>
        <div className="flex-1 text-left font-sans">
          <h2 className="font-black text-navy tracking-tight leading-tight">Matdaan Mitra</h2>
          <div className="flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
             <p className="text-[8px] text-accent font-black uppercase tracking-[0.2em]">Learning Live</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mr-2">
           <button 
             onClick={toggleAutoSpeak} 
             className={`p-3 rounded-2xl transition-all ${autoSpeak ? 'bg-primary text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}
             title={autoSpeak ? "Auto-speak ON" : "Auto-speak OFF"}
           >
             {autoSpeak ? <Volume2 size={20} /> : <VolumeX size={20} />}
           </button>
           {isSpeaking && (
              <button 
                onClick={stopSpeaking}
                className="p-3 bg-red-50 text-red-500 rounded-2xl animate-pulse"
              >
                <X size={20} />
              </button>
           )}
        </div>
        <button onClick={() => setView('dashboard')} className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><X size={20} /></button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 native-scroller pb-32 bg-slate-50">
        {messages.length === 0 && (
          <div className="flex flex-col gap-8 pb-10">
            <div className="space-y-4 reveal-item">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Choose a Learning Path</h4>
              <div className="grid grid-cols-1 gap-3">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => onSend(s)}
                    className="p-5 bg-white border-2 border-slate-50 rounded-3xl text-left hover:border-primary transition-all group active:scale-95 shadow-sm flex items-center justify-between reveal-item"
                  >
                    <span className="font-bold text-slate-700 group-hover:text-primary transition-colors">{s}</span>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ChatBubble message={m} onSelectMCQ={handleMCQSelect} onSpeak={speak} />
          </motion.div>
        ))}

        {loading && (
          <div className="flex flex-col items-start gap-2">
            <div className="bg-white border border-slate-100 p-5 rounded-[32px] rounded-tl-none flex gap-1.5 shadow-sm">
              <span className="w-2 h-2 bg-primary/20 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce delay-150" />
              <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce delay-300" />
            </div>
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest ml-2 animate-pulse">{waitQuote}</p>
          </div>
        )}

        {/* Suggestions chips */}
        <div className="flex flex-wrap gap-2 pt-4">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSend(s)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:border-primary hover:text-primary transition-all active:scale-95 shadow-sm"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {speechError && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-28 left-6 right-6 flex justify-center z-50 pointer-events-none"
          >
            <div className="bg-red-500 text-white px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-3">
              <VolumeX size={18} />
              {speechError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
 
      <div className="absolute bottom-6 left-6 right-6 flex gap-3 items-center">
        <div className="flex-1 bg-white rounded-[32px] border-2 border-slate-100 focus-within:border-primary pr-3 flex items-center shadow-2xl shadow-slate-900/10 transition-all">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder={t.typeQuestion}
            className="flex-1 p-5 outline-none bg-transparent font-medium"
          />
          <button 
            onClick={toggleMic}
            className={`p-3 rounded-2xl transition-all ${recording ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-primary hover:bg-orange-50'}`}
          >
            <Mic size={20} />
          </button>
        </div>
        <button 
          onClick={() => onSend()}
          disabled={!input.trim() || loading}
          className="w-16 h-16 bg-slate-950 text-white rounded-[32px] flex items-center justify-center shadow-xl shadow-slate-900/20 active:scale-90 disabled:opacity-50 transition-all"
        >
          <Send size={24} />
        </button>
      </div>
    </div>
  );
}

function QuizView({ profile, user, awardPoints, setView }: { profile: any, user: any, awardPoints: (n: number) => void, setView: (v: View) => void }) {
  const t = useTranslation(profile);
  const [quiz, setQuiz] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!fetchedRef.current) {
        fetchedRef.current = true;
        loadQuizSession();
    }
  }, []);

  const triggerHaptic = () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
  };

  const loadQuizSession = async () => {
    if (queue.length === 0) setLoading(true);
    try {
      const texts = await getAnsweredQuestionTexts(user.uid);
      const newQuizzes = await generateQuiz(profile, texts);
      if (newQuizzes && newQuizzes.length > 0) {
        setQueue(prev => [...prev, ...newQuizzes]);
        if (!quiz) setQuiz(newQuizzes[0]);
        setLoading(false);
        return newQuizzes;
      } else {
        if (!quiz) throw new Error("No quizzes generated");
      }
    } catch (e) {
      console.error(e);
      if (!quiz) setQuiz(null); // Triggers retry UI
    }
    setLoading(false);
    return [];
  };

  const handleFinish = async () => {
    if (selection === null) return;
    triggerHaptic();
    const isCorrect = selection === quiz.answer_index;
    const points = isCorrect ? 50 : 0;
    
    await saveQuizAttempt(user.uid, {
      question: quiz.question,
      selected_option: quiz.options[selection],
      correct_answer: quiz.options[quiz.answer_index],
      is_correct: isCorrect,
      points_earned: points,
      category: quiz.category,
      difficulty: quiz.difficulty,
      timestamp: new Date().toISOString()
    });

    if (isCorrect) {
      awardPoints(points);
      const { updateDoc, doc, increment } = await import('firebase/firestore');
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), { points: increment(points) });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
    setComplete(true);
  };

  const nextQuestion = async () => {
    triggerHaptic();
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 0.4 });
    }
    const next = currentIdx + 1;
    setCurrentIdx(next);
    setSelection(null);
    setComplete(false);
    
    if (next < queue.length) {
      setQuiz(queue[next]);
    } else {
      setLoading(true);
      const newQs = await loadQuizSession();
      if (newQs && newQs.length > 0) {
        setQuiz(newQs[0]);
      } else {
        setQuiz(null);
      }
    }
    
    if (next === queue.length - 1 && !loading) {
      loadQuizSession();
    }
  };

  if (loading && queue.length === 0) return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-white p-8">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6 ring-8 ring-orange-50" />
      <p className="text-slate-400 font-bold italic text-lg">{t.loading}</p>
    </div>
  );

  if (!quiz && !loading) return <div className="p-8 text-center flex flex-col items-center justify-center h-full"><AlertCircle className="text-slate-200 mb-4" size={64} /><button onClick={loadQuizSession} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold">{t.retry}</button></div>;

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col bg-white overflow-hidden relative">
      <header className="p-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 transition-all">
        <button onClick={() => { triggerHaptic(); setView('dashboard'); }} className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><X size={20} /></button>
        <div className="flex flex-col items-center">
           <h2 className="font-black text-slate-900 tracking-tight">{t.masterQuiz}</h2>
           <div className="text-xs font-black text-primary bg-orange-50 px-2 py-0.5 rounded-full mt-1 border border-orange-100 uppercase tracking-widest shadow-sm">Round {currentIdx + 1}</div>
        </div>
        <div className="w-12 h-12 flex items-center justify-center text-primary font-black bg-orange-50 border border-orange-100 rounded-[20px] shadow-sm">
           <Award size={24} />
        </div>
      </header>
      
      <main className="flex-1 p-8 pt-4 overflow-y-auto native-scroller pb-32">
        <div className="mb-4 flex items-center gap-2">
          {quiz?.category && <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded-full text-slate-500 uppercase tracking-widest shadow-sm">{quiz.category}</span>}
          {quiz?.difficulty && <span className="text-[10px] font-black bg-orange-50 border border-orange-100 px-2 py-1 rounded-full text-primary uppercase tracking-widest flex items-center gap-1 shadow-sm"><Rocket size={10} /> Level {Math.round(quiz.difficulty * 10)}</span>}
        </div>
        <h3 className="text-2xl font-black leading-snug tracking-tight text-slate-900 mb-8 text-left pr-4">{quiz?.question}</h3>
        
        <div className="space-y-4">
          {quiz?.options.map((opt: string, i: number) => {
             const isCorrect = i === quiz?.answer_index;
             const isSelected = i === selection;
             const showStatus = complete;
             
             return (
              <motion.button
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1, duration: 0.3 }}
                key={i}
                disabled={complete}
                onClick={() => { triggerHaptic(); setSelection(i); }}
                className={`w-full p-5 text-left rounded-[24px] border-2 transition-all flex items-center justify-between group shadow-sm active:scale-[0.98] ${
                  isSelected && !showStatus ? 'bg-primary/5 border-primary shadow-lg shadow-primary/10' 
                  : (!showStatus ? 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md' 
                  : (showStatus && isCorrect ? 'bg-green-50/50 border-green-500 shadow-lg shadow-green-500/10' 
                  : (showStatus && isSelected && !isCorrect ? 'bg-red-50/50 border-red-500 shadow-lg shadow-red-500/10' 
                  : 'bg-white border-slate-100 opacity-40')))
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 flex-shrink-0 rounded-[14px] flex items-center justify-center font-black text-[15px] transition-colors 
                    ${isSelected && !showStatus ? 'bg-primary text-white shadow-md shadow-primary/20 scale-110' : 
                      showStatus && isCorrect ? 'bg-green-500 text-white shadow-md shadow-green-500/20' : 
                      showStatus && isSelected && !isCorrect ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 
                      'bg-slate-100 text-slate-500 group-hover:bg-slate-200 shadow-sm'}`}>
                     {String.fromCharCode(65 + i)}
                  </div>
                  <span className={`font-bold text-[16px] leading-[1.3] ${isSelected && !showStatus ? 'text-primary' : showStatus && isCorrect ? 'text-green-700' : showStatus && isSelected && !isCorrect ? 'text-red-700' : 'text-slate-700'}`}>{opt}</span>
                </div>
                {showStatus && isCorrect && <CheckCircle2 className="text-green-500 flex-shrink-0" size={24} strokeWidth={3} />}
                {showStatus && isSelected && !isCorrect && <X className="text-red-500 flex-shrink-0" size={24} strokeWidth={3} />}
              </motion.button>
             );
          })}
        </div>

        <AnimatePresence>
          {complete && quiz?.explanation && (
             <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} className={`mt-8 p-6 bg-gradient-to-br rounded-[28px] text-white overflow-hidden relative group shadow-2xl ${selection === quiz.answer_index ? 'from-green-500 to-green-600' : 'from-slate-800 to-slate-900 border border-slate-700'}`}>
               <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  {selection === quiz.answer_index ? <Award size={120} /> : <AlertCircle size={120} />}
               </div>
               <div className="relative z-10 flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selection === quiz.answer_index ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-400'}`}>
                     {selection === quiz?.answer_index ? <Award size={20} /> : <X size={20} />}
                  </div>
                  <h4 className={`font-black uppercase tracking-widest text-sm ${selection === quiz.answer_index ? 'text-white' : 'text-red-400'}`}>{selection === quiz.answer_index ? "+50 XP Earned!" : "Not Quite"}</h4>
               </div>
               <p className="relative z-10 font-semibold text-white/90 text-[15px] leading-relaxed pl-1">{quiz.explanation}</p>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          {complete ? (
            <button 
              onClick={nextQuestion}
              className="w-full bg-primary text-white py-6 rounded-[32px] font-black text-xl shadow-2xl shadow-orange-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all text-center"
            >
              Next Challenge {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"/> : <ChevronRight size={24} />}
            </button>
          ) : (
            <button 
              disabled={selection === null}
              onClick={handleFinish}
              className="w-full bg-slate-950 text-white py-6 rounded-[32px] font-black text-xl shadow-2xl shadow-slate-900/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all font-sans"
            >
              Verify Answer
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function HistoryView({ user, setView, profile }: { user: any, setView: (v: View) => void, profile: any }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslation(profile);

  useEffect(() => {
    getQuizHistory(user.uid).then(h => {
      setHistory(h || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <header className="p-8 pb-4 flex items-center gap-4 sticky top-0 bg-white z-10 border-b border-slate-50 pt-12">
        <button onClick={() => setView('dashboard')} className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><ArrowLeft size={24} /></button>
        <h2 className="font-black text-3xl tracking-tight leading-none pt-1">{t.history}</h2>
      </header>

      <main className="flex-1 p-8 overflow-y-auto native-scroller pb-24">
        {loading ? (
          <div className="flex justify-center p-12"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : history.length === 0 ? (
          <div className="text-center p-12 space-y-4">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
               <Award className="text-slate-200" size={64} />
            </div>
            <p className="text-slate-400 font-black text-xl leading-none">No records yet.</p>
            <p className="text-slate-400 font-medium">Start a quiz to earn points!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((h, i) => {
              const dateObj = h.timestamp?.seconds ? new Date(h.timestamp.seconds * 1000) : new Date(h.timestamp);
              const isValidDate = !isNaN(dateObj.getTime());
              
              return (
                <div key={i} className="p-8 bg-slate-50 rounded-[40px] border-4 border-white flex flex-col gap-4 shadow-sm hover:shadow-md transition-all active:scale-98 text-left">
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="font-black text-xl text-slate-900 leading-tight pr-4">{h.question}</h4>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${h.is_correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {h.is_correct ? 'Correct' : 'Incorrect'}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className={`text-sm font-bold ${h.is_correct ? 'text-green-600' : 'text-slate-400'}`}>
                      Your Choice: {h.selected_option}
                    </p>
                    {!h.is_correct && (
                      <p className="text-sm font-bold text-green-600">
                        Correct Answer: {h.correct_answer}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-4 border-t-2 border-white">
                     <div className="flex items-center gap-2">
                       <HistoryIcon size={14} className="text-slate-300" />
                       <span className="text-xs text-slate-400 font-bold">
                         {isValidDate ? dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                       </span>
                     </div>
                     <div className="flex items-end gap-1">
                        <span className={`font-black text-3xl leading-none ${h.is_correct ? 'text-green-600' : 'text-slate-300'}`}>+{h.points_earned || 0}</span>
                        <span className="text-[10px] font-black text-slate-400 pb-1">XP</span>
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
