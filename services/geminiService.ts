
import { GoogleGenAI } from "@google/genai";
import { RenderParams, AspectRatio } from "../types";

export class GeminiService {
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        // Aggressively sanitize error to prevent circular structure issues
        const errorMessage = error?.message ? String(error.message) : String(error);
        
        lastError = new Error(errorMessage);
        if (error?.stack && typeof error.stack === 'string') {
            lastError.stack = error.stack;
        }

        const lowerMessage = errorMessage.toLowerCase();
        
        if (lowerMessage.includes('requested entity was not found')) {
          throw new Error("API_KEY_REQUIRED");
        }

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
          console.warn(`API Busy or Network Error (${lowerMessage}). Retrying in ${Math.round(delay)}ms...`);
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
        
        // Use detected mime type if valid, otherwise fallback to PNG conversion
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
            img.onerror = () => reject(new Error("Image load failed"));
            // Add cache buster to prevent cached CORS errors
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

  // Helper to determine the closest aspect ratio for the model configuration
  private getClosestAspectRatio(width: number, height: number): string {
    const target = width / height;
    const supported = [
      { id: "1:1", val: 1.0 },
      { id: "4:3", val: 1.333 },
      { id: "3:4", val: 0.75 },
      { id: "16:9", val: 1.777 },
      { id: "9:16", val: 0.5625 }
    ];
    // Find closest
    return supported.reduce((prev, curr) => 
      Math.abs(curr.val - target) < Math.abs(prev.val - target) ? curr : prev
    ).id;
  }

