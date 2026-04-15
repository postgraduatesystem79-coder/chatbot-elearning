import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

async function testModels() {
  const key = "AIzaSyAec4bPimwO_GEoDvSd60AhVsepYTFncxw";
  const genAI = new GoogleGenerativeAI(key);
  const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.0-flash-exp", "gemini-pro"];
  
  console.log("Starting model diagnostic...");
  
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hi");
      console.log(`✅ ${modelName} works! Response: ${result.response.text().substring(0, 20)}...`);
      process.exit(0); // If one works, we are good
    } catch (e: any) {
      console.log(`❌ ${modelName} failed: ${e.message}`);
    }
  }
}

testModels();
