import { GoogleGenAI } from "@google/genai";
import { RoomAnalysis, InteriorStyle, AIEngine } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_PROMPT = `Bạn là một Kiến trúc sư Kiến trúc & Thiết kế Nội thất cấp cao. Hãy phân tích hình ảnh không gian nội thất được cung cấp với độ chi tiết cao nhất.
Nhiệm vụ của bạn là bóc tách toàn bộ không gian để mô hình ảnh AI có thể hiểu rõ nhất. Sự chính xác của bạn quyết định chất lượng hình ảnh đầu ra.

Hãy bóc tách và phân tích các yếu tố sau bằng tiếng Việt:
1. Kiến trúc tổng thể (architecture): Không gian rộng hay hẹp, trần cao hay thấp, hình dáng căn phòng, các đặc điểm không gian nổi bật.
2. Yếu tố cấu trúc (structuralElements): Phân tích như một kiến trúc sư - Vị trí của các cửa sổ, cửa ra vào, cột, dầm, cầu thang, hốc tường, vách ngăn.
3. Sàn nhà (flooring): Vật liệu sàn nhà hiện tại là gì? (gỗ, gạch, bê tông... màu sắc, hoa văn nếu có).
4. Ánh sáng (lighting): Nguồn sáng chính ở đâu? Hệ thống chiếu sáng tự nhiên (cửa sổ hướng nào) và nhân tạo (loại đèn, màu sắc ánh sáng mềm hay gắt, vị trí đổ bóng).
5. Bố cục & Đồ nội thất (layoutAndFurniture): Liệt kê và định vị các món đồ nội thất chính (sofa, giường, bàn ghế...). Tỷ lệ đồ vật so với diện tích phòng.
6. Kết cấu & Chất liệu mặt (materials): Mô tả tường (sơn, giấy dán, ốp gỗ...), trần (thạch cao, gỗ, bê tông) và các chất liệu chủ đạo của nội thất hiện có.
7. Cảm nhận (spatialAtmosphere): Không gian đang cho cảm giác gì? (cũ kĩ, bừa bộn, ấm cúng, lạnh rỗng...).

Bạn phải TUYỆT ĐỐI TRUNG THỰC với những gì thấy trong hình. KHÔNG BỊA ĐẶT THÊM các yếu tố không có. KHÔNG SUY ĐOÁN phong cách nếu không rõ ràng.

Trả về kết quả chuẩn định dạng JSON, KHÔNG KÈM THEO BẤT KỲ VĂN BẢN NÀO KHÁC BÊN NGOÀI:
{
  "architecture": "chuỗi chi tiết (tiếng Việt)",
  "structuralElements": ["mảng", "chuỗi", "tiếng Việt"],
  "flooring": "chuỗi mô tả sàn nhà (tiếng Việt)",
  "lighting": "chuỗi mô tả ánh sáng (tiếng Việt)",
  "layoutAndFurniture": "chuỗi mô tả bố cục (tiếng Việt)",
  "materials": "chuỗi mô tả vật liệu (tiếng Việt)",
  "spatialAtmosphere": "chuỗi mô tả cảm nhận (tiếng Việt)",
  "suggestedPrompt": "BẮT BUỘC BẰNG TIẾNG ANH. Một chuỗi mô tả kỹ thuật CHUYÊN SÂU DÀNH CHO AI IMAGE GENERATOR. Focus vào layout, cấu trúc, vị trí cửa, tỷ lệ không gian. Không nhắc đến vật liệu bề mặt cũ vì chúng sẽ bị thay thế."
}`;

export async function analyzeRoomImage(base64Image: string): Promise<RoomAnalysis> {
  const mimeType = base64Image.split(',')[0].split(':')[1].split(';')[0];
  const data = base64Image.split(',')[1];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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

    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Safely parse JSON
    let result: any;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON Parse failed on text:", text);
      throw new Error(`Invalid JSON format returned from AI model.`);
    }
    
    return result as RoomAnalysis;
  } catch (error: any) {
    console.error("Analysis failed:", error);
    const message = error?.message || String(error);
    throw new Error(`Analysis failed: ${message}`);
  }
}