  private async getImageDimensions(data: string, mimeType: string): Promise<{width: number, height: number}> {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = reject;
          img.src = `data:${mimeType};base64,${data}`;
      });
  }

  async generateRender(params: RenderParams, specificSketch: string): Promise<string> {
    return this.withRetry(async () => {
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

        // Split logic based on 'furnitureLayoutMode'
        if (params.furnitureLayoutMode === 'empty') {
            // Case A: Without Furniture (Empty Shell) -> Virtual Staging
            contextPrompt += `\n
            TASK: VIRTUAL STAGING OF AN EMPTY SPACE.
            1. GEOMETRY PRESERVATION (NON-NEGOTIABLE): The input sketch (Image #0) is the rigid architectural shell. DO NOT MODIFY WALLS, WINDOWS, DOORS, or CEILING HEIGHTS.
            2. FURNISHING: The room is currently empty or contains only rough outlines. FURNISH the space based on the following description: "${params.furniturePrompt}".
            3. STYLE MATCHING: Use Image #${furniturePartIndex} as the STRICT stylistic reference for the furniture design, materials, and color palette.
            4. PLACEMENT: Arrange the new furniture realistically within the preserved architectural shell. Do not block doors or windows shown in the sketch.
            `;
        } else {
            // Case B: With Furniture -> Replacement
            contextPrompt += `\n
            TASK: FURNITURE REPLACEMENT.
            1. SPATIAL INTEGRITY: The input sketch (Image #0) defines the exact room boundaries (walls, windows, doors). These must remain UNTOUCHED.
            2. LAYOUT MATCHING: PRESERVE the exact position, rotation, and scale of the sketched furniture.
            3. STYLE MATCHING: The new furniture MUST match the design style, material, and luxury level of the inspiration image (Image #${furniturePartIndex}).
            `;
        }
      } else if (isInterior) {
        // Fallback if no inspiration image is provided
        contextPrompt += `\n
        TASK: INTERIOR REALIZATION.
        1. STRUCTURAL INTEGRITY (ABSOLUTE PRIORITY): The input sketch (Image #0) is the GROUND TRUTH for the room's geometry.
        2. DO NOT ADD OR REMOVE: Windows, doors, columns, beams, or walls. If it is drawn, it exists. If it is not drawn, it does not exist.
        3. EXACT MATCH: The placement of every architectural element must align perfectly with the sketch lines.`;
      }

      if (!isInterior && params.sitePicture) {
        const siteImg = await this.processImageInput(params.sitePicture);
        const sitePartIndex = parts.length;
        parts.push({
          inlineData: {
            mimeType: siteImg.mimeType,
            data: siteImg.data
          }
        });
        contextPrompt = `
        SITE COMPOSITION INSTRUCTION (CRITICAL):
        1. IMAGE #${sitePartIndex} IS THE REAL-WORLD SITE PHOTO.
        2. TASK: COMPOSITE/INSERT the building from the sketch (Image #0) directly into the environment of Image #${sitePartIndex}.
        3. MATCH PERSPECTIVE: Align the building's geometry to match the ground plane and camera angle of the SITE PHOTO.
        4. MATCH LIGHTING: Analyze the sun direction, shadow hardness, and color temperature of the SITE PHOTO. Apply EXACTLY the same lighting conditions to the new building.
        5. BLENDING: Ensure the building foundation interacts naturally with the terrain in the SITE PHOTO.
        6. IGNORE any generic landscape descriptions; the SITE PHOTO is the absolute truth for the environment.`;
      }

      const prompt = `ACT AS A WORLD-CLASS ARCHITECTURAL VISUALIZER SPECIALIZING IN PHOTOREALISM.
      
      TASK: Photorealistically render the provided ${isInterior ? 'interior space' : 'architectural structure'} layout.
      
      CRITICAL STRUCTURAL RULES (ZERO TOLERANCE FOR HALLUCINATION):
      - The input sketch (Image #0) IS THE GEOMETRY. You are a renderer, not an architect. You cannot redesign the space.
      - WALLS/WINDOWS/DOORS: Must match Image #0 exactly in position, size, and shape. Do not "invent" views or extra windows.
      - PERSPECTIVE: Do not shift the camera. The output must overlay perfectly on top of the sketch.
      
      PHOTOREALISM MANDATE (ULTRA-HIGH FIDELITY):
      - RENDER HIGH-QUALITY, REALISTIC MATERIALS: Use physically based rendering (PBR) mandates. Concrete must show micro-texture and subtle imperfections. Glass must feature Fresnel-accurate reflections and high-quality transparency. Metal must exhibit realistic specular highlights and anisotropic brushing where applicable.
      - ATMOSPHERIC RENDERING: Implement ray-traced global illumination, complex soft shadows, and accurate ambient occlusion.
      - PHOTOGRAPHIC QUALITY: The output must look like it was shot on a Phase One medium format camera. 8k resolution textures. Perfect lens geometry.
      
      STYLE: ${params.style}.
      ${contextPrompt}
      
      MATERIAL LOGIC:
      ${materialInstruction}
      
      FINAL QUALITY REQUIREMENTS:
      Ensure Ultra HD clarity. The landscape must be photographic quality, with realistic vegetation and sky integration. ${isInterior ? 'Prioritize realistic bounce lighting, texture depth, and realistic fabric folds.' : 'Prioritize accurate solar shadows and atmospheric haze.'}`;

      parts.push({ text: prompt });

      // Handle texture sample if in text-prompt mode (Legacy support for single sample upload)
      if (params.materialMode === 'text-prompt' && params.materialTextureImage) {
        const textureImg = await this.processImageInput(params.materialTextureImage);
        parts.push({
          inlineData: {
            mimeType: textureImg.mimeType,
            data: textureImg.data
          }
        });
        parts.push({ text: `SURFACE FINISH REFERENCE: Apply the physical properties of this sample to relevant elements.` });
      }

      const ai = new GoogleGenAI({ apiKey: "AIzaSyBQGJDAFp7dXxgpv7Ww_OV53Ck_lU9M4VQ" });
      
      // Determine final aspect ratio
      // Ensure strict typing for Gemini API which does not support 'Auto'
      let finalAspectRatio = (params.aspectRatio === 'Auto' ? '1:1' : params.aspectRatio) as "1:1" | "16:9" | "9:16" | "3:4" | "4:3";
      
      // Auto-detect ratio from sketch if set to Auto
      if (params.aspectRatio === 'Auto') {
         try {
             const dims = await this.getImageDimensions(sketchImg.data, sketchImg.mimeType);
             finalAspectRatio = this.getClosestAspectRatio(dims.width, dims.height) as "1:1" | "16:9" | "9:16" | "3:4" | "4:3";
         } catch (e) {
             console.warn("Could not detect aspect ratio, defaulting to 1:1");
         }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: finalAspectRatio,
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
      const img = await this.processImageInput(baseImage);
      
      // Auto-detect aspect ratio for editing to prevent distortion
      let aspectRatio = "1:1" as "1:1" | "16:9" | "9:16" | "3:4" | "4:3";
      try {
          const dims = await this.getImageDimensions(img.data, img.mimeType);
          aspectRatio = this.getClosestAspectRatio(dims.width, dims.height) as "1:1" | "16:9" | "9:16" | "3:4" | "4:3";
      } catch (e) {
          console.warn("Could not detect edit aspect ratio");
      }

      const ai = new GoogleGenAI({ apiKey: "AIzaSyBQGJDAFp7dXxgpv7Ww_OV53Ck_lU9M4VQ" });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: img.data,
                mimeType: img.mimeType
              }
            },
            { 
              text: `OBJECTIVE: ARCHITECTURAL EDITING / IMAGE MODIFICATION.
              
              INSTRUCTION: ${instruction}
              
              RULES:
              1. Apply the instruction to the provided image.
              2. Maintain the perspective, lighting, and style of the original image unless instructed otherwise.
              3. If specific regions are described, modify only those regions. If global changes are requested, apply them generally.
              4. High fidelity output.` 
            }
          ]
        },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio
            }
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

  // Restored: Use mask for precise modification
  async modifyWithMask(baseImage: string, maskImage: string, prompt: string): Promise<string> {
    return this.withRetry(async () => {
      const baseImg = await this.processImageInput(baseImage);
      const maskImg = await this.processImageInput(maskImage);

      // Auto-detect aspect ratio for modification to prevent distortion
      let aspectRatio = "1:1" as "1:1" | "16:9" | "9:16" | "3:4" | "4:3";
      try {
          const dims = await this.getImageDimensions(baseImg.data, baseImg.mimeType);
          aspectRatio = this.getClosestAspectRatio(dims.width, dims.height) as "1:1" | "16:9" | "9:16" | "3:4" | "4:3";
      } catch (e) {
          console.warn("Could not detect modify aspect ratio");
      }

      const ai = new GoogleGenAI({ apiKey: "AIzaSyBQGJDAFp7dXxgpv7Ww_OV53Ck_lU9M4VQ" });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            // Original Image (Image #0)
            {
              inlineData: {
                data: baseImg.data,
                mimeType: baseImg.mimeType
              }
            },
            // The Mask (Image #1) - Black Background, White Stroke/Rect
            {
              inlineData: {
                data: maskImg.data,
                mimeType: maskImg.mimeType
              }
            },
            // Prompt
            { 
              text: `TASK: GENERATIVE INPAINTING / MODIFICATION.
              
              INPUTS:
              - Image #0: Base image.
              - Image #1: Mask (White Area = Target Region for Edit, Black Area = Frozen/Protected).
              
              INSTRUCTION:
              Modify ONLY the area defined by the WHITE parts of Mask #1 to match this request: "${prompt}".
              
              STRICT RULES:
              1. MODIFICATION: Change the pixels inside the masked area (Image #1 White) to implement: "${prompt}".
              2. INTEGRATION: The new content must seamlessly blend with the surrounding environment in Image #0 (lighting, perspective, shadows, grain).
              3. FROZEN BACKGROUND: Do NOT change any pixel corresponding to the BLACK area of the mask.
              4. OUTPUT: Return the full image with the modification applied.` 
            }
          ]
        },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio
            }
        }
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) throw new Error("No modification candidates.");
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned from modification.");
    });
  }

  async upscaleImage(baseImage: string): Promise<string> {
    return this.withRetry(async () => {
      const img = await this.processImageInput(baseImage);
      
      if (img.data.length < 200) {
          throw new Error("Failed to process image data. Source invalid.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: img.data,
                mimeType: img.mimeType
              }
            },
            { 
              text: `TASK: Upscale this architectural render to 4K resolution.
              INSTRUCTIONS:
              1. RESAMPLE: Significantly increase image resolution and clarity to 4K.
              2. ENHANCE DETAILS: Refine textures. Sharpen architectural edges.
              3. DENOISE: Remove artifacts.
              4. PRESERVE INTEGRITY: Maintain exact geometry and lighting.
              5. OUTPUT: High-fidelity, print-ready architectural visualization.` 
            }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "4K"
          }
        }
      });
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) throw new Error("No upscale candidates.");
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned from upscale model");
    });
  }
}
