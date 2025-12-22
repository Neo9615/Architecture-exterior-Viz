
export type RenderStyle = 
  | 'Modernist' | 'Brutalist' | 'Scandinavian' | 'Minimalist' 
  | 'Biophilic' | 'Industrial' | 'Neo-Futuristic' | 'Art Deco' 
  | 'Victorian' | 'Mediterranean' | 'Post-Modern' | 'Parametric' 
  | 'Gothic' | 'Zen' | 'Colonial' | 'Mid-Century Modern' | 'Deconstructivism';

export type CameraAngle = 'Eye Level' | 'Bird\'s Eye' | 'Drone View' | 'Worm\'s Eye' | 'Interior Close-up' | 'Isometric';

export interface MaterialMapping {
  color: string;
  material: string;
}

export interface RenderParams {
  style: RenderStyle;
  description: string;
  landscapePrompt: string;
  angle: CameraAngle;
  inspirationImage?: string; // Style reference
  baseSketches: string[]; // Support up to 5 perspective sources
  materialMappings: MaterialMapping[];
}

export interface Annotation {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface RenderResult {
  id: string;
  sketchUrl: string;
  renderUrl: string;
  timestamp: number;
}
