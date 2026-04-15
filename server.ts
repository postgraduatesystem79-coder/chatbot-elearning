import "dotenv/config";
import express, { Request } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { Blob } from "buffer";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp } from "firebase/app";
import admin from "firebase-admin";
import fs from "fs";
import cors from "cors";

// ===================== Simple MemoryVectorStore =====================
class MemoryVectorStore {
  docs: any[] = [];
  embeddings: any;
  constructor(embeddings: any) {
    this.embeddings = embeddings;
  }
  async addDocuments(docs: any[]) {
    this.docs.push(...docs);
  }
  async similaritySearch(query: string, k: number) {
    if (this.docs.length === 0) return [];
    const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const scoredDocs = this.docs.map((doc) => {
      const content = doc.pageContent.toLowerCase();
      let score = keywords.reduce((s, kw) => s + (content.includes(kw) ? 1 : 0), 0);
      return { doc, score };
    });
    const results = scoredDocs
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((i) => i.doc);
    return results.length > 0 ? results : this.docs.slice(0, Math.min(2, this.docs.length));
  }
  static async fromDocuments(docs: any[], embeddings: any) {
    const store = new MemoryVectorStore(embeddings);
    await store.addDocuments(docs);
    return store;
  }
}

// ===================== Types =====================
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// ===================== Paths =====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), "knowledge_data");
const CHUNKS_FILE = path.join(DATA_DIR, "chunks.json");
const META_FILE = path.join(DATA_DIR, "metadata.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ===================== State =====================
let vectorStore: MemoryVectorStore | null = null;
const uploadedDocuments: any[] = [];

// ===================== API Key =====================
function getApiKey(): string {
  const key = process.env.MY_APP_KEY || process.env.GEMINI_API_KEY || process.env.VITE_MY_APP_KEY;
  if (!key || key === "dummy-key" || key === "MY_GEMINI_API_KEY" || key.trim() === "") {
    throw new Error("API key is not configured. Please set VITE_MY_APP_KEY in .env");
  }
  return key;
}

// ===================== Disk Persistence =====================
function saveChunksToDisk(chunks: any[]) {
  try {
    fs.writeFileSync(CHUNKS_FILE, JSON.stringify(chunks, null, 2), "utf-8");
    console.log(`[KB] Saved ${chunks.length} chunks to disk.`);
  } catch (e) {
    console.error("[KB] Failed to save chunks:", e);
  }
}

function saveMetaToDisk() {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(uploadedDocuments, null, 2), "utf-8");
  } catch (e) {
    console.error("[KB] Failed to save metadata:", e);
  }
}

/** Load chunks from disk synchronously - no embeddings API call needed (keyword search only) */
function loadChunksFromDisk() {
  if (!fs.existsSync(CHUNKS_FILE)) return;
  try {
    const chunks = JSON.parse(fs.readFileSync(CHUNKS_FILE, "utf-8"));
    if (!chunks || chunks.length === 0) return;
    // Create store directly without re-embedding (keyword search doesn't need embeddings)
    vectorStore = new MemoryVectorStore(null);
    vectorStore.docs = chunks;
    console.log(`[KB] Loaded ${chunks.length} chunks from disk.`);
  } catch (e) {
    console.error("[KB] Failed to load chunks:", e);
  }
}

function loadMetaFromDisk() {
  if (!fs.existsSync(META_FILE)) return;
  try {
    const meta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
    if (Array.isArray(meta)) uploadedDocuments.push(...meta);
    console.log(`[KB] Loaded ${uploadedDocuments.length} documents from disk.`);
  } catch (e) {
    console.error("[KB] Failed to load metadata:", e);
  }
}

// Load on startup (synchronous, no API calls)
loadMetaFromDisk();
loadChunksFromDisk();

