
import React from 'react';
import { StoryboardGroup, CanvasItem } from '../types';
import { Copy, X, Maximize2, Grid, Sparkles } from 'lucide-react';
import { Button } from './Button';

interface InspectorProps {
  selectedGroup: StoryboardGroup | null;
  selectedItemId: string | undefined;
  onSelectItem: (item: CanvasItem) => void;
  onClose: () => void;
  onAnalyze: (prompt: string) => void;
  onOpenLightbox: (item: CanvasItem) => void;
  isAnalyzing: boolean;
  analysisResult?: string;
}

export const Inspector: React.FC<InspectorProps> = ({ 
  selectedGroup,
  selectedItemId,
  onSelectItem,
  onClose,
  onAnalyze,
  onOpenLightbox,
}) => {
  const selectedItem = selectedGroup?.items.find(i => i.id === selectedItemId) || selectedGroup?.items[0];

  if (!selectedGroup || !selectedItem) return null;

  return (
    <div className="w-[320px] bg-white/30 backdrop-blur-3xl border border-white/40 rounded-[32px] overflow-hidden flex flex-col max-h-[calc(100vh-40px)] animate-fade-in shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1)] ring-1 ring-white/20 transition-all duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/20 bg-gradient-to-b from-white/30 to-transparent">
        <div>
            <div className="text-[9px] font-bold text-text-secondary/70 uppercase tracking-widest">Selected Item</div>
            <div className="text-[14px] font-bold text-text-primary truncate max-w-[180px] tracking-tight">{selectedGroup.title}</div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/30 transition-colors clickable text-text-primary/70">
            <X size={16} />
        </button>
      </div>

      {/* Preview Area */}
      <div className="p-6 pb-0">
          <div 
            onClick={() => onOpenLightbox(selectedItem)}
            className="relative aspect-video rounded-2xl overflow-hidden shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] border border-white/30 group cursor-pointer hover:scale-[1.02] transition-transform duration-300"
          >
             <img src={selectedItem.url} className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center backdrop-blur-[0px] group-hover:backdrop-blur-[2px] duration-500">
                 <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 drop-shadow-md" size={24} />
             </div>
          </div>
      </div>

      {/* Grid List */}
      <div className="p-6 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
             <Grid size={12} className="text-text-secondary" />
             <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">Context Grid ({selectedGroup.items.length})</span>
          </div>
          
          <div className="grid grid-cols-4 gap-2 overflow-y-auto custom-scrollbar content-start pr-1 max-h-[200px]">
             {selectedGroup.items.map((item) => (
                 <div 
                    key={item.id}
                    onClick={() => onSelectItem(item)} // Updates Inspector Preview only
                    className={`aspect-square rounded-xl overflow-hidden cursor-pointer border transition-all duration-300 clickable ${
                        item.id === selectedItemId 
                        ? 'border-[#007AFF] ring-2 ring-[#007AFF]/20 shadow-md scale-105' 
                        : 'border-transparent opacity-70 hover:opacity-100 hover:border-white/40 hover:scale-105'
                    }`}
                 >
                     <img src={item.url} className="w-full h-full object-cover" loading="lazy" />
                 </div>
             ))}
          </div>
      </div>

      {/* Info Section */}
      <div className="p-6 bg-white/20 border-t border-white/10 space-y-5">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-text-secondary/70 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles size={10} /> Prompt Data
                    </label>
                    <button 
                        onClick={() => navigator.clipboard.writeText(selectedItem.prompt || '')} 
                        className="text-text-secondary hover:text-[#007AFF] transition-colors clickable p-1"
                    >
                        <Copy size={12} />
                    </button>
                </div>
                <div className="p-4 rounded-2xl bg-white/30 border border-white/20 text-[11px] leading-relaxed text-text-primary font-medium max-h-[100px] overflow-y-auto shadow-inner backdrop-blur-sm">
                    {selectedItem.prompt || 'No prompt data available for this generation.'}
                </div>
            </div>

            <Button variant="primary" className="w-full h-11 rounded-2xl text-xs font-bold tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all clickable" onClick={() => onOpenLightbox(selectedItem)}>
                OPEN VIEWER
            </Button>
      </div>
    </div>
  );
};
