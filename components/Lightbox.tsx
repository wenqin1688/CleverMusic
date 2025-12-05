
import React from 'react';
import { X, Download, Share2 } from 'lucide-react';
import { CanvasItem } from '../types';

interface LightboxProps {
  item: CanvasItem | null;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ item, onClose }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-white/10 backdrop-blur-3xl animate-fade-in flex items-center justify-center">
      
      {/* Controls */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <div className="flex flex-col">
            <h3 className="text-text-primary text-sm font-bold tracking-wider uppercase">Preview</h3>
            <span className="text-text-secondary text-[10px] font-mono">{item.id?.split('-')[0] || 'Unknown'}</span>
        </div>
        
        <div className="flex gap-4">
            <button 
                onClick={() => { const a = document.createElement('a'); a.href = item.url; a.download = `wenvis-${item.id || 'export'}.png`; a.click(); }}
                className="p-3 bg-white/40 hover:bg-white/80 rounded-full text-text-primary transition-all clickable backdrop-blur-md shadow-lg border border-white/20"
            >
                <Download size={20} />
            </button>
            <button 
                onClick={onClose}
                className="p-3 bg-white/40 hover:bg-red-500 hover:text-white rounded-full text-text-primary transition-all clickable backdrop-blur-md shadow-lg border border-white/20"
            >
                <X size={20} />
            </button>
        </div>
      </div>

      {/* Image Container */}
      <div className="relative w-full h-full p-12 flex items-center justify-center">
        {/* We prioritize the slice URL (item.url) to ensure we view the specific grid item selected, 
            rather than the full merged grid, unless specifically requested. */}
        <img 
            src={item.url} 
            alt="Lightbox" 
            className="max-w-full max-h-full object-contain shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] rounded-lg ring-1 ring-black/5"
        />
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-white/90 to-transparent">
        <div className="max-w-3xl mx-auto text-center space-y-2">
            {item.prompt && (
                <p className="text-text-primary text-sm font-medium leading-relaxed font-sans">{item.prompt}</p>
            )}
            <div className="flex justify-center gap-4 text-[10px] text-text-secondary uppercase tracking-widest font-bold">
                <span>{item.aspectRatio || 'Source Ratio'}</span>
                <span>•</span>
                <span>{new Date(item.timestamp).toLocaleString()}</span>
            </div>
        </div>
      </div>
    </div>
  );
};
