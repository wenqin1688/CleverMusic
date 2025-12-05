
import React, { useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { Asset } from '../types';

interface AssetBayProps {
  assets: Asset[];
  onAddAsset: (files: FileList) => void;
  onRemoveAsset: (id: string) => void;
  onSelectAsset: (asset: Asset) => void;
  selectedAssetId?: string;
}

export const AssetBay: React.FC<AssetBayProps> = ({ assets, onAddAsset, onRemoveAsset, onSelectAsset, selectedAssetId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col space-y-4 w-full transition-all duration-300 min-h-[100px]">
      <div className="flex items-center justify-between px-1">
         <span className="text-text-secondary text-[10px] uppercase tracking-widest font-bold">References</span>
         <span className="text-text-secondary/60 text-[10px] font-mono bg-black/5 px-2 py-0.5 rounded-md">{assets.length}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 content-start">
        {/* Add Button */}
        <div 
          className="aspect-square border border-dashed border-black/10 bg-black/5 rounded-2xl hover:bg-black/10 hover:border-black/20 transition-all cursor-pointer flex flex-col items-center justify-center group clickable"
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="image/*"
            onChange={(e) => e.target.files && onAddAsset(e.target.files)}
          />
          <Plus className="w-4 h-4 text-text-secondary group-hover:text-text-primary transition-colors" />
        </div>

        {assets.map((asset) => (
          <div 
            key={asset.id} 
            onClick={() => onSelectAsset(asset)}
            className={`relative group aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 clickable ${
                selectedAssetId === asset.id 
                ? 'ring-2 ring-[#007AFF] shadow-lg z-10' 
                : 'opacity-80 hover:opacity-100 hover:shadow-md'
            }`}
          >
            <img src={asset.previewUrl} alt="asset" className="w-full h-full object-cover" />
            
            <button 
                onClick={(e) => { e.stopPropagation(); onRemoveAsset(asset.id); }} 
                className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-md rounded-full text-text-primary hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 clickable shadow-sm"
            >
                <X size={8} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
