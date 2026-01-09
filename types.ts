
export type RenderStyle = 
  | 'Modernist' | 'Brutalist' | 'Scandinavian' | 'Minimalist' 
  | 'Biophilic' | 'Industrial' | 'Neo-Futuristic' | 'Art Deco' 
  | 'Victorian' | 'Mediterranean' | 'Post-Modern' | 'Parametric' 
  | 'Gothic' | 'Zen' | 'Colonial' | 'Mid-Century Modern' | 'Deconstructivism'
  | 'Japandi' | 'Industrial Loft' | 'Bohemian' | 'Hollywood Regency' | 'Contemporary Classic';

export type CameraAngle = 'Eye Level' | 'Bird\'s Eye' | 'Drone View' | 'Worm\'s Eye' | 'Interior Close-up' | 'Isometric' | 'Wide Angle Interior';

export type MaterialMode = 'text-prompt' | 'color-map' | 'reference-image';

export type EnvironmentMode = 'Exterior' | 'Interior';

export type FurnitureLayoutMode = 'existing' | 'empty';

export type ToolMode = 'create' | 'modify';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '3:4' | '4:3' | 'Auto';

export interface MaterialMapping {
  color: string;
  material: string;
  textureImage?: string; 
}

export interface Project {
  id: string;
  name: string;
  timestamp: number;
}

export interface RenderParams {
  mode: EnvironmentMode;
  toolMode: ToolMode;
  style: RenderStyle;
  description: string;
  landscapePrompt: string; 
  interiorAmbiance: string; 
  materialPrompt: string;
  materialMode: MaterialMode;
  angle: CameraAngle;
  aspectRatio: AspectRatio;
  furnitureInspirationImage?: string; 
  materialTextureImage?: string; 
  sitePicture?: string; 
  baseSketches: string[]; 
  materialMappings: MaterialMapping[]; // Kept for type compatibility but unused in UI
  furnitureLayoutMode: FurnitureLayoutMode;
  furniturePrompt: string;
  // Modification specific
  modifyBaseImage?: string;
  modifyMaskImage?: string; // Base64 of the generated mask
  modifyPrompt: string;
  // Project grouping
  projectId?: string;
}

export interface Annotation {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface RenderResult {
  id: string; // Internal ID (usually timestamp-based or random)
  firestoreId?: string; // Document ID in Firestore
  sketchUrl: string;
  renderUrl: string;
  timestamp: number;
  mode: EnvironmentMode;
  toolMode?: ToolMode; // To distinguish between create and modify history
  notes?: string;
  aiSummary?: string;
  size?: number; // Size in bytes
  projectId?: string;
}