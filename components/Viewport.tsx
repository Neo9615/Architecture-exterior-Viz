
import React, { useState, useRef } from 'react';
import { Annotation } from '../types';

interface ViewportProps {
  imageUrl: string | null;
  isLoading: boolean;
  annotations: Annotation[];
  onAddAnnotation: (ann: Annotation) => void;
  onRemoveAnnotation: (index: number) => void;
  isAnnotating: boolean;
}

const Viewport: React.FC<ViewportProps> = ({ 
  imageUrl, 
  isLoading, 
  annotations, 
  onAddAnnotation, 
  onRemoveAnnotation,
  isAnnotating
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [showPrompt, setShowPrompt] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [newLabel, setNewLabel] = useState("");

  const getCoords = (e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isAnnotating || !imageUrl || showPrompt) return;
    const coords = getCoords(e);
    setStartPos(coords);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos) return;
    const coords = getCoords(e);
    
    const x = Math.min(startPos.x, coords.x);
    const y = Math.min(startPos.y, coords.y);
    const w = Math.abs(coords.x - startPos.x);
    const h = Math.abs(coords.y - startPos.y);
    
    setCurrentBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentBox && currentBox.w > 1 && currentBox.h > 1) {
      setShowPrompt(currentBox);
    } else {
      setStartPos(null);
      setCurrentBox(null);
    }
  };

  const handleSave = () => {
    if (showPrompt && newLabel.trim()) {
      onAddAnnotation({
        x: showPrompt.x,
        y: showPrompt.y,
        width: showPrompt.w,
        height: showPrompt.h,
        label: newLabel.trim()
      });
      setNewLabel("");
      setShowPrompt(null);
      setStartPos(null);
      setCurrentBox(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col relative bg-[#050505] overflow-hidden select-none">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-4">
        <div className="bg-[#111]/80 backdrop-blur-md border border-[#222] px-4 py-2 rounded-full flex items-center gap-6 shadow-2xl">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isLoading ? 'Neural Rendering...' : 'System Ready'}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-[#333]"></div>
          <div className="flex items-center gap-3">
             <span className="text-xs text-gray-300">Archivision Engine</span>
             <i className="fas fa-layer-group text-gray-500"></i>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`relative max-w-full max-h-full aspect-video bg-[#0f0f0f] rounded-2xl overflow-hidden shadow-2xl border border-[#222] ${isAnnotating ? 'cursor-crosshair' : 'cursor-default'}`}
        >
          {imageUrl ? (
            <img 
              src={imageUrl} 
              draggable={false}
              className={`w-full h-full object-contain transition-opacity duration-700 ${isLoading ? 'opacity-30 blur-sm' : 'opacity-100'}`} 
              alt="Arch Render" 
            />
          ) : (
            <div className="w-[800px] h-[450px] flex flex-col items-center justify-center text-gray-600 p-12 text-center">
              <i className="fas fa-drafting-compass text-6xl mb-6 opacity-20"></i>
              <h3 className="text-xl font-medium text-gray-400">Workspace Viewport</h3>
              <p className="mt-2 text-sm max-w-xs">Upload your color-coded facade sketches to generate precision material renderings.</p>
            </div>
          )}

          {currentBox && (
            <div 
              className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
              style={{
                left: `${currentBox.x}%`,
                top: `${currentBox.y}%`,
                width: `${currentBox.w}%`,
                height: `${currentBox.h}%`
              }}
            />
          )}

          {annotations.map((ann, idx) => (
            <div 
              key={idx}
              className="absolute group z-10 border border-blue-400/50 bg-blue-400/5 hover:bg-blue-400/20 transition-colors"
              style={{ 
                left: `${ann.x}%`, 
                top: `${ann.y}%`, 
                width: `${ann.width}%`, 
                height: `${ann.height}%` 
              }}
            >
              <div className="absolute top-0 left-0 -translate-y-full bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-t-md flex items-center gap-2 shadow-lg">
                <span>{ann.label}</span>
                <button 
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onRemoveAnnotation(idx); }}
                  className="hover:text-red-300 ml-1"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          ))}

          {showPrompt && (
            <div 
              className="absolute z-30 bg-[#111] border border-blue-500 rounded-lg p-3 shadow-2xl w-48"
              style={{ 
                left: `${showPrompt.x + showPrompt.w / 2}%`, 
                top: `${showPrompt.y + showPrompt.h / 2}%`, 
                transform: 'translate(-50%, -50%)' 
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="text-[10px] font-bold text-blue-400 uppercase mb-2 tracking-widest">Add Instruction</div>
              <input 
                autoFocus
                type="text"
                placeholder="e.g., Change to marble..."
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-2 py-1.5 text-xs text-white mb-2 focus:outline-none focus:border-blue-500"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowPrompt(null); setStartPos(null); setCurrentBox(null); }} className="text-[10px] text-gray-500 hover:text-white">Cancel</button>
                <button onClick={handleSave} className="bg-blue-600 text-white text-[10px] px-3 py-1 rounded hover:bg-blue-500">Save</button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[4px] z-40">
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-microchip text-blue-500 text-xl animate-pulse"></i>
                  </div>
                </div>
                <div className="flex flex-col items-center text-center px-8">
                  <span className="text-white text-base font-medium tracking-wide">AI VISUALIZATION ENGINE</span>
                  <p className="text-gray-400 text-xs mt-2 max-w-sm leading-relaxed">
                    Translating color maps into photorealistic textures. Maintaining geometric integrity.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Viewport;
