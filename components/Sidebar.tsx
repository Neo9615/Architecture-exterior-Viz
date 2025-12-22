
import React from 'react';
import { STYLES } from '../constants';
import { RenderStyle, RenderParams, MaterialMapping } from '../types';

interface SidebarProps {
  params: RenderParams;
  setParams: React.Dispatch<React.SetStateAction<RenderParams>>;
  onGenerate: () => void;
  isLoading: boolean;
  onInspirationUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSketchesUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasKey: boolean;
  onOpenKey: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  params, 
  setParams, 
  onGenerate, 
  isLoading, 
  onInspirationUpload, 
  onSketchesUpload,
  hasKey,
  onOpenKey
}) => {
  const addMapping = () => {
    setParams(p => ({
      ...p,
      materialMappings: [...p.materialMappings, { color: '', material: '' }]
    }));
  };

  const updateMapping = (index: number, field: keyof MaterialMapping, value: string) => {
    const newMappings = [...params.materialMappings];
    newMappings[index][field] = value;
    setParams(p => ({ ...p, materialMappings: newMappings }));
  };

  const removeMapping = (index: number) => {
    setParams(p => ({
      ...p,
      materialMappings: p.materialMappings.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="w-80 h-full bg-[#111] border-r border-[#222] p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <i className="fas fa-cubes text-white"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Archivision</h1>
        </div>
        {!hasKey && (
          <button 
            onClick={onOpenKey}
            className="text-[10px] bg-amber-600/20 text-amber-400 border border-amber-600/50 px-2 py-1 rounded hover:bg-amber-600 hover:text-white transition-colors"
          >
            Setup Key
          </button>
        )}
      </div>

      <section>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">
          1. Perspective & Color Map
        </label>
        <div className="relative group">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={onSketchesUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={isLoading}
          />
          <div className={`w-full h-24 bg-[#1a1a1a] border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors overflow-hidden ${params.baseSketches.length > 0 ? 'border-blue-500' : 'border-[#333] group-hover:border-blue-500'}`}>
            <i className="fas fa-palette text-gray-600 text-xl mb-1"></i>
            <span className="text-[10px] text-gray-500">
              {params.baseSketches.length > 0 ? `${params.baseSketches.length} Sketches Uploaded` : "Upload color-coded perspective sketches"}
            </span>
          </div>
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
          {params.baseSketches.map((sketch, i) => (
            <img key={i} src={sketch} className="w-10 h-10 object-cover rounded border border-[#333]" />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">2. Material Selection</label>
          <div className="flex bg-[#1a1a1a] p-0.5 rounded-md border border-[#222]">
             <button 
               onClick={() => setParams(p => ({ ...p, materialMode: 'color-key' }))}
               className={`text-[9px] px-2 py-1 rounded transition-all ${params.materialMode === 'color-key' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
             >
               COLOR KEY
             </button>
             <button 
               onClick={() => setParams(p => ({ ...p, materialMode: 'text-prompt' }))}
               className={`text-[9px] px-2 py-1 rounded transition-all ${params.materialMode === 'text-prompt' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
             >
               PROMPT
             </button>
          </div>
        </div>

        {params.materialMode === 'color-key' ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-gray-400">Map sketch colors to materials</span>
              <button onClick={addMapping} className="text-blue-500 hover:text-blue-400 text-[10px]">
                <i className="fas fa-plus mr-1"></i> ADD
              </button>
            </div>
            {params.materialMappings.map((mapping, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input 
                  placeholder="Color (e.g. Red)"
                  value={mapping.color}
                  onChange={(e) => updateMapping(idx, 'color', e.target.value)}
                  className="w-1/3 bg-[#1a1a1a] border border-[#222] text-[10px] rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-gray-300"
                />
                <input 
                  placeholder="Material (e.g. Oak)"
                  value={mapping.material}
                  onChange={(e) => updateMapping(idx, 'material', e.target.value)}
                  className="flex-1 bg-[#1a1a1a] border border-[#222] text-[10px] rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-gray-300"
                />
                <button onClick={() => removeMapping(idx)} className="text-gray-600 hover:text-red-500 transition-colors">
                  <i className="fas fa-times text-[10px]"></i>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <textarea
            value={params.materialPrompt}
            onChange={(e) => setParams(p => ({ ...p, materialPrompt: e.target.value }))}
            placeholder="Describe the building materials (e.g., Brushed aluminum, tinted glass, limestone base)..."
            className="w-full h-24 bg-[#1a1a1a] border border-[#222] text-xs rounded-lg p-3 focus:outline-none focus:border-blue-500 text-gray-300 resize-none"
          />
        )}
      </section>

      <section>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">3. Architectural Style</label>
        <select
          value={params.style}
          onChange={(e) => setParams(p => ({ ...p, style: e.target.value as RenderStyle }))}
          className="w-full bg-[#1a1a1a] border border-[#222] text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 text-gray-300"
        >
          {STYLES.map(style => <option key={style} value={style}>{style}</option>)}
        </select>
      </section>

      <section>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">4. Style Reference (Optional)</label>
        <div className="relative group">
          <input
            type="file"
            accept="image/*"
            onChange={onInspirationUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={isLoading}
          />
          <div className="w-full aspect-[21/9] bg-[#1a1a1a] border border-[#222] rounded-lg flex flex-col items-center justify-center group-hover:border-blue-500 transition-colors overflow-hidden">
            {params.inspirationImage ? (
              <img src={params.inspirationImage} className="w-full h-full object-cover" alt="Inspiration" />
            ) : (
              <span className="text-[10px] text-gray-600 text-center px-2">Mood & Lighting Reference</span>
            )}
          </div>
        </div>
      </section>

      <div className="mt-auto pt-4 flex flex-col gap-3">
        <section>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Landscape Prompt</label>
          <textarea
            value={params.landscapePrompt}
            onChange={(e) => setParams(p => ({ ...p, landscapePrompt: e.target.value }))}
            placeholder="Describe surrounding environment, terrain, vegetation..."
            className="w-full h-16 bg-[#1a1a1a] border border-[#222] text-xs rounded-lg p-3 focus:outline-none focus:border-blue-500 text-gray-300 resize-none"
          />
        </section>

        <button
          onClick={onGenerate}
          disabled={isLoading || params.baseSketches.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-3 rounded-xl transition-all shadow-xl shadow-blue-900/10 flex flex-col items-center justify-center gap-1"
        >
          {isLoading ? (
            <><i className="fas fa-spinner fa-spin"></i><span className="text-xs text-center">Neural Rendering...</span></>
          ) : (
            <><i className="fas fa-magic"></i><span className="text-xs">Generate Render</span></>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
