
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { RenderParams, Annotation, RenderResult, Project } from './types';
import { StorageService } from './services/storageService';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from './firebase';
import Auth from './components/Auth';
import { Verification } from './components/Verification';
import { Language, translations } from './translations';

// Lazy load heavy components
const Sidebar = lazy(() => import('./components/Sidebar'));
const Viewport = lazy(() => import('./components/Viewport'));
const ProfileModal = lazy(() => import('./components/ProfileModal'));
const TopUpModal = lazy(() => import('./components/TopUpModal'));
const ShowcaseLanding = lazy(() => import('./components/ShowcaseLanding'));

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  
  // Initialize based on URL safely (Check both Path and Hash for robustness)
  const [showLanding, setShowLanding] = useState(() => {
    try {
      return window.location.pathname === '/landing' || window.location.hash === '#/landing';
    } catch {
      return false;
    }
  });
  
  const [lang, setLang] = useState<Language>('en');

  const t = translations[lang];
  const isRTL = lang === 'ma';
  const prevLangRef = useRef<Language>(lang);

  const [credits, setCredits] = useState<number>(0);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [params, setParams] = useState<RenderParams>({
    mode: 'Exterior',
    toolMode: 'create',
    style: 'Modernist',
    description: '',
    landscapePrompt: translations['en'].landscapeDefault,
    interiorAmbiance: translations['en'].interiorDefault,
    materialPrompt: translations['en'].materialDefault,
    materialMode: 'text-prompt',
    angle: 'Eye Level',
    aspectRatio: 'Auto',
    baseSketches: [],
    materialMappings: [
      { color: 'Red', material: 'Red Clay Brick' },
      { color: 'Blue', material: 'Reflective Glass' },
      { color: 'Yellow', material: 'Polished Brass' }
    ],
    furnitureLayoutMode: 'existing',
    furniturePrompt: '',
    modifyPrompt: '',
    modifyMaskImage: '', // Initialize mask
    brushSize: 0,
    projectId: undefined
  } as any);

  const [results, setResults] = useState<RenderResult[]>([]);
  const [base64Cache, setBase64Cache] = useState<Record<string, string>>({});
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [shouldClearMask, setShouldClearMask] = useState(0);
  
  // View state to handle Modify mode uploads vs results
  const [viewingBaseImage, setViewingBaseImage] = useState(false);
  // View state to handle immediate preview of uploaded sketches in Create Mode
  const [previewSketch, setPreviewSketch] = useState<string | null>(null);

  // Storage service is lightweight enough (class definition) to check cached history on mount
  const storageService = new StorageService();

  // Handle browser back/forward buttons and hash changes
  useEffect(() => {
    const handleNavigation = () => {
      try {
        setShowLanding(window.location.pathname === '/landing' || window.location.hash === '#/landing');
      } catch (e) {
        // Ignore location errors
      }
    };
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation); // Listen for hash changes too
    return () => {
        window.removeEventListener('popstate', handleNavigation);
        window.removeEventListener('hashchange', handleNavigation);
    };
  }, []);

  const handleNavigateToLanding = () => {
    try {
      window.history.pushState(null, '', '/landing');
    } catch (e) {
      console.warn("Navigation history update failed (sandboxed environment):", e);
    }
    setShowLanding(true);
  };

  const handleNavigateToApp = () => {
    try {
      window.history.pushState(null, '', '/');
    } catch (e) {
      console.warn("Navigation history update failed (sandboxed environment):", e);
    }
    setShowLanding(false);
  };

  // Reset active index when tool mode changes
  useEffect(() => {
    setActiveResultIndex(0);
    setAnnotations([]);
    // If switching to modify and we have a base image, show it by default if no results are explicitly selected
    if (params.toolMode === 'modify' && params.modifyBaseImage) {
        setViewingBaseImage(true);
    } else {
        setViewingBaseImage(false);
    }
  }, [params.toolMode]);

  // Sync default prompts on language change if they haven't been edited
  useEffect(() => {
    const prevT = translations[prevLangRef.current];
    const currentT = translations[lang];

    setParams(p => {
      const newParams = { ...p };
      
      // Update landscape prompt if it matches previous default
      if (p.landscapePrompt === prevT.landscapeDefault) {
        newParams.landscapePrompt = currentT.landscapeDefault;
      }
      // Update interior ambiance if it matches previous default
      if (p.interiorAmbiance === prevT.interiorDefault) {
        newParams.interiorAmbiance = currentT.interiorDefault;
      }
      // Update material prompt if it matches previous default
      if (p.materialPrompt === prevT.materialDefault) {
        newParams.materialPrompt = currentT.materialDefault;
      }

      return newParams;
    });

    prevLangRef.current = lang;
  }, [lang]);

  useEffect(() => {
    let unsubscribeHistory: () => void;
    let unsubscribeProjects: () => void;
    let unsubscribeUser: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
             await setDoc(userRef, {
               uid: currentUser.uid,
               email: currentUser.email,
               displayName: currentUser.displayName || '',
               photoURL: currentUser.photoURL || '',
               photoFileName: '',
               createdAt: new Date().toISOString(),
               credits: 10,
             });
          }
          
          unsubscribeHistory = storageService.subscribeToHistory(currentUser.uid, (syncedResults) => {
            setResults(syncedResults);
            // Don't reset index here to avoid jumping around if user is browsing history
          });

          unsubscribeProjects = storageService.subscribeToProjects(currentUser.uid, (syncedProjects) => {
             setProjects(syncedProjects);
          });

          unsubscribeUser = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
            const data = docSnap.data();
            if (data) setCredits(data.credits || 0);
          }, (err) => {
            console.warn("User profile listener failed (permissions):", err);
          });

        } catch (e) { 
          console.error("Firestore initialization failed", e); 
        }
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeHistory) unsubscribeHistory();
      if (unsubscribeProjects) unsubscribeProjects();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  // Update params when active project changes
  useEffect(() => {
     setParams(p => ({ ...p, projectId: activeProjectId || undefined }));
     setActiveResultIndex(0); // Reset selection when changing projects
  }, [activeProjectId]);

  const handleCreateProject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !newProjectName.trim()) return;
      try {
          const newProject = await storageService.createProject(user.uid, newProjectName);
          setActiveProjectId(newProject.id);
          setNewProjectName('');
          setIsCreatingProject(false);
      } catch (e) {
          console.error("Failed to create project", e);
      }
  };

  const handleMoveRender = async (projectId: string | null) => {
      const displayedResults = results.filter(r => {
        const modeMatch = (r.toolMode || 'create') === params.toolMode;
        const projectMatch = activeProjectId ? r.projectId === activeProjectId : !r.projectId;
        return modeMatch && projectMatch;
      });
      const activeResult = displayedResults[activeResultIndex];

      if (!user || !activeResult?.firestoreId) return;

      try {
          await storageService.moveFileToProject(user.uid, activeResult.firestoreId, projectId);
          // If moving to a different project than the active one, it will disappear from view.
          // Adjust index to prevent crash
          if (activeResultIndex >= displayedResults.length - 1) {
              setActiveResultIndex(Math.max(0, displayedResults.length - 2));
          }
      } catch (e) {
          console.error("Failed to move file", e);
      }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setResults([]);
      setProjects([]);
      setActiveProjectId(null);
      setBase64Cache({});
    } catch (error) { console.error("Error signing out", error); }
  };

  const handleGenerate = async () => {
    if (!user) return;
    
    // Modify Mode Flow
    if (params.toolMode === 'modify') {
        if (!params.modifyBaseImage || !params.modifyPrompt) return;
        if (credits < 1) { setShowTopUp(true); return; }
        
        setIsLoading(true);
        // Dynamic Import of GeminiService
        const { GeminiService } = await import('./services/geminiService');
        const gemini = new GeminiService();
        try {
            let resultBase64 = "";
            
            // Check if mask exists and is valid
            if (params.modifyMaskImage && params.modifyMaskImage.length > 100) {
                 resultBase64 = await gemini.modifyWithMask(params.modifyBaseImage, params.modifyMaskImage, params.modifyPrompt);
            } else {
                 // Fallback to global edit if no mask
                 resultBase64 = await gemini.editImage(params.modifyBaseImage, params.modifyPrompt);
            }

            const savedResult = await storageService.saveRender(user.uid, resultBase64, params.modifyBaseImage, { ...params, description: `Modified: ${params.modifyPrompt}` });
            if (savedResult.firestoreId) {
                setBase64Cache(prev => ({ ...prev, [savedResult.firestoreId!]: resultBase64 }));
            }
            await updateDoc(doc(db, 'users', user.uid), { credits: increment(-1) });
            
            setActiveResultIndex(0);
            setAnnotations([]);
            // Clear mask after successful generation
            setShouldClearMask(prev => prev + 1);
            setParams(p => ({ ...p, modifyMaskImage: '' }));
            // Switch view to the result
            setViewingBaseImage(false);

        } catch (error: any) { alert("Modification failed. See console for details."); console.error(error); } 
        finally { setIsLoading(false); }
        return;
    }

    // Create Mode Flow
    const cost = params.baseSketches.length;
    if (credits < cost) {
        setShowTopUp(true);
        return;
    }

    setIsLoading(true);
    // Dynamic Import of GeminiService
    const { GeminiService } = await import('./services/geminiService');
    const gemini = new GeminiService();
    try {
      for (const sketch of params.baseSketches) {
        const resultBase64 = await gemini.generateRender(params, sketch);
        const savedResult = await storageService.saveRender(user.uid, resultBase64, sketch, params);
        if (savedResult.firestoreId) {
            setBase64Cache(prev => ({ ...prev, [savedResult.firestoreId!]: resultBase64 }));
        }
        await updateDoc(doc(db, 'users', user.uid), { credits: increment(-1) });
      }
      setAnnotations([]);
      setActiveResultIndex(0);
      setPreviewSketch(null); // Clear preview once generated
    } catch (error: any) { alert("Generation failed."); } finally { setIsLoading(false); }
  };

  const handleTransferToModify = () => {
     if (!currentImageUrl) return;
     // Set the current image as the base for modification
     setParams(prev => ({
         ...prev,
         toolMode: 'modify',
         modifyBaseImage: currentImageUrl,
         modifyMaskImage: '', // Reset mask
         modifyPrompt: '' // Reset prompt
     }));
     // Force view to show the "uploaded" base image so user can mask it
     setViewingBaseImage(true);
     setShouldClearMask(prev => prev + 1);
  };

  const handleUpscale = async () => {
    if (!user) return;
    const displayedResults = results.filter(r => {
        const modeMatch = (r.toolMode || 'create') === params.toolMode;
        const projectMatch = activeProjectId ? r.projectId === activeProjectId : !r.projectId;
        return modeMatch && projectMatch;
    });
    const activeItem = displayedResults[activeResultIndex];
    if (!activeItem) return;

    if (credits < 2) { setShowTopUp(true); return; }

    setIsLoading(true);
    try {
      // Dynamic Import
      const { GeminiService } = await import('./services/geminiService');
      const gemini = new GeminiService();
      const sourceImage = (activeItem.firestoreId && base64Cache[activeItem.firestoreId]) || activeItem.renderUrl;
      const resultBase64 = await gemini.upscaleImage(sourceImage);
      const savedResult = await storageService.saveRender(user.uid, resultBase64, activeItem.sketchUrl, { ...params, description: `4K Upscale` });
      if (savedResult.firestoreId) {
        setBase64Cache(prev => ({ ...prev, [savedResult.firestoreId!]: resultBase64 }));
      }
      await updateDoc(doc(db, 'users', user.uid), { credits: increment(-2) });
      setActiveResultIndex(0);
    } catch (error: any) { alert("Upscale failed."); } finally { setIsLoading(false); }
  };

  const handleDownload = async () => {
    const displayedResults = results.filter(r => {
        const modeMatch = (r.toolMode || 'create') === params.toolMode;
        const projectMatch = activeProjectId ? r.projectId === activeProjectId : !r.projectId;
        return modeMatch && projectMatch;
    });
    const activeResult = displayedResults[activeResultIndex];

    if (!activeResult) return;
    
    try {
      let url = activeResult.renderUrl;
      if (user && activeResult.firestoreId) {
         url = await storageService.downloadFile(user.uid, activeResult.firestoreId);
      }

      // Direct Download Logic: Fetch as Blob -> Create Object URL -> Click Link
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ozArchViz_${activeResult.mode}_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

    } catch (error) { 
      console.warn("Direct download failed, falling back to new tab.", error);
      // Fallback: Open in new tab
      let url = activeResult.renderUrl;
      window.open(url, '_blank');
    }
  };

  const handleDelete = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !window.confirm(t.deleteConfirm)) return;
    
    const displayedResults = results.filter(r => {
        const modeMatch = (r.toolMode || 'create') === params.toolMode;
        const projectMatch = activeProjectId ? r.projectId === activeProjectId : !r.projectId;
        return modeMatch && projectMatch;
    });
    const item = displayedResults[index];

    if (!item.firestoreId) return;
    try {
      await storageService.deleteFile(user.uid, item.firestoreId, item.renderUrl, item.sketchUrl);
      if (activeResultIndex >= index && activeResultIndex > 0) {
         setActiveResultIndex(prev => prev - 1);
      }
    } catch (error) { console.error("Delete failed", error); }
  };

  if (authLoading) return <div className="h-screen bg-gray-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div></div>;

  // ROUTING LOGIC
  
  // 1. Show Landing Page if toggle is active (Priority over Auth)
  if (showLanding) {
      return (
        <Suspense fallback={<div className="h-screen bg-gray-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div></div>}>
            <ShowcaseLanding onBack={handleNavigateToApp} lang={lang} setLang={setLang} />
        </Suspense>
      );
  }

  // 2. Show Auth if not logged in
  if (!user) return <Auth lang={lang} setLang={setLang} onShowShowcase={handleNavigateToLanding} />;
  
  // 3. Show Verification if email not verified
  if (!user.emailVerified) return <Verification user={user} lang={lang} />;

  // 4. Show Main App if logged in
  // Filtering Logic: Only show results relevant to the current toolMode AND activeProjectId
  const displayedResults = results.filter(r => {
      const modeMatch = (r.toolMode || 'create') === params.toolMode;
      // If activeProjectId is null, show only uncategorized results (projectId is null/undefined)
      const projectMatch = activeProjectId ? r.projectId === activeProjectId : !r.projectId;
      return modeMatch && projectMatch;
  });
  
  const activeResult = displayedResults[activeResultIndex];
  
  // Determine what image to show in Viewport
  let currentImageUrl = null;
  if (params.toolMode === 'modify') {
      if (viewingBaseImage && params.modifyBaseImage) {
          currentImageUrl = params.modifyBaseImage;
      } else {
          currentImageUrl = activeResult?.renderUrl || params.modifyBaseImage || null;
      }
  } else {
      // In Create Mode
      if (displayedResults.length === 0 && previewSketch) {
          // If no results but we have a preview sketch, show it
          currentImageUrl = previewSketch;
      } else {
          currentImageUrl = activeResult?.renderUrl || previewSketch || null;
      }
  }

  return (
    <div className={`flex flex-col md:flex-row min-h-screen md:h-screen bg-gray-50 text-gray-900 md:overflow-hidden ${isRTL ? 'font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <Suspense fallback={null}>
        {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSignOut={handleSignOut} lang={lang} />}
        {showTopUp && <TopUpModal user={user} onClose={() => setShowTopUp(false)} lang={lang} />}
      </Suspense>
      
      <Suspense fallback={<div className="w-full md:w-80 bg-gray-50 border-r border-gray-200 flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div></div>}>
        <Sidebar 
            user={user} params={params} setParams={setParams} onGenerate={handleGenerate} 
            isLoading={isLoading} 
            onFurnitureInspirationUpload={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                const reader = new FileReader();
                reader.onloadend = () => setParams(p => ({ ...p, furnitureInspirationImage: reader.result as string }));
                reader.readAsDataURL(file);
                }
            }} 
            onSitePictureUpload={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                const reader = new FileReader();
                reader.onloadend = () => setParams(p => ({ ...p, sitePicture: reader.result as string }));
                reader.readAsDataURL(file);
                }
            }} 
            onTextureUpload={() => {}}
            onSketchesUpload={(e) => {
                const fileList = e.target.files;
                if (!fileList) return;
                const files = Array.from(fileList).slice(0, 5) as File[];
                
                // Immediately preview the first uploaded sketch
                if (files.length > 0) {
                    const previewReader = new FileReader();
                    previewReader.onloadend = () => {
                         setPreviewSketch(previewReader.result as string);
                         setActiveResultIndex(-1); // Deselect result to force preview
                    };
                    previewReader.readAsDataURL(files[0]);
                }

                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onloadend = () => setParams(p => ({ ...p, baseSketches: [...p.baseSketches, reader.result as string] }));
                    reader.readAsDataURL(file);
                });
            }}
            onMappingTextureUpload={(index, e) => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const newMappings = [...params.materialMappings];
                    newMappings[index] = { ...newMappings[index], textureImage: reader.result as string };
                    setParams(p => ({ ...p, materialMappings: newMappings }));
                };
                reader.readAsDataURL(file);
            }
            }}
            onBaseImageUpload={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setParams(p => ({ ...p, modifyBaseImage: reader.result as string }));
                    // Reset mask when new base image is loaded
                    setShouldClearMask(prev => prev + 1);
                    // Switch to viewing the uploaded base image
                    setViewingBaseImage(true);
                };
                reader.readAsDataURL(file);
                }
            }}
            onClearMask={() => setShouldClearMask(prev => prev + 1)}
            onSignOut={handleSignOut} onOpenProfile={() => setShowProfile(true)} 
            onOpenTopUp={() => setShowTopUp(true)} credits={credits} lang={lang} setLang={setLang}
        />
      </Suspense>
      
      <main className="flex-1 flex flex-col min-w-0 order-first md:order-none relative md:overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <img src="https://storage.googleapis.com/oavbucket/Logo_ozarch.png" alt="Logo" className="h-8 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setShowTopUp(true)}
               className="flex items-center gap-2 bg-white border border-gray-200 pl-3 pr-2 py-1.5 rounded-full shadow-sm active:bg-gray-50 transition-all"
             >
                <span className="text-xs font-bold text-gray-900">{credits}</span>
                <div className="w-5 h-5 bg-gray-900 text-white rounded-full flex items-center justify-center">
                  <i className="fas fa-plus text-[10px]"></i>
                </div>
             </button>

             <button onClick={() => setShowProfile(true)} className="w-8 h-8 rounded-full overflow-hidden border border-gray-200">
               {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-100 flex items-center justify-center"><i className="fas fa-user text-xs text-gray-400"></i></div>}
            </button>
          </div>
        </div>

        {/* Desktop Profile Badge */}
        <div className={`hidden md:flex absolute top-6 z-50 gap-3 ${isRTL ? 'left-6' : 'right-6'}`}>
             <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 bg-white/80 backdrop-blur-md border border-gray-200 pl-1.5 pr-4 py-1.5 rounded-full shadow-lg hover:bg-white transition-all cursor-pointer group">
                <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-[10px] font-bold text-white uppercase overflow-hidden">
                  {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : (user.displayName ? user.displayName[0] : (user.email ? user.email[0] : 'U'))}
                </div>
                <div className={`flex flex-col ${isRTL ? 'items-end' : 'items-start'}`}>
                   <span className="text-xs text-gray-700 font-medium max-w-[120px] truncate leading-none">{user.displayName || t.userDefault}</span>
                   <span className="text-[9px] text-gray-400 mt-0.5 group-hover:text-gray-900">{t.viewProfile}</span>
                </div>
             </button>
        </div>

        <div className="h-[45vh] md:h-full flex-none md:flex-1 min-h-[300px]">
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-gray-100"><div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div></div>}>
            <Viewport 
                imageUrl={currentImageUrl} 
                isLoading={isLoading} 
                annotations={annotations}
                onAddAnnotation={(ann) => setAnnotations(prev => [...prev, ann])}
                onRemoveAnnotation={(i) => setAnnotations(prev => prev.filter((_, idx) => idx !== i))}
                isAnnotating={isAnnotating} 
                lang={lang}
                toolMode={params.toolMode}
                onMaskChange={(mask) => setParams(p => ({ ...p, modifyMaskImage: mask }))}
                shouldClearMask={shouldClearMask}
            />
          </Suspense>
        </div>
        
        {/* Show History & Bottom Toolbar for both modes now, but filtered */}
        {displayedResults.length > 0 && (
              <div className="flex flex-col bg-white border-t border-gray-200 shrink-0">
                 {/* Project Management & Summary Panel (Replaces Project Notes) */}
                 <div className="hidden md:flex p-4 border-b border-gray-200 gap-6">
                    {/* Left: Project Selector (Replaces Project Notes) */}
                    <div className="flex-1 flex flex-col gap-2 border-r border-gray-100 pr-4">
                       <label className={`text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {t.currentWorkspace}
                       </label>
                       
                       {isCreatingProject ? (
                          <form onSubmit={handleCreateProject} className="flex gap-2">
                             <input 
                               autoFocus
                               type="text" 
                               placeholder={t.projectName} 
                               value={newProjectName} 
                               onChange={e => setNewProjectName(e.target.value)} 
                               className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-gray-900" 
                             />
                             <button type="submit" className="bg-gray-900 text-white px-3 rounded text-[10px] font-bold">{t.create}</button>
                             <button type="button" onClick={() => setIsCreatingProject(false)} className="text-gray-400 px-2"><i className="fas fa-times"></i></button>
                          </form>
                       ) : (
                          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-1">
                             <select 
                               value={activeProjectId || ''} 
                               onChange={(e) => setActiveProjectId(e.target.value || null)}
                               className="bg-transparent text-xs font-bold text-gray-900 focus:outline-none w-full cursor-pointer py-1 px-2"
                             >
                                <option value="">{t.defaultProject}</option>
                                {projects.map(p => (
                                   <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                             </select>
                             <button 
                               onClick={() => setIsCreatingProject(true)} 
                               className="ml-2 w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-500 hover:text-gray-900 transition-colors shadow-sm" 
                               title={t.newProject}
                             >
                                <i className="fas fa-plus text-[10px]"></i>
                             </button>
                          </div>
                       )}
                    </div>

                    {/* Right: AI Summary + Move Tool */}
                    <div className="flex-1 flex flex-col gap-2">
                       <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                             <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">{t.aiSummary}</span>
                             <span className="text-[10px] text-gray-500">{new Date(activeResult?.timestamp || 0).toLocaleString()}</span>
                          </div>
                          
                          {/* Move to Project Dropdown for Selected Render */}
                          {activeResult && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-gray-400 font-bold uppercase">{t.assignTo}</span>
                                <select 
                                    value={activeResult.projectId || ''} 
                                    onChange={(e) => handleMoveRender(e.target.value || null)}
                                    className="bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-[10px] text-gray-700 focus:outline-none focus:border-gray-900 cursor-pointer w-32"
                                >
                                    <option value="">{t.defaultProject}</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                              </div>
                          )}
                       </div>
                       <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                         {activeResult?.aiSummary || "No summary available."}
                       </p>
                    </div>
                 </div>

                 <div className="h-16 md:h-24 flex items-center px-4 gap-3 md:gap-4 overflow-x-auto no-scrollbar" dir="ltr">
                  {displayedResults.map((res, i) => (
                    <div 
                      key={res.firestoreId || res.id}
                      onClick={() => { setActiveResultIndex(i); setAnnotations([]); setViewingBaseImage(false); }}
                      className={`relative group h-12 md:h-16 aspect-video rounded-lg cursor-pointer overflow-hidden shrink-0 transition-all border-2 ${i === activeResultIndex && !viewingBaseImage ? 'border-gray-900 scale-105' : 'border-transparent opacity-70 hover:opacity-100'}`}
                    >
                      <img src={res.renderUrl} className="w-full h-full object-cover" />
                      <div className="absolute top-0 left-0 bg-black/60 text-[8px] px-1 font-bold text-white uppercase">v{displayedResults.length - i}</div>
                      <button onClick={(e) => handleDelete(i, e)} className="absolute top-0 right-0 p-1 bg-red-900/80 text-white opacity-0 group-hover/sketch:opacity-100 flex items-center justify-center text-white transition-opacity"><i className="fas fa-trash text-[8px]"></i></button>
                    </div>
                  ))}
                </div>
              </div>
        )}

            {/* Desktop Toolbar - Simplified */}
            <div className={`hidden md:flex h-20 bg-white border-t border-gray-200 px-8 items-center justify-between shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="flex gap-2">
                <button 
                   onClick={handleUpscale}
                   disabled={!currentImageUrl || isLoading}
                   className="h-12 px-4 rounded-xl bg-white text-gray-900 hover:bg-gray-50 border border-gray-200 disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-xs"
                   title={t.upscaleTooltip}
                ><span className="bg-gray-900 text-white px-1.5 py-0.5 rounded text-[10px]">4K</span>{t.upscale}</button>
                <button 
                  disabled={isLoading || !currentImageUrl}
                  onClick={handleDownload}
                  className="w-12 h-12 rounded-xl bg-white text-gray-500 hover:text-gray-900 border border-gray-200 disabled:opacity-50 flex items-center justify-center"
                  title={t.downloadTooltip}
                ><i className="fas fa-download"></i></button>
              </div>

              <div className="flex items-center gap-2">
                 <button 
                    onClick={handleTransferToModify}
                    disabled={!currentImageUrl || isLoading}
                    className="h-12 px-6 rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-xs shadow-lg transition-all"
                    title={t.transferToModify}
                 >
                    <i className="fas fa-vector-square"></i> {t.transferToModify}
                 </button>
              </div>
            </div>

            {/* Mobile Toolbar - Simplified */}
            <div className="md:hidden sticky bottom-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200 p-4 flex gap-2">
                <button 
                    onClick={handleTransferToModify} 
                    disabled={!currentImageUrl} 
                    className="flex-1 py-3 rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-xs shadow-lg"
                >
                    <i className="fas fa-vector-square"></i> {t.transferToModify}
                </button>
                <button onClick={handleUpscale} disabled={!currentImageUrl || isLoading} className="w-12 h-12 rounded-xl bg-white border border-gray-200 text-gray-900 flex items-center justify-center font-bold text-[10px]"><span className="bg-gray-900 text-white px-1 rounded">4K</span></button>
                <button disabled={!currentImageUrl} onClick={handleDownload} className="w-12 h-12 bg-white border border-gray-200 rounded-xl text-gray-500 flex items-center justify-center"><i className="fas fa-download text-xs"></i></button>
            </div>
      </main>
    </div>
  );
};

export default App;
