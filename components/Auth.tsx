
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { translations, Language } from '../translations';

const BACKGROUND_IMAGES = [
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_1.jpg",
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_2.jpg",
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_3.jpg",
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_4.jpg",
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_5.jpg",
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_6.jpg"
];

const QUOTES = [
  "Architecture is the learned game, correct and magnificent, of forms assembled in the light.",
  "Design is not just what it looks like and feels like. Design is how it works.",
  "Space and light and order. Those are the things that men need just as much as they need bread.",
  "The sun never knew how great it was until it hit the side of a building.",
  "God is in the details."
];

const GOOGLE_LOGO_URL = "https://storage.googleapis.com/oavbucket/Google__G__logo.svg.webp";

interface AuthProps {
  lang: Language;
  setLang: (l: Language) => void;
  onShowShowcase?: () => void;
}

const Auth: React.FC<AuthProps> = ({ lang, setLang, onShowShowcase }) => {
  const t = translations[lang];
  const isRTL = lang === 'ma';
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<boolean[]>(new Array(BACKGROUND_IMAGES.length).fill(false));

  // Image Preloading Logic - Sequential
  useEffect(() => {
    // Mark first image as loaded immediately to allow logic to proceed (browser handles LCP)
    setLoadedImages(prev => {
        const newState = [...prev];
        newState[0] = true;
        return newState;
    });

    const loadImage = (index: number) => {
      if (index >= BACKGROUND_IMAGES.length) return;
      
      // Skip 0 as it is handled by the initial render and browser LCP priority
      if (index === 0) {
          loadImage(index + 1);
          return;
      }

      const img = new Image();
      img.src = BACKGROUND_IMAGES[index];
      img.onload = () => {
        setLoadedImages(prev => {
          const newState = [...prev];
          newState[index] = true;
          return newState;
        });
        loadImage(index + 1);
      };
      img.onerror = () => {
        loadImage(index + 1);
      };
    };

    // Start loading sequence
    loadImage(0);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentImageIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length), 7000);
    const quoteTimer = setInterval(() => setCurrentQuoteIndex((prev) => (prev + 1) % QUOTES.length), 9000);
    return () => {
      clearInterval(timer);
      clearInterval(quoteTimer);
    };
  }, []);

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          credits: 10,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (password !== repeatPassword) { setError("Passwords mismatch"); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await sendEmailVerification(cred.user);
        await setDoc(doc(db, 'users', cred.user.uid), { 
          uid: cred.user.uid, 
          email, 
          displayName: name,
          credits: 10, 
          createdAt: new Date().toISOString() 
        });
      }
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className={`h-screen w-full relative flex items-center bg-gray-900 font-sans overflow-hidden ${isRTL ? 'justify-end' : 'justify-start'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background Slider */}
      <div className="absolute inset-0 z-0 bg-gray-900">
         {BACKGROUND_IMAGES.map((src, index) => {
            // Optimization: Only render the first image immediately.
            // Subsequent images are rendered only after they are "loaded" by the effect.
            // This prevents the browser from fighting for bandwidth for all 6 images at once.
            if (index > 0 && !loadedImages[index]) return null;

            return (
                <div key={src} className={`absolute inset-0 transition-opacity duration-2000 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}>
                    <img 
                        src={src} 
                        className="w-full h-full object-cover scale-105" 
                        alt="ArchViz Background"
                        // Priority hints for the browser
                        fetchPriority={index === 0 ? "high" : "low"}
                        loading={index === 0 ? "eager" : "lazy"}
                    />
                    <div className="absolute inset-0 bg-black/20"></div>
                </div>
            );
         })}
      </div>

      {/* Floating Badge: Renders made by our engine - HIDDEN ON MOBILE */}
      <div className={`hidden md:block absolute top-8 z-30 transition-all duration-1000 ${isRTL ? 'left-8' : 'right-8'}`}>
        <div className="bg-white/90 backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-1000">
           <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Renders made by our engine</span>
        </div>
      </div>

      {/* Dreamy Quotes Layer */}
      <div className={`absolute bottom-16 ${isRTL ? 'left-16 text-left' : 'right-16 text-right'} z-10 hidden lg:block transition-all duration-1000`}>
          <div className="max-w-md">
            <p className="text-white text-2xl font-light italic leading-relaxed drop-shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000" key={currentQuoteIndex}>
              "{QUOTES[currentQuoteIndex]}"
            </p>
            <div className={`mt-4 h-[2px] bg-white/30 rounded-full w-24 ${isRTL ? 'mr-0 ml-auto' : 'ml-auto'}`}></div>
          </div>
      </div>

      {/* Full-Height Auth Card Container (Minimal Blur "White Transparent" Scheme) */}
      <div className={`relative z-20 h-full w-full max-w-[460px] animate-in fade-in duration-1000 ${isRTL ? 'slide-in-from-right-20' : 'slide-in-from-left-20'}`}>
        <div className={`h-full bg-white/10 backdrop-blur-[2px] flex flex-col justify-center p-8 md:p-14 ${isRTL ? 'border-l' : 'border-r'} border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.2)]`}>
            <div className={`flex justify-between items-center mb-12 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="ozArchViz" className="h-8 md:h-10 w-auto object-contain filter brightness-0 invert" />
                <div className="flex bg-white/10 p-0.5 rounded-xl border border-white/20">
                    <button onClick={() => setLang('en')} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all ${lang === 'en' ? 'bg-white shadow-md text-gray-900' : 'text-white/70 hover:text-white'}`}>EN</button>
                    <button onClick={() => setLang('fr')} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all ${lang === 'fr' ? 'bg-white shadow-md text-gray-900' : 'text-white/70 hover:text-white'}`}>FR</button>
                    <button onClick={() => setLang('ma')} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all ${lang === 'ma' ? 'bg-white shadow-md text-gray-900' : 'text-white/70 hover:text-white'}`}>MA</button>
                </div>
            </div>
            
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">{isLogin ? t.welcome : t.createAccount}</h1>
            <p className="text-white/90 text-sm mb-10 font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{isLogin ? t.loginDesc : t.signupDesc}</p>

            <div className="flex flex-col gap-5">
              <button 
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full bg-white/20 border border-white/30 text-white font-bold py-4 rounded-2xl hover:bg-white/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xs shadow-sm group backdrop-blur-[4px]"
              >
                <img src={GOOGLE_LOGO_URL} className="w-5 h-5 object-contain group-hover:scale-110 transition-transform" alt="Google" />
                {isLogin ? t.googleSign : t.googleUp}
              </button>

              <div className="flex items-center gap-4 my-2">
                <div className="flex-1 h-[1px] bg-white/20"></div>
                <span className="text-[10px] text-white/80 font-bold uppercase tracking-widest drop-shadow-sm">{t.orContinue}</span>
                <div className="flex-1 h-[1px] bg-white/20"></div>
              </div>

              <form onSubmit={handleAuth} className="flex flex-col gap-4">
              {!isLogin && (
                  <div className="space-y-1.5">
                      <label className={`text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-sm ${isRTL ? 'mr-1' : 'ml-1'}`}>{t.fullName}</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3.5 text-xs text-white placeholder-white/50 focus:border-white/50 focus:outline-none focus:bg-white/20 transition-all shadow-sm" placeholder="John Doe" />
                  </div>
              )}
              <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-sm ${isRTL ? 'mr-1' : 'ml-1'}`}>{t.email}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3.5 text-xs text-white placeholder-white/50 focus:border-white/50 focus:outline-none focus:bg-white/20 transition-all shadow-sm" placeholder="name@company.com" />
              </div>
              <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-sm ${isRTL ? 'mr-1' : 'ml-1'}`}>{t.password}</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3.5 text-xs text-white placeholder-white/50 focus:border-white/50 focus:outline-none focus:bg-white/20 transition-all shadow-sm" placeholder="••••••••" />
              </div>
              {!isLogin && (
                  <div className="space-y-1.5">
                      <label className={`text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-sm ${isRTL ? 'mr-1' : 'ml-1'}`}>{t.repeatPassword}</label>
                      <input type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} required className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3.5 text-xs text-white placeholder-white/50 focus:border-white/50 focus:outline-none focus:bg-white/20 transition-all shadow-sm" placeholder="••••••••" />
                  </div>
              )}
              
              {error && <p className="text-white text-[11px] text-center p-3 bg-red-500/40 rounded-2xl border border-red-400/50 backdrop-blur-md">{error}</p>}
              
              <button type="submit" disabled={isLoading} className="w-full bg-white text-gray-900 font-bold py-4 rounded-2xl hover:bg-gray-100 active:scale-[0.98] transition-all shadow-xl mt-4 flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                  {isLoading ? <i className="fas fa-spinner fa-spin"></i> : (isLogin ? t.signIn : t.signUp)}
              </button>
              </form>
            </div>
            
            <div className="mt-10 text-center text-xs text-white flex flex-col items-center gap-4">
                <div className="drop-shadow-sm">
                  {isLogin ? t.noAccount : t.haveAccount}
                  <button onClick={() => setIsLogin(!isLogin)} className="ml-2 text-white font-extrabold hover:underline transition-all underline-offset-4">{isLogin ? t.signUp : t.signIn}</button>
                </div>
                
                <button 
                  onClick={() => setShowTutorial(true)}
                  className="mt-2 flex items-center justify-center gap-2 text-[10px] text-white/90 hover:text-white transition-all uppercase tracking-[0.2em] font-bold py-2 px-6 rounded-full border border-white/20 hover:bg-white/10 backdrop-blur-[2px] shadow-sm"
                >
                  <i className="fas fa-play-circle text-xs"></i> {t.howTo}
                </button>

                {onShowShowcase && (
                  <button 
                    onClick={onShowShowcase}
                    className="mt-1 text-[10px] text-white/70 hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
                  >
                    View Showcase
                  </button>
                )}
            </div>

            <div className={`mt-auto pt-10 text-white/40 ${isRTL ? 'text-right' : 'text-left'}`}>
              <p className="text-[9px] font-bold tracking-[0.3em] uppercase drop-shadow-sm">Archivision Engine • Precision Rendering • v2.1.0</p>
            </div>
        </div>
      </div>

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 md:p-10 animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in duration-500">
            <button 
              onClick={() => setShowTutorial(false)}
              className={`absolute top-6 z-[110] w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white hover:text-slate-900 transition-all border border-white/10 ${isRTL ? 'left-6' : 'right-6'}`}
            >
              <i className="fas fa-times"></i>
            </button>
            <div className="w-full h-full">
                <video 
                    src="https://storage.googleapis.com/oavbucket/Untitled%20video%20-%20Made%20with%20Clipchamp%20(4).mp4" 
                    className="w-full h-full object-contain" 
                    controls 
                    autoPlay
                >
                    Your browser does not support the video tag.
                </video>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Auth;