export async function generateRestyledRoom(
  base64Image: string | null, 
  analysis: RoomAnalysis | null, 
  style: InteriorStyle,
  preserveLayout: boolean = false,
  customPrompt?: string,
  aiEngine: AIEngine = 'gemini',
  cameraLens: string = 'Standard 35mm',
  renderEngine: string = 'Corona Render',
  preserveMaterials: boolean = false,
  addDecor: boolean = false,
  addLEDs: boolean = false,
  roomType: string = 'Auto-detect',
  timeOfDay: string = 'Noon',
  negativePrompt: string = '',
  cameraAngle: string = 'Default',
  materialOverrides: Record<string, string> = {}
): Promise<{image: string, prompt: string}> {
  const stylePrompt = style === 'Original' ? 'original materials and colors' : `${style} interior design style`;
  const roomContext = roomType !== 'Auto-detect' ? `This is a ${roomType}. ` : '';
  const timeContext = timeOfDay !== 'Noon' ? `Lighting corresponds to ${timeOfDay}. ` : '';
  const angleContext = cameraAngle !== 'Default' ? `Viewed from a ${cameraAngle} perspective. ` : '';
  
  const overrides = [];
  if (materialOverrides['Floor']) overrides.push(`Floor: ${materialOverrides['Floor']}`);
  if (materialOverrides['Wall']) overrides.push(`Walls: ${materialOverrides['Wall']}`);
  if (materialOverrides['Ceiling']) overrides.push(`Ceiling: ${materialOverrides['Ceiling']}`);
  if (materialOverrides['Furniture']) overrides.push(`Furniture: ${materialOverrides['Furniture']}`);
  if (materialOverrides['General']) overrides.push(`General Accents: ${materialOverrides['General']}`);
  
  const materialsContext = overrides.length > 0 ? `Apply the following specific materials: ${overrides.join(', ')}. ` : '';
  
  // Use custom prompt if provided, otherwise build the professional one
  const qualityTokens = `raw photo, hyper-realistic architectural photography, shot on ${cameraLens} lens, Sony A7R IV, f/8, photorealistic, physically based rendering (PBR), ${renderEngine}, 8k resolution, ultra-detailed textures, sharp focus, ray-traced global illumination, high dynamic range (HDR), realistic lighting and shadows, masterwork`;
  const suggestedContext = analysis ? `Context: ${analysis.suggestedPrompt}.` : '';

  let autoPrompt = '';
  if (base64Image && preserveLayout) {
    if (preserveMaterials || style === 'Original') {
      autoPrompt = `${roomContext}${timeContext}${angleContext}${materialsContext}Professional hyper-realistic rendering enhancement of an interior space. 
       STRICTLY PRESERVE the exact furniture geometry, positions, overall floor plan, materials, and colors of the original room. 
       DO NOT change the materials, do not change the colors, do not change the furniture. 
       Only enhance the lighting, volumetric shadows, ray-traced reflections, and overall image quality.
       ${suggestedContext}
       ${qualityTokens}.`;
    } else {
      autoPrompt = `${roomContext}${timeContext}${angleContext}${materialsContext}Professional hyper-realistic material restyling of an interior space. 
       STRICTLY PRESERVE the exact furniture geometry, positions, and overall floor plan of the original room. 
       Update all surfaces, colors, and textures to match the ${stylePrompt} aesthetic with physically accurate materials.
       Ensure highly realistic lighting and reflections.
       ${suggestedContext}
       ${qualityTokens}.`;
    }
  } else {
    autoPrompt = `${roomContext}${timeContext}${angleContext}${materialsContext}Complete professional architectural interior redesign. 
       ${suggestedContext ? `Base architecture, windows, and walls: ${analysis?.suggestedPrompt}.` : ''}
       Target aesthetic: ${stylePrompt}.
       Replace furniture and decor with high-end ${style} pieces.
       Ensure highly realistic lighting, volumetric shadows, and reflections.
       ${qualityTokens}.`;
  }
  
  let finalPrompt = customPrompt || autoPrompt;

  if (customPrompt && base64Image && preserveLayout && (preserveMaterials || style === 'Original')) {
    finalPrompt = `${roomContext}${timeContext}${angleContext}${materialsContext}${customPrompt}\n\nCRITICAL: STRICTLY PRESERVE the exact furniture geometry, positions, overall floor plan, materials, and colors of the original room. DO NOT change the materials, do not change the colors, do not change the furniture.`;
  } else if (customPrompt && base64Image && preserveLayout) {
    finalPrompt = `${roomContext}${timeContext}${angleContext}${materialsContext}${customPrompt}\n\nCRITICAL: STRICTLY PRESERVE the exact furniture geometry, positions, and overall floor plan of the original room.`;
  } else if (customPrompt) {
    finalPrompt = `${roomContext}${timeContext}${angleContext}${materialsContext}${customPrompt}`;
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
      return { image: result.resultImage, prompt: finalPrompt };
    } catch (error: any) {
      console.error("Replicate generation failed:", error);
      const message = error?.message || String(error);
      throw new Error(`Replicate failed: ${message}`);
    }
  }

  if (aiEngine === 'chatgpt') {
    try {
      const response = await fetch('/api/enhance-chatgpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to call ChatGPT API');
      }
      return { image: result.resultImage, prompt: finalPrompt };
    } catch (error: any) {
      console.error("ChatGPT generation failed:", error);
      const message = error?.message || String(error);
      throw new Error(`ChatGPT failed: ${message}`);
    }
  }

  if (aiEngine === 'seedance') {
    try {
      const response = await fetch('/api/enhance-seedance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to call Seedance API');
      }
      return { image: result.resultImage, prompt: finalPrompt };
    } catch (error: any) {
      console.error("Seedance generation failed:", error);
      const message = error?.message || String(error);
      throw new Error(`Seedance failed: ${message}`);
    }
  }

  try {
    const parts: any[] = [];
    if (base64Image) {
      const mimeType = base64Image.split(',')[0].split(':')[1].split(';')[0];
      const data = base64Image.split(',')[1];
      parts.push({ inlineData: { data, mimeType } });
    }
    parts.push({ text: finalPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts,
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return { 
          image: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`,
          prompt: finalPrompt
        };
      }
    }

    throw new Error("No image generated by the AI model.");
  } catch (error: any) {
    console.error("Generation failed:", error);
    const message = error?.message || String(error);
    throw new Error(`Generation failed: ${message}`);
  }
}
