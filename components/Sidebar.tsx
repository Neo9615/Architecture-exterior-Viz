
import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { STYLES } from '../constants';
import { RenderStyle, RenderParams, MaterialMapping, AspectRatio } from '../types';
import { translations, Language } from '../translations';

interface SidebarProps {
  user: User | null;
  params: RenderParams;
  setParams: React.Dispatch<React.SetStateAction<RenderParams>>;
  onGenerate: () => void;
  isLoading: boolean;
  onFurnitureInspirationUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSitePictureUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTextureUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSketchesUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMappingTextureUpload: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onSignOut: () => void;
  onOpenProfile?: () => void;
  onOpenTopUp?: () => void;
  // Modify Mode specific
  onBaseImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearMask: () => void;
  
  credits: number;
  lang: Language;
  setLang: (l: Language) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  user,
  params, 
  setParams, 
  onGenerate, 
  isLoading, 
  onFurnitureInspirationUpload,
  onSitePictureUpload,
  onTextureUpload,
  onSketchesUpload,
  onMappingTextureUpload,
  onSignOut,
  onOpenProfile,
  onOpenTopUp,
  onBaseImageUpload,
  onClearMask,
  credits,
  lang,
  setLang
}) => {
  const t = translations[lang];

  const removeSketch = (idx: number) => {
    setParams(p => ({
      ...p,
      baseSketches: p.baseSketches.filter((_, i) => i !== idx)
    }));
  };

  const updateMapping = (index: number, field: keyof MaterialMapping, value: string) => {
    const newMappings = [...params.materialMappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setParams(p => ({ ...p, materialMappings: newMappings }));
  };

  const addMapping = () => {
    setParams(p => ({
      ...p,
      materialMappings: [...p.materialMappings, { color: '', material: '' }]
    }));
  };

  const removeMapping = (index: number) => {
    const newMappings = params.materialMappings.filter((_, i) => i !== index);
    setParams(p => ({ ...p, materialMappings: newMappings }));
  };

  const canGenerate = credits > 0;

  const aspectRatios: { label: string; value: AspectRatio; icon: string }[] = [
    { label: 'Auto', value: 'Auto', icon: 'fa-expand' },
    { label: 'Square', value: '1:1', icon: 'fa-square' },
    { label: 'Landscape', value: '16:9', icon: 'fa-image' },
    { label: 'Portrait', value: '9:16', icon: 'fa-mobile-alt' },
  ];

  return (
    <div className={`
      flex-none w-full md:w-80 bg-white border-r border-gray-200 flex flex-col gap-6 shrink-0 z-30
      h-auto md:h-full md:overflow-y-auto order-last md:order-first p-6 md:p-6 pb-32 md:pb-6
    `}>
      <div className="hidden md:flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onOpenProfile}>
          <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="ozArchViz" className="h-10 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
               <button 
                 onClick={() => setLang('en')}
                 className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${lang === 'en' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
               >EN</button>
               <button 
                 onClick={() => setLang('fr')}
                 className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${lang === 'fr' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
               >FR</button>
               <button 
                 onClick={() => setLang('ma')}
                 className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${lang === 'ma' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
               >MA</button>
            </div>
            <button onClick={onSignOut} className="text-gray-400 hover:text-gray-900 transition-colors" title={t.signOut}>
              <i className="fas fa-sign-out-alt"></i>
            </button>
        </div>
      </div>

      <div className="mb-1 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between mb-3">
             <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t.balance}</span>
                <span className="text-xs font-bold text-gray-900">{lang === 'en' ? 'Credits' : lang === 'fr' ? 'Crédits' : 'النقط'}: {credits}</span>
             </div>
             <div className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center">
                 <i className="fas fa-wallet text-gray-400 text-xs"></i>
             </div>
        </div>
        <button 
          onClick={onOpenTopUp}
          className="w-full bg-gray-900 text-white text-[10px] font-bold py-2.5 rounded-lg hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2"
        >
            <i className="fas fa-plus-circle"></i> {t.buyTokens}
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
        <button 
          onClick={() => setParams(p => ({ ...p, toolMode: 'create' }))}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all ${params.toolMode === 'create' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <i className="fas fa-magic"></i> {t.createMode}
        </button>
        <button 
          onClick={() => setParams(p => ({ ...p, toolMode: 'modify' }))}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all ${params.toolMode === 'modify' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <i className="fas fa-vector-square"></i> {t.modifyMode}
        </button>
      </div>

      {params.toolMode === 'create' ? (
        <>
          <section className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
             <button 
               onClick={() => setParams(p => ({ ...p, mode: 'Exterior', materialMode: 'text-prompt' }))}
               className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all ${params.mode === 'Exterior' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}
             >
               <i className="fas fa-city"></i> {t.ext}
             </button>
             <button 
               onClick={() => setParams(p => ({ ...p, mode: 'Interior', materialMode: 'text-prompt' }))}
               className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all ${params.mode === 'Interior' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-900'}`}
             >
               <i className="fas fa-couch"></i> {t.int}
             </button>
          </section>

          <div className="flex flex-col gap-8 md:gap-6">
            <section>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">
                {t.step1.replace('{mode}', params.mode === 'Exterior' ? (lang === 'fr' ? 'du bâtiment' : lang === 'ma' ? 'ديال البني' : 'Building') : (lang === 'fr' ? 'de la pièce' : lang === 'ma' ? 'ديال البيت' : 'Room'))}
              </label>
              <div className="flex flex-col gap-3">
                <div className="relative group">
                  <input type="file" multiple accept="image/*" onChange={onSketchesUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isLoading} />
                  <div className={`w-full h-20 bg-gray-50 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${params.baseSketches.length > 0 ? 'border-gray-900 bg-gray-100' : 'border-gray-300'}`}>
                    <i className="fas fa-pencil-ruler text-gray-400 text-lg mb-1"></i>
                    <span className="text-[10px] text-gray-500 text-center px-4 leading-tight">
                      {params.baseSketches.length > 0 ? t.sketchesLoaded.replace('{count}', params.baseSketches.length.toString()) : t.uploadLayout.replace('{mode}', params.mode.toLowerCase())}
                    </span>
                  </div>
                </div>
                
                {params.baseSketches.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {params.baseSketches.map((src, idx) => (
                      <div key={idx} className="relative group/sketch w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-white">
                        <img src={src} className="w-full h-full object-contain" />
                        <button onClick={() => removeSketch(idx)} className="absolute inset-0 bg-black/40 opacity-0 group-hover/sketch:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <i className="fas fa-trash text-[10px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {params.mode === 'Interior' && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">{t.layoutType}</label>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => setParams(p => ({ ...p, furnitureLayoutMode: 'existing' }))}
                         className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${params.furnitureLayoutMode === 'existing' ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
                       >
                         {t.withFurniture}
                       </button>
                       <button 
                         onClick={() => setParams(p => ({ ...p, furnitureLayoutMode: 'empty' }))}
                         className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${params.furnitureLayoutMode === 'empty' ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
                       >
                         {t.withoutFurniture}
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Proportions / Aspect Ratio Selector */}
            <section>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">Proportions</label>
              <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                {aspectRatios.map((ratio) => (
                  <button
                    key={ratio.value}
                    onClick={() => setParams(p => ({ ...p, aspectRatio: ratio.value }))}
                    className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-all ${params.aspectRatio === ratio.value ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    title={ratio.label}
                  >
                    <i className={`fas ${ratio.icon} text-[10px]`}></i>
                    <span className="text-[7px] font-bold uppercase tracking-tighter">{ratio.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.step2}</label>
                
                {params.mode === 'Exterior' ? (
                  <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                    <button 
                      onClick={() => setParams(p => ({ ...p, materialMode: 'text-prompt' }))}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${params.materialMode === 'text-prompt' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                    >
                      {t.text}
                    </button>
                    <button 
                      onClick={() => setParams(p => ({ ...p, materialMode: 'color-map' }))}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${params.materialMode === 'color-map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                    >
                      {t.map}
                    </button>
                  </div>
                ) : (
                  <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                    <button 
                      onClick={() => setParams(p => ({ ...p, materialMode: 'text-prompt' }))}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${params.materialMode === 'text-prompt' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                    >
                      {t.text}
                    </button>
                    <button 
                      onClick={() => setParams(p => ({ ...p, materialMode: 'reference-image' }))}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${params.materialMode === 'reference-image' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                    >
                      {t.reference}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Content for Step 2 */}
              {params.mode === 'Exterior' && params.materialMode === 'color-map' ? (
                /* EXTERIOR MAP MODE */
                <div className="flex flex-col gap-2">
                   <p className="text-[9px] text-gray-400 mb-1">{t.mapColors}</p>
                   {params.materialMappings.map((mapping, idx) => (
                      <div key={idx} className="bg-gray-50 p-2 rounded-lg border border-gray-200 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                          <div className="flex gap-2">
                             <input 
                               type="text" 
                               value={mapping.color} 
                               onChange={(e) => updateMapping(idx, 'color', e.target.value)} 
                               placeholder="Color" 
                               className="w-14 bg-white border border-gray-200 rounded px-2 py-1 text-xs shrink-0"
                             />
                             <input 
                               type="text" 
                               value={mapping.material} 
                               onChange={(e) => updateMapping(idx, 'material', e.target.value)} 
                               placeholder="Material (e.g., Brick)" 
                               className="flex-1 min-w-0 bg-white border border-gray-200 rounded px-2 py-1 text-[10px]"
                             />
                             <button onClick={() => removeMapping(idx)} className="text-red-400 hover:text-red-600 px-1"><i className="fas fa-trash text-xs"></i></button>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="relative overflow-hidden w-full">
                                <input type="file" accept="image/*" onChange={(e) => onMappingTextureUpload(idx, e)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                <div className={`flex items-center justify-center gap-2 py-1 rounded border border-dashed ${mapping.textureImage ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-gray-100 text-gray-500'}`}>
                                    <i className={`fas ${mapping.textureImage ? 'fa-check' : 'fa-upload'} text-[10px]`}></i>
                                    <span className="text-[9px] font-bold uppercase">{mapping.textureImage ? t.referenceReady : t.addPhysical}</span>
                                </div>
                             </div>
                          </div>
                      </div>
                   ))}
                   <button onClick={addMapping} className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-400 text-xs font-bold hover:border-gray-500 hover:text-gray-600 transition-all flex items-center justify-center gap-1">
                      <i className="fas fa-plus"></i> {t.add}
                   </button>
                </div>
              ) : params.mode === 'Interior' && params.materialMode === 'reference-image' ? (
                 /* INTERIOR REFERENCE MODE */
                 <div className="flex flex-col gap-3">
                   <div className="relative group">
                     <div className="relative overflow-hidden w-full">
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setParams(p => ({ ...p, materialTextureImage: reader.result as string }));
                                    reader.readAsDataURL(file);
                                }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        />
                        <div className={`w-full h-24 bg-gray-50 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all relative overflow-hidden ${params.materialTextureImage ? 'border-gray-900 bg-gray-100' : 'border-gray-300'}`}>
                           {params.materialTextureImage ? (
                               <div className="w-full h-full relative">
                                  <img src={params.materialTextureImage} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <span className="text-[10px] text-white font-bold uppercase tracking-tight">{t.referenceLoaded}</span>
                                  </div>
                               </div>
                           ) : (
                               <div className="flex flex-col items-center">
                                  <i className="fas fa-image text-gray-400 text-lg mb-1"></i>
                                  <span className="text-[10px] text-gray-500 text-center px-4 leading-tight">{t.uploadReference}</span>
                               </div>
                           )}
                        </div>
                     </div>
                   </div>
                   {/* Optional additional text prompt even in reference mode */}
                   <textarea 
                        value={params.materialPrompt} 
                        onChange={(e) => setParams(p => ({ ...p, materialPrompt: e.target.value }))} 
                        className="w-full h-16 bg-gray-50 border border-gray-200 text-xs rounded-lg p-3 resize-none focus:border-gray-900 focus:outline-none" 
                        placeholder={t.notesPlaceholder}
                   />
                 </div>
              ) : (
                /* TEXT PROMPT MODE (DEFAULT FOR EXT & INT) */
                <textarea 
                    value={params.materialPrompt} 
                    onChange={(e) => setParams(p => ({ ...p, materialPrompt: e.target.value }))} 
                    className="w-full h-24 bg-gray-50 border border-gray-200 text-xs rounded-lg p-3 resize-none focus:border-gray-900 focus:outline-none" 
                />
              )}
            </section>

            <section>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">{t.step3}</label>
              <select value={params.style} onChange={(e) => setParams(p => ({ ...p, style: e.target.value as RenderStyle }))} className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-3 py-2.5 focus:border-gray-900 focus:outline-none">
                {STYLES.map(style => <option key={style} value={style}>{style}</option>)}
              </select>
            </section>

            <section>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                {params.mode === 'Exterior' ? t.step4Ext : t.step4Int}
              </label>
              <textarea value={params.mode === 'Exterior' ? params.landscapePrompt : params.interiorAmbiance} onChange={(e) => setParams(p => ({ ...p, [params.mode === 'Exterior' ? 'landscapePrompt' : 'interiorAmbiance']: e.target.value }))} className="w-full h-32 bg-gray-50 border border-gray-200 text-xs rounded-lg p-3 resize-none focus:border-gray-900 focus:outline-none" />
            </section>
            
            {params.mode === 'Exterior' && (
              <section>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">{t.sitePicture}</label>
                <div className="relative group">
                  <input type="file" accept="image/*" onChange={onSitePictureUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className={`w-full h-24 bg-gray-50 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all relative overflow-hidden ${params.sitePicture ? 'border-gray-900' : 'border-gray-300'}`}>
                    {params.sitePicture ? (
                      <div className="w-full h-full relative">
                        <img src={params.sitePicture} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-white font-bold uppercase tracking-tight">{t.siteLoaded}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <i className="fas fa-camera text-gray-400 text-lg mb-1"></i>
                        <span className="text-[10px] text-gray-500 text-center px-4 leading-tight">{t.uploadSite}</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {params.mode === 'Interior' && (
              <section>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">{t.furnitureInspiration}</label>
                
                <div className="flex flex-col gap-3">
                  <div className="relative group">
                    <input type="file" accept="image/*" onChange={onFurnitureInspirationUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`w-full h-24 bg-gray-50 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all relative overflow-hidden ${params.furnitureInspirationImage ? 'border-gray-900' : 'border-gray-300'}`}>
                      {params.furnitureInspirationImage ? (
                        <div className="w-full h-full relative">
                          <img src={params.furnitureInspirationImage} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-white font-bold uppercase tracking-tight">{t.furnitureRef}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <i className="fas fa-couch text-gray-400 text-lg mb-1"></i>
                          <span className="text-[10px] text-gray-500 text-center px-4 leading-tight">{t.matchFurniture}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {params.furnitureLayoutMode === 'empty' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">{t.furnitureLayoutPrompt}</label>
                       <textarea 
                         value={params.furniturePrompt} 
                         onChange={(e) => setParams(p => ({ ...p, furniturePrompt: e.target.value }))} 
                         placeholder={t.furnitureLayoutPlaceholder}
                         className="w-full h-24 bg-gray-50 border border-gray-200 text-xs rounded-lg p-3 resize-none focus:border-gray-900 focus:outline-none" 
                       />
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </>
      ) : (
        /* MODIFY MODE CONTROLS */
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
           <section>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">{t.uploadBaseImage}</label>
              <div className="relative group">
                <input type="file" accept="image/*" onChange={onBaseImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className={`w-full h-32 bg-gray-50 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all relative overflow-hidden ${params.modifyBaseImage ? 'border-gray-900 bg-gray-100' : 'border-gray-300'}`}>
                  {params.modifyBaseImage ? (
                    <div className="flex flex-col items-center gap-2">
                       <img src={params.modifyBaseImage} className="h-16 w-auto object-contain rounded border border-gray-200" />
                       <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{t.baseImageLoaded}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <i className="fas fa-image text-gray-400 text-xl mb-2"></i>
                      <span className="text-[10px] text-gray-500 text-center px-4 leading-tight">{t.uploadBaseImage}</span>
                    </div>
                  )}
                </div>
              </div>
           </section>

           <section>
              <div className="flex justify-between items-center mb-2">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Selection</label>
                 <button onClick={onClearMask} className="text-[9px] text-red-500 hover:text-red-700 font-bold uppercase"><i className="fas fa-trash mr-1"></i> {t.clearMask}</button>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
                 <p className="text-[10px] text-gray-500">
                   Drag on the image to select the area you want to modify (Optional).
                 </p>
              </div>
           </section>

           <section>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">{t.modifyPromptLabel}</label>
              <textarea 
                value={params.modifyPrompt} 
                onChange={(e) => setParams(p => ({ ...p, modifyPrompt: e.target.value }))} 
                placeholder={t.modifyPromptPlaceholder}
                className="w-full h-32 bg-gray-50 border border-gray-200 text-xs rounded-lg p-3 resize-none focus:border-gray-900 focus:outline-none" 
              />
           </section>
        </div>
      )}

      <div className="mt-8 md:mt-auto pt-4 flex flex-col gap-3">
        <button
          onClick={canGenerate ? onGenerate : onOpenTopUp}
          disabled={isLoading || (params.toolMode === 'create' && params.baseSketches.length === 0) || (params.toolMode === 'modify' && (!params.modifyBaseImage || !params.modifyPrompt))}
          className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg flex flex-col items-center justify-center gap-1 
            ${!canGenerate ? 'bg-red-600 text-white' : 'bg-gray-900 text-white disabled:bg-gray-200'}
          `}
        >
          {isLoading ? (
            <><i className="fas fa-spinner fa-spin"></i><span className="text-[10px] uppercase tracking-wider">{params.toolMode === 'modify' ? t.modifying : t.rendering}</span></>
          ) : !canGenerate ? (
            <><i className="fas fa-bolt"></i><span className="text-xs">{t.recharge}</span></>
          ) : (
            <><i className="fas fa-magic"></i><span className="text-xs">{params.toolMode === 'modify' ? t.applyModification : t.finalize.replace('{mode}', lang === 'ma' ? (params.mode === 'Exterior' ? 'لخارجي' : 'لداخلي') : params.mode)}</span></>
          )}
        </button>
        {!canGenerate && !isLoading && <div className="flex items-center justify-center gap-2 text-[10px] text-red-500 font-bold px-4 animate-pulse"><i className="fas fa-exclamation-circle"></i> <span>{t.insufficient}</span></div>}
        {canGenerate && <p className="text-[9px] text-gray-400 text-center px-4 leading-relaxed">{t.creditsNote}</p>}
      </div>
    </div>
  );
};

export default Sidebar;