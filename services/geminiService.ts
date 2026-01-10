
import { GoogleGenAI } from "@google/genai";
import { RenderParams } from "../types";

export class GeminiService {
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        // 1. Robust Error Message Extraction
        let errorMessage = "Unknown Error";
        
        if (typeof error === 'string') {
            errorMessage = error;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        } else if (error && typeof error === 'object') {
            // Handle API JSON error responses like {"error": {"message": "..."}}
            if (error.error && error.error.message) {
                errorMessage = error.error.message;
            } else if (error.message) {
                errorMessage = String(error.message);
            } else {
                try {
                    // Prefer string conversion first
                    errorMessage = String(error);
                    if (errorMessage === '[object Object]') {
                        try {
                            // Only use stringify if basic string conversion fails to give info
                            // and protect against circular structure
                            errorMessage = JSON.stringify(error);
                        } catch {
                            errorMessage = "Complex/Circular Error Object";
                        }
                    }
                } catch (e) {
                    errorMessage = "Circular/Complex Error Object";
                }
            }
        }

        // 2. Create clean Error object (prevents circular reference issues in calling code)
        lastError = new Error(errorMessage);
        if (error instanceof Error && error.stack) {
            lastError.stack = error.stack;
        }

        const lowerMessage = errorMessage.toLowerCase();

        // 3. Check for specific Critical Errors (No Retry)
        if (lowerMessage.includes('requested entity was not found') || lowerMessage.includes('api_key_required')) {
          throw new Error("API_KEY_REQUIRED");
        }
        if (lowerMessage.includes('leaked') || lowerMessage.includes('permission_denied')) {
          throw new Error("API_KEY_LEAKED");
        }

        // 4. Check for Transient Errors (Retry)
        const isTransient = 
          lowerMessage.includes('500') || 
          lowerMessage.includes('internal error') ||
          lowerMessage.includes('503') || 
          lowerMessage.includes('overloaded') || 
          lowerMessage.includes('429') || 
          lowerMessage.includes('rate limit') || 
          lowerMessage.includes('unavailable') || 
          lowerMessage.includes('fetch') || 
          lowerMessage.includes('network') ||
          lowerMessage.includes('failed to load');
        
