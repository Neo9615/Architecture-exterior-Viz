import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { translations, Language } from '../translations';

interface ShowcaseLandingProps {
  onBack: () => void;
  lang?: Language;
  setLang?: (l: Language) => void;
}

const GALLERY_IMAGES = [
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_2.jpg",
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_3.jpg",
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_4.jpg",
  "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_5.jpg",
  "https://storage.googleapis.com/oavbucket/Gallery/Home_Slides_6.jpg",
  "https://storage.googleapis.com/oavbucket/Gallery/ozArchViz_Exterior_1767785432910.png",
  "https://storage.googleapis.com/oavbucket/Gallery/render_1767532462364_j4f7hcc47.png",
  "https://storage.googleapis.com/oavbucket/Gallery/render_1767716888511_n2t55s42c.png"
];

// --- Parametric Background Component ---
const ParametricGrid = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Start center screen to look nice initially
  const mouseRef = useRef({ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 }); 
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let points: {x: number, y: number, angle: number}[] = [];
    const spacing = 45; // Balance density and performance
    
    const initGrid = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      points = [];
      const cols = Math.ceil(canvas.width / spacing);
      const rows = Math.ceil(canvas.height / spacing);
      
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          points.push({
            x: i * spacing,
            y: j * spacing,
            angle: 0 // Will align on first frame
          });
        }
      }
    };
    
    initGrid();
    window.addEventListener('resize', initGrid);
    
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = { 
            x: e.clientX - rect.left, 
            y: e.clientY - rect.top 
        };
    };
    window.addEventListener('mousemove', handleMouseMove);
    
    const render = () => {
       // Clear with a slight fade for trails? No, Antigravity is crisp.
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       ctx.lineCap = 'round';
       
       const mouseX = mouseRef.current.x;
       const mouseY = mouseRef.current.y;
       const maxDist = Math.max(canvas.width, canvas.height) * 0.7;

       points.forEach(p => {
           const dx = mouseX - p.x;
           const dy = mouseY - p.y;
           const dist = Math.sqrt(dx * dx + dy * dy);
           
           // Calculate target angle to face mouse
           const targetAngle = Math.atan2(dy, dx);
           
           // Smooth rotation easing
           let angleDiff = targetAngle - p.angle;
           // Normalize to shortest path
           while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
           while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
           
           // Easing factor - 0.1 gives a nice delayed "magnetic" feel
           p.angle += angleDiff * 0.1; 
           
           // Dynamic visual properties based on distance
           // Normalize distance 0 to 1 (1 being close)
           const proximity = Math.max(0, 1 - dist / maxDist);
           
           // Antigravity style: 
           // - Base: Small blue dot/dash
           // - Active: Longer dash pointing to cursor
           
           const length = 4 + (proximity * 14); // Grow when closer
           const width = 2 + (proximity * 1.5);
           // Opacity: Fade out slightly at edges of screen/influence
           const opacity = 0.2 + (proximity * 0.8);

           // Google Blue #4285F4
           ctx.strokeStyle = `rgba(66, 133, 244, ${opacity})`; 
           ctx.lineWidth = width;
           
           ctx.save();
           ctx.translate(p.x, p.y);
           ctx.rotate(p.angle);
           
           ctx.beginPath();
           ctx.moveTo(-length / 2, 0);
           ctx.lineTo(length / 2, 0);
           ctx.stroke();
           
           ctx.restore();
       });
       
       animationFrameId = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
        window.removeEventListener('resize', initGrid);
        window.removeEventListener('mousemove', handleMouseMove);
        cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 bg-white" />;
}

// --- Animation Helper ---
const useIntersectionObserver = (options = {}) => {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect(); // Only animate once
      }
    }, { threshold: 0.1, ...options });

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return [elementRef, isVisible] as const;
};

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
}

