
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StoryboardGroup, CanvasItem, GenerationMode, AspectRatio, TimelineClip } from '../types';
import { ZoomIn, ZoomOut, Move, GripHorizontal, Download, Trash2, Zap, Image as ImageIcon, Copy, Play, Grid2X2, Grid3X3, LayoutGrid, Wand2, Loader2, Plus, Link, Pencil, Video, Aperture, Sun, ChevronDown, Music, AudioLines, FileAudio, Pause, Volume2, Sparkles, Type, Settings, User, Clapperboard, Film, Maximize2, FileText, RefreshCw, Layers, Scissors, FileVideo, Import } from 'lucide-react';
import JSZip from 'jszip';

interface CanvasProps {
  storyboards: StoryboardGroup[];
  onSelectItem: (item: CanvasItem) => void;
  selectedItemId: string | undefined;
  onSelectNode: (nodeId: string | null) => void;
  selectedNodeId: string | null;
  onUpdateStoryboard: (updatedGroup: StoryboardGroup) => void;
  onRegenerateItem: (item: CanvasItem) => void;
  onDeleteItem: (itemId: string, groupId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newTitle: string) => void;
  onCreateAgent: (x: number, y: number) => void;
  onCreateAssetNode: (x: number, y: number) => void;
  onCreateMusicNode: (x: number, y: number) => void;
  onCreateMusicAnalysisAgent: (x: number, y: number) => void;
  onCreateTextNode: (x: number, y: number) => void;
  onCreateMVAttributeSettings: (x: number, y: number) => void;
  onCreateMVStoryboard: (x: number, y: number) => void;
  onCreateTimelineNode: (x: number, y: number) => void;
  onCreateVideoNode: (x: number, y: number) => void;
  onRunAgent: (agentId: string) => void;
  onImportVideos: (timelineNodeId: string) => void;
  onUploadDrop: (files: FileList, x: number, y: number, targetNodeId?: string) => void;
  onConnect: (sourceNodeId: string, targetNodeId: string) => void;
  onDisconnect: (sourceNodeId: string, targetNodeId: string) => void;
  onSmartPrompt: (agentId: string) => void;
  generatingAgents: Set<string>;
  onOpenPromptEditor: (nodeId: string) => void;
  onResizeNode: (nodeId: string, width: number, height: number) => void;
}

// --- CONSTANTS FOR GEOMETRY ---
const HEADER_HEIGHT = 64;
const HEADER_CENTER_Y = HEADER_HEIGHT / 2; // 32px
const HANDLE_OFFSET = 12; // 12px outside the node
const NODE_WIDTH_AGENT = 360; 
const NODE_WIDTH_ASSET = 300;
const NODE_WIDTH_VIDEO = 320;
const NODE_WIDTH_MUSIC = 320;
const NODE_WIDTH_TEXT = 400;
const NODE_WIDTH_MV_SETTINGS = 480; 
const NODE_WIDTH_MV_STORYBOARD = 520; 
const NODE_WIDTH_GENERATION = 400;
const NODE_WIDTH_TIMELINE = 900;

// --- PRESETS ---
const CAMERA_PRESETS = ["None", "Pan Left", "Pan Right", "Zoom In", "Zoom Out", "Tilt Up", "Tilt Down", "Tracking Shot"];
const LIGHTING_PRESETS = ["None", "Golden Hour", "Cyberpunk", "Cinematic", "Natural Light", "Studio", "Dramatic"];

