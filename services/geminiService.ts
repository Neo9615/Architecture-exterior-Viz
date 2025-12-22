
import { GoogleGenAI } from "@google/genai";
import { RenderParams } from "../types";

export class GeminiService {
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const lowerMessage = (error?.message || '').toLowerCase();
        
        if (lowerMessage.includes('requested entity was not found')) {
          const keyErr = new Error("API_KEY_REQUIRED");
          keyErr.stack = error.stack;
          throw keyErr;
        }

        const isTransient = 
          lowerMessage.includes('503') || 
          lowerMessage.includes('overloaded') || 
          lowerMessage.includes('429') || 
          lowerMessage.includes('rate limit') || 
          lowerMessage.includes('unavailable');
        
        if (isTransient && i < maxRetries - 1) {
          const delay = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
          console.warn(`API Busy. Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async generateRender(params: RenderParams, specificSketch: string): Promise<string> {
    return this.withRetry(async () => {
      const parts: any[] = [
        {
          inlineData: {
            mimeType: 'image/png',
            data: specificSketch.includes('base64,') ? specificSketch.split('base64,')[1] : specificSketch
          }
        }
      ];

      let materialInstruction = '';
      
      if (params.materialMode === 'color-key') {
        const mappingsWithTextures = params.materialMappings.filter(m => m.color && m.material);
        
        let mappingText = "STRICT COLOR-TO-MATERIAL BOUNDARY ENFORCEMENT:\nThe sketch is a geometric blueprint where each color defines a specific material zone. DO NOT bleed materials across these color lines.\n";
        
        mappingsWithTextures.forEach((m) => {
          if (m.textureImage) {
            const partIndex = parts.length;
            parts.push({
              inlineData: {
                mimeType: 'image/png',
                data: m.textureImage.split('base64,')[1]
              }
            });
            mappingText += `- AREAS COLORED ${m.color.toUpperCase()}: Apply ${m.material}. Use image part #${partIndex} for the exact texture detail.\n`;
          } else {
            mappingText += `- AREAS COLORED ${m.color.toUpperCase()}: Apply high-quality ${m.material} texture.\n`;
          }
        });
        materialInstruction = mappingText;
      } else {
        materialInstruction = `GLOBAL MATERIAL SPECIFICATIONS:\n${params.materialPrompt}`;
      }

      const prompt = `ACT AS A SENIOR ARCHITECTURAL VISUALIZER.
      
      TASK: Photorealistically render the provided structural sketch.
      
      CORE PRINCIPLE: GEOMETRIC IMMUTABILITY.
      The input image is a fixed blueprint. You are forbidden from altering the building's silhouette, window placement, rooflines, or perspective.
      
      STYLE: ${params.style}.
      CONTEXT: ${params.description}.
      
      ENVIRONMENT: ${params.landscapePrompt}
      
      MATERIAL LOGIC:
      ${materialInstruction}
      
      RENDER SETTINGS:
      High-end architectural photography style. Use 4K-ready texture maps. Ensure shadows and reflections are physically accurate to the environment. The result must look like a real building constructed exactly according to the sketch proportions.`;

      parts.push({ text: prompt });

      if (params.materialMode === 'text-prompt' && params.materialTextureImage) {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: params.materialTextureImage.includes('base64,') ? params.materialTextureImage.split('base64,')[1] : params.materialTextureImage
          }
        });
        parts.push({ text: "TEXTURE REFERENCE: Apply the qualities of this material sample to the building facades." });
      }

      if (params.inspirationImage) {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: params.inspirationImage.includes('base64,') ? params.inspirationImage.split('base64,')[1] : params.inspirationImage
          }
        });
        parts.push({ text: "MOOD REFERENCE: Extract lighting, atmosphere, and landscape style from this image, but DO NOT modify the building's shape." });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K"
          }
        }
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) throw new Error("No response candidates from AI.");
      
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      
      throw new Error("No image data returned in the response.");
    });
  }

  async editImage(baseImage: string, instruction: string): Promise<string> {
    return this.withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: baseImage.includes('base64,') ? baseImage.split('base64,')[1] : baseImage,
                mimeType: 'image/png'
              }
            },
            { 
              text: `SURGICAL ARCHITECTURAL MODIFICATION.
              
              INSTRUCTION: ${instruction}. 
              
              STRICT OPERATIONAL MASKING RULES:
              1. If coordinates/bounding boxes are provided in the instruction, treat them as a RIGID MASK.
              2. ONLY generate new pixels within the specified [x, y, width, height] zones.
              3. ZERO TOLERANCE for changes outside these zones. The sky, background, and other building sections must remain exactly as they are in the original.
              4. Maintain the existing lighting, perspective, and resolution of the original image.
              5. The final output must be a seamless composite where the new material or object fits perfectly into the rest of the static image.` 
            }
          ]
        }
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) throw new Error("No edit candidates.");

      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      
      throw new Error("No image data returned from edit model");
    });
  }
}
