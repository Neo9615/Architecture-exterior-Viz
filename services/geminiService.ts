
import { GoogleGenAI } from "@google/genai";
import { RenderParams } from "../types";

export class GeminiService {
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const lowerMessage = (error?.message || '').toLowerCase();
        
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
      const mappingText = params.materialMappings
        .filter(m => m.color && m.material)
        .map(m => `- Areas colored ${m.color}: Use ${m.material}`)
        .join('\n');

      const prompt = `Convert the provided architectural sketch into a high-end photorealistic 3D render.
      
      STRUCTURE: Maintain the EXACT perspective and geometry of the base sketch.
      STYLE: ${params.style}.
      ADDITIONAL INFO: ${params.description}.
      
      LANDSCAPE & ENVIRONMENT GUIDELINES:
      ${params.landscapePrompt}
      
      COLOR-CODED MATERIAL MAP:
      The provided sketch contains specific colors representing different building materials. Follow this mapping strictly for the architecture:
      ${mappingText || "No specific color map provided."}
      
      TECHNICAL QUALITY: Architectural photography style, 4K detail, realistic lighting, shadows, and high-quality textures. Ensure the landscape and building are integrated seamlessly.`;

      const parts: any[] = [
        {
          inlineData: {
            mimeType: 'image/png',
            data: specificSketch.includes('base64,') ? specificSketch.split('base64,')[1] : specificSketch
          }
        },
        { text: prompt }
      ];

      if (params.inspirationImage) {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: params.inspirationImage.includes('base64,') ? params.inspirationImage.split('base64,')[1] : params.inspirationImage
          }
        });
        parts.push({ text: "Use the image above for lighting, mood, and landscape inspiration ONLY." });
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
            { text: `Modify this architectural render according to this instruction: ${instruction}. Keep the building architecture and perspective mostly the same.` }
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