// ===================== Server =====================
async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(cors());
  app.use(express.json());

  const upload = multer({ storage: multer.memoryStorage() });

  // Firebase init (client SDK)
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  initializeApp(firebaseConfig);

  // Firebase Admin init - supports both env var (production) and local file (dev)
  if (admin.apps.length === 0) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Production: credentials stored as JSON string in env var
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket,
        });
        console.log("[Firebase Admin] Initialized from env var");
      } else {
        // Development: use Application Default Credentials
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket,
        });
        console.log("[Firebase Admin] Initialized from applicationDefault");
      }
    } catch (e) {
      console.warn("[Firebase Admin] Init failed (non-critical):", e);
    }
  }

  // Static uploads
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use("/uploads", express.static(uploadsDir));


  // ===================== Upload Submission =====================
  app.post("/api/upload-submission", upload.single("file"), async (req, res) => {
    try {
      const multerReq = req as MulterRequest;
      if (!multerReq.file) return res.status(400).json({ error: "No file uploaded" });
      const fileName = `${Date.now()}_${multerReq.file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, multerReq.file.buffer);
      const url = `${req.protocol}://${req.get("host")}/uploads/${fileName}`;
      res.json({ success: true, url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===================== Test AI =====================
  app.get("/api/test-ai", async (req, res) => {
    try {
      const apiKey = getApiKey();
      const genAI_old = new GoogleGenerativeAI(apiKey);
      const testModel = genAI_old.getGenerativeModel({ model: "gemini-2.0-flash-lite" }, { apiVersion: "v1beta" });
      const testResult = await testModel.generateContent("Say hello in Arabic");
      res.json({ success: true, response: testResult.response.text() });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===================== Knowledge Base Upload =====================
  app.post("/api/knowledge-base/upload", async (req, res) => {
    try {
      await new Promise((resolve, reject) => {
        upload.single("file")(req, res, (err) => (err ? reject(new Error(err.message)) : resolve(null)));
      });
      const multerReq = req as MulterRequest;
      if (!multerReq.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      const fileBuffer = multerReq.file.buffer;
      const fileName = multerReq.file.originalname;

      let docs;
      try {
        const loader = new PDFLoader(new Blob([fileBuffer]));
        docs = await loader.load();
      } catch (err: any) {
        throw new Error(`PDF Parsing Error: ${err.message}`);
      }
      if (!docs || docs.length === 0) throw new Error("PDF is empty or could not be read");

      const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
      const splitDocs = await splitter.splitDocuments(docs);
      splitDocs.forEach((doc) => {
        doc.metadata = { ...doc.metadata, fileName, uploadDate: new Date().toISOString() };
      });

      if (!vectorStore) {
        vectorStore = new MemoryVectorStore(null);
      }
      await vectorStore.addDocuments(splitDocs);

      const docInfo = {
        id: Math.random().toString(36).substr(2, 9),
        filename: fileName,
        uploadDate: new Date().toISOString(),
        status: "Vectorized / Active",
        chunkCount: splitDocs.length,
      };
      uploadedDocuments.push(docInfo);

      // Persist to disk
      saveChunksToDisk(vectorStore.docs);
      saveMetaToDisk();

      res.status(201).json({ success: true, data: docInfo });
    } catch (error: any) {
      console.error("Upload Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/knowledge-base/documents", (_req, res) => {
    res.json(uploadedDocuments);
  });

  app.delete("/api/knowledge-base/documents/:id", (req, res) => {
    const { id } = req.params;
    const idx = uploadedDocuments.findIndex((d) => d.id === id);
    if (idx === -1) return res.status(404).json({ error: "Document not found" });

    const deleted = uploadedDocuments.splice(idx, 1)[0];
    if (vectorStore) {
      vectorStore.docs = vectorStore.docs.filter(
        (chunk: any) => chunk.metadata?.fileName !== deleted.filename
      );
      saveChunksToDisk(vectorStore.docs);
    }
    saveMetaToDisk();
    res.json({ success: true });
  });

  app.get("/api/knowledge-base/status", (_req, res) => {
    res.json({ docCount: uploadedDocuments.length });
  });

  // ===================== Knowledge Base Query =====================
  app.post("/api/knowledge-base/query", async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) return res.status(400).json({ success: false, error: "Question is required" });

      if (!vectorStore || vectorStore.docs.length === 0) {
        return res.json({
          success: true,
          answer: "عذراً، لم يتم رفع أي مستندات في قاعدة المعرفة بعد. يرجى رفع المحتوى التعليمي أولاً.",
          sources: [],
        });
      }

      const results = await vectorStore.similaritySearch(question, 3);
      const context = results.map((r) => r.pageContent).join("\n\n");

      const apiKey = getApiKey();
      const genAI_old = new GoogleGenerativeAI(apiKey);
      const prompt = `أنت مساعد أكاديمي متخصص في مهارات ريادة الأعمال الرقمية.
أجب على سؤال المستخدم بناءً على السياق المرفق فقط. إذا لم تجد الإجابة في السياق، قل: 'عذراً، هذه المعلومة غير متوفرة في المحتوى التعليمي الحالي.'

السياق:
${context || "لا يوجد سياق متاح."}

سؤال الطالب: ${question}`;

      // Try full models first, then fall back to lite and Gemma
      const MODELS = [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash",
        "gemma-3-12b-it",
        "gemma-3-27b-it"
      ];
      let kbResult: any = null;
      
      for (const modelName of MODELS) {
        try {
          console.log(`[KB Query] Trying: ${modelName}`);
          const kbModel = genAI_old.getGenerativeModel({ model: modelName }, { apiVersion: "v1beta" });
          kbResult = await kbModel.generateContent(prompt);
          if (kbResult) break;
        } catch (e: any) {
          console.warn(`[KB Query] ${modelName} failed:`, e.message?.slice(0, 100));
          if (!e.message?.includes("429") && !e.message?.includes("404")) break;
        }
      }

      res.json({
        success: true,
        answer: kbResult?.response.text() || "عذراً، لم أتمكن من توليد إجابة بسبب ضغط على الشبكة.",
        sources: results.map((r) => ({ content: r.pageContent, metadata: r.metadata })),
      });
    } catch (error: any) {
      console.error("Query Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===================== Response Cache (reduce API calls) =====================
  const responseCache = new Map<string, { answer: string; timestamp: number }>();
  const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

  // ===================== Chatbot API =====================
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history = [], userName = "طالب", language = "ar" } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });

      // Check cache first
      const cacheKey = message.trim().toLowerCase().slice(0, 100);
      const cached = responseCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log("[Chat] Cache hit!");
        return res.json({ success: true, answer: cached.answer });
      }

      const apiKey = getApiKey();
      const genAI = new GoogleGenAI({ apiKey });

      // Search knowledge base for relevant context
      let kbContext = "";
      if (vectorStore && vectorStore.docs.length > 0) {
        try {
          const kbResults = await vectorStore.similaritySearch(message, 3);
          if (kbResults.length > 0) {
            kbContext = kbResults.map((r: any) => r.pageContent).join("\n\n");
            console.log(`[Chat] Found ${kbResults.length} KB results for: "${message.slice(0, 40)}..."`);
          }
        } catch (e) {
          console.warn("[Chat] KB search failed:", e);
        }
      }

      const systemText = `أنت مساعد تعليمي ذكي في منصة "بيئة التعلم الإلكترونية وروبوتات الدردشة لتنمية مهارات ريادة الاعمال الرقمية" بجامعة المنيا، كلية التربية النوعية.
اسم المستخدم: ${userName}. تجاوب دائماً بنفس لغة المستخدم. كن مشجعاً ومحترفاً وتعليمياً.
إذا سُئلت عن المنصة: يمكن للطلاب الوصول للكورسات، متابعة التقدم، المشاركة في المنتدى، واستخدام قاعدة المعرفة.
${kbContext ? `\nلديك المحتوى التعليمي التالي من قاعدة المعرفة، استخدمه للإجابة على أسئلة الطلاب:\n${kbContext}` : ""}`;

      const historyText = (history as { role: string; text: string }[])
        .filter((h) => h.text && (h.role === "user" || h.role === "model"))
        .slice(-6)
        .map((h) => `${h.role === "user" ? "المستخدم" : "المساعد"}: ${h.text}`)
        .join("\n");

      const fullPrompt = historyText
        ? `${systemText}\n\n${historyText}\nالمستخدم: ${message}\nالمساعد:`
        : `${systemText}\n\nالمستخدم: ${message}\nالمساعد:`;


      // Try lite models first (separate quota pools), then standard models
      const MODELS = [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash",
        "gemma-3-12b-it",
        "gemma-3-27b-it"
      ];
      let lastError: any = null;

      for (const modelName of MODELS) {
        try {
          console.log(`[Chat] Trying: ${modelName}`);
          const response = await genAI.models.generateContent({
            model: modelName,
            contents: fullPrompt,
            config: {
              maxOutputTokens: 800,
              temperature: 0.7,
            },
          });
          const answer = response.text || "";
          if (answer) {
            console.log(`[Chat] ✅ ${modelName} worked!`);
            // Cache the response
            responseCache.set(cacheKey, { answer, timestamp: Date.now() });
            return res.json({ 
              success: true, 
              answer,
              sources: kbContext ? (await vectorStore.similaritySearch(message, 3)).map((r: any) => ({ content: r.pageContent, metadata: r.metadata })) : []
            });
          }
        } catch (err: any) {
          lastError = err;
          const msg = err.message?.slice(0, 120) || "unknown";
          console.warn(`[Chat] ❌ ${modelName}: ${msg}`);
          // Continue on quota/not-found errors, break on others
          if (!msg.includes("429") && !msg.includes("404") && !msg.includes("quota") && !msg.includes("RESOURCE_EXHAUSTED")) {
            break;
          }
        }
      }

      // All models failed
      const errMsg = lastError?.message || "Unknown error";
      console.error("[Chat] All models failed:", errMsg.slice(0, 200));
      res.status(500).json({
        success: false,
        error: errMsg,
        answer: "عذراً، تم تجاوز حد الاستخدام اليومي للنماذج. يرجى المحاولة بعد دقيقة أو إنشاء مفتاح API جديد من aistudio.google.com",
      });
    } catch (error: any) {
      console.error("Chat API Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        answer: `خطأ: ${error.message?.slice(0, 200)}`,
      });
    }
  });


  // ===================== Vite Middleware =====================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
