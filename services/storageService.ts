
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { RenderResult, RenderParams } from "../types";

export class StorageService {
  
  // Helper to convert base64 to Blob efficiently
  private async base64ToBlob(base64: string): Promise<Blob> {
    try {
      // Ensure it's a data URL
      const dataUrl = base64.startsWith('data:') 
        ? base64 
        : `data:image/png;base64,${base64}`;
        
      const response = await fetch(dataUrl);
      return await response.blob();
    } catch (e) {
      console.warn("Fetch conversion failed, falling back to manual decoding");
      // Fallback manual decoding
      const arr = base64.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
      const bstr = atob(arr[arr.length - 1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    }
  }

  // Helper to upload base64 images
  private async uploadImage(uid: string, base64Data: string, prefix: string): Promise<{url: string, path: string, size: number}> {
    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
    const path = `user_uploads/${uid}/${filename}`;
    const storageRef = ref(storage, path);
    
    try {
      // Convert to Blob for more robust upload (avoids retry-limit-exceeded on large strings)
      const blob = await this.base64ToBlob(base64Data);
      
      const snapshot = await uploadBytes(storageRef, blob, { contentType: 'image/png' });
      const url = await getDownloadURL(storageRef);
      return { url, path, size: snapshot.metadata.size };
    } catch (error: any) {
      // Sanitize error before throwing
      const sanitizedMsg = error?.message || "Upload failed";
      console.error("Upload error sanitized:", sanitizedMsg);
      throw new Error(`Image Upload Error: ${sanitizedMsg}`);
    }
  }

  // Save a new render: Uploads images -> Saves Metadata to Firestore
  async saveRender(uid: string, renderBase64: string, sketchBase64: string, params: RenderParams): Promise<RenderResult> {
    try {
      // 1. Upload Images to Storage
      const renderUpload = await this.uploadImage(uid, renderBase64, 'render');
      let totalSize = renderUpload.size;
      
      let sketchUrl = sketchBase64;
      let sketchPath = '';
      
      // Upload sketch if it's base64 (not a URL)
      if (sketchBase64 && !sketchBase64.startsWith('http')) {
         const sketchUpload = await this.uploadImage(uid, sketchBase64, 'sketch');
         sketchUrl = sketchUpload.url;
         sketchPath = sketchUpload.path;
         totalSize += sketchUpload.size;
      }

      // 2. Prepare Firestore Data
      const timestamp = Date.now();
      const fileData = {
        uid,
        sketchUrl,
        sketchPath,
        renderUrl: renderUpload.url,
        renderPath: renderUpload.path,
        mode: params.mode,
        toolMode: params.toolMode, // Save tool mode
        style: params.style,
        prompt: params.mode === 'Exterior' ? params.landscapePrompt : params.interiorAmbiance,
        timestamp,
        notes: '',
        aiSummary: `Generated ${params.style} ${params.mode} render.`, 
        size: totalSize,
        createdAt: new Date().toISOString()
      };

      // 3. Add to Firestore using hierarchical doc path
      const historyCollection = collection(db, "users", uid, "files");
      const docRef = await addDoc(historyCollection, fileData);

      return {
        id: docRef.id,
        firestoreId: docRef.id,
        sketchUrl,
        renderUrl: renderUpload.url,
        timestamp,
        mode: params.mode,
        toolMode: params.toolMode,
        notes: fileData.notes,
        aiSummary: fileData.aiSummary,
        size: totalSize
      };
    } catch (error: any) {
      // Sanitize error to prevent "Converting circular structure to JSON"
      // We explicitly extract properties instead of trying to log the whole object
      const safeErrorMsg = error?.message || String(error);
      console.error("Error saving render to storage:", safeErrorMsg);
      throw new Error(safeErrorMsg);
    }
  }

  // Real-time subscription to user's history
  subscribeToHistory(uid: string, onUpdate: (results: RenderResult[]) => void) {
    if (!uid) return () => {};
    
    const historyCollection = collection(db, "users", uid, "files");
    const q = query(historyCollection, orderBy("timestamp", "desc"));
    
    return onSnapshot(q, (snapshot) => {
      const results: RenderResult[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          firestoreId: doc.id,
          sketchUrl: data.sketchUrl,
          renderUrl: data.renderUrl,
          timestamp: data.timestamp,
          mode: data.mode,
          toolMode: data.toolMode || 'create', // Default to create for old records
          notes: data.notes || '',
          aiSummary: data.aiSummary || '',
          size: data.size || 0
        };
      });
      onUpdate(results);
    }, (error) => {
      // Permission errors are common if rules aren't deployed or user not authenticated correctly
      const msg = error?.message || "Unknown error";
      console.warn(`Firestore history listener for ${uid} failed:`, msg);
    });
  }

  async updateNotes(uid: string, fileId: string, notes: string) {
    const docRef = doc(db, "users", uid, "files", fileId);
    await updateDoc(docRef, { notes });
  }

  async deleteFile(uid: string, fileId: string, renderUrl: string, sketchUrl: string) {
    try {
      // 1. Delete from Firestore
      const docRef = doc(db, "users", uid, "files", fileId);
      await deleteDoc(docRef);

      // 2. Delete from Storage (Best effort)
      const deleteStorageFile = async (url: string) => {
        if (!url || !url.includes('firebasestorage')) return;
        try {
          const fileRef = ref(storage, url);
          await deleteObject(fileRef);
        } catch (e) {
          console.warn("Could not delete file from storage (might already be gone):", url);
        }
      };

      await Promise.all([
        deleteStorageFile(renderUrl),
        deleteStorageFile(sketchUrl)
      ]);
    } catch (error: any) {
      console.error("Delete error:", error?.message);
    }
  }

  async downloadFile(uid: string, fileId: string): Promise<string> {
    const docRef = doc(db, "users", uid, "files", fileId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("File not found");
    
    const data = docSnap.data();
    const path = data.renderPath;
    
    if (path) {
        const storageRef = ref(storage, path);
        return getDownloadURL(storageRef);
    }
    
    return data.renderUrl;
  }
}
