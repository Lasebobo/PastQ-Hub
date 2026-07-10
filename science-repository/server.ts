import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware with increased limit for image uploads
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/ocr", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "No image provided" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            text: "Please extract all text from this exam question paper. Format the output cleanly, identifying question numbers, sub-questions (a, b, c), and any instructions. Do not solve the questions, just transcribe them accurately."
          },
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType || "image/jpeg"
            }
          }
        ],
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("OCR Error:", error);
      res.status(500).json({ error: error.message || "Failed to process image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