const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, className = "", direction = "up" }) => {
  const [ref, isVisible] = useIntersectionObserver();
  
  const getTransform = () => {
    switch (direction) {
        case "up": return "translate-y-10";
        case "down": return "-translate-y-10";
        case "left": return "translate-x-10";
        case "right": return "-translate-x-10";
        default: return "";
    }
  };

  return (
    <div
      ref={ref as any}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? "opacity-100 translate-y-0 translate-x-0" : `opacity-0 ${getTransform()}`
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const ShowcaseLanding: React.FC<ShowcaseLandingProps> = ({ onBack, lang: propLang, setLang: propSetLang }) => {
  // Use prop language if available, otherwise default to 'fr' or internal state
  const [internalLang, setInternalLang] = useState<Language>('fr');
  const lang = propLang || internalLang;
  const setLang = propSetLang || setInternalLang;
  
  const t = translations[lang];
  const isRTL = lang === 'ma';

  // --- GATEKEEPER STATE ---
  const [accessGranted, setAccessGranted] = useState(false);

  // --- LANDING PAGE STATE ---
  const [sliderPosition, setSliderPosition] = useState(50);
  const [sliderPosition2, setSliderPosition2] = useState(50);
  const [formData, setFormData] = useState({ name: '', title: '', phone: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Images for slider 1
  const beforeImage1 = "https://storage.googleapis.com/oavbucket/Sketch1.jpeg";
  const afterImage1 = "https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_1.jpg";

  // Images for slider 2
  const beforeImage2 = "https://storage.googleapis.com/oavbucket/Gallery/AA.png";
  const afterImage2 = "https://storage.googleapis.com/oavbucket/Gallery/BB.png";

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  };

  const handleSliderChange2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition2(Number(e.target.value));
  };

  const handleGatekeeperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'leads'), {
        ...formData,
        timestamp: new Date().toISOString(),
        source: 'ShowcaseLanding_Gatekeeper'
      });
      // Grant access after successful submission
      setAccessGranted(true);
    } catch (error) {
      console.error("Error submitting lead:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lightbox Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex((prev) => (prev! + 1) % GALLERY_IMAGES.length);
      if (e.key === 'ArrowLeft') setLightboxIndex((prev) => (prev! - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex]);

  // --- RENDER: GATEKEEPER VIEW ---
  if (!accessGranted) {
      return (
        <div className={`min-h-screen bg-transparent text-gray-900 font-sans overflow-x-hidden ${isRTL ? 'font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
           {/* Interactive Background */}
           <ParametricGrid />

           <div className="min-h-screen flex items-center justify-center p-4">
              <FadeIn direction="up">
                  <div className="w-full max-w-lg bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-12 relative overflow-hidden">
                      {/* Decorative Elements */}
                      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
                      
                      <div className="text-center mb-10 relative z-10">
                          <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="ozArchViz" className="h-10 w-auto mx-auto mb-6" />
                          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight mb-4">
                             {t.gatekeeperTitle}
                          </h1>
                          <p className="text-gray-500 text-sm">
                             Please complete your profile to access the immersive showcase.
                          </p>
                      </div>

                      <form onSubmit={handleGatekeeperSubmit} className="space-y-4 relative z-10">
                          <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">{t.fullName}</label>
                              <input 
                                required
                                type="text" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full bg-white/60 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:bg-white transition-all shadow-sm"
                                placeholder="John Doe"
                              />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">{t.titleRole}</label>
                                  <input 
                                    required
                                    type="text" 
                                    value={formData.title}
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    className="w-full bg-white/60 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:bg-white transition-all shadow-sm"
                                    placeholder="Architect"
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">{t.phone}</label>
                                  <input 
                                    required
                                    type="tel" 
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    className="w-full bg-white/60 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:bg-white transition-all shadow-sm"
                                    placeholder="+212..."
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">{t.email}</label>
                              <input 
                                required
                                type="email" 
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                className="w-full bg-white/60 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-gray-900 focus:outline-none focus:bg-white transition-all shadow-sm"
                                placeholder="name@company.com"
                              />
                          </div>
                          
                          <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-xl hover:bg-black hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 mt-6 disabled:opacity-70 text-sm"
                          >
                              {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <span>{t.enterExperience} <i className="fas fa-arrow-right ml-2"></i></span>}
                          </button>
                      </form>

                       <div className="mt-8 pt-6 border-t border-gray-200/50 flex justify-center gap-4">
                            <button onClick={() => setLang('en')} className={`text-[10px] font-bold uppercase ${lang === 'en' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>EN</button>
                            <button onClick={() => setLang('fr')} className={`text-[10px] font-bold uppercase ${lang === 'fr' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>FR</button>
                            <button onClick={() => setLang('ma')} className={`text-[10px] font-bold uppercase ${lang === 'ma' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>MA</button>
                       </div>
                  </div>
              </FadeIn>
           </div>
        </div>
      );
  }

  // --- RENDER: MAIN LANDING VIEW (After Gatekeeper) ---
  return (
    <div className={`min-h-screen bg-transparent text-gray-900 font-sans overflow-x-hidden ${isRTL ? 'font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Interactive Background */}
      <ParametricGrid />

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/70 backdrop-blur-xl z-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
            <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="ozArchViz" className="h-8 w-auto" />
            <span className="text-xs font-bold tracking-widest uppercase border-l border-gray-200 pl-3 ml-1 text-gray-400">{t.showcase}</span>
        </div>
        <div className="flex items-center gap-4">
            <div className="hidden md:flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
               <button onClick={() => setLang('en')} className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${lang === 'en' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-900'}`}>EN</button>
               <button onClick={() => setLang('fr')} className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${lang === 'fr' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-900'}`}>FR</button>
               <button onClick={() => setLang('ma')} className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${lang === 'ma' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-900'}`}>MA</button>
            </div>
            <button 
                onClick={onBack}
                className="text-xs font-bold uppercase tracking-widest text-gray-900 hover:text-gray-600 transition-colors flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full"
            >
                {isRTL ? <i className="fas fa-arrow-right"></i> : <i className="fas fa-arrow-left"></i>} {t.backToApp}
            </button>
        </div>
      </nav>

      {/* Hero Section with Before/After Sliders */}
      <header className="relative pt-32 pb-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
                <FadeIn delay={0} direction="up">
                  <span className="inline-block py-1 px-3 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest mb-4 shadow-blue-200 shadow-lg">
                    v2.0 Neural Rendering
                  </span>
                </FadeIn>
                <FadeIn delay={100} direction="up">
                  <h1 className="text-4xl md:text-7xl font-extrabold mb-6 tracking-tight text-gray-900 leading-tight">
                    {t.landingTitle}
                  </h1>
                </FadeIn>
                <FadeIn delay={200} direction="up">
                  <p className="text-gray-600 text-base md:text-xl max-w-2xl mx-auto leading-relaxed font-light bg-white/50 backdrop-blur-sm p-4 rounded-xl">
                      {t.landingSubtitle}
                  </p>
                </FadeIn>
            </div>

            {/* Dreamy Quote Section */}
            <div className="max-w-4xl mx-auto text-center mb-24 relative">
                <FadeIn delay={300}>
                    <div className="relative inline-block px-8 py-6">
                        <i className="fas fa-quote-left absolute top-0 left-0 text-3xl text-blue-200 opacity-60"></i>
                        <blockquote className="text-2xl md:text-4xl font-serif italic text-gray-800 leading-snug tracking-wide relative z-10">
                            "Architecture starts when you carefully put two bricks together. There it begins."
                        </blockquote>
                        <i className="fas fa-quote-right absolute bottom-0 right-0 text-3xl text-blue-200 opacity-60"></i>
                    </div>
                    <div className="mt-8 flex items-center justify-center gap-4 opacity-70">
                        <div className="h-[1px] w-16 bg-blue-300"></div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-[0.2em]">Ludwig Mies van der Rohe</p>
                        <div className="h-[1px] w-16 bg-blue-300"></div>
                    </div>
                </FadeIn>
            </div>

            <FadeIn delay={400} className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                {/* Slider 1 Container */}
                <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border border-gray-200/50 select-none group">
                    {/* After Image (Background/Base) */}
                    <img 
                        src={afterImage1} 
                        alt="After Render 1" 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105"
                        // High priority for LCP
                        fetchPriority="high"
                        loading="eager"
                    />
                    <div className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest z-10 pointer-events-none shadow-lg`}>
                        {t.aiRendering}
                    </div>

                    {/* Before Image (Clipped) */}
                    <div 
                        className="absolute inset-0 w-full h-full overflow-hidden"
                        style={{ clipPath: `inset(0 ${isRTL ? 0 : 100 - sliderPosition}% 0 ${isRTL ? 100 - sliderPosition : 0})` }}
                    >
                        <img 
                            src={beforeImage1} 
                            alt="Before Sketch 1" 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105"
                            fetchPriority="high"
                            loading="eager"
                        />
                        <div className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-gray-900 text-xs font-bold uppercase tracking-widest z-10 shadow-lg`}>
                            {t.originalSketch}
                        </div>
                    </div>

                    {/* Slider Handle */}
                    <div 
                        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 shadow-[0_0_15px_rgba(0,0,0,0.3)]"
                        style={{ left: `${sliderPosition}%` }}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl text-gray-900 transition-transform hover:scale-110 border border-gray-100">
                            <i className="fas fa-arrows-alt-h text-lg"></i>
                        </div>
                    </div>

                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={sliderPosition} 
                        onChange={handleSliderChange}
                        className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-ew-resize"
                        dir="ltr"
                    />
                </div>

                {/* Slider 2 Container */}
                <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border border-gray-200/50 select-none group">
                    {/* After Image (Background/Base) */}
                    <img 
                        src={afterImage2} 
                        alt="After Render 2" 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105"
                        loading="lazy"
                    />
                    <div className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest z-10 pointer-events-none shadow-lg`}>
                        {t.aiRendering}
                    </div>

                    {/* Before Image (Clipped) */}
                    <div 
                        className="absolute inset-0 w-full h-full overflow-hidden"
                        style={{ clipPath: `inset(0 ${isRTL ? 0 : 100 - sliderPosition2}% 0 ${isRTL ? 100 - sliderPosition2 : 0})` }}
                    >
                        <img 
                            src={beforeImage2} 
                            alt="Before Sketch 2" 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105"
                            loading="lazy"
                        />
                        <div className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-gray-900 text-xs font-bold uppercase tracking-widest z-10 shadow-lg`}>
                            {t.originalSketch}
                        </div>
                    </div>

                    {/* Slider Handle */}
                    <div 
                        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 shadow-[0_0_15px_rgba(0,0,0,0.3)]"
                        style={{ left: `${sliderPosition2}%` }}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl text-gray-900 transition-transform hover:scale-110 border border-gray-100">
                            <i className="fas fa-arrows-alt-h text-lg"></i>
                        </div>
                    </div>

                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={sliderPosition2} 
                        onChange={handleSliderChange2}
                        className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-ew-resize"
                        dir="ltr"
                    />
                </div>
            </FadeIn>
        </div>
      </header>

      {/* Storytelling Section - Replaces the old Lead Form */}
      <section className="py-20 px-4">
          <FadeIn direction="up">
          <div className="max-w-6xl mx-auto bg-white/60 backdrop-blur-lg rounded-[3rem] overflow-hidden shadow-2xl border border-white/50 flex flex-col md:flex-row min-h-[500px] relative group">
              
              <div className="md:w-1/2 p-8 md:p-16 flex flex-col justify-center relative z-10">
                  <span className="inline-block py-1 px-3 w-fit rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest mb-6">
                     {t.storyTitle}
                  </span>
                  <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-gray-900 leading-tight">
                     {t.storyTitle}
                  </h2>
                  <p className="text-gray-600 mb-10 text-lg leading-relaxed font-light">
                      {t.storyDesc}
                  </p>
                  
                  <div className="space-y-8">
                     <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30 text-white">
                           <i className="fas fa-bolt text-xl"></i>
                        </div>
                        <div>
                           <h3 className="text-xl font-bold text-gray-900 mb-1">{t.storyPoint1}</h3>
                           <p className="text-sm text-gray-500">{t.storyPoint1Desc}</p>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30 text-white">
                           <i className="fas fa-gem text-xl"></i>
                        </div>
                        <div>
                           <h3 className="text-xl font-bold text-gray-900 mb-1">{t.storyPoint2}</h3>
                           <p className="text-sm text-gray-500">{t.storyPoint2Desc}</p>
                        </div>
                     </div>
                  </div>
              </div>

              {/* Right Side: Visual / Testimonial */}
              <div className="md:w-1/2 bg-gray-900 relative hidden md:block overflow-hidden">
                  <img src="https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_2.jpg" className="absolute inset-0 w-full h-full object-cover opacity-70 scale-105 transition-transform duration-[20s] group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
                  <div className="absolute bottom-12 left-12 right-12 text-white">
                      <div className="text-6xl text-white/20 mb-4 absolute -top-12 -left-4 font-serif">"</div>
                      <p className="font-light italic mb-8 text-xl leading-relaxed relative z-10">{t.testimonial}</p>
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center font-bold text-white text-xs">ZH</div>
                         <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-white">{t.testimonialAuthor}</p>
                            <p className="text-[10px] text-white/60 uppercase tracking-wider">Verified User</p>
                         </div>
                      </div>
                  </div>
              </div>
          </div>
          </FadeIn>
      </section>

      {/* Gallery Section */}
      <section className="py-24 px-4 bg-gray-50/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                  <FadeIn>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{t.galleryTitle}</h2>
                    <p className="text-gray-500 text-sm max-w-lg mx-auto">{t.galleryDesc}</p>
                  </FadeIn>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {GALLERY_IMAGES.map((src, index) => (
                      <FadeIn key={index} delay={index * 100} direction="up">
                        <div 
                            onClick={() => setLightboxIndex(index)}
                            className="group relative aspect-[3/4] rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all cursor-pointer bg-gray-200"
                        >
                            <img 
                                src={src} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                loading="lazy" 
                                decoding="async"
                                alt={`Gallery render ${index + 1}`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                <span className="text-white text-xs font-bold uppercase tracking-widest mb-1 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">View Render</span>
                                <div className="h-0.5 w-8 bg-white/50"></div>
                            </div>
                        </div>
                      </FadeIn>
                  ))}
              </div>
          </div>
      </section>

      {/* Video Section */}
      <section className="py-24 px-4 bg-white/80 backdrop-blur-md relative">
          <div className="max-w-5xl mx-auto text-center relative z-10">
               <FadeIn>
                   <h2 className="text-3xl font-bold text-gray-900 mb-10">{t.videoTitle}</h2>
                   <div className="relative aspect-video rounded-[2rem] overflow-hidden shadow-2xl bg-black border border-gray-200 group">
                       <video 
                          src="https://storage.googleapis.com/oavbucket/Untitled%20video%20-%20Made%20with%20Clipchamp%20(4).mp4" 
                          poster="https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_4.jpg"
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                          controls 
                          preload="none"
                       />
                       <div className="absolute inset-0 pointer-events-none rounded-[2rem] border-4 border-white/10"></div>
                   </div>
               </FadeIn>
          </div>
          {/* Decorative Blob behind video */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-gradient-to-r from-blue-50 to-purple-50 rounded-full blur-[100px] -z-10 opacity-50"></div>
      </section>

      <footer className="bg-gray-900 text-white py-16 px-4 text-center border-t border-gray-800 relative z-20">
          <FadeIn>
            <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="ozArchViz" className="h-8 w-auto mx-auto mb-8 filter brightness-0 invert opacity-80 hover:opacity-100 transition-opacity" />
            <div className="flex justify-center gap-8 mb-8 text-gray-400 text-sm">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-gray-600 text-xs">© {new Date().getFullYear()} ozArchViz. {t.rightsReserved}</p>
          </FadeIn>
      </footer>

      {/* Gallery Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-300 backdrop-blur-sm">
          <button 
             onClick={() => setLightboxIndex(null)}
             className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white transition-colors bg-white/10 rounded-full"
          >
             <i className="fas fa-times text-2xl"></i>
          </button>
          
          <button 
             onClick={(e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev! - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length); }}
             className="absolute left-4 md:left-8 w-14 h-14 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
             <i className="fas fa-arrow-left text-2xl"></i>
          </button>

          <img 
            src={GALLERY_IMAGES[lightboxIndex]} 
            className="max-h-[85vh] max-w-[90vw] object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-300"
          />

          <button 
             onClick={(e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev! + 1) % GALLERY_IMAGES.length); }}
             className="absolute right-4 md:right-8 w-14 h-14 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
             <i className="fas fa-arrow-right text-2xl"></i>
          </button>
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium tracking-widest bg-black/50 px-4 py-1 rounded-full backdrop-blur-md border border-white/10">
             {lightboxIndex + 1} <span className="text-white/30 mx-2">|</span> {GALLERY_IMAGES.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowcaseLanding;