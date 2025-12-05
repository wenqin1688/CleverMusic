
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AspectRatio, ImageSize, MVScene } from "../types";

export const ensureApiKey = async () => {
  // @ts-ignore
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  }
};

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- UTILS: RETRY WRAPPER ---
const withRetry = async <T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
    try {
        return await operation();
    } catch (error: any) {
        const isOverloaded = error?.status === 503 || error?.code === 503 || error?.message?.toLowerCase().includes('overloaded');
        const isRateLimit = error?.status === 429 || error?.code === 429;
        
        if (retries > 0 && (isOverloaded || isRateLimit)) {
            const backoff = isRateLimit ? delay * 2 : delay;
            console.warn(`API Error (${error?.status || error?.code}). Retrying in ${backoff}ms... (${retries} left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return withRetry(operation, retries - 1, backoff * 1.5);
        }
        throw error;
    }
};

// --- ROBUST IMAGE SLICING ---
const sliceImageGrid = (base64Data: string, rows: number, cols: number): Promise<string[]> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
          const w = img.width;
          const h = img.height;
          if (w < 100 || h < 100) {
              resolve([base64Data]); 
              return;
          }

          const pieceWidth = Math.floor(w / cols);
          const pieceHeight = Math.floor(h / rows);
          const pieces: string[] = [];
          const canvas = document.createElement('canvas');
          canvas.width = pieceWidth;
          canvas.height = pieceHeight;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve([base64Data]); 
            return;
          }

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                ctx.clearRect(0, 0, pieceWidth, pieceHeight);
                ctx.drawImage(img, c * pieceWidth, r * pieceHeight, pieceWidth, pieceHeight, 0, 0, pieceWidth, pieceHeight);
                pieces.push(canvas.toDataURL('image/png'));
            }
          }
          resolve(pieces);
      } catch (e) {
          console.warn("Slicing failed, returning full image:", e);
          resolve([base64Data]);
      }
    };
    img.onerror = () => resolve([base64Data]);
    img.src = base64Data;
  });
};

export interface ReferenceImageData {
  mimeType: string;
  data: string;
}

// --- DEFAULTS ---
export const DEFAULT_AGENT_SYSTEM_PROMPT = `ACT AS: An Expert Visual Director.
TASK: Generate a precise, high-fidelity storyboard grid based on the user's prompt and reference assets.
STYLE: Cinematic, Photorealistic, High Detail, UHD.`;

export const DEFAULT_MUSIC_ANALYSIS_PROMPT = `Generate a detailed music analysis report covering the following three aspects. 
Format the output clearly with headers.

1. Music Attributes:
   - Genre/Style
   - Duration (Approximate)
   - Estimated BPM
   - Instrumentation (if applicable)
   - Key characteristics (e.g., Mono/Stereo feeling, Lo-fi/Hi-fi)

2. Music Emotion:
   - Interpret the "feeling" of the track.
   - Translate the auditory experience into specific emotional keywords (e.g., Melancholic, Energetic, Ethereal, Tense).
   - Describe the imagery or atmosphere the music evokes.

3. Music Structure:
   - Precise dissection of the song structure if discernible.
   - Identify sections like: Intro, Verse, Pre-Chorus, Chorus, Bridge, Interlude, Outro.
   - Provide timestamp estimates if possible (e.g., Intro: 0:00-0:15).`;

export const DEFAULT_STYLE_GEN_PROMPT = `Based on the provided music analysis, generate a single high-quality, 4K visual style reference image that captures the mood, atmosphere, and aesthetic described.

REQUIREMENTS:
- Highly artistic, cinematic, and evocative.
- No text overlays.
- High fidelity, UHD, 8k resolution.
- Abstract or Scene setting that embodies the "Feeling" of the music.`;

export const DEFAULT_STORYBOARD_PROMPT = `ACT AS: An Expert Film Director and Visual Storyteller.

TASK:
Generate a Music Video Storyboard Script for the first 60 seconds of the song (or less if the song is shorter).
Generate exactly 10 KEY SCENES.
Each scene must represent exactly 4 seconds of footage.

STEP 1: TIMING
- Calculate timecodes in 4-second increments (e.g., 0:00-0:04, 0:04-0:08, etc.).
- Ensure a logical flow that tells a visual story.

STEP 2: CONCEPT FUSION
- Merge emotion/rhythm with visual style.

STEP 3: PROMPT ENGINEERING (Midjourney V7 Format)
- Write a specific prompt for each scene. Structure: [Quality] + [Subject] + [Environment] + [Style] + [Lighting/Angle].

OUTPUT FORMAT:
Return a raw JSON Array of Objects (MVScene). No markdown formatting.
[{
    "timeCode": "0:00-0:04",
    "rhythm": "Slow",
    "visualDescription": "Description...",
    "cameraMovement": "Zoom In",
    "midjourneyPrompt": "8k, cinematic..."
}]`;


// --- GENERATION SERVICE ---

export const generateMultiViewGrid = async (
  prompt: string,
  gridRows: number, 
  gridCols: number,
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
  referenceImages: ReferenceImageData[] = [],
  instructionPrompt?: string
): Promise<{ fullImage: string, slices: string[] }> => {
  await ensureApiKey();
  const ai = getClient();
  
  const totalViews = gridRows * gridCols;
  const gridType = `${gridRows}x${gridCols}`;
  const systemContext = instructionPrompt || DEFAULT_AGENT_SYSTEM_PROMPT;

  const imageParts: any[] = referenceImages.map(ref => ({
      inlineData: { mimeType: ref.mimeType, data: ref.data }
  }));

  const proPrompt = `
    ${systemContext}
    LAYOUT: ${gridType} Grid (${totalViews} views).
    CONTENT: ${prompt}
    STYLE: Photorealistic, 8k, Cinematic.
    CONSTRAINT: Distinct grid panels.
  `;

  const fallbackPrompt = `
    ${systemContext}
    Generate a storyboard image with ${totalViews} panels for: ${prompt}.
    Style: Cinematic, High Quality.
  `;

  const getImg = (response: any) => {
      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      return null;
  };

  let fullImageBase64: string | null = null;

  try {
      // 1. Try Pro Model (Retriable)
      try {
          console.log("Attempting Pro generation...");
          fullImageBase64 = await withRetry(async () => {
              const response = await ai.models.generateContent({
                  model: 'gemini-3-pro-image-preview',
                  contents: { parts: [...imageParts, { text: proPrompt }] },
                  config: { 
                      imageConfig: { aspectRatio, imageSize } 
                  }
              });
              return getImg(response);
          });
      } catch (proError) {
          console.warn("Pro generation failed, attempting Fallback (Flash)...", proError);
          // 2. Fallback to Flash
          try {
              fullImageBase64 = await withRetry(async () => {
                  const response = await ai.models.generateContent({
                      model: 'gemini-2.5-flash-image',
                      contents: { parts: [...imageParts, { text: fallbackPrompt }] },
                      config: { 
                          imageConfig: { aspectRatio }
                      }
                  });
                  return getImg(response);
              });
          } catch (fbError) {
              console.error("Fallback generation also failed:", fbError);
              throw new Error("Failed to generate image. Please try again or check API quota.");
          }
      }
  } catch (e) {
      throw e;
  }

  if (!fullImageBase64) throw new Error("API returned no image data.");

  const slices = await sliceImageGrid(fullImageBase64, gridRows, gridCols);
  return { fullImage: fullImageBase64, slices };
};


export const suggestPrompts = async (referenceImages: ReferenceImageData[]): Promise<string[]> => {
  await ensureApiKey();
  const ai = getClient();
  
  if (referenceImages.length === 0) return ["Cinematic lighting", "Cyberpunk", "Studio shot"];

  const parts: any[] = referenceImages.map(ref => ({ inlineData: ref }));
  parts.push({ text: "Provide 3 distinct cinematic prompting directives (JSON array of strings)." });

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: { responseMimeType: 'application/json' }
    })) as GenerateContentResponse;
    let text = response.text || "[]";
    text = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    return ["Cinematic lighting", "Detailed environment", "Character focus"];
  }
};


export const analyzeMusic = async (
    audioData: string,
    mimeType: string,
    userContext: string,
    instructionPrompt?: string
): Promise<string> => {
    await ensureApiKey();
    const ai = getClient();
    const systemInstruction = instructionPrompt || DEFAULT_MUSIC_ANALYSIS_PROMPT;
    const finalPrompt = `${systemInstruction}\n\nUSER CONTEXT:\n"${userContext}"`;

    try {
        const response = await withRetry(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: audioData } },
                    { text: finalPrompt }
                ]
            }
        })) as GenerateContentResponse;
        return response.text || "Analysis failed.";
    } catch (error) {
        console.error("Music analysis error:", error);
        throw error;
    }
}

// --- ASSET HELPERS ---
const processImageInput = async (input: string): Promise<{ mimeType: string; data: string }> => {
    if (!input) throw new Error("Image input is empty");
    if (input.startsWith('data:')) {
        const matches = input.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) return { mimeType: matches[1], data: matches[2] };
    } 
    if (input.startsWith('blob:') || input.startsWith('http')) {
        const response = await fetch(input);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
        const matches = base64.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) return { mimeType: matches[1], data: matches[2] };
    }
    throw new Error("Unsupported image format.");
};

export const generateVisualStyle = async (
    musicAnalysisText: string,
    instructionPrompt?: string
): Promise<string> => {
    await ensureApiKey();
    const ai = getClient();
    const systemInstruction = instructionPrompt || DEFAULT_STYLE_GEN_PROMPT;
    const prompt = `${systemInstruction}\n\nMUSIC REPORT:\n${musicAnalysisText}`;

    try {
        const response = await withRetry(() => ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: { aspectRatio: AspectRatio.WIDE, imageSize: ImageSize.K4 }
            }
        })) as GenerateContentResponse;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        throw new Error("No image generated");
    } catch (error) {
        console.error("Style generation error:", error);
        throw error;
    }
};

export const generateProtagonistImage = async (
    musicAnalysisText: string
): Promise<string> => {
    await ensureApiKey();
    const ai = getClient();
    const prompt = `Based on this music analysis, generate a high-quality 3:4 portrait of the main protagonist or character that fits this song's vibe.\n\nMUSIC REPORT:\n${musicAnalysisText}`;

    try {
        const response = await withRetry(() => ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: { aspectRatio: AspectRatio.PORTRAIT, imageSize: ImageSize.K2 }
            }
        })) as GenerateContentResponse;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return "";
    } catch (error) {
        console.warn("Protagonist generation error:", error);
        return "";
    }
};

const generateSceneImage = async (prompt: string, styleImageBase64: string, styleMime: string): Promise<string> => {
    const ai = getClient();
    const parts = [
        { inlineData: { mimeType: styleMime, data: styleImageBase64 } },
        { text: `Generate a scene: ${prompt}. Match the style reference.` }
    ];

    const attempt = async (model: string, config: any) => {
        const response = await ai.models.generateContent({ model, contents: { parts }, config }) as GenerateContentResponse;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    };

    try {
        return await withRetry(() => attempt('gemini-3-pro-image-preview', {
            imageConfig: { aspectRatio: AspectRatio.WIDE, imageSize: ImageSize.K2 }
        })) || "";
    } catch (e) {
        try {
            return await withRetry(() => attempt('gemini-2.5-flash-image', {
                imageConfig: { aspectRatio: AspectRatio.WIDE }
            })) || "";
        } catch (e2) {
            console.warn("Scene generation failed", e2);
            return "";
        }
    }
};

export const generateMVStoryboard = async (
    musicAnalysisText: string,
    styleImageUrl: string,
    protagonistImageUrl: string | undefined,
    instructionPrompt?: string
): Promise<MVScene[]> => {
    await ensureApiKey();
    const ai = getClient();
    
    const parts: any[] = [];
    let styleData: { mimeType: string, data: string } | null = null;
    
    try {
        styleData = await processImageInput(styleImageUrl);
        parts.push({ inlineData: { mimeType: styleData.mimeType, data: styleData.data } });
        if (protagonistImageUrl) {
            const protagPart = await processImageInput(protagonistImageUrl);
            parts.push({ inlineData: { mimeType: protagPart.mimeType, data: protagPart.data } });
        }
    } catch (e: any) {
        throw new Error(`Image processing failed: ${e.message}`);
    }

    const systemInstruction = instructionPrompt || DEFAULT_STORYBOARD_PROMPT;
    const prompt = `${systemInstruction}\n\nCONTEXT:\nMusic Analysis: "${musicAnalysisText}"\nVisual Style: (Image 1)`;
    parts.push({ text: prompt });

    let scenes: MVScene[] = [];
    try {
        const response = await withRetry(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts },
            config: { responseMimeType: 'application/json' }
        })) as GenerateContentResponse;
        let text = response.text || "[]";
        text = text.replace(/```json\n?|\n?```/g, '').trim();
        scenes = JSON.parse(text);
    } catch (error) {
        try {
            const response = await withRetry(() => ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts },
                config: { responseMimeType: 'application/json' }
            })) as GenerateContentResponse;
            let text = response.text || "[]";
            text = text.replace(/```json\n?|\n?```/g, '').trim();
            scenes = JSON.parse(text);
        } catch (fbError) {
            throw fbError;
        }
    }

    if (scenes.length > 0 && styleData) {
        const imagePromises = scenes.map(async (scene) => {
            if (!styleData) return scene;
            const imageUrl = await generateSceneImage(scene.midjourneyPrompt, styleData.data, styleData.mimeType);
            return { ...scene, imageUrl };
        });
        scenes = await Promise.all(imagePromises);
    }
    return scenes;
};

