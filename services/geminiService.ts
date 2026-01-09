import { GoogleGenAI } from "@google/genai";
import { RenderParams } from "../types";

// ============================================================
// 🔑 API KEY SETUP
// ============================================================
// This is your key from the screenshot.
const API_KEY = "AIzaSyBQGJDAFp7dXxgpv7Ww_OV53Ck_1U9M4VQ"; 

export class GeminiService {
  
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (!API_KEY) throw new Error("API Key is missing.");
        return await fn();
      } catch (error: any) {
        const errorMessage = error?.message ? String(error.message) : String(error);
        lastError = new Error(errorMessage);
        if (error?.stack) lastError.stack = error.stack;

        console.warn(`Gemini API Attempt ${i + 1} failed:`, errorMessage);

        const lowerMessage = errorMessage.toLowerCase();
        if (lowerMessage.includes('not found') || lowerMessage.includes('api_key')) {
          throw new Error("INVALID_API_KEY_OR_MODEL");
        }

        const isTransient = 
          lowerMessage.includes('500') || lowerMessage.includes('503') || 
          lowerMessage.includes('429') || lowerMessage.includes('fetch');
        
        if (isTransient && i < maxRetries - 1) {
          const delay = Math.pow(2, i + 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError;
  }

  // FIXED: Prevents "Unexpected token <" error on broken images
  private async processImageInput(input: string): Promise<{ data: string, mimeType: string }> {
    const str = String(input).trim();
    
    // 1. Handle URL (http/https)
    if (/^https?:\/\//i.test(str)) {
      try {
        const response = await fetch(str, { method: 'GET', mode: 'cors' });
        
        // CHECK: If we get an HTML page instead of an image, throw a clear error
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
             throw new Error("Image URL returned HTML instead of an image (404 or broken link).");
        }
        
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
           const reader = new FileReader();
           reader.onloadend = () => {
             const res = reader.result as string;
             // distinct check to avoid crashing on empty results
             if (!res || !res.includes(',')) {
                 reject(new Error("Image processing failed: invalid data"));
                 return;
             }
             const data = res.split(',')[1];
             resolve({ data, mimeType: blob.type });
           };
           reader.onerror = () => reject(new Error("FileReader failed"));
           reader.readAsDataURL(blob);
        });
      } catch (e: any) {
         console.error("Image fetch failed", e);
         // If it's the "Unexpected token" error, give a better message
         if (e.message && e.message.includes('Unexpected token')) {
             throw new Error("Could not download the source image (Link might be broken).");
         }
         throw new Error(`Failed to load image: ${e.message}`);
      }
    }

    // 2. Handle Data URL
    if (str.startsWith('data:')) {
        const mimeType = str.substring(5, str.indexOf(';'));
        const data = str.split(',')[1];
        return { data, mimeType };
    }

    // 3. Fallback
    return { data: str, mimeType: 'image/png' };
  }

  private getClosestAspectRatio(width: number, height: number): string {
    const target = width / height;
    const supported = [
      { id: "1:1", val: 1.0 }, { id: "4:3", val: 1.333 }, { id: "3:4", val: 0.75 },
      { id: "16:9", val: 1.777 }, { id: "9:16", val: 0.5625 }
    ];
    return supported.reduce((prev, curr) => 
      Math.abs(curr.val - target) < Math.abs(prev.val - target) ? curr : prev
    ).id;
  }

  private async getImageDimensions(data: string, mimeType: string): Promise<{width: number, height: number}> {
      return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.src = `data:${mimeType};base64,${data}`;
      });
  }

  async generateRender(params: RenderParams, specificSketch: string): Promise<string> {
    return this.withRetry(async () => {
      const sketchImg = await this.processImageInput(specificSketch);
      const parts: any[] = [
        { inlineData: { mimeType: sketchImg.mimeType, data: sketchImg.data } }
      ];

      // Construct Prompt
      let contextPrompt = params.mode === 'Interior' 
        ? `INTERIOR AMBIANCE: ${params.interiorAmbiance}` 
        : `ENVIRONMENT: ${params.landscapePrompt}`;
      
      const prompt = `ACT AS A PHOTOREALISTIC RENDERER.
      TASK: Render the attached sketch (Image #0) with high fidelity.
      STYLE: ${params.style}.
      ${contextPrompt}
      MATERIALS: ${params.materialPrompt}
      IMPORTANT: Maintain the exact geometry of the sketch. Output a photorealistic image.`;

      parts.push({ text: prompt });

      const ai = new GoogleGenAI({ apiKey: API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-pro', 
        contents: { parts },
        config: {
          responseMimeType: 'application/json' 
        }
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) throw new Error("No response from AI.");
      
      if (candidates[0].content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
          }
      }

      // If we got here, the model returned text but no image
      throw new Error("The AI returned text, but no image. Ensure your API Key supports Image Generation models.");
    });
  }

  async editImage(baseImage: string, instruction: string): Promise<string> {
    return this.withRetry(async () => {
      const img = await this.processImageInput(baseImage);
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-pro', 
        contents: {
          parts: [
            { inlineData: { data: img.data, mimeType: img.mimeType } },
            { text: `Edit this image: ${instruction}` }
          ]
        }
      });
      
       const candidates = response.candidates;
       if (candidates?.[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
          }
       }
       throw new Error("AI did not return an edited image.");
    });
  }

  // Simplified stubs to prevent crashes on complex operations
  async modifyWithMask(base: string, mask: string, prompt: string) { 
      // Fallback to global edit for now to ensure stability
      return this.editImage(base, `(Inpaint Request): ${prompt}`); 
  }

  async upscaleImage(base: string) { 
      return this.editImage(base, "Upscale to 4K resolution, high fidelity"); 
  }
}