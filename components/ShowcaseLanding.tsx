
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
  const mouseRef = useRef({ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 }); 
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let points: {x: number, y: number, angle: number}[] = [];
    
    // REDUCED DENSITY: Increased spacing from default to 90
    const spacing = 90; 
    
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
            angle: 0 
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
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       ctx.lineCap = 'round';
       
       const mouseX = mouseRef.current.x;
       const mouseY = mouseRef.current.y;
       const maxDist = Math.max(canvas.width, canvas.height) * 0.6;

       points.forEach(p => {
           const dx = mouseX - p.x;
           const dy = mouseY - p.y;
           const dist = Math.sqrt(dx * dx + dy * dy);
           const targetAngle = Math.atan2(dy, dx);
           let angleDiff = targetAngle - p.angle;
           while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
           while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
           p.angle += angleDiff * 0.1; 
           
           const proximity = Math.max(0, 1 - dist / maxDist);
           
           // SMALLER LINES & LESSER VISIBILITY
           const length = 2 + (proximity * 6); 
           const width = 0.5 + (proximity * 0.5);
           const opacity = 0.05 + (proximity * 0.25);

           ctx.strokeStyle = `rgba(100, 116, 139, ${opacity})`; 
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

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-auto" />;
};

// --- Image Comparison Slider Component ---
const ImageComparison = ({ before, after, label }: { before: string, after: string, label: string }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      setSliderPosition((x / rect.width) * 100);
  };

  const onMouseDown = () => setIsDragging(true);
  const onMouseUp = () => setIsDragging(false);
  const onMouseMove = (e: React.MouseEvent) => { if (isDragging) handleMove(e.clientX); };
  const onTouchMove = (e: React.TouchEvent) => { handleMove(e.touches[0].clientX); };

  useEffect(() => {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden cursor-ew-resize select-none shadow-2xl border border-gray-200 group"
      onMouseMove={onMouseMove}
      onTouchMove={onTouchMove}
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
    >
        {/* After Image (Background) */}
        <img src={after} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">{label}</div>

        {/* Before Image (Clipped) */}
        <div 
            className="absolute inset-0 w-full h-full overflow-hidden border-r-2 border-white"
            style={{ width: `${sliderPosition}%` }}
        >
            <img src={before} className="absolute inset-0 w-full h-full object-cover max-w-none" style={{ width: containerRef.current?.getBoundingClientRect().width || '100%' }} draggable={false} />
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-gray-900 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Original Sketch</div>
        </div>

        {/* Slider Handle */}
        <div 
            className="absolute top-0 bottom-0 w-10 -ml-5 flex items-center justify-center z-10 pointer-events-none"
            style={{ left: `${sliderPosition}%` }}
        >
            <div className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                <i className="fas fa-arrows-alt-h text-gray-400 text-xs"></i>
            </div>
        </div>
    </div>
  );
};

// --- Main Landing Component ---
const ShowcaseLanding: React.FC<ShowcaseLandingProps> = ({ onBack, lang = 'en', setLang }) => {
  const t = translations[lang];
  const isRTL = lang === 'ma';
  
  // Form State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestStatus('loading');
    
    try {
        await addDoc(collection(db, 'access_requests'), {
            email,
            name,
            role,
            phone,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });
        
        // Simulate delay
        setTimeout(() => {
            setRequestStatus('success');
        }, 1500);

    } catch (error) {
        console.error("Error submitting request:", error);
        setRequestStatus('idle');
        alert("Something went wrong. Please try again.");
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-gray-900 selection:text-white ${isRTL ? 'font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
        
        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 transition-all duration-300">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="ozArchViz" className="h-8 w-auto" />
                </div>
                <div className="flex items-center gap-6">
                    {setLang && (
                        <div className="hidden md:flex bg-gray-100 p-0.5 rounded-lg">
                            <button onClick={() => setLang('en')} className={`px-2 py-1 text-[10px] font-bold rounded ${lang === 'en' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>EN</button>
                            <button onClick={() => setLang('fr')} className={`px-2 py-1 text-[10px] font-bold rounded ${lang === 'fr' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>FR</button>
                            <button onClick={() => setLang('ma')} className={`px-2 py-1 text-[10px] font-bold rounded ${lang === 'ma' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>MA</button>
                        </div>
                    )}
                    <button 
                        onClick={onBack}
                        className="bg-gray-900 text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        {t.backToApp}
                    </button>
                </div>
            </div>
        </nav>

        {/* Hero Section */}
        <header className="relative pt-32 pb-20 overflow-hidden">
            <ParametricGrid />
            
            <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    v2.1 Neural Engine Live
                </div>
                
                {/* Smaller Title */}
                <h1 className="text-3xl md:text-6xl font-black tracking-tight text-gray-900 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    {t.landingTitle}
                </h1>

                {/* --- SLIDERS (MOVED UP) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 mb-16">
                    <div className="flex flex-col gap-4">
                        <ImageComparison 
                            before="https://storage.googleapis.com/oavbucket/Gallery/AA.png"
                            after="https://storage.googleapis.com/oavbucket/Gallery/BB.png"
                            label={t.aiRendering}
                        />
                        <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Exterior Visualization</p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <ImageComparison 
                            before="https://storage.googleapis.com/oavbucket/Sketch1.jpeg"
                            after="https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_1.jpg"
                            label="Interior Staging"
                        />
                        <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Interior Design</p>
                    </div>
                </div>
                
                {/* Subtitle (MOVED DOWN) */}
                <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-500 leading-relaxed mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    {t.landingSubtitle}
                </p>
            </div>
        </header>

        {/* Narrative Section */}
        <section className="py-24 bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">{t.storyTitle}</h2>
                        <p className="text-gray-600 leading-relaxed mb-8 text-lg">
                            {t.storyDesc}
                        </p>
                        
                        <div className="space-y-8">
                            <div className="flex gap-4">
                                <div className="w-12 h-12 shrink-0 bg-gray-100 rounded-xl flex items-center justify-center">
                                    <i className="fas fa-bolt text-gray-900 text-xl"></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-2 text-lg">{t.storyPoint1}</h3>
                                    <p className="text-gray-500 text-sm">{t.storyPoint1Desc}</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-12 h-12 shrink-0 bg-gray-100 rounded-xl flex items-center justify-center">
                                    <i className="fas fa-gem text-gray-900 text-xl"></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-2 text-lg">{t.storyPoint2}</h3>
                                    <p className="text-gray-500 text-sm">{t.storyPoint2Desc}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-gray-100 shadow-2xl">
                             <img src="https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_1.jpg" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* --- FORM SECTION (Replacing Quote) --- */}
        <section className="py-24 bg-gray-900 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                
                {requestStatus === 'success' ? (
                     <div className="py-16 animate-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                            <i className="fas fa-check text-3xl"></i>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.requestReceivedTitle}</h2>
                        <p className="text-gray-300 text-lg max-w-lg mx-auto mb-8">{t.requestReceivedDesc}</p>
                        <button 
                            onClick={() => { setRequestStatus('idle'); setEmail(''); setName(''); setRole(''); setPhone(''); }}
                            className="bg-white/10 text-white px-8 py-3 rounded-full font-bold hover:bg-white/20 transition-all border border-white/20"
                        >
                            {t.sendAnother}
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Join the Waitlist</h2>
                        <p className="text-gray-400 mb-12 text-lg max-w-2xl mx-auto">
                            Experience the power of AI-driven architecture. Fill out the form below to request access to the engine.
                        </p>
                        
                        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm p-8 rounded-3xl border border-white/10 max-w-3xl mx-auto text-left shadow-2xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">{t.fullName}</label>
                                    <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all" placeholder="John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">{t.email}</label>
                                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all" placeholder="name@company.com" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">{t.titleRole}</label>
                                    <input required type="text" value={role} onChange={e => setRole(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all" placeholder="Senior Architect" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">{t.phone}</label>
                                    <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all" placeholder="+1 (555) 000-0000" />
                                </div>
                            </div>
                            <button 
                                type="submit" 
                                disabled={requestStatus === 'loading'}
                                className="w-full bg-white text-gray-900 font-bold py-4 rounded-xl hover:bg-gray-100 transition-all shadow-lg flex items-center justify-center gap-2"
                            >
                                {requestStatus === 'loading' ? <i className="fas fa-spinner fa-spin"></i> : t.requestBtn}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </section>

        {/* Gallery Section */}
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold mb-4">{t.galleryTitle}</h2>
                    <p className="text-gray-500 max-w-2xl mx-auto">{t.galleryDesc}</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {GALLERY_IMAGES.map((src, i) => (
                        <div key={i} className={`group relative rounded-2xl overflow-hidden cursor-pointer ${i % 3 === 0 ? 'col-span-2 row-span-2' : ''}`}>
                            <img src={src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                                <span className="text-white font-bold text-sm tracking-wide">ArchViz Render #{i+1}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Video Section */}
        <section className="py-24 bg-gray-50 border-t border-gray-200">
             <div className="max-w-5xl mx-auto px-6 text-center">
                 <h2 className="text-3xl font-bold mb-12">{t.videoTitle}</h2>
                 <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white">
                    <video 
                        src="https://storage.googleapis.com/oavbucket/Untitled%20video%20-%20Made%20with%20Clipchamp%20(4).mp4" 
                        className="w-full h-full object-cover" 
                        controls 
                    />
                 </div>
             </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12 border-t border-gray-800">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all">
                    <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="ozArchViz" className="h-6 w-auto brightness-0 invert" />
                </div>
                <div className="text-xs text-gray-500">
                    © 2024 ozArchViz. {t.rightsReserved}
                </div>
                <div className="flex gap-4">
                    <a href="#" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fab fa-twitter text-xs"></i></a>
                    <a href="#" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fab fa-instagram text-xs"></i></a>
                    <a href="#" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><i className="fab fa-linkedin-in text-xs"></i></a>
                </div>
            </div>
        </footer>
    </div>
  );
};

export default ShowcaseLanding;
