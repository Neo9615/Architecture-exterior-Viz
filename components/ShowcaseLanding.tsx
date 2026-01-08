
import React, { useState, useEffect } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface ShowcaseLandingProps {
  onBack: () => void;
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

const ShowcaseLanding: React.FC<ShowcaseLandingProps> = ({ onBack }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [sliderPosition2, setSliderPosition2] = useState(50);
  const [formData, setFormData] = useState({ name: '', title: '', phone: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'leads'), {
        ...formData,
        timestamp: new Date().toISOString(),
        source: 'ShowcaseLanding'
      });
      setIsSuccess(true);
      setFormData({ name: '', title: '', phone: '', email: '' });
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

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-gray-900/95 backdrop-blur-md z-50 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="ozArchViz" className="h-8 w-auto filter brightness-0 invert" />
            <span className="text-xs font-bold tracking-widest uppercase border-l border-gray-700 pl-3 ml-1 text-gray-400">Showcase</span>
        </div>
        <button 
            onClick={onBack}
            className="text-xs font-bold uppercase tracking-widest text-white hover:text-gray-300 transition-colors flex items-center gap-2"
        >
            <i className="fas fa-arrow-left"></i> Back to App
        </button>
      </nav>

      {/* Hero Section with Before/After Sliders */}
      <header className="relative pt-28 pb-12 px-4 md:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 text-gray-900 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">From Sketch to Reality</h1>
                <p className="text-gray-600 text-sm md:text-base max-w-2xl mx-auto">
                    Experience the power of our AI engine. Slide to see how we transform rough conceptual sketches into hyper-realistic architectural visualizations in seconds.
                </p>
            </div>

            {/* Slider 1 Container */}
            <div className="relative w-full aspect-video max-h-[70vh] rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-100 select-none mb-12">
                {/* After Image (Background/Base) */}
                <img 
                    src={afterImage1} 
                    alt="After Render 1" 
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest z-10 pointer-events-none">
                    AI Rendering
                </div>

                {/* Before Image (Clipped) */}
                <div 
                    className="absolute inset-0 w-full h-full overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                >
                    <img 
                        src={beforeImage1} 
                        alt="Before Sketch 1" 
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                     <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-gray-900 text-xs font-bold uppercase tracking-widest z-10">
                        Original Sketch
                    </div>
                </div>

                {/* Slider Handle */}
                <div 
                    className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                    style={{ left: `${sliderPosition}%` }}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-900">
                        <i className="fas fa-arrows-alt-h"></i>
                    </div>
                </div>

                {/* Invisible Input for Interaction */}
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={sliderPosition} 
                    onChange={handleSliderChange}
                    className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-ew-resize"
                />
            </div>

            {/* Slider 2 Container */}
            <div className="relative w-full aspect-video max-h-[70vh] rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-100 select-none">
                {/* After Image (Background/Base) */}
                <img 
                    src={afterImage2} 
                    alt="After Render 2" 
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest z-10 pointer-events-none">
                    AI Rendering
                </div>

                {/* Before Image (Clipped) */}
                <div 
                    className="absolute inset-0 w-full h-full overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - sliderPosition2}% 0 0)` }}
                >
                    <img 
                        src={beforeImage2} 
                        alt="Before Sketch 2" 
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                     <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-gray-900 text-xs font-bold uppercase tracking-widest z-10">
                        Original Sketch
                    </div>
                </div>

                {/* Slider Handle */}
                <div 
                    className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                    style={{ left: `${sliderPosition2}%` }}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-900">
                        <i className="fas fa-arrows-alt-h"></i>
                    </div>
                </div>

                {/* Invisible Input for Interaction */}
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={sliderPosition2} 
                    onChange={handleSliderChange2}
                    className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-ew-resize"
                />
            </div>
        </div>
      </header>

      {/* Lead Generation Section */}
      <section className="py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto bg-gray-50 rounded-3xl overflow-hidden shadow-xl border border-gray-100 flex flex-col md:flex-row min-h-[600px]">
              <div className="md:w-1/2 p-8 md:p-16 flex flex-col justify-center">
                  <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">Get Professional Access</h2>
                  <p className="text-gray-600 mb-10 text-base leading-relaxed">
                      Ready to transform your architectural workflow? Fill out the form below to schedule a demo or get early access to enterprise features. Our team will contact you within 24 hours.
                  </p>
                  
                  {isSuccess ? (
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center animate-in zoom-in duration-300">
                          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                              <i className="fas fa-check text-xl"></i>
                          </div>
                          <h3 className="text-xl font-bold text-green-800 mb-2">Request Received!</h3>
                          <p className="text-green-600 text-sm">We'll be in touch shortly.</p>
                          <button 
                            onClick={() => setIsSuccess(false)}
                            className="mt-6 text-sm font-bold text-green-700 underline"
                          >
                              Send another
                          </button>
                      </div>
                  ) : (
                      <form onSubmit={handleFormSubmit} className="space-y-6">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Full Name</label>
                              <input 
                                required
                                type="text" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 text-base focus:border-gray-900 focus:outline-none transition-colors"
                                placeholder="Amine Ziani"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Title</label>
                              <input 
                                required
                                type="text" 
                                value={formData.title}
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 text-base focus:border-gray-900 focus:outline-none transition-colors"
                                placeholder="Senior Architect"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Phone Number</label>
                              <input 
                                required
                                type="tel" 
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 text-base focus:border-gray-900 focus:outline-none transition-colors"
                                placeholder="+212 600 00 00 00"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email Address</label>
                              <input 
                                required
                                type="email" 
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 text-base focus:border-gray-900 focus:outline-none transition-colors"
                                placeholder="Ziani@architecture.com"
                              />
                          </div>
                          <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full bg-gray-900 text-white font-bold py-5 rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-70 text-base"
                          >
                              {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <span>Request Access</span>}
                          </button>
                      </form>
                  )}
              </div>
              <div className="md:w-1/2 bg-gray-900 relative hidden md:block">
                  <img src="https://storage.googleapis.com/oavbucket/Home_Slides/Home_Slides_2.jpg" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                  <div className="absolute bottom-12 left-12 right-12 text-white">
                      <div className="text-5xl text-white mb-4">"</div>
                      <p className="font-light italic mb-6 text-lg leading-relaxed">The speed at which we can now iterate on design concepts is absolutely revolutionary.</p>
                      <p className="text-sm font-bold uppercase tracking-widest opacity-70">Senior Architect, Studio K</p>
                  </div>
              </div>
          </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Generated Gallery</h2>
                  <p className="text-gray-500 text-sm">Recent outputs created by our users. Click to view.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {GALLERY_IMAGES.map((src, index) => (
                      <div 
                        key={index} 
                        onClick={() => setLightboxIndex(index)}
                        className="group relative aspect-[3/4] rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer"
                      >
                          <img src={src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                             <i className="fas fa-expand text-white opacity-0 group-hover:opacity-100 transition-opacity text-xl"></i>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      {/* Video Section */}
      <section className="py-20 px-4 bg-white border-t border-gray-200">
          <div className="max-w-4xl mx-auto text-center">
               <h2 className="text-2xl font-bold text-gray-900 mb-8">See It In Action</h2>
               <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl bg-black border border-gray-100">
                   <video 
                      src="https://storage.googleapis.com/oavbucket/Untitled%20video%20-%20Made%20with%20Clipchamp%20(4).mp4" 
                      className="w-full h-full object-cover" 
                      controls 
                   />
               </div>
          </div>
      </section>

      <footer className="bg-gray-900 text-white py-12 px-4 text-center">
          <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="ozArchViz" className="h-8 w-auto mx-auto mb-6 filter brightness-0 invert" />
          <p className="text-gray-500 text-xs">© {new Date().getFullYear()} ozArchViz. All rights reserved.</p>
      </footer>

      {/* Gallery Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-300">
          <button 
             onClick={() => setLightboxIndex(null)}
             className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
             <i className="fas fa-times text-2xl"></i>
          </button>
          
          <button 
             onClick={(e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev! - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length); }}
             className="absolute left-4 md:left-8 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
             <i className="fas fa-chevron-left text-3xl"></i>
          </button>

          <img 
            src={GALLERY_IMAGES[lightboxIndex]} 
            className="max-h-[90vh] max-w-[90vw] object-contain shadow-2xl"
          />

          <button 
             onClick={(e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev! + 1) % GALLERY_IMAGES.length); }}
             className="absolute right-4 md:right-8 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
             <i className="fas fa-chevron-right text-3xl"></i>
          </button>
          
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono">
             {lightboxIndex + 1} / {GALLERY_IMAGES.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowcaseLanding;