        if (isTransient && i < maxRetries - 1) {
          const delay = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
          console.warn(`API Busy or Network Error (${errorMessage}). Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw lastError;
      }
    }
    throw lastError;
  }

  private async processImageInput(input: string): Promise<{ data: string, mimeType: string }> {
    const str = String(input).trim();
    
    // 1. Handle URL (http/https)
    if (/^https?:\/\//i.test(str)) {
      try {
        const response = await fetch(str, { 
            method: 'GET', 
            mode: 'cors',
            cache: 'no-store', 
            credentials: 'omit'
        });
        if (!response.ok) throw new Error(`Fetch status: ${response.status}`);
        const blob = await response.blob();
        
        // Use detected mime type if valid
        const mimeType = blob.type;
        const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
        
        if (validTypes.includes(mimeType)) {
             return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const res = reader.result as string;
                    // Remove data url prefix
                    const data = res.includes(',') ? res.split(',')[1] : res;
                    resolve({ data, mimeType });
                };
                reader.onerror = () => reject(new Error("FileReader failed"));
                reader.readAsDataURL(blob);
             });
        } else {
             throw new Error("Invalid mime type, forcing conversion");
        }
      } catch (e) {
         // Fallback: Load via Image and draw to Canvas (converts to PNG)
         return await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if(!ctx) { reject(new Error("Canvas context failed")); return; }
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                resolve({ 
                    data: dataUrl.split(',')[1], 
                    mimeType: 'image/png' 
                });
            };
            // CRITICAL FIX: Do not pass the event object 'e' to reject, as it contains circular refs
            img.onerror = () => reject(new Error("Image load failed during fallback conversion"));
            
            try {
                const urlObj = new URL(str);
                urlObj.searchParams.set('cb', Date.now().toString());
                img.src = urlObj.toString();
            } catch {
                img.src = str;
            }
         });
      }
    }

    // 2. Handle Data URL (data:image/xyz;base64,...)
    if (str.startsWith('data:')) {
        const mimeType = str.substring(5, str.indexOf(';'));
        const data = str.split(',')[1];
        return { data, mimeType };
    }

    // 3. Raw Base64 (Assume PNG)
    return { data: str, mimeType: 'image/png' };
  }

  async generateRender(params: RenderParams, specificSketch: string): Promise<string> {
    return this.withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sketchImg = await this.processImageInput(specificSketch);
      const parts: any[] = [
        {
          inlineData: {
            mimeType: sketchImg.mimeType,
            data: sketchImg.data
          }
        }
      ];

      // Step 2: Texture & Finish - Handle Modes
      let materialInstruction = "";
      
      if (params.materialMode === 'color-map' && params.mode === 'Exterior') {
        const mappingsText = params.materialMappings
            .filter(m => m.color && m.material)
            .map(m => `- Color "${m.color}" matches Material "${m.material}"`)
            .join('\n');
        
        materialInstruction = `STRICT COLOR-MATERIAL MAPPING:\n${mappingsText}\nINSTRUCTION: The input sketch (Image #0) is color-coded. Identify areas matching the specified colors and apply the corresponding high-fidelity materials. Do not change the geometry. For areas not specified, use context-appropriate materials.`;

        // Handle physical texture uploads for mappings
        for (const mapping of params.materialMappings) {
            if (mapping.textureImage) {
                const texture = await this.processImageInput(mapping.textureImage);
                parts.push({
                    inlineData: { mimeType: texture.mimeType, data: texture.data }
                });
                materialInstruction += `\n- Use Image #${parts.length - 1} as the physical texture reference for "${mapping.material}".`;
            }
        }

      } else if (params.mode === 'Interior' && params.materialMode === 'reference-image' && params.materialTextureImage) {
         // INTERIOR REFERENCE IMAGE MODE
         const refImg = await this.processImageInput(params.materialTextureImage);
         parts.push({
            inlineData: { mimeType: refImg.mimeType, data: refImg.data }
         });
         materialInstruction = `STYLE & MATERIAL REFERENCE: Use Image #${parts.length - 1} as the PRIMARY reference for materials, lighting, and overall aesthetic. The materials in the generated render must match the textures and finishes visible in this reference image.`;
         
         if (params.materialPrompt && params.materialPrompt.trim().length > 0) {
             materialInstruction += `\nADDITIONAL NOTES: ${params.materialPrompt}`;
         }

      } else {
        // DEFAULT TEXT PROMPT MODE
        materialInstruction = `GLOBAL MATERIAL SPECIFICATIONS & FINISHES:\n${params.materialPrompt}\nIMPORTANT: Apply high-fidelity, PBR-accurate textures based on this description. Concrete should look porous, wood should have grain, glass should have accurate reflections.`;
      }

      const isInterior = params.mode === 'Interior';
      let contextPrompt = isInterior ? 
        `INTERIOR AMBIANCE: ${params.interiorAmbiance}` : 
        `ENVIRONMENT & LANDSCAPE: ${params.landscapePrompt}`;

      // Step 3: Furniture & Staging Logic
      if (isInterior && params.furnitureInspirationImage) {
        const furnitureImg = await this.processImageInput(params.furnitureInspirationImage);
        const furniturePartIndex = parts.length;
        parts.push({
          inlineData: {
            mimeType: furnitureImg.mimeType,
            data: furnitureImg.data
          }
        });

        if (params.furnitureLayoutMode === 'empty') {
            contextPrompt += `\n
            TASK: VIRTUAL STAGING OF AN EMPTY SPACE.
            1. GEOMETRY PRESERVATION: The input sketch (Image #0) is the architectural shell. DO NOT MODIFY WALLS, WINDOWS, or CEILINGS.
            2. FURNISHING: Furnish the space based on: "${params.furniturePrompt}".
            3. STYLE MATCHING: Use Image #${furniturePartIndex} as the stylistic reference.
            `;
        } else {
            contextPrompt += `\n
            TASK: FURNITURE REPLACEMENT.
            1. SPATIAL INTEGRITY: Preserve room boundaries from Image #0.
            2. STYLE MATCHING: The new furniture MUST match the style of Image #${furniturePartIndex}.
            `;
        }
      } else if (isInterior) {
        contextPrompt += `\nTASK: INTERIOR REALIZATION. The input sketch is the ground truth. Preserve all geometry.`;
      }

      if (!isInterior && params.sitePicture) {
          const siteImg = await this.processImageInput(params.sitePicture);
          const sitePartIndex = parts.length;
          parts.push({
            inlineData: { mimeType: siteImg.mimeType, data: siteImg.data }
          });
          contextPrompt += `\nSITE CONTEXT: Use Image #${sitePartIndex} as the strict background and environmental context. The building must be composited realistically into this specific site.`;
      }

      // Add Text Prompt at the end
      const finalPrompt = `
        ROLE: High-End Architectural Visualizer.
        TASK: Transform the input sketch (Image #0) into a photorealistic ${params.style} render.
        CAMERA ANGLE: ${params.angle}
        
        ${materialInstruction}
        
        ${contextPrompt}
        
        OUTPUT QUALITY: 8k resolution, unbiased rendering, ray-traced lighting, photorealistic.
      `;

      parts.push({ text: finalPrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', // Fast, high quality generation
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: params.aspectRatio === 'Auto' ? undefined : params.aspectRatio
            }
        }
      });

      // Handle response parts to find image
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
      }
      throw new Error("No image generated in response");
    });
  }

  async editImage(baseImage: string, prompt: string): Promise<string> {
    return this.withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const img = await this.processImageInput(baseImage);
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: img.mimeType, data: img.data } },
                    { text: `Edit this image: ${prompt}. Maintain the original perspective and lighting.` }
                ]
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }
        throw new Error("No image generated from edit");
    });
  }

  async modifyWithMask(baseImage: string, maskImage: string, prompt: string): Promise<string> {
    return this.withRetry(async () => {
        // Since the current SDK might not strictly support "mask" inputs directly in `generateContent` for editing in the same way regular inpainting works,
        // we prompt the model to use the mask as a guide or use the Image Editing capabilities if supported.
        // For 'gemini-2.5-flash-image', we provide both images and a strong instruction.
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const base = await this.processImageInput(baseImage);
        const mask = await this.processImageInput(maskImage);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: base.mimeType, data: base.data } },
                    { inlineData: { mimeType: mask.mimeType, data: mask.data } },
                    { text: `INSTRUCTION: Perform a masked edit. Image #0 is the Source. Image #1 is the Mask (White area is the edit zone). 
                    Task: ${prompt}. 
                    Apply changes ONLY to the white area of the mask. Keep the black area of the mask exactly identical to the source image.` }
                ]
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }
        throw new Error("No image generated from masked edit");
    });
  }

  async upscaleImage(sourceImage: string): Promise<string> {
    return this.withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const img = await this.processImageInput(sourceImage);

        // Use Pro model for 4K upscaling tasks
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview', 
            contents: {
                parts: [
                    { inlineData: { mimeType: img.mimeType, data: img.data } },
                    { text: "Upscale this image to 4K resolution. Enhance details, textures, and lighting while strictly preserving the original composition and geometry. Do not hallucinate new objects." }
                ]
            },
            config: {
                imageConfig: {
                    imageSize: "4K"
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }
        throw new Error("No image generated from upscale");
    });
  }
}
