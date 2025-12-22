
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
    angle: 'Eye Level',
    baseSketches: [],
    materialMappings: [
      { color: 'Red', material: 'Brick' },
      { color: 'Blue', material: 'Glass' }
    ],
  });

  const [results, setResults] = useState<RenderResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [editPrompt, setEditPrompt] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const studio = (window as any).aistudio;
    if (studio) {
      studio.hasSelectedApiKey().then((has: boolean) => setHasApiKey(has));
    }
  }, []);

  const handleOpenKey = async () => {
    const studio = (window as any).aistudio;
    if (studio) {
      await studio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleGenerate = async () => {
    if (!hasApiKey && (window as any).aistudio) {
      await handleOpenKey();
    }
    
    setIsLoading(true);
    setResults([]); 
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
        
        setResults(prev => [...prev, newResult]);
        if (i === 0) setActiveResultIndex(0);
        
        if (params.baseSketches.length > 1 && i < params.baseSketches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      setAnnotations([]);
    } catch (error: any) {
      console.error("Render failed:", error);
      alert("Render failed. The model might be busy or your API key is invalid.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    const activeImage = results[activeResultIndex]?.renderUrl;
    if (!activeImage || (!editPrompt && annotations.length === 0)) return;
    
    setIsLoading(true);
    try {
      const gemini = new GeminiService();
      const annotationContext = annotations.length > 0 
        ? `. Regions: ${annotations.map((a, i) => `${a.label}`).join(', ')}`
        : '';
      
      const fullInstruction = editPrompt + annotationContext;
      const result = await gemini.editImage(activeImage, fullInstruction);
      
      setResults(prev => prev.map((res, idx) => 
        idx === activeResultIndex ? { ...res, renderUrl: result, timestamp: Date.now() } : res
      ));
      
      setEditPrompt("");
      setAnnotations([]); 
    } catch (error) {
      console.error("Edit failed:", error);
      alert("Modification failed.");
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

  const onSketchesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5) as File[];
    if (files.length === 0) return;

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
  };

  const activeResult = results[activeResultIndex];
  const currentImageUrl = activeResult?.renderUrl || null;

  return (
    <div className="flex h-screen bg-[#050505] text-gray-100 overflow-hidden">
      <Sidebar 
        params={params} 
        setParams={setParams} 
        onGenerate={handleGenerate} 
        isLoading={isLoading} 
        onInspirationUpload={onInspirationUpload}
        onSketchesUpload={onSketchesUpload}
        hasKey={hasApiKey}
        onOpenKey={handleOpenKey}
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
          <div className="h-20 bg-[#080808] border-t border-[#111] flex items-center px-4 gap-4 overflow-x-auto shrink-0">
            {results.map((res, i) => (
              <div 
                key={res.id}
                onClick={() => { setActiveResultIndex(i); setAnnotations([]); }}
                className={`relative h-14 aspect-video rounded-lg cursor-pointer overflow-hidden transition-all border-2 ${i === activeResultIndex ? 'border-blue-600 scale-105 shadow-lg shadow-blue-900/20' : 'border-transparent opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}`}
              >
                <img src={res.renderUrl} className="w-full h-full object-cover" />
                <div className="absolute top-0 left-0 bg-black/60 text-[8px] px-1 font-bold text-white uppercase">Render {i+1}</div>
              </div>
            ))}
          </div>
        )}

        <div className="h-24 bg-[#0a0a0a] border-t border-[#222] px-8 flex items-center gap-6 shrink-0">
          <div className="flex gap-2">
            <button 
              onClick={() => setIsAnnotating(!isAnnotating)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
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
              className="w-12 h-12 rounded-xl bg-[#111] text-gray-400 hover:text-white border border-[#222] disabled:opacity-20 flex items-center justify-center"
              title="Download Render"
            >
              <i className="fas fa-download"></i>
            </button>
          </div>

          <div className="flex-1 relative">
            <input 
              type="text"
              placeholder={currentImageUrl ? "Refine landscape or add building details..." : "Upload color-coded sketches to begin."}
              disabled={!currentImageUrl || isLoading}
              className="w-full bg-[#111] border border-[#222] rounded-2xl py-3 pl-5 pr-12 focus:outline-none focus:border-blue-500/50 text-sm transition-all placeholder-gray-600 disabled:opacity-50"
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

          <div className="flex items-center gap-2">
             <div className="text-right">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Status</div>
                <div className="text-xs text-blue-400 font-medium">
                  {isLoading ? 'Processing' : 'Ready'}
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
