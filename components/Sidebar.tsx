
import React from 'react';
import { STYLES } from '../constants';
import { RenderStyle, RenderParams, MaterialMapping } from '../types';

interface SidebarProps {
  params: RenderParams;
  setParams: React.Dispatch<React.SetStateAction<RenderParams>>;
  onGenerate: () => void;
  isLoading: boolean;
  onInspirationUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTextureUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSketchesUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMappingTextureUpload: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  hasKey: boolean;
  onOpenKey: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  params, 
  setParams, 
  onGenerate, 
  isLoading, 
  onInspirationUpload, 
  onTextureUpload,
  onSketchesUpload,
  onMappingTextureUpload,
  hasKey,
  onOpenKey,
  isOpen,
  onClose
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

  const clearMappingTexture = (index: number) => {
    const newMappings = [...params.materialMappings];
    newMappings[index].textureImage = undefined;
    setParams(p => ({ ...p, materialMappings: newMappings }));
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <div className={`
        fixed inset-y-0 left-0 w-80 h-full bg-[#111] border-r border-[#222] p-6 flex flex-col gap-6 overflow-y-auto shrink-0 z-50 transition-transform duration-300 transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <i className="fas fa-cubes text-white"></i>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Archivision</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white p-1">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <section className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl">
           <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Billing & API Key</label>
              <div className={`w-2 h-2 rounded-full ${hasKey ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></div>
           </div>
           <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
             Gemini 3 Pro requires a <span className="text-white">paid API key</span> with billing enabled.
           </p>
           <div className="flex flex-col gap-2">
              <button 
                onClick={onOpenKey}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <i className="fas fa-key"></i>
                {hasKey ? 'Change API Project' : 'Setup API Key'}
              </button>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-center text-[9px] text-gray-500 hover:text-blue-400 underline underline-offset-2"
              >
                Billing Documentation
              </a>
           </div>
        </section>

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
              <span className="text-[10px] text-gray-500 text-center px-4">
                {params.baseSketches.length > 0 ? `${params.baseSketches.length} Sketches Uploaded` : "Upload perspective sketches"}
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
                <span className="text-[10px] text-gray-400">Map colors to materials</span>
                <button onClick={addMapping} className="text-blue-500 hover:text-blue-400 text-[10px]">
                  <i className="fas fa-plus mr-1"></i> ADD
                </button>
              </div>
              {params.materialMappings.map((mapping, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-2 bg-[#161616] border border-[#222] rounded-lg">
                  <div className="flex gap-2 items-center">
                    <input 
                      placeholder="Color"
                      value={mapping.color}
                      onChange={(e) => updateMapping(idx, 'color', e.target.value)}
                      className="w-1/3 bg-[#1a1a1a] border border-[#222] text-[10px] rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-gray-300"
                    />
                    <input 
                      placeholder="Material"
                      value={mapping.material}
                      onChange={(e) => updateMapping(idx, 'material', e.target.value)}
                      className="flex-1 bg-[#1a1a1a] border border-[#222] text-[10px] rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-gray-300"
                    />
                    <button onClick={() => removeMapping(idx)} className="text-gray-600 hover:text-red-500 transition-colors">
                      <i className="fas fa-times text-[10px]"></i>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="relative group/tex flex-1">
                       <input 
                         type="file" 
                         accept="image/*"
                         onChange={(e) => onMappingTextureUpload(idx, e)}
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                       />
                       <div className={`h-8 rounded border border-dashed flex items-center justify-center gap-2 transition-colors ${mapping.textureImage ? 'border-blue-500/40 bg-blue-500/5' : 'border-[#333] hover:border-[#444]'}`}>
                         {mapping.textureImage ? (
                           <>
                             <img src={mapping.textureImage} className="w-5 h-5 object-cover rounded" />
                             <span className="text-[9px] text-blue-400">Ref Loaded</span>
                           </>
                         ) : (
                           <>
                             <i className="fas fa-plus text-[8px] text-gray-600"></i>
                             <span className="text-[9px] text-gray-500">Add texture ref</span>
                           </>
                         )}
                       </div>
                    </div>
                    {mapping.textureImage && (
                       <button onClick={() => clearMappingTexture(idx)} className="text-gray-600 hover:text-white px-1">
                         <i className="fas fa-trash text-[9px]"></i>
                       </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="relative group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onTextureUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isLoading}
                />
                <div className={`w-full h-12 bg-[#1a1a1a] border border-[#222] rounded-lg flex items-center gap-3 px-3 group-hover:border-blue-500 transition-colors overflow-hidden ${params.materialTextureImage ? 'border-blue-500/50' : ''}`}>
                  {params.materialTextureImage ? (
                    <img src={params.materialTextureImage} className="w-6 h-6 rounded object-cover border border-[#333]" />
                  ) : (
                    <i className="fas fa-layer-group text-gray-600 text-xs"></i>
                  )}
                  <span className="text-[10px] text-gray-500 truncate">
                    {params.materialTextureImage ? "Global Texture Loaded" : "Upload Global Texture Ref (Opt)"}
                  </span>
                  {params.materialTextureImage && (
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setParams(p => ({ ...p, materialTextureImage: undefined })); }}
                      className="ml-auto text-gray-600 hover:text-white"
                    >
                      <i className="fas fa-times text-[10px]"></i>
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={params.materialPrompt}
                onChange={(e) => setParams(p => ({ ...p, materialPrompt: e.target.value }))}
                placeholder="Describe building materials..."
                className="w-full h-24 bg-[#1a1a1a] border border-[#222] text-xs rounded-lg p-3 focus:outline-none focus:border-blue-500 text-gray-300 resize-none"
              />
            </div>
          )}
        </section>

        <section>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">3. Style</label>
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
              placeholder="Describe terrain, vegetation..."
              className="w-full h-16 bg-[#1a1a1a] border border-[#222] text-xs rounded-lg p-3 focus:outline-none focus:border-blue-500 text-gray-300 resize-none"
            />
          </section>

          <button
            onClick={() => {
              onGenerate();
              onClose();
            }}
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
    </>
  );
};

export default Sidebar;
