
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Viewport from './components/Viewport';
import { RenderParams, Annotation, RenderResult } from './types';
import { GeminiService } from './services/geminiService';

const App: React.FC = () => {
  const [params, setParams] = useState<RenderParams>({
    style: 'Modernist',
    description: '',
    landscapePrompt: 'Lush mountain landscape with misty morning light and pine trees.',
    materialPrompt: 'Exposed concrete, dark wood accents, and expansive tempered glass panels.',
    materialMode: 'color-key',
    angle: 'Eye Level',
    baseSketches: [],
    materialMappings: [
      { color: 'Red', material: 'Red Clay Brick' },
      { color: 'Blue', material: 'Reflective Glass' },
      { color: 'Yellow', material: 'Polished Brass' }
    ],
  });

  const [results, setResults] = useState<RenderResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [editPrompt, setEditPrompt] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    const studio = (window as any).aistudio;
    if (studio) {
      try {
        const has = await studio.hasSelectedApiKey();
        setHasApiKey(has);
      } catch (e) {
        console.error("Error checking key status", e);
      }
    }
  };

  const handleOpenKey = async () => {
    const studio = (window as any).aistudio;
    if (studio) {
      try {
        await studio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Key selection failed", e);
      }
    }
  };

  const handleGenerate = async () => {
    const studio = (window as any).aistudio;
    if (!hasApiKey && studio) {
      await handleOpenKey();
    }
    
    setIsLoading(true);
    const gemini = new GeminiService();
    
    try {
      for (let i = 0; i < params.baseSketches.length; i++) {
        const sketch = params.baseSketches[i];
        const resultUrl = await gemini.generateRender(params, sketch);
        
        const newResult: RenderResult = {
          id: Math.random().toString(36).substr(2, 9),
          sketchUrl: sketch,
          renderUrl: resultUrl,
          timestamp: Date.now()
        };
        
        setResults(prev => {
          const updated = [...prev, newResult];
          if (prev.length === 0 && i === 0) {
             setActiveResultIndex(0);
          } else if (i === 0) {
             setActiveResultIndex(prev.length);
          }
          return updated;
        });
        
        if (params.baseSketches.length > 1 && i < params.baseSketches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      setAnnotations([]);
    } catch (error: any) {
      console.error("Render failed:", error);
      if (error.message === "API_KEY_REQUIRED" && studio) {
        setHasApiKey(false);
        alert("A paid API key is required for Gemini 3 Pro. Please select a valid billing-enabled project.");
        await handleOpenKey();
      } else {
        alert("Generation failed. Please check your connection and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    const activeItem = results[activeResultIndex];
    const activeImage = activeItem?.renderUrl;
    if (!activeImage || (!editPrompt && annotations.length === 0)) return;
    
    setIsLoading(true);
    try {
      const gemini = new GeminiService();
      
      // Build an explicit spatial mask instruction
      let spatialContext = "";
      if (annotations.length > 0) {
        spatialContext = " MASKED REGIONS (ONLY EDIT INSIDE THESE BOXES): " + annotations.map((a, i) => 
          `[REGION #${i+1}: Action="${a.label}", BoundingBox={"x_start": ${Math.round(a.x)}%, "y_start": ${Math.round(a.y)}%, "width": ${Math.round(a.width)}%, "height": ${Math.round(a.height)}%}]`
        ).join(", ");
      }
      
      const fullInstruction = (editPrompt ? `GLOBAL_GOAL: ${editPrompt}. ` : "") + spatialContext + " DO NOT MODIFY PIXELS OUTSIDE THE BOUNDING BOXES.";
      const result = await gemini.editImage(activeImage, fullInstruction);
      
      const newResult: RenderResult = {
        id: Math.random().toString(36).substr(2, 9),
        sketchUrl: activeItem.sketchUrl,
        renderUrl: result,
        timestamp: Date.now()
      };

      setResults(prev => {
        const updated = [...prev, newResult];
        setActiveResultIndex(updated.length - 1);
        return updated;
      });
      
      setEditPrompt("");
      setAnnotations([]); 
      setIsAnnotating(false);
    } catch (error: any) {
      console.error("Edit failed:", error);
      if (error.message === "API_KEY_REQUIRED" && (window as any).aistudio) {
        setHasApiKey(false);
        await handleOpenKey();
      } else {
        alert("Modification failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onInspirationUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setParams(p => ({ ...p, inspirationImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const onTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setParams(p => ({ ...p, materialTextureImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const onMappingTextureUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newMappings = [...params.materialMappings];
        newMappings[index].textureImage = reader.result as string;
        setParams(p => ({ ...p, materialMappings: newMappings }));
      };
      reader.readAsDataURL(file);
    }
  };

  const onSketchesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5) as File[];
    if (files.length === 0) return;

    setIsLoading(true);
    try {
      const base64Files: string[] = [];
      for (const file of files) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        base64Files.push(base64);
      }
      setParams(p => ({ ...p, baseSketches: base64Files }));
    } finally {
      setIsLoading(false);
    }
  };

  const activeResult = results[activeResultIndex];
  const currentImageUrl = activeResult?.renderUrl || null;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#050505] text-gray-100 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#111] border-b border-[#222] z-30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <i className="fas fa-cubes text-white text-xs"></i>
          </div>
          <span className="font-bold text-sm tracking-tight">Archivision</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="w-10 h-10 flex items-center justify-center text-gray-400"
        >
          <i className="fas fa-bars"></i>
        </button>
      </div>

      <Sidebar 
        params={params} 
        setParams={setParams} 
        onGenerate={handleGenerate} 
        isLoading={isLoading} 
        onInspirationUpload={onInspirationUpload}
        onTextureUpload={onTextureUpload}
        onSketchesUpload={onSketchesUpload}
        onMappingTextureUpload={onMappingTextureUpload}
        hasKey={hasApiKey}
        onOpenKey={handleOpenKey}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        <Viewport 
          imageUrl={currentImageUrl} 
          isLoading={isLoading} 
          annotations={annotations}
          onAddAnnotation={(ann) => setAnnotations(prev => [...prev, ann])}
          onRemoveAnnotation={(i) => setAnnotations(prev => prev.filter((_, idx) => idx !== i))}
          isAnnotating={isAnnotating}
        />

        {results.length > 0 && (
          <div className="h-16 md:h-20 bg-[#080808] border-t border-[#111] flex items-center px-4 gap-3 md:gap-4 overflow-x-auto shrink-0 no-scrollbar">
            {results.map((res, i) => (
              <div 
                key={res.id}
                onClick={() => { setActiveResultIndex(i); setAnnotations([]); }}
                className={`relative h-10 md:h-14 aspect-video rounded-lg cursor-pointer overflow-hidden shrink-0 transition-all border-2 ${i === activeResultIndex ? 'border-blue-600 scale-105 shadow-lg shadow-blue-900/20' : 'border-transparent opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}`}
              >
                <img src={res.renderUrl} className="w-full h-full object-cover" />
                <div className="absolute top-0 left-0 bg-black/60 text-[8px] px-1 font-bold text-white uppercase">
                  {i === activeResultIndex ? 'Current' : `v${i+1}`}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-auto md:h-24 bg-[#0a0a0a] border-t border-[#222] px-4 md:px-8 py-3 md:py-0 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-6 shrink-0">
          <div className="flex gap-2 justify-center md:justify-start">
            <button 
              onClick={() => setIsAnnotating(!isAnnotating)}
              className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all ${
                isAnnotating ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 animate-pulse' : 'bg-[#111] text-gray-400 hover:text-white border border-[#222]'
              }`}
              title="Add Material Notes"
            >
              <i className="fas fa-tag"></i>
            </button>
            <button 
              disabled={isLoading || !currentImageUrl}
              onClick={() => {
                const link = document.createElement('a');
                link.href = currentImageUrl!;
                link.download = `archivision-render-${activeResultIndex + 1}.png`;
                link.click();
              }}
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#111] text-gray-400 hover:text-white border border-[#222] disabled:opacity-20 flex items-center justify-center"
              title="Download Render"
            >
              <i className="fas fa-download"></i>
            </button>
          </div>

          <div className="flex-1 relative">
            <input 
              type="text"
              placeholder={currentImageUrl ? (isAnnotating ? "Describe change for the selected area..." : "General refinement or tap the tag icon to select areas...") : "Upload sketches to begin."}
              disabled={!currentImageUrl || isLoading}
              className="w-full bg-[#111] border border-[#222] rounded-xl md:rounded-2xl py-2 md:py-3 pl-4 md:pl-5 pr-12 focus:outline-none focus:border-blue-500/50 text-xs md:text-sm transition-all placeholder-gray-600 disabled:opacity-50"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
            />
            <button 
              onClick={handleEdit}
              disabled={!currentImageUrl || (!editPrompt && annotations.length === 0) || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 transition-all disabled:opacity-20 shadow-lg shadow-blue-900/20"
            >
              <i className="fas fa-magic text-xs"></i>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2">
             <div className="text-right">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">History</div>
                <div className="text-xs text-blue-400 font-medium">
                  {results.length} Attempts
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