// --- COMPONENT: PORT HANDLE ---
const PortHandle: React.FC<{ 
  type: 'input' | 'output'; 
  nodeId: string;
  isConnected?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}> = ({ type, nodeId, isConnected, onMouseDown }) => {
  const isInput = type === 'input';
  
  return (
    <div
      className={`absolute z-[50] w-6 h-6 flex items-center justify-center cursor-crosshair group/port transition-transform duration-200 hover:scale-125 pointer-events-auto`}
      style={{
        top: `${HEADER_CENTER_Y}px`, // 32px
        transform: 'translateY(-50%)',
        [isInput ? 'left' : 'right']: `-${HANDLE_OFFSET}px`, // -12px
      }}
      onMouseDown={(e) => { 
        e.stopPropagation(); 
        onMouseDown?.(e); 
      }}
      data-port-type={type}
      data-node-id={nodeId}
    >
        <div className={`
            w-3.5 h-3.5 rounded-full border border-white/40 shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-300
            flex items-center justify-center relative backdrop-blur-md pointer-events-none
            bg-[#1c1c1e]
            ${isConnected ? 'ring-2 ring-[#007AFF]/60 border-[#007AFF]' : 'hover:ring-2 hover:ring-[#007AFF]/40 hover:border-white/60'}
        `}>
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isConnected ? 'bg-[#007AFF] shadow-[0_0_6px_#007AFF]' : 'bg-white/20 group-hover/port:bg-[#007AFF]/80'}`} />
        </div>
        <div className="absolute inset-[-8px] rounded-full bg-transparent" />
    </div>
  );
};

// --- COMPONENT: AUDIO PLAYER WITH WAVEFORM ---
const AudioPlayer: React.FC<{ url: string; title?: string }> = ({ url, title }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

    useEffect(() => {
        let audioContext: AudioContext | null = null;
        let isMounted = true;

        const loadAudio = async () => {
            if (!url) return;
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                
                if (arrayBuffer.byteLength === 0) return;
                
                if (!isMounted) return;

                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                audioContext = new AudioContext();
                
                const decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
                    audioContext!.decodeAudioData(arrayBuffer, resolve, reject);
                });

                if (isMounted) {
                    setAudioBuffer(decodedBuffer);
                    setDuration(decodedBuffer.duration);
                }
            } catch (e) {
                console.error("Failed to load audio for waveform", e);
            } finally {
                if (audioContext && audioContext.state !== 'closed') {
                    audioContext.close().catch(() => {});
                }
            }
        };
        loadAudio();

        return () => {
            isMounted = false;
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(() => {});
            }
        };
    }, [url]);

    const drawWaveform = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !audioBuffer) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const data = audioBuffer.getChannelData(0); 
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.clearRect(0, 0, width, height);

        const playedColor = '#ec4899'; 
        const remainingColor = 'rgba(255, 255, 255, 0.2)'; 

        for (let i = 0; i < width; i+=2) { 
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            
            const barHeight = Math.max(2, (max - min) * amp);
            const progressPct = duration > 0 ? currentTime / duration : 0;
            const barPct = i / width;
            
            ctx.fillStyle = barPct <= progressPct ? playedColor : remainingColor;
            
            const x = i;
            const y = (height - barHeight) / 2;
            
            ctx.fillRect(x, y, 1.5, barHeight);
        }
    }, [audioBuffer, currentTime, duration]);

    useEffect(() => {
        let animationId: number;
        const loop = () => {
            if (audioRef.current && !audioRef.current.paused) {
                setCurrentTime(audioRef.current.currentTime);
                animationId = requestAnimationFrame(loop);
            }
            drawWaveform();
        };

        if (isPlaying) {
            loop();
        } else {
            drawWaveform();
        }

        return () => { if (animationId) cancelAnimationFrame(animationId); };
    }, [isPlaying, drawWaveform]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!audioRef.current || !duration) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.min(1, Math.max(0, x / rect.width));
        const newTime = pct * duration;
        
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        drawWaveform();
    };

    const formatTime = (time: number) => {
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 text-text-primary shadow-inner border border-white/10 w-full">
            <audio 
                ref={audioRef} 
                src={url} 
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
            />
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/10 rounded-full shadow-sm text-pink-500 ring-1 ring-white/10">
                   <Music size={14} />
                </div>
                <div className="flex-1 truncate text-xs font-bold text-text-primary/90">
                    {title || "Audio Track"}
                </div>
                <div className="text-[9px] font-mono text-text-secondary">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="hover:text-pink-500 transition-colors text-text-primary shrink-0">
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <div className="flex-1 h-8 relative group cursor-pointer">
                    <canvas 
                        ref={canvasRef}
                        width={220}
                        height={32}
                        onClick={handleWaveformClick}
                        className="w-full h-full rounded-md opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: TIMELINE PLAYER ---
const TimelinePlayer: React.FC<{ 
    clips: TimelineClip[], 
    audioUrl?: string,
    onExtractClip: (clip: TimelineClip) => void,
    isHovered: boolean,
    onUpdateClips: (clips: TimelineClip[]) => void
}> = ({ clips, audioUrl, onExtractClip, isHovered, onUpdateClips }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(60); 
    const [audioDuration, setAudioDuration] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    
    // Scaling
    const [pixelsPerSecond, setPixelsPerSecond] = useState(40); // Base zoom level
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Audio Buffer State for Timeline Waveform
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

    // Interactive States
    const [resizingState, setResizingState] = useState<{ id: string, startX: number, startDuration: number } | null>(null);
    const [draggedClipIndex, setDraggedClipIndex] = useState<number | null>(null);

    // Update total duration based on clips, but min 60s as requested
    useEffect(() => {
        const clipsDur = clips.reduce((acc, clip) => acc + clip.duration, 0);
        setTotalDuration(Math.max(clipsDur, audioDuration, 60)); 
    }, [clips, audioDuration]);

    // Keyboard controls for Spacebar Play/Pause
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isHovered && e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                setIsPlaying(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isHovered]);

    // --- RESIZING EFFECT ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingState) return;
            e.preventDefault();
            
            const deltaPixels = e.clientX - resizingState.startX;
            const deltaTime = deltaPixels / pixelsPerSecond;
            const newDuration = Math.max(0.5, resizingState.startDuration + deltaTime); // Min 0.5s duration
            
            const updatedClips = clips.map(c => 
                c.id === resizingState.id ? { ...c, duration: newDuration } : c
            );
            onUpdateClips(updatedClips);
        };

        const handleMouseUp = () => {
            setResizingState(null);
            document.body.style.cursor = 'default';
        };

        if (resizingState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingState, pixelsPerSecond, clips, onUpdateClips]);

    // --- AUDIO BUFFER LOADING ---
    useEffect(() => {
        if (!audioUrl) {
            setAudioBuffer(null);
            setAudioDuration(0);
            return;
        }
        
        let audioContext: AudioContext | null = null;
        let isMounted = true;

        const loadAudio = async () => {
            try {
                const response = await fetch(audioUrl);
                const arrayBuffer = await response.arrayBuffer();
                if (!isMounted) return;

                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                audioContext = new AudioContext();
                const decoded = await audioContext.decodeAudioData(arrayBuffer);
                if (isMounted) {
                    setAudioBuffer(decoded);
                    setAudioDuration(decoded.duration);
                }
            } catch (e) {
                console.error("Timeline audio load failed", e);
            } finally {
                if (audioContext && audioContext.state !== 'closed') {
                    audioContext.close().catch(() => {});
                }
            }
        };
        loadAudio();
        return () => { 
            isMounted = false; 
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(() => {});
            } 
        };
    }, [audioUrl]);

    // --- TIMELINE WAVEFORM DRAWING ---
    const drawTimelineWaveform = useCallback(() => {
        const canvas = waveformCanvasRef.current;
        if (!canvas || !audioBuffer) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const data = audioBuffer.getChannelData(0); 
        
        const totalPixelsForAudio = audioBuffer.duration * pixelsPerSecond;
        const step = Math.ceil(data.length / totalPixelsForAudio);
        const amp = height / 2;

        const playedColor = '#ec4899'; // Pink
        const remainingColor = 'rgba(255, 255, 255, 0.2)'; // Faint White

        // Only iterate up to what fits in the audio
        const drawWidth = Math.min(width, totalPixelsForAudio);

        for (let i = 0; i < drawWidth; i+=2) { 
            let min = 1.0;
            let max = -1.0;
            
            const startSample = Math.floor(i * step);
            // safe check
            if (startSample >= data.length) break;

            for (let j = 0; j < step; j++) {
                const idx = startSample + j;
                if (idx < data.length) {
                    const datum = data[idx];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
            }
            
            const barHeight = Math.max(2, (max - min) * amp);
            
            // Current Time sync
            const timeAtPixel = i / pixelsPerSecond;
            
            ctx.fillStyle = timeAtPixel <= currentTime ? playedColor : remainingColor;
            
            const x = i;
            const y = (height - barHeight) / 2;
            
            ctx.fillRect(x, y, 1.5, barHeight);
        }
    }, [audioBuffer, pixelsPerSecond, currentTime]);

    useEffect(() => {
        drawTimelineWaveform();
    }, [drawTimelineWaveform]);


    // --- SYNC LOOP ---
    const animate = useCallback(() => {
        if (isPlaying) {
            const now = performance.now();
            if (lastFrameTimeRef.current === 0) lastFrameTimeRef.current = now;
            const dt = (now - lastFrameTimeRef.current) / 1000;
            lastFrameTimeRef.current = now;

            let nextTime = currentTime;
            
            if (audioRef.current && !audioRef.current.paused) {
                // Master Clock: Audio
                nextTime = audioRef.current.currentTime;
                if (audioRef.current.ended) {
                    setIsPlaying(false);
                    return;
                }
            } else {
                // Master Clock: System Time Delta
                nextTime = currentTime + dt; 
            }

            if (nextTime >= totalDuration) {
                setIsPlaying(false);
                nextTime = 0;
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                }
            }
            
            setCurrentTime(nextTime);
            syncVideo(nextTime);
            drawTimelineWaveform(); // Update playhead color on waveform
            
            requestRef.current = requestAnimationFrame(animate);
        } else {
            lastFrameTimeRef.current = 0;
        }
    }, [isPlaying, totalDuration, currentTime, drawTimelineWaveform]);

    const syncVideo = (time: number) => {
        if (!videoRef.current || clips.length === 0) return;

        let accumTime = 0;
        let activeClip: TimelineClip | null = null;
        let clipStartTime = 0;

        for (const clip of clips) {
            if (time >= accumTime && time < accumTime + clip.duration) {
                activeClip = clip;
                clipStartTime = accumTime;
                break;
            }
            accumTime += clip.duration;
        }

        if (activeClip) {
            const currentClipId = videoRef.current.getAttribute('data-clip-id');
            // Check if source changed or if src is empty (which happens if it was previously reset or failed)
            // Robust check for blob/remote URLs
            if ((currentClipId !== activeClip.id || !videoRef.current.src) && activeClip.videoUrl) {
                 videoRef.current.src = activeClip.videoUrl;
                 videoRef.current.setAttribute('data-clip-id', activeClip.id);
                 videoRef.current.load();
            }

            // Sync Time within clip
            const localTime = time - clipStartTime;
            
            // Limit localTime to valid range to prevent seeking past end
            const duration = videoRef.current.duration;
            // Use 0.1s buffer from end if duration is known
            const safeTime = (isFinite(duration) && duration > 0) 
                ? Math.min(localTime, duration - 0.1) 
                : localTime;

            // Allow small drift to prevent stutter, but sync if off
            const drift = Math.abs(videoRef.current.currentTime - safeTime);
            
            if (isPlaying) {
                // Attempt to play if paused
                if (videoRef.current.paused) {
                    const playPromise = videoRef.current.play();
                    if (playPromise !== undefined) playPromise.catch(() => {});
                }
                // Sync drift - tighter threshold (0.3s) and ensure metadata loaded
                if (drift > 0.3 && videoRef.current.readyState >= 1) {
                    videoRef.current.currentTime = safeTime;
                }
            } else {
                if (!videoRef.current.paused) videoRef.current.pause();
                // When paused, seek more accurately
                if (videoRef.current.readyState >= 1 && drift > 0.05) {
                    videoRef.current.currentTime = safeTime;
                }
            }
            
            // Make sure video is visible
            videoRef.current.style.opacity = '1';
        } else {
            // No clip at this time
            if (!videoRef.current.paused) videoRef.current.pause();
            videoRef.current.style.opacity = '0'; // Hide video element if no clip
        }
    };

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
            if (audioRef.current) audioRef.current.play().catch(() => {});
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (audioRef.current) audioRef.current.pause();
            if (videoRef.current) videoRef.current.pause();
            lastFrameTimeRef.current = 0;
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPlaying, animate]);

    // Manual Seek
    const handleSeek = (time: number) => {
        setCurrentTime(time);
        if (audioRef.current) audioRef.current.currentTime = time;
        syncVideo(time);
        drawTimelineWaveform();
    };

    // Format: MM:SS:FF (24fps)
    const formatTimecode = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const f = Math.floor((t % 1) * 24);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}:${f < 10 ? '0' : ''}${f}`;
    };

    const handleExport = async () => {
        if (clips.length === 0) return;
        setIsExporting(true);
        try {
            const zip = new JSZip();
            const folder = zip.folder("storyboard_videos");
            
            // Fetch all videos
            const promises = clips.map(async (clip, index) => {
                try {
                    const response = await fetch(clip.videoUrl);
                    const blob = await response.blob();
                    folder?.file(`scene_${index + 1}_${clip.id.substring(0,4)}.mp4`, blob);
                } catch (e) {
                    console.error("Failed to download clip", clip, e);
                }
            });

            await Promise.all(promises);
            
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement("a");
            a.href = url;
            a.download = `wenvis_export_${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed. Please check console.");
        } finally {
            setIsExporting(false);
        }
    };

    const totalWidth = Math.max(containerRef.current?.clientWidth || 0, totalDuration * pixelsPerSecond);

    return (
        <div 
            className="flex flex-col h-full bg-[#0e0e0e] rounded-xl overflow-hidden select-none"
            onMouseDown={(e) => e.stopPropagation()} // Stop propagation to prevent canvas drag
            onWheel={(e) => e.stopPropagation()} // Stop propagation to prevent canvas zoom/pan
        >
            {/* Top: Preview Player */}
            <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden border-b border-white/10 group">
                <video 
                    ref={videoRef}
                    className="h-full w-full object-contain"
                    muted // Muted as we rely on the audio track
                    playsInline
                />
                
                {/* Overlay Play Button */}
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all cursor-pointer" onClick={() => setIsPlaying(true)}>
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl hover:scale-110 transition-transform">
                            <Play size={32} fill="white" className="text-white ml-1" />
                        </div>
                    </div>
                )}

                {/* Audio Element (Master Clock) */}
                <audio ref={audioRef} src={audioUrl} />
            </div>

            {/* Middle: Toolbar */}
            <div className="h-10 border-b border-white/10 bg-[#141414] flex items-center px-4 justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider">Timecode (24fps)</span>
                        <div className="font-mono text-[#007AFF] text-xs font-bold tracking-tight">
                            {formatTimecode(currentTime)} <span className="text-white/30">/ {formatTimecode(totalDuration)}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                     <button onClick={() => { setIsPlaying(!isPlaying); if (!isPlaying) syncVideo(currentTime); }} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                     </button>
                     <button 
                        onClick={handleExport}
                        disabled={isExporting || clips.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-[#007AFF] rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                     >
                         {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                         Export
                     </button>
                </div>

                <div className="w-32 flex items-center gap-2">
                    <ZoomOut size={12} className="text-white/30" />
                    <input 
                        type="range" 
                        min="10" 
                        max="100" 
                        value={pixelsPerSecond} 
                        onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none thumb:bg-white cursor-ew-resize" 
                    />
                    <ZoomIn size={12} className="text-white/30" />
                </div>
            </div>

            {/* Bottom: Timeline Tracks */}
            <div className="h-[220px] bg-[#0a0a0a] relative overflow-x-auto custom-scrollbar" ref={containerRef}>
                <div className="absolute top-0 left-0 h-full" style={{ width: totalWidth, minWidth: '100%' }}>
                    
                    {/* 1. Time Ruler */}
                    <div className="h-6 border-b border-white/5 bg-[#141414] sticky top-0 z-20 flex items-end">
                         {Array.from({length: Math.ceil(totalDuration) + 1}).map((_, i) => (
                             <div key={i} className="absolute bottom-0 border-l border-white/20 h-2 flex flex-col justify-end" style={{ left: i * pixelsPerSecond }}>
                                 <span className="text-[9px] text-white/40 font-mono ml-1 -mb-1">{i}s</span>
                             </div>
                         ))}
                         {/* Sub-ticks */}
                         {Array.from({length: Math.ceil(totalDuration) * 4}).map((_, i) => (
                             <div key={`sub-${i}`} className="absolute bottom-0 border-l border-white/10 h-1" style={{ left: i * (pixelsPerSecond / 4) }} />
                         ))}
                    </div>

                    {/* Playhead & Click-to-Seek Area */}
                    <div 
                        className="absolute inset-0 z-30 cursor-crosshair"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left + e.currentTarget.scrollLeft; 
                            const clickX = e.nativeEvent.offsetX;
                            const t = Math.max(0, Math.min(totalDuration, clickX / pixelsPerSecond));
                            handleSeek(t);
                        }}
                    >
                        <div 
                            className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-40 pointer-events-none"
                            style={{ left: currentTime * pixelsPerSecond }}
                        >
                            <div className="w-3 h-3 -ml-[5px] bg-red-500 transform rotate-45 -mt-1.5 shadow-[0_0_10px_rgba(255,0,0,0.5)] border border-white/20"></div>
                        </div>
                    </div>

                    {/* 2. Video Track */}
                    <div className="mt-2 h-[80px] bg-white/5 relative flex items-center border-y border-white/5 px-0.5">
                        {clips.length === 0 && <span className="absolute left-4 text-[10px] text-white/20 uppercase pointer-events-none">Video Track Empty</span>}
                        {clips.map((clip, i) => {
                            // Calculate position based on previous clips
                            let startTime = 0;
                            for (let j = 0; j < i; j++) startTime += clips[j].duration;
                            
                            const isGenerating = clip.status === 'generating';
                            const isError = clip.status === 'error';
                            const isActive = currentTime >= startTime && currentTime < startTime + clip.duration;
                            
                            return (
                                <div 
                                    key={clip.id}
                                    draggable={!resizingState} // Enable dragging if not resizing
                                    onDragStart={(e) => {
                                        setDraggedClipIndex(i);
                                        e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault(); // Enable dropping
                                        e.dataTransfer.dropEffect = 'move';
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (draggedClipIndex !== null && draggedClipIndex !== i) {
                                            const newClips = [...clips];
                                            const [removed] = newClips.splice(draggedClipIndex, 1);
                                            newClips.splice(i, 0, removed);
                                            onUpdateClips(newClips);
                                        }
                                        setDraggedClipIndex(null);
                                    }}
                                    className={`absolute top-1 bottom-1 bg-black/40 border rounded overflow-hidden group cursor-pointer transition-colors
                                        ${isActive ? 'border-yellow-500/80 ring-1 ring-yellow-500/20' : 'border-white/10 hover:border-white/40 hover:bg-white/5'}
                                    `}
                                    style={{ 
                                        left: startTime * pixelsPerSecond, 
                                        width: clip.duration * pixelsPerSecond 
                                    }}
                                >
                                    <div className="relative w-full h-full">
                                        {/* Content Area */}
                                        {isGenerating ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a] animate-pulse">
                                                <Loader2 size={16} className="text-[#007AFF] animate-spin mb-1" />
                                                <span className="text-[8px] font-bold text-text-secondary uppercase tracking-wider">Generating</span>
                                            </div>
                                        ) : isError ? (
                                             <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-red-300 bg-black/80 px-2 py-1 rounded">Generation Failed</span>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Use video tag if thumbUrl is a blob (likely imported video), otherwise use img (generated) */}
                                                {(clip.thumbUrl && clip.thumbUrl.startsWith('blob:') && clip.videoUrl === clip.thumbUrl) ? (
                                                    <video 
                                                        src={clip.thumbUrl} 
                                                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" 
                                                        muted 
                                                        onLoadedData={(e) => e.currentTarget.currentTime = 0} // Seek to start to show frame
                                                    />
                                                ) : (
                                                    <img src={clip.thumbUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                )}
                                                
                                                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent pointer-events-none" />
                                                <span className="absolute top-1 left-1 text-[9px] font-mono text-white/70 drop-shadow-md truncate max-w-full px-1">{clip.prompt}</span>
                                                <span className="absolute bottom-1 right-1 text-[8px] font-mono text-white/50 bg-black/50 px-1 rounded">{clip.duration.toFixed(1)}s</span>
                                                
                                                {/* Copy/Extract Button */}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onExtractClip(clip); }}
                                                    className="absolute top-1 right-1 p-1.5 bg-black/60 hover:bg-[#007AFF] text-white rounded-md opacity-0 group-hover:opacity-100 transition-all z-50 shadow-lg border border-white/10"
                                                    title="Copy to Canvas"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            </>
                                        )}

                                        {/* Resize Handle */}
                                        {!isGenerating && !isError && (
                                            <div 
                                                className="absolute top-0 bottom-0 right-0 w-3 cursor-ew-resize hover:bg-blue-500/50 z-50 flex items-center justify-center transition-colors group/handle"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    setResizingState({ id: clip.id, startX: e.clientX, startDuration: clip.duration });
                                                }}
                                            >
                                                <div className="w-0.5 h-4 bg-white/50 rounded-full group-hover/handle:bg-white" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 3. Audio Track (Real Waveform) */}
                    <div className="mt-1 h-[60px] bg-[#111] relative flex items-center border-y border-white/5 overflow-hidden">
                        {audioUrl ? (
                            <canvas 
                                ref={waveformCanvasRef}
                                width={totalWidth}
                                height={60}
                                className="absolute inset-0 w-full h-full pointer-events-none"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] text-white/20 uppercase pointer-events-none">Audio Track Empty</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const NodeTitle: React.FC<{ title: string; onRename: (newTitle: string) => void }> = ({ title, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState(title);

    useEffect(() => {
        setTempTitle(title);
    }, [title]);

    const handleBlur = () => {
        setIsEditing(false);
        if (tempTitle.trim()) onRename(tempTitle);
        else setTempTitle(title);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') handleBlur();
        if (e.key === 'Escape') {
            setIsEditing(false);
            setTempTitle(title);
        }
    };

    if (isEditing) {
        return (
            <input 
                autoFocus
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
                className="bg-transparent text-white font-bold text-[14px] outline-none border-b border-[#007AFF] w-full"
            />
        );
    }

    return (
        <span 
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="text-[14px] font-bold text-text-primary truncate max-w-[180px] cursor-text select-none"
        >
            {title}
        </span>
    );
};

export const Canvas: React.FC<CanvasProps> = ({ 
  storyboards, 
  onSelectItem, 
  selectedItemId, 
  onSelectNode,
  selectedNodeId,
  onUpdateStoryboard,
  onRegenerateItem,
  onDeleteItem,
  onDeleteNode,
  onDuplicateNode,
  onRenameNode,
  onCreateAgent,
  onCreateAssetNode,
  onCreateMusicNode,
  onCreateMusicAnalysisAgent,
  onCreateTextNode,
  onCreateMVAttributeSettings,
  onCreateMVStoryboard,
  onCreateTimelineNode,
  onCreateVideoNode,
  onRunAgent,
  onImportVideos,
  onUploadDrop,
  onConnect,
  onDisconnect,
  onSmartPrompt,
  generatingAgents,
  onOpenPromptEditor,
  onResizeNode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false); 
  
  const [selectedConnection, setSelectedConnection] = useState<{source: string, target: string} | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{nodeId: string, x: number, y: number} | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const isSpacePressed = useRef(false);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Resizing State
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState<{nodeId: string, x: number, y: number, initialWidth: number, initialHeight: number} | null>(null);
  
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, nodeId?: string} | null>(null);

  const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
    <div className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1.5 px-0.5">
        {label}
    </div>
  );

  const screenToCanvas = useCallback((sx: number, sy: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const bounds = containerRef.current.getBoundingClientRect();
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    return {
        x: (sx - bounds.left - position.x - centerX) / scale,
        y: (sy - bounds.top - position.y - centerY) / scale
    };
  }, [position, scale]);

  const handleExtractClip = (clip: TimelineClip, parentNode: StoryboardGroup) => {
      // clip extraction logic
  };

  const getNodeWidth = (group: StoryboardGroup) => {
      if (group.width) return group.width;
      
      switch(group.type) {
          case 'agent': return NODE_WIDTH_AGENT;
          case 'music': return NODE_WIDTH_MUSIC;
          case 'text_result': return NODE_WIDTH_TEXT;
          case 'text': return NODE_WIDTH_TEXT;
          case 'mv_attribute_settings': return NODE_WIDTH_MV_SETTINGS;
          case 'mv_storyboard': return NODE_WIDTH_MV_STORYBOARD;
          case 'music_analysis': return NODE_WIDTH_TEXT; 
          case 'generation': return NODE_WIDTH_GENERATION;
          case 'timeline': return NODE_WIDTH_TIMELINE;
          case 'video': return NODE_WIDTH_VIDEO;
          default: return NODE_WIDTH_ASSET;
      }
  };

  const getNodeHeight = (group: StoryboardGroup) => {
    if (group.height) return group.height;
    return undefined; // auto
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setMousePos(canvasPos);

      // Handle Resize
      if (isResizing && resizeStart) {
          const deltaX = (e.clientX - resizeStart.x) / scale;
          const deltaY = (e.clientY - resizeStart.y) / scale;
          
          const newWidth = Math.max(300, resizeStart.initialWidth + deltaX);
          const newHeight = Math.max(200, resizeStart.initialHeight + deltaY); 
          
          onResizeNode(resizeStart.nodeId, newWidth, newHeight);
          return;
      }

      if (isPanning) {
          setPosition(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
          return;
      }

      if (draggingGroupId) {
         const group = storyboards.find(g => g.id === draggingGroupId);
         if (group) {
             onUpdateStoryboard({
                 ...group,
                 x: canvasPos.x - dragOffset.x,
                 y: canvasPos.y - dragOffset.y
             });
         }
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
        if (isConnecting && connectionStart) {
            const target = e.target as HTMLElement;
            const portNodeId = target.closest('[data-port-type="input"]')?.getAttribute('data-node-id');
            const nodeBodyId = target.closest('.storyboard-node')?.getAttribute('data-node-id');
            const targetId = portNodeId || nodeBodyId;

            if (targetId && targetId !== connectionStart.nodeId) {
                onConnect(connectionStart.nodeId, targetId);
            }
        }

        setIsPanning(false);
        setDraggingGroupId(null);
        setIsConnecting(false);
        setConnectionStart(null);
        setIsResizing(false);
        setResizeStart(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent canvas panning logic if hovering a timeline node that uses Space for playback
        const hoveredNode = storyboards.find(n => n.id === hoveredNodeId);
        if (hoveredNode?.type === 'timeline' && e.code === 'Space') {
            return; 
        }

        if (e.code === 'Space') {
            isSpacePressed.current = true;
            setIsSpaceDown(true); // Update state to trigger pointer-events change
            document.body.style.cursor = 'grab';
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedConnection) {
                onDisconnect(selectedConnection.source, selectedConnection.target);
                setSelectedConnection(null);
            }
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            isSpacePressed.current = false;
            setIsSpaceDown(false);
            document.body.style.cursor = 'default';
            setIsPanning(false);
        }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPanning, draggingGroupId, isConnecting, connectionStart, dragOffset, onUpdateStoryboard, onConnect, onDisconnect, screenToCanvas, storyboards, selectedNodeId, selectedConnection, isResizing, resizeStart, onResizeNode, scale, hoveredNodeId]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      setContextMenu(null);
      if (isSpacePressed.current || e.button === 1) {
          setIsPanning(true);
          return;
      }
      
      if (!(e.target as HTMLElement).closest('path') && !(e.target as HTMLElement).closest('.storyboard-node')) {
          setSelectedConnection(null);
          onSelectNode(null);
          onSelectItem({} as any);
      }
  };

  const handleStartConnection = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      e.preventDefault();
      
      const node = storyboards.find(n => n.id === nodeId);
      if (node) {
          const width = getNodeWidth(node);
          const startX = node.x + width + HANDLE_OFFSET;
          const startY = node.y + HEADER_CENTER_Y;
          setConnectionStart({ nodeId, x: startX, y: startY });
          setIsConnecting(true);
      }
  };

  const handleResizeStart = (e: React.MouseEvent, node: StoryboardGroup) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      setResizeStart({
          nodeId: node.id,
          x: e.clientX,
          y: e.clientY,
          initialWidth: getNodeWidth(node),
          initialHeight: getNodeHeight(node) || 200
      });
  }

  const renderExistingConnections = () => {
      const lines = [];
      storyboards.forEach(sourceNode => {
          if (!sourceNode.connections) return;
          sourceNode.connections.forEach(targetId => {
              const targetNode = storyboards.find(n => n.id === targetId);
              if (!targetNode) return;

              const sourceWidth = getNodeWidth(sourceNode);
              
              const x1 = sourceNode.x + sourceWidth + HANDLE_OFFSET; 
              const y1 = sourceNode.y + HEADER_CENTER_Y;
              const x2 = targetNode.x - HANDLE_OFFSET; 
              const y2 = targetNode.y + HEADER_CENTER_Y;

              const isSelected = selectedConnection?.source === sourceNode.id && selectedConnection?.target === targetId;

              const dist = Math.abs(x2 - x1);
              const c1x = x1 + dist * 0.5;
              const c1y = y1;
              const c2x = x2 - dist * 0.5;
              const c2y = y2;
              const pathData = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

              lines.push(
                  <g key={`${sourceNode.id}-${targetId}`} 
                     onClick={(e) => { e.stopPropagation(); setSelectedConnection({ source: sourceNode.id, target: targetId }); }}
                     className="group/line cursor-pointer pointer-events-auto"
                  >
                      <path d={pathData} stroke="transparent" strokeWidth="20" fill="none" />
                      <path 
                        d={pathData} 
                        stroke={isSelected ? "#007AFF" : "#86868b"} 
                        strokeWidth={isSelected ? "3" : "2"} 
                        strokeOpacity={isSelected ? 0.8 : 0.3}
                        strokeDasharray="6, 6"
                        fill="none" 
                      />
                      <path 
                        d={pathData} 
                        stroke={isSelected ? "#60A5FA" : "#007AFF"} 
                        strokeWidth="2" 
                        strokeDasharray="10, 10"
                        strokeDashoffset="0"
                        fill="none" 
                        className="animate-[flow_1s_linear_infinite]"
                      />
                  </g>
              );
          });
      });
      return lines;
  };

  const renderDraggingLine = () => {
      if (isConnecting && connectionStart) {
          const { x: x1, y: y1 } = connectionStart;
          const { x: x2, y: y2 } = mousePos;
          
          const dist = Math.abs(x2 - x1);
          const c1x = x1 + dist * 0.5;
          const c1y = y1;
          const c2x = x2 - dist * 0.5;
          const c2y = y2;
          const pathData = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

          return (
              <path 
                d={pathData} 
                stroke="#007AFF" 
                strokeWidth="2.5" 
                strokeDasharray="6,4" 
                fill="none" 
                className="animate-pulse drop-shadow-md"
              />
          );
      }
      return null;
  };

  const copyScript = (scenes: any[]) => {
      const text = scenes.map(s => `[${s.timeCode}] ${s.visualDescription} (${s.cameraMovement})`).join('\n');
      navigator.clipboard.writeText(text);
  };

  return (
    <div 
        className="relative w-full h-full overflow-hidden bg-[#000000] select-none font-sans"
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length > 0) {
                 const pos = screenToCanvas(e.clientX, e.clientY);
                 onUploadDrop(e.dataTransfer.files, pos.x, pos.y);
            }
        }}
    >
      <style>{`
        @keyframes flow {
          to { stroke-dashoffset: -20; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* --- SVG Layer (Z-Index 0) --- */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div 
            style={{ 
                transform: `translate(${position.x + (containerRef.current?.clientWidth || 0)/2}px, ${position.y + (containerRef.current?.clientHeight || 0)/2}px) scale(${scale})`,
                transformOrigin: '0 0',
            }}
          >
             <svg className="overflow-visible w-full h-full">
                 {renderExistingConnections()}
             </svg>
          </div>
      </div>

      {/* --- HTML Node Layer --- */}
      <div 
        ref={containerRef}
        className={`w-full h-full ${isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        onMouseDown={handleCanvasMouseDown}
        onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                setScale(s => Math.min(Math.max(0.2, s - e.deltaY * 0.001), 3));
            } else {
                setPosition(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
            }
        }}
      >
        <div 
            style={{ 
                transform: `translate(${position.x + (containerRef.current?.clientWidth || 0)/2}px, ${position.y + (containerRef.current?.clientHeight || 0)/2}px) scale(${scale})`,
                transformOrigin: '0 0',
            }}
            className="absolute top-0 left-0 w-0 h-0"
        >
             <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center opacity-[0.03] pointer-events-none select-none mix-blend-multiply">
                 <span className="text-[80px] font-bold tracking-tighter text-white leading-none">Wenvis</span>
                 <span className="text-[24px] tracking-[0.8em] text-white font-light uppercase mt-4">AILab</span>
             </div>

             {storyboards.map(group => (
                 <div
                    key={group.id}
                    data-node-id={group.id}
                    className={`absolute storyboard-node flex flex-col rounded-[32px] animate-fade-in
                        ${selectedNodeId === group.id ? 'ring-1 ring-[#007AFF] shadow-[0_0_30px_-5px_rgba(0,122,255,0.3)] scale-[1.002]' : 'hover:shadow-2xl hover:scale-[1.001]'}
                    `}
                    style={{ 
                        width: getNodeWidth(group),
                        height: getNodeHeight(group),
                        transform: `translate(${group.x}px, ${group.y}px)`,
                        zIndex: draggingGroupId === group.id ? 100 : 10,
                        transition: draggingGroupId === group.id ? 'none' : isResizing ? 'none' : 'box-shadow 0.3s ease, transform 0.1s cubic-bezier(0.2, 0, 0.2, 1)' 
                    }}
                    onMouseEnter={() => setHoveredNodeId(group.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onMouseDown={(e) => {
                        // Allow dragging canvas if space is pressed
                        if (isSpacePressed.current) return;
                        e.stopPropagation();
                        onSelectNode(group.id);
                    }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, nodeId: group.id }); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files?.length) {
                             onUploadDrop(e.dataTransfer.files, 0, 0, group.id); 
                        }
                    }}
                 >
                    {(group.type !== 'assets' && group.type !== 'music' && group.type !== 'text' && group.type !== 'video') && (
                        <PortHandle type="input" nodeId={group.id} isConnected={(group.inputs?.length || 0) > 0} />
                    )}
                    {(group.type !== 'generation' && group.type !== 'timeline') && (
                        <PortHandle type="output" nodeId={group.id} isConnected={(group.connections?.length || 0) > 0} onMouseDown={(e) => handleStartConnection(e, group.id)} />
                    )}
                    {group.type === 'mv_storyboard' && (
                        <PortHandle type="output" nodeId={group.id} isConnected={(group.connections?.length || 0) > 0} onMouseDown={(e) => handleStartConnection(e, group.id)} />
                    )}

                    {/* --- NODE BODY --- */}
                    <div 
                        className="backdrop-blur-[40px] rounded-[32px] overflow-hidden transition-all duration-300 bg-[#0e0e0e]/80 border border-white/10 text-text-primary shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.05)] flex flex-col h-full"
                        style={{ pointerEvents: isSpaceDown ? 'none' : 'auto' }}
                    >
                        
                        {/* Header */}
                        <div 
                            className="h-[64px] flex-none flex items-center justify-between px-6 border-b border-white/5 cursor-grab active:cursor-grabbing bg-gradient-to-b from-white/5 to-transparent pointer-events-auto"
                            onMouseDown={(e) => {
                                if (isSpacePressed.current) return;
                                e.stopPropagation();
                                setDraggingGroupId(group.id);
                                onSelectNode(group.id);
                                const pos = screenToCanvas(e.clientX, e.clientY);
                                setDragOffset({ x: pos.x - group.x, y: pos.y - group.y });
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-[0_2px_8px_rgba(0,0,0,0.2)] backdrop-blur-md transition-transform duration-300 group-hover:scale-105 ${
                                    group.type === 'agent' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                    group.type === 'assets' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                                    group.type === 'music' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                                    group.type === 'music_analysis' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                    group.type === 'text' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                                    group.type === 'mv_attribute_settings' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                    group.type === 'mv_storyboard' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                    group.type === 'generation' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                    group.type === 'timeline' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                    group.type === 'video' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    'bg-white/5 text-text-primary border-white/10'
                                }`}>
                                    {group.type === 'agent' ? <Zap size={16} strokeWidth={2} /> : 
                                     group.type === 'assets' ? <ImageIcon size={16} strokeWidth={2} /> : 
                                     group.type === 'music' ? <AudioLines size={16} strokeWidth={2} /> :
                                     group.type === 'music_analysis' ? <Wand2 size={16} strokeWidth={2} /> :
                                     group.type === 'text' ? <Type size={16} strokeWidth={2} /> :
                                     group.type === 'mv_attribute_settings' ? <Settings size={16} strokeWidth={2} /> :
                                     group.type === 'mv_storyboard' ? <Clapperboard size={16} strokeWidth={2} /> :
                                     group.type === 'timeline' ? <Film size={16} strokeWidth={2} /> :
                                     group.type === 'video' ? <FileVideo size={16} strokeWidth={2} /> :
                                     <LayoutGrid size={16} strokeWidth={2} />}
                                </div>
                                <div>
                                    <NodeTitle title={group.title} onRename={(t) => onRenameNode(group.id, t)} />
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                                {(group.type === 'music_analysis' || group.type === 'mv_attribute_settings' || group.type === 'mv_storyboard' || group.type === 'agent') && (
                                    <button onClick={() => onOpenPromptEditor(group.id)} className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary hover:text-[#007AFF] transition-colors" title="System Instructions">
                                        <FileText size={16} />
                                    </button>
                                )}
                                {(group.type === 'assets' || group.type === 'music' || group.type === 'mv_attribute_settings' || group.type === 'video') && (
                                    <button onClick={() => document.getElementById(`file-input-${group.id}`)?.click()} className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary transition-colors"><Plus size={16} /></button>
                                )}
                                {group.type === 'timeline' && (
                                    <button onClick={() => document.getElementById(`file-input-${group.id}`)?.click()} className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary transition-colors" title="Import Audio"><Plus size={16} /></button>
                                )}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-5 flex-1 min-h-0 relative flex flex-col">
                            {group.type === 'timeline' && (
                                <div className="space-y-4 h-full flex flex-col">
                                    <input 
                                        type="file" 
                                        id={`file-input-${group.id}`}
                                        className="hidden" 
                                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" 
                                        onChange={(e) => e.target.files && onUploadDrop(e.target.files, 0, 0, group.id)} 
                                    />
                                    <div className="flex justify-between items-center flex-none">
                                         <div className="text-xs text-text-primary/70 font-medium max-w-[50%] truncate">
                                            Connect <span className="text-rose-400 font-bold">MV Storyboard</span> or <span className="text-red-400 font-bold">Video Node</span>.
                                        </div>
                                        <div className="flex gap-2">
                                            {group.inputs?.some(id => storyboards.find(n => n.id === id)?.type === 'video') && (
                                                <button 
                                                    onClick={() => onImportVideos(group.id)}
                                                    className="bg-red-600/80 hover:bg-red-500 text-white text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md"
                                                >
                                                    <Import size={12} />
                                                    <span className="uppercase tracking-widest">Import Clips</span>
                                                </button>
                                            )}
                                            
                                            {group.inputs?.some(id => storyboards.find(n => n.id === id)?.type === 'mv_storyboard') && (
                                                <button 
                                                    onClick={() => onRunAgent(group.id)}
                                                    disabled={generatingAgents.has(group.id)}
                                                    className="bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                                                >
                                                    {generatingAgents.has(group.id) ? <Loader2 size={12} className="animate-spin" /> : <Film size={12} />}
                                                    <span className="uppercase tracking-widest">Generate</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Timeline Player */}
                                    <div className="flex-1 min-h-[400px] border border-white/5 rounded-xl overflow-hidden bg-black/40 relative">
                                        <TimelinePlayer 
                                            clips={group.config?.timelineClips || []} 
                                            audioUrl={group.config?.timelineAudioUrl}
                                            onExtractClip={(clip) => handleExtractClip(clip, group)}
                                            isHovered={hoveredNodeId === group.id}
                                            onUpdateClips={(newClips) => {
                                                onUpdateStoryboard({
                                                    ...group,
                                                    config: { ...group.config!, timelineClips: newClips }
                                                });
                                            }}
                                        />
                                        
                                        {!group.config?.timelineAudioUrl && (
                                            <div 
                                                className="absolute bottom-0 left-0 right-0 h-[60px] flex items-center justify-center bg-white/5 hover:bg-white/10 cursor-pointer transition-colors z-10 border-t border-white/5 pointer-events-auto"
                                                onClick={() => document.getElementById(`file-input-${group.id}`)?.click()}
                                                title="Drop audio file to add track"
                                            >
                                                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest flex items-center gap-2">
                                                    <Plus size={12} /> Drop Audio or Click to Add
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div 
                                        className="absolute bottom-1 right-1 cursor-nwse-resize p-2 opacity-50 hover:opacity-100 text-white/50 hover:text-white transition-opacity pointer-events-auto"
                                        onMouseDown={(e) => handleResizeStart(e, group)}
                                     >
                                         <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                             <path d="M12 12H0L12 0V12Z" fill="currentColor"/>
                                         </svg>
                                     </div>
                                </div>
                            )}

                            {(group.type === 'assets' || group.type === 'video') && (
                                <>
                                    <input 
                                        type="file" 
                                        id={`file-input-${group.id}`}
                                        className="hidden" 
                                        multiple 
                                        accept={group.type === 'video' ? "video/*" : "image/*"}
                                        onChange={(e) => e.target.files && onUploadDrop(e.target.files, 0, 0, group.id)} 
                                    />
                                    {group.items.length === 0 ? (
                                        <div onClick={() => document.getElementById(`file-input-${group.id}`)?.click()} className="h-[120px] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-text-secondary/50 hover:bg-white/5 cursor-pointer transition-colors group/empty">
                                            {group.type === 'video' ? <FileVideo size={24} className="mb-2 opacity-50 group-hover/empty:scale-110 transition-transform" /> : <ImageIcon size={24} className="mb-2 opacity-50 group-hover/empty:scale-110 transition-transform" />}
                                            <span className="text-[10px] uppercase font-bold tracking-widest">{group.type === 'video' ? 'Drop Videos' : 'Drop Images'}</span>
                                        </div>
                                    ) : (
                                        <div className="columns-2 gap-2 space-y-2">
                                            {group.items.map(item => (
                                                <div key={item.id} className="break-inside-avoid relative group/item rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all">
                                                    {group.type === 'video' ? (
                                                        <div className="relative aspect-video bg-black/40">
                                                            <video src={item.url} className="w-full h-full object-cover" muted />
                                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                                                                <Play size={12} className="text-white/70" />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <img src={item.url} className="w-full h-auto bg-black/20" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id, group.id); }} className="p-1.5 bg-white/10 backdrop-blur-md rounded-full text-red-400 hover:bg-red-500/20 hover:text-red-300 shadow-sm hover:scale-110"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {group.type === 'agent' && (
                                <div className="space-y-4">
                                    <div className="flex gap-2 mb-2">
                                        <button 
                                            onClick={() => onSmartPrompt(group.id)} 
                                            disabled={group.config?.isAnalyzing}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20 text-[10px] font-bold text-blue-400 hover:from-blue-500/20 hover:to-purple-500/20 transition-all"
                                        >
                                            {group.config?.isAnalyzing ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                                            Smart Analysis
                                        </button>
                                    </div>

                                    {group.config?.recommendations && group.config.recommendations.length > 0 && (
                                        <div className="flex flex-col gap-1.5 mb-2">
                                            {group.config.recommendations.map((rec, idx) => (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => onUpdateStoryboard({...group, config: {...group.config!, prompt: group.config!.prompt + (group.config!.prompt ? ' ' : '') + rec}})}
                                                    className="text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-text-secondary leading-tight transition-colors truncate"
                                                >
                                                    + {rec}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="relative group/input">
                                        <textarea
                                            value={group.config?.prompt || ''}
                                            onChange={(e) => onUpdateStoryboard({...group, config: {...group.config!, prompt: e.target.value}})}
                                            placeholder="Describe your scene..."
                                            className="w-full h-24 bg-black/20 border border-white/5 rounded-xl p-3 text-xs text-text-primary focus:border-white/20 focus:bg-black/40 focus:ring-0 resize-none leading-relaxed transition-all shadow-inner placeholder:text-white/20"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <SectionLabel label="Grid Layout" />
                                            <div className="flex gap-1">
                                                {[
                                                    { m: GenerationMode.GRID_2x2, icon: Grid2X2 },
                                                    { m: GenerationMode.GRID_3x3, icon: Grid3X3 },
                                                    { m: GenerationMode.GRID_4x4, icon: LayoutGrid }
                                                ].map(opt => (
                                                    <button 
                                                        key={opt.m}
                                                        onClick={() => onUpdateStoryboard({...group, config: {...group.config!, mode: opt.m}})}
                                                        className={`p-1.5 rounded-lg border transition-all ${group.config?.mode === opt.m ? 'bg-white/10 border-white/20 text-white shadow-sm' : 'border-transparent text-white/40 hover:bg-white/5'}`}
                                                    >
                                                        <opt.icon size={14} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <SectionLabel label="Frame Ratio" />
                                            <select 
                                                value={group.config?.aspectRatio || AspectRatio.WIDE}
                                                onChange={(e) => onUpdateStoryboard({...group, config: {...group.config!, aspectRatio: e.target.value as AspectRatio}})}
                                                className="w-full bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold px-2 py-1.5 focus:ring-0 cursor-pointer hover:bg-white/10 transition-colors text-white"
                                            >
                                                {Object.values(AspectRatio).map(ar => <option key={ar} value={ar} className="bg-[#1c1c1e] text-white">{ar}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <SectionLabel label="Camera" />
                                            <div className="relative">
                                                <select 
                                                    value={group.config?.cameraMove || 'None'}
                                                    onChange={(e) => onUpdateStoryboard({...group, config: {...group.config!, cameraMove: e.target.value}})}
                                                    className="w-full bg-white/5 border border-white/5 rounded-lg text-[10px] font-medium px-2 py-1.5 pr-6 focus:ring-0 cursor-pointer hover:bg-white/10 transition-colors appearance-none text-white"
                                                >
                                                    {CAMERA_PRESETS.map(p => <option key={p} value={p} className="bg-[#1c1c1e] text-white">{p}</option>)}
                                                </select>
                                                <Video size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <SectionLabel label="Lighting" />
                                            <div className="relative">
                                                <select 
                                                    value={group.config?.lightingStyle || 'None'}
                                                    onChange={(e) => onUpdateStoryboard({...group, config: {...group.config!, lightingStyle: e.target.value}})}
                                                    className="w-full bg-white/5 border border-white/5 rounded-lg text-[10px] font-medium px-2 py-1.5 pr-6 focus:ring-0 cursor-pointer hover:bg-white/10 transition-colors appearance-none text-white"
                                                >
                                                    {LIGHTING_PRESETS.map(p => <option key={p} value={p} className="bg-[#1c1c1e] text-white">{p}</option>)}
                                                </select>
                                                <Sun size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => onRunAgent(group.id)}
                                        disabled={generatingAgents.has(group.id)}
                                        className="w-full h-10 bg-white text-black rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                    >
                                        {generatingAgents.has(group.id) ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} fill="currentColor" />}
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Generate</span>
                                    </button>
                                </div>
                            )}

                            {group.type === 'music_analysis' && (
                                <div className="space-y-4">
                                    <div className="text-center space-y-4 py-4">
                                        <div className="text-xs text-text-primary/70 leading-relaxed font-medium mb-2 px-2">
                                            Connect a <strong>Music Node</strong> and a <strong>Text Context Node</strong> to start analysis.
                                        </div>
                                        <button 
                                            onClick={() => onRunAgent(group.id)}
                                            disabled={generatingAgents.has(group.id)}
                                            className="w-full h-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                        >
                                            {generatingAgents.has(group.id) ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Run Analysis</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {group.type === 'music' && (
                                <div className="space-y-4">
                                    <input 
                                        type="file" 
                                        id={`file-input-${group.id}`} 
                                        className="hidden" 
                                        multiple 
                                        accept="audio/*" 
                                        onChange={(e) => e.target.files && onUploadDrop(e.target.files, 0, 0, group.id)} 
                                    />
                                    {group.items.length === 0 ? (
                                        <div onClick={() => document.getElementById(`file-input-${group.id}`)?.click()} className="h-[80px] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-text-secondary/50 hover:bg-white/5 cursor-pointer transition-colors group/empty">
                                            <Music size={24} className="mb-2 opacity-50 group-hover/empty:scale-110 transition-transform" />
                                            <span className="text-[10px] uppercase font-bold tracking-widest">Drop Audio</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {group.items.map(item => (
                                                <div key={item.id} className="relative group/item">
                                                    <AudioPlayer url={item.url} title={item.fileName} />
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id, group.id); }} 
                                                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full text-white shadow-md hover:scale-110 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {group.type === 'text' && (
                                <div className="space-y-1">
                                    <SectionLabel label="Context / Prompt" />
                                    <textarea 
                                        value={group.config?.prompt || ''}
                                        onChange={(e) => onUpdateStoryboard({...group, config: {...(group.config || { mode: GenerationMode.GRID_2x2, aspectRatio: AspectRatio.WIDE, prompt: '' }), prompt: e.target.value}})}
                                        className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-[12px] leading-relaxed resize-none focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/50 transition-all placeholder:text-white/20 text-text-primary"
                                        placeholder="Enter context, background story, or analysis instructions..."
                                    />
                                </div>
                            )}

                            {group.type === 'text_result' && (
                                <div 
                                    className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2"
                                    onWheel={(e) => e.stopPropagation()} 
                                >
                                    <div className="whitespace-pre-wrap text-xs leading-relaxed text-text-primary font-mono bg-white/5 p-3 rounded-xl border border-white/10 select-text">
                                        {group.config?.textResult || "No result generated."}
                                    </div>
                                </div>
                            )}

                            {group.type === 'mv_attribute_settings' && (
                                <div className="space-y-5 h-full flex flex-col">
                                    {/* ... (Visual Expert) ... */}
                                    <div>
                                        {group.config?.textResult ? (
                                            <div className="space-y-1">
                                                <SectionLabel label="Analysis Input" />
                                                <div className="max-h-[60px] overflow-y-auto custom-scrollbar bg-white/5 rounded-lg p-2 border border-white/10 text-[9px] font-mono leading-relaxed select-text opacity-70 hover:opacity-100 transition-opacity" onWheel={(e) => e.stopPropagation()}>
                                                    {group.config.textResult.substring(0, 300) + (group.config.textResult.length > 300 ? "..." : "")}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400 font-medium text-center">
                                                Waiting for Analysis Result Input...
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 flex-1">
                                        <div className="space-y-1 flex flex-col">
                                            <SectionLabel label="Visual Style (Mandatory)" />
                                            <div className="flex-1 min-h-[140px] aspect-video bg-black/20 rounded-xl overflow-hidden border border-white/10 shadow-inner relative group/style">
                                                {group.config?.mvStyleImageUrl ? (
                                                    <>
                                                        <img src={group.config.mvStyleImageUrl} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover/style:bg-black/40 transition-all flex items-center justify-center">
                                                            <Maximize2 size={24} className="text-white opacity-0 group-hover/style:opacity-100 drop-shadow-md cursor-pointer" onClick={() => onSelectItem({ id: `${group.id}-style`, url: group.config!.mvStyleImageUrl!, type: 'image', timestamp: Date.now() })} />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                                                        <ImageIcon size={24} className="mb-2" />
                                                        <span className="text-[10px] font-medium">Pending...</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1 flex flex-col">
                                            <SectionLabel label="Character (1:1)" />
                                            <div className="flex-1 min-h-[140px] aspect-square bg-black/20 rounded-xl overflow-hidden border border-white/10 shadow-inner relative group/char self-start w-full max-w-[180px]">
                                                {group.config?.mvProtagonistImageUrl ? (
                                                    <>
                                                        <img src={group.config.mvProtagonistImageUrl} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover/char:bg-black/40 transition-all flex items-center justify-center">
                                                            <Maximize2 size={24} className="text-white opacity-0 group-hover/char:opacity-100 drop-shadow-md cursor-pointer" onClick={() => onSelectItem({ id: `${group.id}-char`, url: group.config!.mvProtagonistImageUrl!, type: 'image', timestamp: Date.now() })} />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                                                        <User size={24} className="mb-2" />
                                                        <span className="text-[10px] font-medium">Pending...</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 mt-auto">
                                         <button 
                                            onClick={() => onRunAgent(group.id)}
                                            disabled={generatingAgents.has(group.id)}
                                            className="w-full h-10 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                        >
                                            {generatingAgents.has(group.id) ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Generate Visuals</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {group.type === 'mv_storyboard' && (
                                <div className="space-y-4 h-full flex flex-col">
                                     <div className="flex justify-between items-start mb-2 flex-none">
                                        <div className="text-xs text-text-primary/70 leading-relaxed font-medium">
                                            Synthesizes music rhythms and visual styles into a shooting script.
                                        </div>
                                        {group.config?.mvScenes && group.config.mvScenes.length > 0 && (
                                            <button 
                                                onClick={() => copyScript(group.config!.mvScenes!)}
                                                className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded text-[9px] font-bold text-text-primary transition-all"
                                            >
                                                <Copy size={10} /> Copy All
                                            </button>
                                        )}
                                     </div>
                                     
                                     {group.config?.mvScenes && group.config.mvScenes.length > 0 ? (
                                         <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-[300px] border border-white/5 rounded-xl bg-black/20" onWheel={(e) => e.stopPropagation()}>
                                             <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 bg-[#0e0e0e] z-10 shadow-sm">
                                                    <tr className="text-[9px] font-bold text-text-secondary uppercase tracking-widest border-b border-white/10">
                                                        <th className="p-3 w-[220px]">Visual</th>
                                                        <th className="p-3 w-[80px]">Time</th>
                                                        <th className="p-3">Description & Prompt</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.config.mvScenes.map((scene, i) => (
                                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors align-top group/row">
                                                            <td className="p-3">
                                                                {scene.imageUrl ? (
                                                                    <div className="relative w-[200px] aspect-video rounded-lg overflow-hidden group/thumb cursor-pointer border border-white/10 shadow-lg"
                                                                         onClick={() => onSelectItem({ id: `${group.id}-scene-${i}`, url: scene.imageUrl!, type: 'image', prompt: scene.midjourneyPrompt, timestamp: Date.now() })}
                                                                    >
                                                                        <img src={scene.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover/thumb:scale-110" />
                                                                        <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/40 flex items-center justify-center transition-all">
                                                                            <Maximize2 size={20} className="text-white opacity-0 group-hover/thumb:opacity-100 drop-shadow-lg" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-[200px] aspect-video bg-white/5 rounded-lg flex items-center justify-center text-text-secondary/40 border border-white/5">
                                                                        <ImageIcon size={20} />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="font-mono text-[10px] text-text-primary bg-white/10 px-2 py-1 rounded border border-white/5">{scene.timeCode}</span>
                                                            </td>
                                                            <td className="p-3 space-y-3">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-[9px] text-text-secondary uppercase font-bold tracking-wider">{scene.rhythm}</span>
                                                                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                                                        <span className="text-[9px] text-text-secondary uppercase font-bold tracking-wider">{scene.cameraMovement}</span>
                                                                    </div>
                                                                    <span className="text-[13px] font-medium text-text-primary leading-snug">{scene.visualDescription}</span>
                                                                </div>
                                                                <div className="relative group/prompt">
                                                                    <div className="text-[10px] font-mono text-text-secondary bg-black/30 p-2.5 rounded-lg leading-relaxed line-clamp-2 hover:line-clamp-none transition-all cursor-text select-text border border-white/5 hover:border-white/20 hover:bg-black/50 hover:text-text-primary shadow-inner">
                                                                        {scene.midjourneyPrompt}
                                                                    </div>
                                                                    <button 
                                                                        onClick={() => navigator.clipboard.writeText(scene.midjourneyPrompt)}
                                                                        className="absolute top-2 right-2 p-1 text-white bg-black/60 backdrop-blur rounded opacity-0 group-hover/prompt:opacity-100 transition-opacity hover:bg-[#007AFF]"
                                                                    >
                                                                        <Copy size={10} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                             </table>
                                         </div>
                                     ) : (
                                        <div className="h-[300px] flex items-center justify-center text-text-secondary/50 border border-dashed border-white/10 rounded-xl bg-white/5">
                                            <span className="text-[10px] uppercase tracking-wider">Waiting for generation...</span>
                                        </div>
                                     )}

                                     <div className="flex-none pt-2">
                                        <button 
                                            onClick={() => onRunAgent(group.id)}
                                            disabled={generatingAgents.has(group.id)}
                                            className="w-full h-10 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                        >
                                            {generatingAgents.has(group.id) ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} fill="currentColor" className="text-white" />}
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Generate Storyboard</span>
                                        </button>
                                     </div>

                                     <div 
                                        className="absolute bottom-1 right-1 cursor-nwse-resize p-2 opacity-50 hover:opacity-100 text-white/50 hover:text-white transition-opacity pointer-events-auto"
                                        onMouseDown={(e) => handleResizeStart(e, group)}
                                     >
                                         <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                             <path d="M12 12H0L12 0V12Z" fill="currentColor"/>
                                         </svg>
                                     </div>
                                </div>
                            )}

                            {/* GENERATION RESULT NODE */}
                            {group.type === 'generation' && (
                                <div className="space-y-3">
                                    <div className="columns-2 gap-2 space-y-2">
                                        {group.items.map(item => (
                                            <div 
                                                key={item.id} 
                                                onClick={() => onSelectItem(item)}
                                                className="break-inside-avoid relative group/item rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all border border-white/5"
                                            >
                                                <img src={item.url} className="w-full h-auto bg-black/20" loading="lazy" />
                                                <div className="absolute inset-0 bg-black/0 group-hover/item:bg-black/20 transition-colors flex items-center justify-center">
                                                    <Maximize2 size={16} className="text-white opacity-0 group-hover/item:opacity-100 transition-opacity drop-shadow-md" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-text-secondary px-1">
                                        <span className="font-mono">{group.items.length} views</span>
                                        <span className="uppercase tracking-widest font-bold">{group.displayMode}</span>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                 </div>
             ))}
        </div>
      </div>
      
       {/* Active Dragging Layer */}
       <div className="absolute inset-0 pointer-events-none z-[100]">
          <div 
            style={{ 
                transform: `translate(${position.x + (containerRef.current?.clientWidth || 0)/2}px, ${position.y + (containerRef.current?.clientHeight || 0)/2}px) scale(${scale})`,
                transformOrigin: '0 0',
            }}
          >
             <svg className="overflow-visible w-full h-full">
                 {renderDraggingLine()}
             </svg>
          </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} />
            <div 
                className="fixed z-[9999] bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1.5 min-w-[160px] flex flex-col gap-0.5 animate-fade-in origin-top-left"
                style={{ left: contextMenu.x, top: contextMenu.y }}
            >
                {/* ... (Context Menu options) ... */}
                {contextMenu.nodeId ? (
                    <>
                        <button onClick={() => { onDuplicateNode(contextMenu.nodeId!); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><Copy size={12} /> Duplicate</button>
                        <button onClick={() => { onDeleteNode(contextMenu.nodeId!); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"><Trash2 size={12} /> Delete</button>
                    </>
                ) : (
                    <>
                        <div className="px-3 py-1.5 text-[9px] font-bold text-text-secondary uppercase tracking-widest opacity-50">Create</div>
                        <button onClick={() => { const pos = screenToCanvas(contextMenu.x, contextMenu.y); onCreateAssetNode(pos.x, pos.y); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><ImageIcon size={12} /> Reference Assets</button>
                        <button onClick={() => { const pos = screenToCanvas(contextMenu.x, contextMenu.y); onCreateVideoNode(pos.x, pos.y); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><FileVideo size={12} /> Video Node</button>
                        <button onClick={() => { const pos = screenToCanvas(contextMenu.x, contextMenu.y); onCreateAgent(pos.x, pos.y); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><Zap size={12} /> Director Agent</button>
                        <div className="my-0.5 h-px bg-white/10" />
                        <button onClick={() => { const pos = screenToCanvas(contextMenu.x, contextMenu.y); onCreateMusicNode(pos.x, pos.y); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><Music size={12} /> Music Node</button>
                        <button onClick={() => { const pos = screenToCanvas(contextMenu.x, contextMenu.y); onCreateTextNode(pos.x, pos.y); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><Type size={12} /> Text Input</button>
                        <div className="my-0.5 h-px bg-white/10" />
                        <button onClick={() => { const pos = screenToCanvas(contextMenu.x, contextMenu.y); onCreateMusicAnalysisAgent(pos.x, pos.y); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><Wand2 size={12} /> Music Analysis Master</button>
                        <button onClick={() => { const pos = screenToCanvas(contextMenu.x, contextMenu.y); onCreateMVAttributeSettings(pos.x, pos.y); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><Settings size={12} /> Visual Expert</button>
                        <button onClick={() => { const pos = screenToCanvas(contextMenu.x, contextMenu.y); onCreateMVStoryboard(pos.x, pos.y); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><Clapperboard size={12} /> MV Storyboard</button>
                        <button onClick={() => { const pos = screenToCanvas(contextMenu.x, contextMenu.y); onCreateTimelineNode(pos.x, pos.y); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors"><Film size={12} /> Timeline</button>
                    </>
                )}
            </div>
          </>
      )}

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/20 p-1.5 rounded-full shadow-lg z-[100]">
         <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95"><ZoomOut size={16} className="text-white/60" /></button>
         <span className="text-[10px] font-mono w-10 text-center text-white/60">{Math.round(scale * 100)}%</span>
         <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95"><ZoomIn size={16} className="text-white/60" /></button>
      </div>
    </div>
  );
};
