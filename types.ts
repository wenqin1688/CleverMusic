
export enum AspectRatio {
  SQUARE = '1:1',
  STANDARD = '4:3',
  PORTRAIT = '3:4',
  WIDE = '16:9',
  MOBILE = '9:16',
  CINEMA = '21:9'
}

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}

export enum GenerationMode {
  GRID_2x2 = '2x2 (4 Views)',
  GRID_3x3 = '3x3 (9 Views)',
  GRID_4x4 = '4x4 (16 Views)'
}

export interface CanvasItem {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio';
  prompt?: string;
  aspectRatio?: string;
  timestamp: number;
  fullGridUrl?: string;
  duration?: number; // For audio/video
  fileName?: string;
}

export interface GeneratedImage extends CanvasItem {
  prompt: string;
}

export type StoryboardType = 'generation' | 'assets' | 'agent' | 'music' | 'music_analysis' | 'text_result' | 'text' | 'mv_attribute_settings' | 'mv_storyboard' | 'timeline' | 'video';

export interface MVScene {
  timeCode: string;
  rhythm: string;
  visualDescription: string;
  midjourneyPrompt: string;
  cameraMovement: string;
  imageUrl?: string; // New: generated image URL
}

export interface TimelineClip {
  id: string;
  sceneId: string;
  videoUrl: string;
  thumbUrl: string;
  duration: number; // in seconds
  prompt: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}

export interface NodeConfig {
  prompt: string;
  mode: GenerationMode;
  aspectRatio: AspectRatio;
  recommendations?: string[];
  isAnalyzing?: boolean;
  cameraMove?: string;
  lightingStyle?: string;
  textResult?: string; // For text output nodes
  customSystemPrompt?: string;
  
  // MV Specific
  mvStyleImageUrl?: string;
  mvProtagonistImageUrl?: string;
  mvScenes?: MVScene[];

  // Timeline Specific
  timelineAudioUrl?: string;
  timelineClips?: TimelineClip[];
}

export interface StoryboardGroup {
  id: string;
  type: StoryboardType;
  title: string;
  x: number;
  y: number;
  width?: number; // Added for resizing
  height?: number; // Added for resizing
  items: CanvasItem[];
  timestamp: number;
  connections: string[]; // Outbound connections (Node IDs)
  inputs?: string[]; // Inbound connections (Node IDs that feed into this node)
  config?: NodeConfig; // Specific config for Agent nodes
  displayMode?: GenerationMode; // For generation nodes to know their layout
}

export interface Asset {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video' | 'audio';
  analysis?: string;
}