// --- VIDEO GENERATION (VEO) ---
export const generateVideoClip = async (
    imageUrl: string,
    prompt: string
): Promise<string> => {
    await ensureApiKey();
    const ai = getClient();

    let imageData: { mimeType: string, data: string } | null = null;
    try {
        imageData = await processImageInput(imageUrl);
    } catch (e) {
        console.warn("Skipping video generation due to image error:", e);
        return "";
    }

    // Start operation
    console.log("Starting video generation with Veo 3.1...");
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
            imageBytes: imageData.data,
            mimeType: imageData.mimeType
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    });

    // Poll for completion
    while (!operation.done) {
        console.log("Polling video operation...");
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
        throw new Error("Video generation completed but no URI returned.");
    }
    
    // Construct authenticated URL
    const authenticatedUrl = `${videoUri}&key=${process.env.API_KEY}`;
    
    // Download video content as Blob to ensure playback in <video> tag
    try {
        const response = await fetch(authenticatedUrl);
        if (!response.ok) throw new Error("Failed to fetch video content");
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        return blobUrl;
    } catch (e) {
        console.error("Failed to convert video to blob:", e);
        return authenticatedUrl; // Fallback to remote URL
    }
};


export const analyzeAsset = async (fileBase64: string, mimeType: string, prompt: string): Promise<string> => {
  await ensureApiKey();
  const ai = getClient();
  const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ inlineData: { mimeType, data: fileBase64 } }, { text: prompt }] }
  })) as GenerateContentResponse;
  return response.text || "No analysis available.";
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
