import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Replicate from "replicate";
import * as admin from "firebase-admin";
try {
  admin.initializeApp();
} catch (e) {
  console.log("Firebase admin already initialized or error");
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function getApiKeys() {
  const keys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
    SEEDANCE_API_KEY: process.env.SEEDANCE_API_KEY,
    SEEDANCE_API_URL: process.env.SEEDANCE_API_URL
  };
  try {
    const db = admin.firestore();
    const doc = await db.collection("settings").doc("apikeys").get();
    if (doc.exists) {
      const data = doc.data() || {};
      if (data.OPENAI_API_KEY) keys.OPENAI_API_KEY = data.OPENAI_API_KEY;
      if (data.REPLICATE_API_TOKEN) keys.REPLICATE_API_TOKEN = data.REPLICATE_API_TOKEN;
      if (data.SEEDANCE_API_KEY) keys.SEEDANCE_API_KEY = data.SEEDANCE_API_KEY;
      if (data.SEEDANCE_API_URL) keys.SEEDANCE_API_URL = data.SEEDANCE_API_URL;
    }
  } catch (error) {
    console.error("Error fetching settings:", error);
  }
  return keys;
}
async function startServer() {
  const app = express();
  const PORT = 3e3;
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.post("/api/enhance-replicate", async (req, res) => {
    try {
      const keys = await getApiKeys();
      const { imageBase64, prompt, preserveLayout, preserveMaterials, negative_prompt } = req.body;
      const replicateToken = keys.REPLICATE_API_TOKEN;
      if (!replicateToken) {
        return res.status(500).json({
          error: "Missing REPLICATE_API_TOKEN. Vui l\xF2ng th\xEAm API Key cho Replicate v\xE0o Settings \u0111\u1EC3 s\u1EED d\u1EE5ng t\xEDnh n\u0103ng n\xE0y."
        });
      }
      if (!imageBase64 || !prompt) {
        return res.status(400).json({ error: "Missing image or prompt" });
      }
      const replicate = new Replicate({
        auth: replicateToken
      });
      let strength = 0.8;
      if (preserveLayout) {
        strength = preserveMaterials || prompt.includes("DO NOT change the materials") ? 0.25 : 0.45;
      }
      const defaultNegative = "(deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, watermark, text";
      const finalNegativePrompt = negative_prompt ? `${negative_prompt}, ${defaultNegative}` : defaultNegative;
      const input = {
        prompt,
        negative_prompt: finalNegativePrompt,
        image: imageBase64,
        // e.g. "data:image/jpeg;base64,..."
        prompt_strength: strength,
        // Adjust based on layout and material preservation restrictions
        num_inference_steps: 40,
        guidance_scale: 7.5
      };
      const output = await replicate.run(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        // SDXL 1.0
        { input }
      );
      if (Array.isArray(output) && output.length > 0) {
        const imageUrl = output[0];
        const imageRes = await fetch(imageUrl);
        const imageBuffer = await imageRes.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString("base64");
        res.json({ resultImage: `data:image/png;base64,${base64}` });
      } else {
        throw new Error("No image returned from Replicate");
      }
    } catch (error) {
      console.error("Replicate error:", error);
      res.status(500).json({ error: error.message || "L\u1ED7i khi g\u1ECDi Replicate API." });
    }
  });
  app.post("/api/enhance-chatgpt", async (req, res) => {
    try {
      const keys = await getApiKeys();
      const { prompt } = req.body;
      const apiKey = keys.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "Missing OPENAI_API_KEY. Vui l\xF2ng th\xEAm API Key cho OpenAI v\xE0o Settings."
        });
      }
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
      }
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to call OpenAI API");
      }
      if (result.data && result.data.length > 0) {
        res.json({ resultImage: `data:image/png;base64,${result.data[0].b64_json}` });
      } else {
        throw new Error("No image returned from OpenAI");
      }
    } catch (error) {
      console.error("ChatGPT API error:", error);
      res.status(500).json({ error: error.message || "L\u1ED7i khi g\u1ECDi ChatGPT API." });
    }
  });
  app.post("/api/enhance-seedance", async (req, res) => {
    try {
      const keys = await getApiKeys();
      const { prompt } = req.body;
      const apiKey = keys.SEEDANCE_API_KEY;
      const apiUrl = keys.SEEDANCE_API_URL || "https://api.seedance.com/v1";
      if (!apiKey) {
        return res.status(500).json({
          error: "Missing SEEDANCE_API_KEY. Vui l\xF2ng th\xEAm API Key cho Seedance v\xE0o Settings."
        });
      }
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
      }
      const response = await fetch(`${apiUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          // Or whatever model Seedance uses
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to call Seedance API");
      }
      if (result.data && result.data.length > 0) {
        res.json({ resultImage: `data:image/png;base64,${result.data[0].b64_json}` });
      } else {
        throw new Error("No image returned from Seedance");
      }
    } catch (error) {
      console.error("Seedance API error:", error);
      res.status(500).json({ error: error.message || "L\u1ED7i khi g\u1ECDi Seedance API." });
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
