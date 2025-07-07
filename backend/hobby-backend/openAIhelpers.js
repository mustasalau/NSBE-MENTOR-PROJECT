import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error("OpenAI Embedding Error:", err);
    return null;
  }
}

export function loadVectors(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    console.warn(`No existing vector file found at ${filePath}, starting fresh.`);
    return {};
  }
}

export async function vectorizeAndSave(term, filePath, vectors, promptPrefix = "") {
  if (vectors[term]) {
    console.log(`"${term}" already vectorized.`);
    return vectors[term];
  }

  const embedding = await getEmbedding(`${promptPrefix}${term}`);

  if (embedding) {
    vectors[term] = embedding;
    fs.writeFileSync(filePath, JSON.stringify(vectors, null, 2));
    console.log(`Vector file updated with: "${term}"`);
  }

  return embedding;
}
