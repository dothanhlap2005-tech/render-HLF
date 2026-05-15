export type InteriorStyle = 
  | 'Original'
  | 'Scandinavian'
  | 'Industrial'
  | 'Minimalist'
  | 'Mid-Century Modern'
  | 'Bohemian'
  | 'Japandi';

export interface RoomAnalysis {
  architecture: string;
  structuralElements: string[];
  flooring: string;
  lighting: string;
  layoutAndFurniture: string;
  materials: string;
  spatialAtmosphere: string;
  suggestedPrompt: string;
}

export type LightingMode = 'Daylight' | 'Night' | 'Golden Hour' | 'Cinematic';
export type ShadowIntensity = 'Soft' | 'Moderate' | 'Strong';
export type ColorTemp = 'Warm' | 'Neutral' | 'Cool';
export type LightDirection = 'Left' | 'Right' | 'Front' | 'Top';

export type RoomType = 'Auto-detect' | 'Living Room' | 'Bedroom' | 'Kitchen' | 'Bathroom' | 'Dining Room' | 'Office' | 'Commercial Space' | 'Studio';
export type TimeOfDay = 'Morning' | 'Noon' | 'Golden Hour' | 'Blue Hour' | 'Night';

export type CameraLens = 'Standard 35mm' | 'Wide 24mm' | 'Ultra-wide 16mm' | 'Telephoto 85mm' | 'Cinematic Anamorphic';
export type CameraAngle = 'Default' | 'Eye Level' | 'Low Angle' | 'High Angle' | 'Bird\'s Eye View' | 'Isometric';
export type RenderEngine = 'Corona Render' | 'V-Ray' | 'Octane Render' | 'Unreal Engine 5 (Lumen)' | 'Redshift';

export type AIEngine = 'gemini' | 'replicate' | 'chatgpt' | 'seedance';

export type Material = 'Wood' | 'Marble' | 'Concrete' | 'Velvet' | 'Leather' | 'Metal' | 'Glass' | 'Linen' | 'Boucle' | 'Terrazzo' | 'Microcement' | 'Exposed Brick' | 'Plaster';

export type SurfaceTarget = 'Floor' | 'Wall' | 'Ceiling' | 'Furniture' | 'General';
export type MaterialOverrides = Record<SurfaceTarget, Material | ''>;

export interface DesignState {
  originalImage: string | null;
  analysis: RoomAnalysis | null;
  selectedStyle: InteriorStyle;
  materialOverrides: MaterialOverrides;
  roomType: RoomType;
  lightingMode: LightingMode;
  shadowIntensity: ShadowIntensity;
  colorTemp: ColorTemp;
  lightDirection: LightDirection;
  timeOfDay: TimeOfDay;
  cameraLens: CameraLens;
  cameraAngle: CameraAngle;
  renderEngine: RenderEngine;
  preserveLayout: boolean;
  preserveMaterials: boolean;
  addDecor: boolean;
  addLEDs: boolean;
  aiEngine: AIEngine;
  customPrompt: string;
  negativePrompt: string;
  isAnalyzing: boolean;
  isGenerating: boolean;
  resultImage: string | null;
  generatedPrompt: string | null;
  error: string | null;
}
