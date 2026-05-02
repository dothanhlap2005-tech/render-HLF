import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Replicate from 'replicate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Setup express to parse large JSON bodies for base64 images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API route for Stable Diffusion via Replicate
  app.post('/api/enhance-replicate', async (req, res) => {
    try {
      const { imageBase64, prompt, preserveLayout, preserveMaterials, negative_prompt } = req.body;
      const replicateToken = process.env.REPLICATE_API_TOKEN;

      if (!replicateToken) {
        return res.status(500).json({ 
          error: 'Missing REPLICATE_API_TOKEN. Vui lòng thêm API Key cho Replicate vào Settings để sử dụng tính năng này.' 
        });
      }

      if (!imageBase64 || !prompt) {
        return res.status(400).json({ error: 'Missing image or prompt' });
      }

      const replicate = new Replicate({
        auth: replicateToken,
      });

      // Format input for Replicate model
      // We will use a reliable ControlNet or Stable Diffusion Img2Img model payload.
      // Example: 'stability-ai/sdxl' for img2img or a specific controlnet model.
      
      let strength = 0.8;
      if (preserveLayout) {
        strength = preserveMaterials || prompt.includes('DO NOT change the materials') ? 0.25 : 0.45;
      }

      const defaultNegative = "(deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, watermark, text";
      const finalNegativePrompt = negative_prompt ? `${negative_prompt}, ${defaultNegative}` : defaultNegative;

      const input = {
        prompt: prompt,
        negative_prompt: finalNegativePrompt,
        image: imageBase64, // e.g. "data:image/jpeg;base64,..."
        prompt_strength: strength, // Adjust based on layout and material preservation restrictions
        num_inference_steps: 40,
        guidance_scale: 7.5,
      };

      const output = await replicate.run(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", // SDXL 1.0
        { input }
      );

      // Replicate outputs an array of image URIs for this model
      if (Array.isArray(output) && output.length > 0) {
        res.json({ resultImage: output[0] });
      } else {
        throw new Error('No image returned from Replicate');
      }
    } catch (error: any) {
      console.error('Replicate error:', error);
      res.status(500).json({ error: error.message || 'Lỗi khi gọi Replicate API.' });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // production mode
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
