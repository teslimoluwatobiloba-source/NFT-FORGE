
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './components/Button';
import { generateNFTImage } from './services/geminiService';
import { AspectRatio, GeneratedNFT } from './types';

const ASPECT_RATIOS: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

interface EditState {
  brightness: number;
  contrast: number;
  grayscale: number;
  sepia: number;
  rotation: number;
}

const INITIAL_EDIT_STATE: EditState = {
  brightness: 100,
  contrast: 100,
  grayscale: 0,
  sepia: 0,
  rotation: 0,
};

type ViewMode = 'forge' | 'marketplace';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('forge');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedNFT[]>([]);
  const [listedIds, setListedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [currentNFT, setCurrentNFT] = useState<GeneratedNFT | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'success' | 'error'>('idle');
  
  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState>(INITIAL_EDIT_STATE);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load state from local storage
  useEffect(() => {
    const savedHistory = localStorage.getItem('nft_history');
    const savedListed = localStorage.getItem('nft_listed');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed);
        if (parsed.length > 0) setCurrentNFT(parsed[0]);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
    if (savedListed) {
      try {
        setListedIds(new Set(JSON.parse(savedListed)));
      } catch (e) {}
    }
  }, []);

  // Sync with local storage
  useEffect(() => {
    localStorage.setItem('nft_history', JSON.stringify(history));
    localStorage.setItem('nft_listed', JSON.stringify(Array.from(listedIds)));
  }, [history, listedIds]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt to generate an image.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setIsEditing(false);

    try {
      const imageUrl = await generateNFTImage(prompt, aspectRatio);
      const newNFT: GeneratedNFT = {
        id: crypto.randomUUID(),
        url: imageUrl,
        prompt: prompt,
        timestamp: Date.now(),
        aspectRatio: aspectRatio,
      };
      setCurrentNFT(newNFT);
      setHistory(prev => [newNFT, ...prev].slice(0, 12));
    } catch (err: any) {
      setError(err.message || "An error occurred while generating the image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const listOnPlatform = (platform: 'x' | 'linkedin' | 'github', nft: GeneratedNFT) => {
    const text = `Check out my latest AI-forged NFT: "${nft.prompt}" %23NFTForge %23AIArt`;
    const url = window.location.href;
    
    let shareUrl = '';
    switch (platform) {
      case 'x':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      case 'github':
        shareUrl = `https://github.com/new?name=NFT-Asset-${nft.id.slice(0, 8)}&description=${encodeURIComponent(nft.prompt)}`;
        break;
    }
    
    window.open(shareUrl, '_blank');
    setListedIds(prev => new Set(prev).add(nft.id));
  };

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `nft_${fileName.replace(/\s+/g, '_').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const applyEdits = async () => {
    if (!currentNFT || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentNFT.url;
    await new Promise((resolve) => { img.onload = resolve; });
    const isHorizontalRotation = editState.rotation % 180 !== 0;
    canvas.width = isHorizontalRotation ? img.height : img.width;
    canvas.height = isHorizontalRotation ? img.width : img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = `brightness(${editState.brightness}%) contrast(${editState.contrast}%) grayscale(${editState.grayscale}%) sepia(${editState.sepia}%)`;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((editState.rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const editedUrl = canvas.toDataURL('image/png');
    const updatedNFT = { ...currentNFT, url: editedUrl };
    setCurrentNFT(updatedNFT);
    setHistory(prev => prev.map(item => item.id === currentNFT.id ? updatedNFT : item));
    setIsEditing(false);
    setEditState(INITIAL_EDIT_STATE);
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
    setListedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
    });
    if (currentNFT?.id === id) setCurrentNFT(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('forge')}>
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i className="fa-solid fa-cube text-white text-xl"></i>
            </div>
            <h1 className="text-2xl font-bold gradient-text">NFT FORGE</h1>
          </div>
          
          <nav className="hidden md:flex gap-8 text-sm font-bold uppercase tracking-widest">
            <button 
              onClick={() => setViewMode('forge')}
              className={`transition-colors flex items-center gap-2 ${viewMode === 'forge' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <i className="fa-solid fa-fire-flame-curved text-[10px]"></i> Forge
            </button>
            <button 
              onClick={() => setViewMode('marketplace')}
              className={`transition-colors flex items-center gap-2 ${viewMode === 'marketplace' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <i className="fa-solid fa-shop text-[10px]"></i> Marketplace
              <span className="bg-indigo-500 text-[8px] px-1.5 py-0.5 rounded-full text-white">{listedIds.size}</span>
            </button>
          </nav>

          <Button variant="secondary" className="hidden sm:inline-flex bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
            <i className="fa-solid fa-wallet mr-2"></i> 0.00 ETH
          </Button>
        </div>
      </header>

      {viewMode === 'forge' ? (
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
          {/* Forge Left Column */}
          <div className="lg:col-span-5 space-y-8">
            <section className="glass p-6 rounded-3xl space-y-6 border-indigo-500/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Creator Engine</h2>
                <div className="flex gap-1">
                    {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-indigo-500/50"></div>)}
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Visualize your next digital asset..."
                className="w-full bg-gray-900/50 border border-white/10 rounded-2xl p-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[140px] resize-none text-sm leading-relaxed"
              />

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${
                      aspectRatio === ratio
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                        : 'bg-gray-800/50 border-white/5 text-gray-500 hover:border-white/20'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              <Button className="w-full py-4 text-sm font-bold tracking-widest uppercase" onClick={handleGenerate} isLoading={isGenerating}>
                Generate Asset
              </Button>
            </section>

            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Forge History</h2>
              <div className="grid grid-cols-2 gap-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => { setCurrentNFT(item); setIsEditing(false); }}
                    className={`group relative cursor-pointer rounded-2xl overflow-hidden aspect-square border transition-all ${
                      currentNFT?.id === item.id ? 'border-indigo-500 ring-4 ring-indigo-500/10 scale-[0.98]' : 'border-white/5 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={item.url} className="w-full h-full object-cover" />
                    {listedIds.has(item.id) && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-green-500 text-[8px] font-black rounded uppercase text-white shadow-lg">Listed</div>
                    )}
                    <button onClick={(e) => deleteFromHistory(item.id, e)} className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Forge Right Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="glass rounded-[2.5rem] overflow-hidden relative flex-1 min-h-[500px] flex flex-col items-center justify-center group shadow-2xl border-white/5">
              {currentNFT ? (
                <>
                  <div className="relative flex-1 w-full flex items-center justify-center p-12">
                    <img
                      src={currentNFT.url}
                      style={{
                        filter: `brightness(${editState.brightness}%) contrast(${editState.contrast}%) grayscale(${editState.grayscale}%) sepia(${editState.sepia}%)`,
                        transform: `rotate(${editState.rotation}deg)`,
                      }}
                      className="max-w-full max-h-[65vh] object-contain shadow-[0_0_80px_rgba(99,102,241,0.1)] rounded-lg"
                    />
                  </div>

                  {isEditing && (
                    <div className="w-full bg-gray-900/90 backdrop-blur-2xl border-t border-white/10 p-8 animate-in slide-in-from-bottom-8">
                      <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-8">
                        {['brightness', 'contrast', 'grayscale'].map(prop => (
                            <div key={prop} className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                                    <span>{prop}</span>
                                    <span className="text-indigo-400">{editState[prop as keyof EditState]}%</span>
                                </div>
                                <input type="range" min="0" max="200" value={editState[prop as keyof EditState]} 
                                    onChange={(e) => setEditState({...editState, [prop]: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-white/5 rounded-full appearance-none accent-indigo-500" />
                            </div>
                        ))}
                        <div className="flex gap-2">
                             <Button variant="secondary" className="flex-1 text-[10px]" onClick={() => setEditState({...editState, rotation: (editState.rotation + 90) % 360})}>Rotate</Button>
                             <Button variant="ghost" className="flex-1 text-[10px]" onClick={() => setEditState(INITIAL_EDIT_STATE)}>Reset</Button>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <Button variant="ghost" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
                        <Button variant="primary" className="flex-1" onClick={applyEdits}>Save Changes</Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center opacity-20">
                    <i className="fa-solid fa-wand-sparkles text-6xl mb-4"></i>
                    <p className="text-sm tracking-widest uppercase font-bold">Awaiting Genesis</p>
                </div>
              )}
            </div>

            {currentNFT && !isEditing && (
              <div className="glass p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-8 border-white/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[9px] font-bold border border-indigo-500/20">#{currentNFT.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">{currentNFT.aspectRatio} MESH</span>
                  </div>
                  <h3 className="text-lg font-bold leading-tight line-clamp-1">{currentNFT.prompt}</h3>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="secondary" className="flex-1 md:flex-none" onClick={() => setIsEditing(true)}><i className="fa-solid fa-sliders"></i></Button>
                    <Button variant="primary" className="flex-1 md:flex-none px-8 font-bold text-sm" onClick={() => setViewMode('marketplace')}>List to Market</Button>
                </div>
              </div>
            )}
          </div>
        </main>
      ) : (
        /* Marketplace View */
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
            {[
                { label: 'Market Cap', val: '42.8 ETH', icon: 'fa-chart-line' },
                { label: 'Listed Items', val: listedIds.size, icon: 'fa-tags' },
                { label: 'Floor Price', val: '0.15 ETH', icon: 'fa-arrow-up-from-bracket' },
                { label: 'Owners', val: '1,204', icon: 'fa-users' }
            ].map((stat, i) => (
                <div key={i} className="glass p-6 rounded-2xl border-white/5 text-center">
                    <i className={`fa-solid ${stat.icon} text-indigo-500/50 mb-3 text-lg`}></i>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-xl font-black text-white">{stat.val}</p>
                </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black tracking-tight">Active Listings</h2>
            <div className="flex gap-2">
                <Button variant="ghost" className="text-xs font-bold">Filter</Button>
                <Button variant="ghost" className="text-xs font-bold">Sort</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {history.map((nft) => (
                <div key={nft.id} className="glass rounded-3xl overflow-hidden border-white/5 group hover:border-indigo-500/30 transition-all">
                    <div className="relative aspect-square overflow-hidden">
                        <img src={nft.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                            <div className="flex gap-2">
                                <button onClick={() => listOnPlatform('x', nft)} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors">
                                    <i className="fa-brands fa-x-twitter text-white"></i>
                                </button>
                                <button onClick={() => listOnPlatform('linkedin', nft)} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors">
                                    <i className="fa-brands fa-linkedin-in text-white"></i>
                                </button>
                                <button onClick={() => listOnPlatform('github', nft)} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors">
                                    <i className="fa-brands fa-github text-white"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Gen Asset #{nft.id.slice(0,6)}</p>
                                <h4 className="font-bold text-sm truncate w-32">{nft.prompt}</h4>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Price</p>
                                <p className="text-sm font-black text-green-400">0.05 ETH</p>
                            </div>
                        </div>
                        {listedIds.has(nft.id) ? (
                            <div className="w-full py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                                <span className="text-[10px] font-black uppercase text-green-400 tracking-widest">Successfully Listed</span>
                            </div>
                        ) : (
                            <Button variant="primary" className="w-full py-2 text-xs font-bold uppercase tracking-widest" onClick={() => listOnPlatform('x', nft)}>List for Sale</Button>
                        )}
                    </div>
                </div>
            ))}
          </div>

          {history.length === 0 && (
            <div className="text-center py-20 glass rounded-[3rem] border-dashed border-white/5">
                <i className="fa-solid fa-box-open text-4xl text-gray-700 mb-4"></i>
                <p className="text-gray-500 uppercase tracking-widest font-bold">No assets found in forge</p>
                <Button variant="secondary" className="mt-6" onClick={() => setViewMode('forge')}>Return to Forge</Button>
            </div>
          )}
        </main>
      )}

      <footer className="py-12 border-t border-white/5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex justify-center gap-6 mb-6 text-gray-500 text-lg">
            <i className="fa-brands fa-x-twitter hover:text-white cursor-pointer transition-colors"></i>
            <i className="fa-brands fa-linkedin hover:text-white cursor-pointer transition-colors"></i>
            <i className="fa-brands fa-github hover:text-white cursor-pointer transition-colors"></i>
          </div>
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">NFT FORGE PROTOCOL // WEB3 INTERFACE // V2.04</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
