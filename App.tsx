
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { Cursor } from './components/Cursor';
import { Lightbox } from './components/Lightbox';
import { Asset, CanvasItem, GenerationMode, AspectRatio, ImageSize, StoryboardGroup, NodeConfig, TimelineClip } from './types';
import { 
    generateMultiViewGrid, 
    fileToBase64, 
    analyzeAsset, 
    ReferenceImageData, 
    suggestPrompts, 
    analyzeMusic, 
    generateVisualStyle, 
    generateProtagonistImage,
    generateMVStoryboard,
    generateVideoClip,
    DEFAULT_MUSIC_ANALYSIS_PROMPT,
    DEFAULT_STYLE_GEN_PROMPT,
    DEFAULT_STORYBOARD_PROMPT,
    DEFAULT_AGENT_SYSTEM_PROMPT
} from './services/geminiService';
import { AlertCircle, X, Save, RotateCcw } from 'lucide-react';
import { Button } from './components/Button';

// --- SYSTEM PROMPT EDITOR COMPONENT ---
const SystemPromptEditor: React.FC<{
    isOpen: boolean;
    nodeTitle: string;
    prompt: string;
    onClose: () => void;
    onSave: (newPrompt: string) => void;
    onReset: () => void;
}> = ({ isOpen, nodeTitle, prompt, onClose, onSave, onReset }) => {
    const [value, setValue] = useState(prompt);

    useEffect(() => {
        setValue(prompt);
    }, [prompt, isOpen]);

    return (
        <div className={`fixed top-4 bottom-4 right-4 z-[200] w-[400px] bg-[#1c1c1e]/90 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl transform transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] flex flex-col overflow-hidden ${isOpen ? 'translate-x-0' : 'translate-x-[120%]'}`}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
                <div>
                    <div className="text-[9px] font-bold text-text-secondary/70 uppercase tracking-widest">System Instruction</div>
                    <div className="text-[14px] font-bold text-text-primary truncate max-w-[200px]">{nodeTitle}</div>
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors clickable text-text-primary/70">
                    <X size={16} />
                </button>
            </div>
            
            <div className="flex-1 p-6 flex flex-col gap-4 min-h-0">
                <div className="flex-1 bg-black/20 border border-white/5 rounded-2xl p-4 shadow-inner">
                    <textarea 
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full h-full bg-transparent border-none resize-none focus:ring-0 text-xs font-mono leading-relaxed text-text-primary"
                        spellCheck={false}
                    />
                </div>
                <div className="text-[10px] text-text-secondary/60 px-2">
                    Tip: Customize the AI's persona, output structure, or analysis criteria here.
                </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-white/5 flex gap-3">
                <Button variant="secondary" onClick={() => { onReset(); setValue(''); }} className="flex-1 flex items-center gap-2 text-xs !bg-white/5 !text-white !border-white/10 hover:!bg-white/10">
                    <RotateCcw size={12} /> Reset Default
                </Button>
                <Button variant="primary" onClick={() => onSave(value)} className="flex-1 flex items-center gap-2 text-xs !bg-[#007AFF]">
                    <Save size={12} /> Save Changes
                </Button>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [storyboards, setStoryboards] = useState<StoryboardGroup[]>([]);
  const [history, setHistory] = useState<StoryboardGroup[][]>([]); // Undo stack
  const [clipboard, setClipboard] = useState<StoryboardGroup | null>(null); // Copy/Paste
  const [generatingAgents, setGeneratingAgents] = useState<Set<string>>(new Set());
  
  // Selection State
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(undefined);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const [lightboxItem, setLightboxItem] = useState<CanvasItem | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // System Prompt Editor State
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null);

  // --- HISTORY & SHORTCUTS ---

  const saveHistory = useCallback(() => {
    setHistory(prev => {
        const newHistory = [...prev, storyboards];
        if (newHistory.length > 20) newHistory.shift(); // Limit history size
        return newHistory;
    });
  }, [storyboards]);

  const handleUndo = useCallback(() => {
    setHistory(prev => {
        if (prev.length === 0) return prev;
        const previousState = prev[prev.length - 1];
        setStoryboards(previousState);
        return prev.slice(0, -1);
    });
  }, []);

  const handleCopy = useCallback(() => {
    if (selectedNodeId) {
        const node = storyboards.find(n => n.id === selectedNodeId);
        if (node) setClipboard(node);
    }
  }, [selectedNodeId, storyboards]);

  const handlePaste = useCallback(() => {
    if (clipboard) {
        saveHistory();
        const newId = crypto.randomUUID();
        const offset = 40;
        
        const newItems = clipboard.items.map(item => ({
            ...item,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        }));

        const newNode: StoryboardGroup = {
            ...clipboard,
            id: newId,
            title: `${clipboard.title} (Copy)`,
            x: clipboard.x + offset,
            y: clipboard.y + offset,
            items: newItems,
            connections: [], 
            inputs: [],      
            timestamp: Date.now()
        };

        setStoryboards(prev => [...prev, newNode]);
        setSelectedNodeId(newId);
    }
  }, [clipboard, saveHistory]);

  const handleDeleteNode = useCallback((nodeId: string) => {
      saveHistory();
      setStoryboards(prev => {
          const remaining = prev.filter(g => g.id !== nodeId);
          return remaining.map(g => ({
              ...g,
              connections: g.connections?.filter(c => c !== nodeId) || [],
              inputs: g.inputs?.filter(i => i !== nodeId) || []
          }));
      });
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      if (editorNodeId === nodeId) setEditorNodeId(null);
  }, [saveHistory, selectedNodeId, editorNodeId]);

  const handleResizeNode = useCallback((nodeId: string, width: number, height: number) => {
      setStoryboards(prev => prev.map(g => g.id === nodeId ? { ...g, width, height } : g));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

        const isCmdOrCtrl = e.metaKey || e.ctrlKey;
        
        if (isCmdOrCtrl && e.key === 'z') { e.preventDefault(); handleUndo(); }
        if (isCmdOrCtrl && e.key === 'c') { e.preventDefault(); handleCopy(); }
        if (isCmdOrCtrl && e.key === 'v') { e.preventDefault(); handlePaste(); }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) { handleDeleteNode(selectedNodeId); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleCopy, handlePaste, handleDeleteNode, selectedNodeId]);


  // --- INITIALIZATION ---

  useEffect(() => {
    const initTemplate = () => {
        const assetNodeId = crypto.randomUUID();
        const agentNodeId = crypto.randomUUID();
        
        const defaultAssets: StoryboardGroup = {
            id: assetNodeId,
            type: 'assets',
            title: 'Reference Assets',
            x: 100,
            y: 300,
            items: [],
            timestamp: Date.now(),
            connections: [agentNodeId]
        };

        const defaultAgent: StoryboardGroup = {
            id: agentNodeId,
            type: 'agent',
            title: 'Storyboard Master',
            x: 600,
            y: 250,
            items: [],
            timestamp: Date.now(),
            connections: [],
            inputs: [assetNodeId],
            config: {
                prompt: 'A cinematic shot of...',
                mode: GenerationMode.GRID_2x2,
                aspectRatio: AspectRatio.WIDE,
                recommendations: [],
                isAnalyzing: false,
                cameraMove: 'None',
                lightingStyle: 'None',
                customSystemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT
            }
        };

        setStoryboards([defaultAssets, defaultAgent]);
    };
    initTemplate();
  }, []);

  const activeGroup = React.useMemo(() => {
    if (selectedItemId) {
        return storyboards.find(group => group.items.some(i => i.id === selectedItemId)) || null;
    }
    return null;
  }, [selectedItemId, storyboards]);

  // --- HANDLERS ---

  const handleAddAsset = (files: FileList, x?: number, y?: number, targetNodeId?: string) => {
    saveHistory();
    const newItems: CanvasItem[] = [];
    let validFiles = Array.from(files);
    let targetNode = targetNodeId ? storyboards.find(g => g.id === targetNodeId) : null;
    
    if (targetNode) {
        if (targetNode.type === 'timeline') {
             // Robust audio check: MIME type OR extension
             const audioFile = validFiles.find(f => f.type.startsWith('audio') || f.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i));
             if (audioFile) {
                 const url = URL.createObjectURL(audioFile);
                 setStoryboards(prev => prev.map(g => g.id === targetNodeId ? { ...g, config: { ...g.config!, timelineAudioUrl: url } } : g));
                 return;
             }
        } else if (targetNode.type === 'music') {
            validFiles = validFiles.filter(f => f.type.startsWith('audio') || f.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i));
        } else if (targetNode.type === 'assets') {
            validFiles = validFiles.filter(f => f.type.startsWith('image'));
        } else if (targetNode.type === 'video') {
            validFiles = validFiles.filter(f => f.type.startsWith('video'));
        } else if (targetNode.type === 'mv_attribute_settings') {
             validFiles = validFiles.filter(f => f.type.startsWith('image'));
             if (validFiles.length > 0) {
                 const file = validFiles[0];
                 const url = URL.createObjectURL(file);
                 setStoryboards(prev => prev.map(g => g.id === targetNodeId ? { ...g, config: { ...g.config!, mvProtagonistImageUrl: url } } : g));
                 return; 
             }
        }
    }

    if (validFiles.length === 0) return;

    validFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      const newItemsId = crypto.randomUUID();
      let type: 'image' | 'video' | 'audio' = 'image';
      
      if (file.type.startsWith('audio') || file.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)) type = 'audio';
      else if (file.type.startsWith('video') || file.name.match(/\.(mp4|mov|webm)$/i)) type = 'video';
      
      newItems.push({
          id: newItemsId,
          url: url,
          type: type,
          timestamp: Date.now(),
          fileName: file.name
      });
      setAssets(prev => [...prev, { id: newItemsId, file, previewUrl: url, type: type }]);
    });
    
    if (targetNodeId) {
        setStoryboards(prev => prev.map(g => {
            if (g.id === targetNodeId) {
                return { ...g, items: [...g.items, ...newItems] };
            }
            return g;
        }));
    } else {
        let firstFileType: string = 'assets';
        if (validFiles[0].type.startsWith('audio') || validFiles[0].name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)) firstFileType = 'music';
        else if (validFiles[0].type.startsWith('video')) firstFileType = 'video';
        
        const group: StoryboardGroup = {
            id: crypto.randomUUID(),
            type: firstFileType as any,
            title: firstFileType === 'music' ? 'Music' : firstFileType === 'video' ? 'Video Library' : 'Reference Assets',
            x: x || 100,
            y: y || 100,
            items: newItems,
            timestamp: Date.now(),
            connections: []
        };
        setStoryboards(prev => [...prev, group]);
    }
  };

  const handleSelectItem = (item: CanvasItem) => {
      setSelectedItemId(item?.id);
      setAnalysisResult('');
  };

  const handleSelectNode = (nodeId: string | null) => {
      setSelectedNodeId(nodeId);
  };

  const handleRenameNode = (nodeId: string, newTitle: string) => {
      saveHistory();
      setStoryboards(prev => prev.map(g => g.id === nodeId ? { ...g, title: newTitle } : g));
  };

  const handleUpdateStoryboard = (updatedGroup: StoryboardGroup) => {
      setStoryboards(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
  };

  const handleDeleteItem = (itemId: string, groupId: string) => {
      saveHistory();
      setStoryboards(prev => prev.map(group => {
          if (group.id !== groupId) return group;
          return { ...group, items: group.items.filter(i => i.id !== itemId) };
      })); 
      if (selectedItemId === itemId) setSelectedItemId(undefined);
  };

  const handleDuplicateNode = (nodeId: string) => {
      saveHistory();
      const nodeToDuplicate = storyboards.find(n => n.id === nodeId);
      if (!nodeToDuplicate) return;

      const newId = crypto.randomUUID();
      const duplicatedNode: StoryboardGroup = {
          ...nodeToDuplicate,
          id: newId,
          x: nodeToDuplicate.x + 50,
          y: nodeToDuplicate.y + 50,
          title: `${nodeToDuplicate.title} (Copy)`,
          connections: [],
          inputs: [],
          items: nodeToDuplicate.items.map(item => ({
              ...item,
              id: crypto.randomUUID(),
              timestamp: Date.now()
          }))
      };
      setStoryboards(prev => [...prev, duplicatedNode]);
  };

  const handleRegenerateItem = (item: CanvasItem) => {};

  const handleCreateAgent = (x: number, y: number) => {
      saveHistory();
      const newAgent: StoryboardGroup = {
          id: crypto.randomUUID(),
          type: 'agent',
          title: 'Storyboard Master',
          x,
          y,
          items: [],
          timestamp: Date.now(),
          connections: [],
          inputs: [],
          config: {
              prompt: '',
              mode: GenerationMode.GRID_2x2,
              aspectRatio: AspectRatio.WIDE,
              recommendations: [],
              isAnalyzing: false,
              cameraMove: 'None',
              lightingStyle: 'None',
              customSystemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT
          }
      };
      setStoryboards(prev => [...prev, newAgent]);
  };

  const handleCreateAssetNode = (x: number, y: number) => {
      saveHistory();
      const newNode: StoryboardGroup = {
          id: crypto.randomUUID(),
          type: 'assets',
          title: 'Reference Assets',
          x,
          y,
          items: [],
          timestamp: Date.now(),
          connections: []
      };
      setStoryboards(prev => [...prev, newNode]);
  };

  const handleCreateVideoNode = (x: number, y: number) => {
      saveHistory();
      const newNode: StoryboardGroup = {
          id: crypto.randomUUID(),
          type: 'video',
          title: 'Video Library',
          x,
          y,
          items: [],
          timestamp: Date.now(),
          connections: []
      };
      setStoryboards(prev => [...prev, newNode]);
  };

  const handleCreateMusicNode = (x: number, y: number) => {
      saveHistory();
      const newNode: StoryboardGroup = {
          id: crypto.randomUUID(),
          type: 'music',
          title: 'Music',
          x,
          y,
          items: [],
          timestamp: Date.now(),
          connections: []
      };
      setStoryboards(prev => [...prev, newNode]);
  };

  const handleCreateTextNode = (x: number, y: number) => {
      saveHistory();
      const newNode: StoryboardGroup = {
          id: crypto.randomUUID(),
          type: 'text',
          title: 'Context / Prompt',
          x,
          y,
          items: [],
          timestamp: Date.now(),
          connections: [],
          config: {
             prompt: '',
             mode: GenerationMode.GRID_2x2, // ignored
             aspectRatio: AspectRatio.WIDE // ignored
          }
      };
      setStoryboards(prev => [...prev, newNode]);
  };

  const handleCreateMusicAnalysisAgent = (x: number, y: number) => {
      saveHistory();
      const newNode: StoryboardGroup = {
          id: crypto.randomUUID(),
          type: 'music_analysis',
          title: 'Music Analysis Master',
          x,
          y,
          items: [],
          timestamp: Date.now(),
          connections: [],
          inputs: [],
          config: {
              prompt: '',
              mode: GenerationMode.GRID_2x2,
              aspectRatio: AspectRatio.WIDE,
              customSystemPrompt: DEFAULT_MUSIC_ANALYSIS_PROMPT
          }
      };
      setStoryboards(prev => [...prev, newNode]);
  };

  const handleCreateMVAttributeSettings = (x: number, y: number) => {
      saveHistory();
      const newNode: StoryboardGroup = {
          id: crypto.randomUUID(),
          type: 'mv_attribute_settings',
          title: 'Visual Expert',
          x,
          y,
          items: [],
          timestamp: Date.now(),
          connections: [],
          inputs: [],
          config: {
              prompt: '',
              mode: GenerationMode.GRID_2x2,
              aspectRatio: AspectRatio.WIDE,
              customSystemPrompt: DEFAULT_STYLE_GEN_PROMPT
          }
      };
      setStoryboards(prev => [...prev, newNode]);
  };

  const handleCreateMVStoryboard = (x: number, y: number) => {
      saveHistory();
      const newNode: StoryboardGroup = {
          id: crypto.randomUUID(),
          type: 'mv_storyboard',
          title: 'MV Storyboard Script',
          x,
          y,
          width: 1000,
          items: [],
          timestamp: Date.now(),
          connections: [],
          inputs: [],
          config: {
              prompt: '',
              mode: GenerationMode.GRID_2x2,
              aspectRatio: AspectRatio.WIDE,
              mvScenes: [],
              customSystemPrompt: DEFAULT_STORYBOARD_PROMPT
          }
      };
      setStoryboards(prev => [...prev, newNode]);
  };

  const handleCreateTimelineNode = (x: number, y: number) => {
      saveHistory();
      const newNode: StoryboardGroup = {
          id: crypto.randomUUID(),
          type: 'timeline',
          title: 'Timeline Edit',
          x,
          y,
          width: 1000,
          height: 600,
          items: [],
          timestamp: Date.now(),
          connections: [],
          inputs: [],
          config: {
              prompt: '',
              mode: GenerationMode.GRID_2x2,
              aspectRatio: AspectRatio.WIDE,
              timelineClips: []
          }
      };
      setStoryboards(prev => [...prev, newNode]);
  };

  const handleConnect = (sourceNodeId: string, targetNodeId: string) => {
      if (sourceNodeId === targetNodeId) return;
      
      const sourceNode = storyboards.find(n => n.id === sourceNodeId);
      const targetNode = storyboards.find(n => n.id === targetNodeId);
      
      if (sourceNode?.connections.includes(targetNodeId)) return;

      saveHistory();
      setStoryboards(prev => prev.map(group => {
          if (group.id === targetNodeId) {
              const inputs = group.inputs || [];
              
              // AUTO-CONFIGURE: If connecting Music -> Timeline, auto-set audio URL
              if (group.type === 'timeline' && sourceNode?.type === 'music' && sourceNode.items.length > 0) {
                  return { 
                      ...group, 
                      inputs: [...inputs, sourceNodeId],
                      config: { ...group.config, timelineAudioUrl: sourceNode.items[0].url }
                  };
              }

              if (!inputs.includes(sourceNodeId)) return { ...group, inputs: [...inputs, sourceNodeId] };
          }
          if (group.id === sourceNodeId) {
              const connections = group.connections || [];
              if (!connections.includes(targetNodeId)) return { ...group, connections: [...connections, targetNodeId] };
          }
          return group;
      }));
  };

  const handleDisconnect = (sourceNodeId: string, targetNodeId: string) => {
      saveHistory();
      setStoryboards(prev => prev.map(group => {
          if (group.id === targetNodeId) return { ...group, inputs: group.inputs?.filter(id => id !== sourceNodeId) || [] };
          if (group.id === sourceNodeId) return { ...group, connections: group.connections?.filter(id => id !== targetNodeId) || [] };
          return group;
      }));
  };

  // ... (rest of methods: getReferenceImagesForAgent, handleSmartPrompt, etc. stay same) ...
  const getReferenceImagesForAgent = async (agent: StoryboardGroup): Promise<ReferenceImageData[]> => {
      const referenceImages: ReferenceImageData[] = [];
      if (agent.inputs) {
          for (const inputNodeId of agent.inputs) {
              const inputNode = storyboards.find(g => g.id === inputNodeId);
              if (inputNode && inputNode.items.length > 0) {
                  for (const item of inputNode.items) {
                      if (item.url.startsWith('blob:')) {
                           const assetRec = assets.find(a => a.previewUrl === item.url);
                           if (assetRec) {
                               const base64 = await fileToBase64(assetRec.file);
                               referenceImages.push({ data: base64, mimeType: assetRec.file.type });
                           }
                      } else if (item.url.startsWith('data:')) {
                          const base64 = item.url.split(',')[1];
                          const mime = item.url.split(';')[0].split(':')[1];
                          referenceImages.push({ data: base64, mimeType: mime });
                      }
                  }
              }
          }
      }
      return referenceImages;
  }

  const handleSmartPrompt = async (agentId: string) => {
      const agent = storyboards.find(g => g.id === agentId);
      if (!agent) return;
      setStoryboards(prev => prev.map(g => g.id === agentId ? { ...g, config: { ...g.config!, isAnalyzing: true } } : g));
      try {
        const refs = await getReferenceImagesForAgent(agent);
        if (refs.length === 0) throw new Error("Please connect a reference image first.");
        const suggestions = await suggestPrompts(refs);
        setStoryboards(prev => prev.map(g => g.id === agentId ? { ...g, config: { ...g.config!, recommendations: suggestions, isAnalyzing: false } } : g));
      } catch (e: any) {
         setError(e.message || "Smart analysis failed");
         setStoryboards(prev => prev.map(g => g.id === agentId ? { ...g, config: { ...g.config!, isAnalyzing: false } } : g));
      }
  }

  const handleMusicAnalysis = async (agentId: string) => {
      const agent = storyboards.find(g => g.id === agentId);
      if (!agent) return;
      
      setGeneratingAgents(prev => new Set(prev).add(agentId));
      setError(null);

      try {
         let audioData: string | null = null;
         let mimeType: string | null = null;
         let userContext: string | null = null;

         if (agent.inputs) {
            for (const inputId of agent.inputs) {
                const inputNode = storyboards.find(n => n.id === inputId);
                
                if (inputNode?.type === 'music' && inputNode.items.length > 0) {
                    const item = inputNode.items[0]; 
                    const asset = assets.find(a => a.previewUrl === item.url);
                    if (asset) {
                        audioData = await fileToBase64(asset.file);
                        mimeType = asset.file.type;
                    }
                }
                
                if (inputNode?.type === 'text') {
                    userContext = inputNode.config?.prompt || null;
                }
            }
         }

         if (!audioData || !mimeType) throw new Error("Missing Audio Source. Please connect a Music node with an audio file.");
         if (!userContext) throw new Error("Missing Context. Please connect a Text node with context/prompt.");

         const resultText = await analyzeMusic(audioData, mimeType, userContext, agent.config?.customSystemPrompt);

         const resultNodeId = crypto.randomUUID();
         const resultNode: StoryboardGroup = {
             id: resultNodeId,
             type: 'text_result',
             title: 'Analysis Result',
             x: agent.x + 400,
             y: agent.y,
             items: [],
             timestamp: Date.now(),
             connections: [],
             inputs: [agentId],
             config: {
                 textResult: resultText,
                 prompt: '', 
                 mode: GenerationMode.GRID_2x2, 
                 aspectRatio: AspectRatio.WIDE 
             }
         };

         setStoryboards(prev => {
             const updatedAgent = { ...agent, connections: [...(agent.connections || []), resultNodeId] };
             return prev.map(g => g.id === agentId ? updatedAgent : g).concat(resultNode);
         });

      } catch (e: any) {
          setError(e.message || "Music analysis failed");
      } finally {
          setGeneratingAgents(prev => { const next = new Set(prev); next.delete(agentId); return next; });
      }
  };

  const handleAnalyzeAndConceptualize = async (agentId: string) => {
      const agent = storyboards.find(g => g.id === agentId);
      if (!agent) return;
      
      setGeneratingAgents(prev => new Set(prev).add(agentId));
      setError(null);

      try {
         let analysisText = "";
         if (agent.inputs) {
            for (const inputId of agent.inputs) {
                const inputNode = storyboards.find(n => n.id === inputId);
                if ((inputNode?.type === 'text_result' || inputNode?.type === 'music_analysis') && inputNode.config?.textResult) {
                    analysisText = inputNode.config.textResult;
                    break;
                } else if (inputNode?.type === 'text' && inputNode.config?.prompt) {
                    analysisText = inputNode.config.prompt;
                }
            }
         }

         if (!analysisText) throw new Error("Please connect an Analysis Result node or provide text input.");

         const styleUrl = await generateVisualStyle(analysisText, agent.config?.customSystemPrompt);
         const protagUrl = await generateProtagonistImage(analysisText);

         setStoryboards(prev => prev.map(g => g.id === agentId ? { 
             ...g, 
             config: { 
                 ...g.config!, 
                 textResult: analysisText, 
                 mvStyleImageUrl: styleUrl,
                 mvProtagonistImageUrl: protagUrl
             } 
         } : g));

      } catch (e: any) {
          setError(e.message || "Visual conceptualization failed");
      } finally {
          setGeneratingAgents(prev => { const next = new Set(prev); next.delete(agentId); return next; });
      }
  };

  const handleGenerateMVStoryboard = async (agentId: string) => {
      const agent = storyboards.find(g => g.id === agentId);
      if (!agent) return;

      setGeneratingAgents(prev => new Set(prev).add(agentId));
      setError(null);

      try {
          let analysisText = "";
          let styleImage = "";
          let protagonistImage: string | undefined = undefined;
          let hasVisualExpert = false;

          if (agent.inputs) {
              for (const inputId of agent.inputs) {
                  const inputNode = storyboards.find(n => n.id === inputId);
                  if (inputNode?.type === 'mv_attribute_settings') {
                      hasVisualExpert = true;
                      analysisText = inputNode.config?.textResult || "";
                      styleImage = inputNode.config?.mvStyleImageUrl || "";
                      protagonistImage = inputNode.config?.mvProtagonistImageUrl || undefined;
                      break; 
                  }
              }
          }

          if (!hasVisualExpert) throw new Error("Please connect a Visual Expert node.");
          if (!analysisText) throw new Error("Missing Analysis Data in Visual Expert node.");
          if (!styleImage) throw new Error("Missing Visual Style in Visual Expert node. Please run the Visual Expert first.");

          const scenes = await generateMVStoryboard(analysisText, styleImage, protagonistImage, agent.config?.customSystemPrompt);
          
          setStoryboards(prev => prev.map(g => g.id === agentId ? { ...g, config: { ...g.config!, mvScenes: scenes } } : g));

      } catch (e: any) {
          setError(e.message || "Storyboard synthesis failed");
      } finally {
          setGeneratingAgents(prev => { const next = new Set(prev); next.delete(agentId); return next; });
      }
  };

  const handleImportVideosToTimeline = (agentId: string) => {
      const agent = storyboards.find(g => g.id === agentId);
      if (!agent) return;

      saveHistory();
      let importedClips: TimelineClip[] = agent.config?.timelineClips || [];
      let inputCount = 0;

      if (agent.inputs) {
          agent.inputs.forEach(inputId => {
              const inputNode = storyboards.find(n => n.id === inputId);
              if (inputNode?.type === 'video') {
                  inputNode.items.forEach(item => {
                      if (!importedClips.some(c => c.videoUrl === item.url)) {
                          importedClips.push({
                              id: crypto.randomUUID(),
                              sceneId: `import-${Date.now()}-${inputCount}`,
                              videoUrl: item.url,
                              thumbUrl: item.url, 
                              duration: item.duration || 5, 
                              prompt: item.fileName || 'Imported Video',
                              status: 'done'
                          });
                          inputCount++;
                      }
                  });
              }
          });
      }

      if (inputCount === 0) {
          setError("No videos found in connected Video Nodes.");
          return;
      }

      setStoryboards(prev => prev.map(g => g.id === agentId ? { ...g, config: { ...g.config!, timelineClips: importedClips } } : g));
  };

  const handleGenerateTimeline = async (agentId: string) => {
      const agent = storyboards.find(g => g.id === agentId);
      if (!agent) return;

      setGeneratingAgents(prev => new Set(prev).add(agentId));
      setError(null);

      try {
          let mvScenes: any[] = [];
          let audioUrl: string | undefined = undefined;

          if (agent.inputs) {
              for (const inputId of agent.inputs) {
                  const inputNode = storyboards.find(n => n.id === inputId);
                  if (inputNode?.type === 'mv_storyboard' && inputNode.config?.mvScenes) {
                      mvScenes = inputNode.config.mvScenes;
                  }
                  if (inputNode?.type === 'music' && inputNode.items.length > 0) {
                      audioUrl = inputNode.items[0].url;
                  }
              }
          }

          if (mvScenes.length === 0) throw new Error("Please connect an MV Storyboard with generated scenes.");
          if (audioUrl) {
             setStoryboards(prev => prev.map(g => g.id === agentId ? { ...g, config: { ...g.config!, timelineAudioUrl: audioUrl } } : g));
          }

          let currentClips: TimelineClip[] = agent.config?.timelineClips || [];
          // Pre-populate placeholders with status 'generating'
          const clipsToGenerate: { index: number, scene: any, clipId: string }[] = [];
          
          for (let i = 0; i < mvScenes.length; i++) {
               const scene = mvScenes[i];
               const sceneId = `scene-${i}`;
               // Skip if already done or if no image
               if (currentClips.some(c => c.sceneId === sceneId && c.status === 'done')) continue;
               if (!scene.imageUrl) continue;
               
               const clipId = crypto.randomUUID();
               const placeholderClip: TimelineClip = {
                   id: clipId,
                   sceneId: sceneId,
                   videoUrl: '', 
                   thumbUrl: scene.imageUrl,
                   duration: 4, 
                   prompt: scene.visualDescription,
                   status: 'generating'
               };
               currentClips.push(placeholderClip);
               clipsToGenerate.push({ index: i, scene, clipId });
          }

          // Initial update to show loading placeholders
          setStoryboards(prev => prev.map(g => g.id === agentId ? { ...g, config: { ...g.config!, timelineClips: [...currentClips] } } : g));

          // Generate one by one
          for (const item of clipsToGenerate) {
              try {
                  const { index, scene, clipId } = item;
                  if (index > 0) await new Promise(resolve => setTimeout(resolve, 2000));
                  
                  const videoUrl = await generateVideoClip(scene.imageUrl, scene.midjourneyPrompt || scene.visualDescription);
                  
                  // Update specific clip to done
                  setStoryboards(prev => prev.map(g => {
                      if (g.id !== agentId) return g;
                      const updatedClips = g.config?.timelineClips?.map(c => {
                          if (c.id === clipId) {
                              return { ...c, videoUrl, status: 'done' as const };
                          }
                          return c;
                      });
                      return { ...g, config: { ...g.config!, timelineClips: updatedClips } };
                  }));
                  
              } catch (clipErr: any) {
                  console.error(`Failed to generate clip`, clipErr);
                   // Update specific clip to error
                   setStoryboards(prev => prev.map(g => {
                      if (g.id !== agentId) return g;
                      const updatedClips = g.config?.timelineClips?.map(c => {
                          if (c.id === item.clipId) {
                              return { ...c, status: 'error' as const, prompt: `Error: ${clipErr.message || "Failed"}` };
                          }
                          return c;
                      });
                      return { ...g, config: { ...g.config!, timelineClips: updatedClips } };
                  }));
              }
          }

      } catch (e: any) {
          setError(e.message || "Timeline generation failed");
      } finally {
          setGeneratingAgents(prev => { const next = new Set(prev); next.delete(agentId); return next; });
      }
  };

  const handleRunAgent = (agentId: string) => {
      const agent = storyboards.find(g => g.id === agentId);
      
      if (agent?.type === 'music_analysis') {
          handleMusicAnalysis(agentId);
      } else if (agent?.type === 'mv_attribute_settings') {
          handleAnalyzeAndConceptualize(agentId);
      } else if (agent?.type === 'mv_storyboard') {
          handleGenerateMVStoryboard(agentId);
      } else if (agent?.type === 'timeline') {
          handleGenerateTimeline(agentId);
      } else {
          handleAgentGenerate(agentId);
      }
  };

  const handleAgentGenerate = async (agentId: string) => {
    saveHistory(); 
    setError(null);
    setGeneratingAgents(prev => new Set(prev).add(agentId));
    try {
        const agent = storyboards.find(g => g.id === agentId);
        if (!agent) throw new Error("Agent not found");
        const config = agent.config || { prompt: '', mode: GenerationMode.GRID_2x2, aspectRatio: AspectRatio.WIDE };
        const referenceImages = await getReferenceImagesForAgent(agent);
        
        let contextFromInputs = "";
        if (agent.inputs) {
            for (const inputId of agent.inputs) {
                const inputNode = storyboards.find(n => n.id === inputId);
                if (inputNode?.type === 'text' && inputNode.config?.prompt) {
                    contextFromInputs += `\nAdditional Context: ${inputNode.config.prompt}`;
                }
            }
        }

        let promptToUse = config.prompt.trim();
        if (referenceImages.length === 0 && !promptToUse && !contextFromInputs.trim()) {
            throw new Error("Please provide a prompt, connect a text node, or connect reference images.");
        }
        if (!promptToUse) promptToUse = "Cinematic storyboard visualization"; 
        promptToUse += contextFromInputs;

        if (config.cameraMove && config.cameraMove !== 'None') promptToUse += `, Camera Movement: ${config.cameraMove}`;
        if (config.lightingStyle && config.lightingStyle !== 'None') promptToUse += `, Lighting Style: ${config.lightingStyle}`;

        let rows = 2, cols = 2;
        if (config.mode === GenerationMode.GRID_3x3) { rows = 3; cols = 3; }
        if (config.mode === GenerationMode.GRID_4x4) { rows = 4; cols = 4; }

        const result = await generateMultiViewGrid(
            promptToUse, 
            rows, 
            cols, 
            config.aspectRatio, 
            ImageSize.K4, 
            referenceImages,
            agent.config?.customSystemPrompt
        );

        const newImages: CanvasItem[] = result.slices.map((url, index) => ({
            id: crypto.randomUUID(),
            url,
            fullGridUrl: result.fullImage,
            prompt: promptToUse, 
            aspectRatio: config.aspectRatio,
            type: 'image',
            timestamp: Date.now() + index
        }));

        const genNodeId = crypto.randomUUID();
        const genNode: StoryboardGroup = {
            id: genNodeId,
            type: 'generation',
            title: `Generated Result (${config.mode})`,
            x: agent.x + 400,
            y: agent.y,
            items: newImages,
            timestamp: Date.now(),
            connections: [],
            inputs: [agentId],
            displayMode: config.mode
        };

        setStoryboards(prev => {
            const updatedAgents = prev.map(g => g.id === agentId ? { ...g, connections: [...g.connections, genNodeId] } : g);
            return [...updatedAgents, genNode];
        });

    } catch (err: any) {
        let message = err.message || "Unknown error";
        if (message.includes("403")) { message = "API Permission Denied. Please ensure a valid API Key."; if (window.aistudio && window.aistudio.openSelectKey) window.aistudio.openSelectKey(); }
        setError(message);
    } finally {
        setGeneratingAgents(prev => { const next = new Set(prev); next.delete(agentId); return next; });
    }
  };

  const handleOpenPromptEditor = (nodeId: string) => { setEditorNodeId(nodeId); };

  const handleSavePrompt = (newPrompt: string) => {
      if (editorNodeId) {
          saveHistory();
          setStoryboards(prev => prev.map(g => g.id === editorNodeId ? { ...g, config: { ...g.config!, customSystemPrompt: newPrompt } } : g));
      }
  };

  const handleResetPrompt = () => {
      if (editorNodeId) {
          saveHistory();
          const node = storyboards.find(n => n.id === editorNodeId);
          let defaultPrompt = '';
          if (node?.type === 'music_analysis') defaultPrompt = DEFAULT_MUSIC_ANALYSIS_PROMPT;
          else if (node?.type === 'mv_attribute_settings') defaultPrompt = DEFAULT_STYLE_GEN_PROMPT;
          else if (node?.type === 'mv_storyboard') defaultPrompt = DEFAULT_STORYBOARD_PROMPT;
          else if (node?.type === 'agent') defaultPrompt = DEFAULT_AGENT_SYSTEM_PROMPT;
          setStoryboards(prev => prev.map(g => g.id === editorNodeId ? { ...g, config: { ...g.config!, customSystemPrompt: defaultPrompt } } : g));
      }
  };

  const editorNode = storyboards.find(n => n.id === editorNodeId);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#000000] text-text-primary font-sans selection:bg-[#007AFF]/40">
      <Cursor />
      <main className="absolute inset-0 z-0">
          <Canvas 
            storyboards={storyboards}
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItemId}
            onSelectNode={handleSelectNode}
            selectedNodeId={selectedNodeId}
            onUpdateStoryboard={handleUpdateStoryboard}
            onRegenerateItem={handleRegenerateItem}
            onDeleteItem={handleDeleteItem}
            onDeleteNode={handleDeleteNode}
            onDuplicateNode={handleDuplicateNode}
            onRenameNode={handleRenameNode}
            onCreateAgent={handleCreateAgent}
            onCreateAssetNode={handleCreateAssetNode}
            onCreateMusicNode={handleCreateMusicNode}
            onCreateMusicAnalysisAgent={handleCreateMusicAnalysisAgent}
            onCreateTextNode={handleCreateTextNode}
            onCreateMVAttributeSettings={handleCreateMVAttributeSettings}
            onCreateMVStoryboard={handleCreateMVStoryboard}
            onCreateTimelineNode={handleCreateTimelineNode}
            onCreateVideoNode={handleCreateVideoNode}
            onRunAgent={handleRunAgent}
            onImportVideos={handleImportVideosToTimeline}
            onUploadDrop={handleAddAsset}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSmartPrompt={handleSmartPrompt}
            generatingAgents={generatingAgents}
            onOpenPromptEditor={handleOpenPromptEditor}
            onResizeNode={handleResizeNode}
          />
      </main>
      <aside className={`absolute top-4 bottom-4 right-4 z-50 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${activeGroup ? 'translate-x-0' : 'translate-x-[120%]'}`}>
          <div className="h-full rounded-[32px] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
              <Inspector 
                selectedGroup={activeGroup}
                selectedItemId={selectedItemId}
                onSelectItem={handleSelectItem}
                onClose={() => setSelectedItemId(undefined)}
                onAnalyze={() => {}}
                onOpenLightbox={(item) => setLightboxItem(item)}
                isAnalyzing={isAnalyzing}
                analysisResult={analysisResult}
              />
          </div>
      </aside>
      
      <SystemPromptEditor 
         isOpen={!!editorNodeId}
         nodeTitle={editorNode?.title || 'System Instruction'}
         prompt={editorNode?.config?.customSystemPrompt || ''}
         onClose={() => setEditorNodeId(null)}
         onSave={handleSavePrompt}
         onReset={handleResetPrompt}
      />

      {lightboxItem && <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}
      {error && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
              <div className="bg-black/60 backdrop-blur-2xl border border-white/10 text-red-400 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4 ring-1 ring-red-500/20">
                  <AlertCircle size={20} className="text-red-500" />
                  <span className="text-sm font-medium">{error}</span>
                  <button onClick={() => setError(null)} className="ml-2 hover:text-white clickable"><X size={16} /></button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
