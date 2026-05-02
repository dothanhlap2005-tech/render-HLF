import { GoogleGenAI } from "@google/genai";
import { RoomAnalysis, InteriorStyle } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_PROMPT = `Bạn là một chuyên gia trợ lý thiết kế nội thất. Hãy phân tích hình ảnh căn phòng được cung cấp.
Mô tả kiến trúc, các yếu tố cấu trúc (tường, cửa sổ, cửa ra vào, cột) và sàn hiện tại bằng tiếng Việt.
Tập trung nghiêm túc vào các sự kiện thực tế. Sau đó, thêm các từ khóa về điều kiện ánh sáng (ví dụ: ánh sáng tự nhiên, mờ, sáng).
Không suy đoán về phong cách.
Trả về phân tích của bạn dưới định dạng JSON với các khóa sau:
"architecture": chuỗi (tiếng Việt),
"structuralElements": mảng chuỗi (tiếng Việt),
"flooring": chuỗi (tiếng Việt),
"lighting": chuỗi (tiếng Việt),
"suggestedPrompt": chuỗi (một mô tả kỹ thuật ngắn gọn về khung cảnh gốc bằng tiếng Anh để dùng cho mô hình diffusion)
`;

export async function analyzeRoomImage(base64Image: string): Promise<RoomAnalysis> {
  const mimeType = base64Image.split(',')[0].split(':')[1].split(';')[0];
  const data = base64Image.split(',')[1];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: SYSTEM_PROMPT },
          { inlineData: { data, mimeType } }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result as RoomAnalysis;
  } catch (error: any) {
    console.error("Analysis failed:", error);
    const message = error?.message || String(error);
    throw new Error(`Analysis failed: ${message}`);
  }
}

export async function generateRestyledRoom(
  base64Image: string, 
  analysis: RoomAnalysis, 
  style: InteriorStyle,
  preserveLayout: boolean = false,
  customPrompt?: string,
  aiEngine: 'gemini' | 'replicate' = 'gemini',
  cameraLens: string = 'Standard 35mm',
  renderEngine: string = 'Corona Render',
  preserveMaterials: boolean = false,
  addDecor: boolean = false,
  addLEDs: boolean = false,
  roomType: string = 'Auto-detect',
  timeOfDay: string = 'Noon',
  negativePrompt: string = ''
): Promise<string> {
  const mimeType = base64Image.split(',')[0].split(':')[1].split(';')[0];
  const data = base64Image.split(',')[1];

  const stylePrompt = style === 'Original' ? 'original materials and colors' : `${style} interior design style`;
  const roomContext = roomType !== 'Auto-detect' ? `This is a ${roomType}. ` : '';
  const timeContext = timeOfDay !== 'Noon' ? `Lighting corresponds to ${timeOfDay}. ` : '';
  
  // Use custom prompt if provided, otherwise build the professional one
  const qualityTokens = `raw photo, hyper-realistic architectural photography, shot on ${cameraLens} lens, Sony A7R IV, f/8, photorealistic, physically based rendering (PBR), ${renderEngine}, 8k resolution, ultra-detailed textures, sharp focus, ray-traced global illumination, high dynamic range (HDR), realistic lighting and shadows, masterwork`;
  
  let autoPrompt = '';
  if (preserveLayout) {
    if (preserveMaterials || style === 'Original') {
      autoPrompt = `${roomContext}${timeContext}Professional hyper-realistic rendering enhancement of an interior space. 
       STRICTLY PRESERVE the exact furniture geometry, positions, overall floor plan, materials, and colors of the original room. 
       DO NOT change the materials, do not change the colors, do not change the furniture. 
       Only enhance the lighting, volumetric shadows, ray-traced reflections, and overall image quality.
       Context: ${analysis.suggestedPrompt}.
       ${qualityTokens}.`;
    } else {
      autoPrompt = `${roomContext}${timeContext}Professional hyper-realistic material restyling of an interior space. 
       STRICTLY PRESERVE the exact furniture geometry, positions, and overall floor plan of the original room. 
       Update all surfaces, colors, and textures to match the ${stylePrompt} aesthetic with physically accurate materials.
       Ensure highly realistic lighting and reflections.
       Context: ${analysis.suggestedPrompt}.
       ${qualityTokens}.`;
    }
  } else {
    autoPrompt = `${roomContext}${timeContext}Complete professional architectural interior redesign. 
       Base architecture, windows, and walls: ${analysis.suggestedPrompt}.
       Target aesthetic: ${stylePrompt}.
       Replace furniture and decor with high-end ${style} pieces.
       Ensure highly realistic lighting, volumetric shadows, and reflections.
       ${qualityTokens}.`;
  }

  let finalPrompt = customPrompt || autoPrompt;
  
  if (customPrompt && preserveLayout && (preserveMaterials || style === 'Original')) {
    finalPrompt = `${roomContext}${timeContext}${customPrompt}\n\nCRITICAL: STRICTLY PRESERVE the exact furniture geometry, positions, overall floor plan, materials, and colors of the original room. DO NOT change the materials, do not change the colors, do not change the furniture.`;
  } else if (customPrompt && preserveLayout) {
    finalPrompt = `${roomContext}${timeContext}${customPrompt}\n\nCRITICAL: STRICTLY PRESERVE the exact furniture geometry, positions, and overall floor plan of the original room.`;
  }

  if (addDecor) {
    finalPrompt += '\n\nAdd tasteful interior decor, art pieces, and plants to enhance the atmosphere.';
  }
  if (addLEDs) {
    finalPrompt += '\n\nIncorporate ambient LED strip lights, colorful neon accents, and modern architectural lighting.';
  }

  if (aiEngine === 'replicate') {
    try {
      const response = await fetch('/api/enhance-replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image, prompt: finalPrompt, preserveLayout, preserveMaterials, negative_prompt: negativePrompt }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to call Replicate API');
      }
      return result.resultImage;
    } catch (error: any) {
      console.error("Replicate generation failed:", error);
      const message = error?.message || String(error);
      throw new Error(`Replicate failed: ${message}`);
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data, mimeType } },
          { text: finalPrompt },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image generated by the AI model.");
  } catch (error: any) {
    console.error("Generation failed:", error);
    const message = error?.message || String(error);
    throw new Error(`Generation failed: ${message}`);
  }
}
