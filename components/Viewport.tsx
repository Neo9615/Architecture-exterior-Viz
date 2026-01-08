
import React, { useState, useRef, useEffect } from 'react';
import { Annotation } from '../types';
import { translations, Language } from '../translations';

interface ViewportProps {
  imageUrl: string | null;
  isLoading: boolean;
  annotations: Annotation[];
  onAddAnnotation: (ann: Annotation) => void;
  onRemoveAnnotation: (index: number) => void;
  isAnnotating: boolean;
  lang: Language;
  toolMode: 'create' | 'modify';
  // Modification Mask Props
  onMaskChange: (base64Mask: string) => void;
  shouldClearMask: number;
}

const Viewport: React.FC<ViewportProps> = ({ 
  imageUrl, 
  isLoading, 
  annotations, 
  onAddAnnotation, 
  onRemoveAnnotation, 
  isAnnotating, 
  lang,
  toolMode,
  onMaskChange,
  shouldClearMask
}) => {
  const t = translations[lang];
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Selection State (Used for both Annotations AND Modification Mask)
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Annotation | null>(null);
  
  // Modification Mode State
  const [hasMask, setHasMask] = useState(false);

  const [funMessageIndex, setFunMessageIndex] = useState(0);

  const funPhrases = {
    en: [
      "Mixing the perfect concrete ratio...",
      "Sourcing rare Italian marble...",
      "Polishing the triple-glazed windows...",
      "Planting 4K resolution trees...",
      "Waking up the digital sun...",
      "Calculating ray-traced reflections...",
      "Applying architectural magic...",
      "Waiting for the paint to dry...",
      "Staging the luxury furniture..."
    ],
    fr: [
      "Mélange du béton haute performance...",
      "Recherche de marbre italien rare...",
      "Polissage des vitrages à triple couche...",
      "Plantation d'arbres en 4K...",
      "Réveil du soleil numérique...",
      "Calcul des reflets ray-tracés...",
      "Application de la magie architecturale...",
      "Attente du séchage de la peinture...",
      "Mise en place du mobilier de luxe..."
    ],
    ma: [
      "كنخلطو السيمة ديالنا...",
      "كنقلبو على الرخام الواعر...",
      "كنمسحو الدجاج باش يبرق...",
      "كنغرسو شجر 4K فالموقع...",
      "كنفيقو الشمش ديالنا...",
      "كنصوبو الخيال والضو...",
      "كنخدمو السحر المعماري...",
      "كنساينو الصباغة تنشف...",
      "كنقادو الأثاث الفاخر..."
    ]
  };

  useEffect(() => {
    let interval: number | undefined;
    if (isLoading) {
      interval = window.setInterval(() => {
        setFunMessageIndex((prev) => (prev + 1) % funPhrases[lang].length);
      }, 3000);
    } else {
      setFunMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading, lang]);

  // Handle mask clearing
  useEffect(() => {
    if (shouldClearMask > 0) {
      setHasMask(false);
      onMaskChange('');
      setCurrentBox(null);
    }
  }, [shouldClearMask]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || !imageUrl) return;

    // Drawing enabled if:
    // 1. In Create mode AND isAnnotating is true
    // 2. In Modify mode (Always enabled for selection)
    if (toolMode === 'create' && !isAnnotating) return;

    if (toolMode === 'modify') {
        // Clear previous mask visualization when starting a new selection
        setHasMask(false); 
        onMaskChange('');
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setStartPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !isDrawing) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const left = Math.min(x, startPos.x);
    const top = Math.min(y, startPos.y);
    const width = Math.abs(x - startPos.x);
    const height = Math.abs(y - startPos.y);

    setCurrentBox({ x: left, y: top, width, height, label: '' });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentBox && currentBox.width > 1 && currentBox.height > 1) {
      
      if (toolMode === 'create') {
          // Annotation Mode: Add to list
          onAddAnnotation({ ...currentBox, label: 'Selected Area' });
          setCurrentBox(null);
      } else {
          // Modify Mode: Generate Mask
          setHasMask(true);
          generateMaskFromBox(currentBox);
          // Keep currentBox visible as the "selection"
      }

    } else {
      setCurrentBox(null);
    }
  };

  const generateMaskFromBox = (box: Annotation) => {
      const img = imageRef.current;
      if (!img) return;

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          // 1. Fill Black (Frozen area)
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // 2. Fill Rectangle White (Edit area)
          ctx.fillStyle = 'white';
          const x = (box.x / 100) * canvas.width;
          const y = (box.y / 100) * canvas.height;
          const w = (box.width / 100) * canvas.width;
          const h = (box.height / 100) * canvas.height;
          
          ctx.fillRect(x, y, w, h);

          // 3. Export
          onMaskChange(canvas.toDataURL('image/png'));
      }
  };

  return (
    <div className="flex-1 flex flex-col relative bg-gray-100 overflow-hidden select-none">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-4">
        <div className="bg-white/90 backdrop-blur-md border border-gray-200 px-4 py-2 rounded-full flex items-center gap-6 shadow-xl">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {isLoading ? t.neuralRendering : t.systemReady}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-gray-200"></div>
          <div className="flex items-center gap-3">
             <span className="text-xs text-gray-600">Archivision Engine</span>
             <i className="fas fa-layer-group text-gray-400"></i>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`relative max-w-full max-h-full aspect-video bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200 ${isAnnotating || toolMode === 'modify' ? 'cursor-crosshair' : ''}`}
        >
          {imageUrl ? (
            <>
              <img 
                ref={imageRef}
                src={imageUrl} 
                className={`w-full h-full object-contain transition-opacity duration-700 ${isLoading ? 'opacity-30 blur-sm' : 'opacity-100'}`} 
                alt="Render" 
                draggable={false}
              />
              
              {/* Annotations (Create Mode) */}
              {toolMode === 'create' && annotations.map((ann, i) => (
                <div 
                  key={i}
                  className="absolute border-2 border-gray-900 bg-gray-900/10 group flex items-start justify-end"
                  style={{ left: `${ann.x}%`, top: `${ann.y}%`, width: `${ann.width}%`, height: `${ann.height}%` }}
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemoveAnnotation(i); }}
                    className="m-1 w-5 h-5 bg-gray-900 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <i className="fas fa-times text-[10px]"></i>
                  </button>
                  <div className="absolute -top-6 left-0 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
                    #{i + 1} {ann.label}
                  </div>
                </div>
              ))}

              {/* Current Selection Box (Used for drawing) */}
              {currentBox && (
                <div 
                  className={`absolute border-2 ${toolMode === 'modify' ? 'border-green-500 bg-green-500/20' : 'border-dashed border-gray-400 bg-white/10'}`}
                  style={{ left: `${currentBox.x}%`, top: `${currentBox.y}%`, width: `${currentBox.width}%`, height: `${currentBox.height}%` }}
                >
                   {toolMode === 'modify' && (
                        <div className="absolute top-0 right-0 -mt-6 bg-green-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                            EDIT AREA
                        </div>
                    )}
                </div>
              )}
            </>
          ) : (
            <div className="w-[800px] h-[450px] flex flex-col items-center justify-center text-gray-400 p-12 text-center">
              <i className="fas fa-drafting-compass text-6xl mb-6 opacity-20"></i>
              <h3 className="text-xl font-medium text-gray-500">Workspace Viewport</h3>
              <p className="mt-2 text-sm max-w-xs text-gray-400">{t.viewportDesc}</p>
            </div>
          )}
          
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md z-40 transition-all">
              <div className="relative mb-8">
                {/* Architectural Spinner */}
                <div className="w-20 h-20 border-4 border-gray-200 rounded-full animate-spin border-t-gray-900"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <i className="fas fa-building text-gray-900 text-xl animate-pulse"></i>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 max-w-sm px-6">
                <p className="text-sm font-bold text-gray-900 text-center animate-in fade-in slide-in-from-bottom-2 duration-500" key={funMessageIndex}>
                   {funPhrases[lang][funMessageIndex]}
                </p>
                <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
                   <div className="h-full bg-gray-900 animate-[loading_2s_ease-in-out_infinite]"></div>
                </div>
              </div>
              <style>{`
                @keyframes loading {
                  0% { transform: translateX(-100%); }
                  50% { transform: translateX(0); }
                  100% { transform: translateX(100%); }
                }
              `}</style>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Viewport;
