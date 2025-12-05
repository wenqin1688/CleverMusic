
import React from 'react';
import { Button } from './Button';
import { AspectRatio, GenerationMode } from '../types';
import { Grid2X2, Grid3X3, LayoutGrid, Sparkles } from 'lucide-react';

interface DirectorDeckProps {
  mode: GenerationMode;
  setMode: (mode: GenerationMode) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  prompt: string;
  setPrompt: (text: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export const DirectorDeck: React.FC<DirectorDeckProps> = ({
  mode,
  setMode,
  aspectRatio,
  setAspectRatio,
  prompt,
  setPrompt,
  onGenerate,
  isGenerating,
}) => {
  
  const presets = ["Cinematic Lighting", "Studio Clean", "Soft Shadows", "Product Shot", "Vibrant"];

  return (
    <div className="flex flex-col flex-1 space-y-8 select-none">
      
      {/* Layout Config */}
      <div className="space-y-4">
         <div className="flex items-center gap-2">
            <span className="text-text-secondary text-[10px] uppercase tracking-widest font-bold">Grid Layout</span>
         </div>
         <div className="grid grid-cols-3 gap-2">
            {[
                { m: GenerationMode.GRID_2x2, icon: Grid2X2, label: "2x2" },
                { m: GenerationMode.GRID_3x3, icon: Grid3X3, label: "3x3" },
                { m: GenerationMode.GRID_4x4, icon: LayoutGrid, label: "4x4" }
            ].map((item) => (
                <button
                    key={item.label}
                    onClick={() => setMode(item.m)}
                    className={`flex flex-col items-center justify-center gap-2 py-3 rounded-2xl border transition-all duration-300 clickable ${
                        mode === item.m 
                        ? 'bg-white text-text-primary border-black/5 shadow-md' 
                        : 'bg-transparent border-transparent text-text-secondary hover:bg-black/5'
                    }`}
                >
                    <item.icon size={16} />
                    <span className="text-[10px] font-medium">{item.label}</span>
                </button>
            ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-4">
        <span className="text-text-secondary text-[10px] uppercase tracking-widest font-bold">Frame Ratio</span>
        <div className="flex flex-wrap gap-2">
            {Object.values(AspectRatio).map((ar) => (
                <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={`text-[10px] px-3 py-1.5 rounded-lg font-medium transition-all duration-300 clickable ${
                        aspectRatio === ar 
                        ? 'bg-[#007AFF] text-white shadow-md' 
                        : 'bg-black/5 text-text-secondary hover:bg-black/10'
                    }`}
                >
                    {ar}
                </button>
            ))}
        </div>
      </div>

      {/* Prompt Area */}
      <div className="space-y-3 flex-1 flex flex-col min-h-[200px]">
        <div className="flex justify-between items-center">
             <span className="text-text-secondary text-[10px] uppercase tracking-widest font-bold">Directive</span>
             <div className="flex gap-1">
                {presets.slice(0, 2).map(p => (
                    <button 
                        key={p} 
                        onClick={() => setPrompt(prompt ? `${prompt}, ${p}` : p)}
                        className="text-[9px] px-2 py-0.5 bg-black/5 rounded-md text-text-secondary hover:text-text-primary hover:bg-black/10 transition-colors clickable"
                    >
                        {p}
                    </button>
                ))}
             </div>
        </div>
        
        <div className="relative flex-1 group">
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your scene..."
                className="w-full h-full absolute inset-0 bg-white/50 border border-black/5 rounded-2xl p-4 text-sm text-text-primary focus:border-black/20 focus:bg-white focus:ring-0 resize-none font-sans leading-relaxed placeholder:text-text-secondary/50 custom-scrollbar transition-all duration-300 shadow-inner"
                spellCheck={false}
            />
        </div>
      </div>

      <Button 
        variant="primary" 
        className="w-full py-4 uppercase text-[10px] tracking-[0.2em] font-bold group relative overflow-hidden"
        onClick={onGenerate}
        disabled={isGenerating || !prompt.trim()}
      >
        <div className="relative z-10 flex items-center justify-center gap-2">
            {isGenerating ? <Sparkles size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isGenerating ? 'Synthesizing...' : 'Generate Visuals'}
        </div>
      </Button>
    </div>
  );
};
