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

// Convert array to pgvector string format
export function arrayToVectorString(array) {
  if (!Array.isArray(array) || array.length !== 1536) {
    throw new Error('Vector must be an array of 1536 numbers');
  }
  return `[${array.join(',')}]`;
}

// Update vectorizeText to support hobby and trait types
export async function vectorizeText(text, textType, role) {
  let promptPrefix = "";
  
  if (textType === "expectations") {
    if (role === "mentor") {
      promptPrefix = "These are the expectations a mentor has for their prospective mentee: ";
    } else {
      promptPrefix = "These are the expectations a mentee has for their prospective mentor: ";
    }
  } else if (textType === "idealMatch") {
    if (role === "mentor") {
      promptPrefix = "This is a description of a mentor's ideal mentee: ";
    } else {
      promptPrefix = "This is a description of a mentee's ideal mentor: ";
    }
  } else if (textType === "hobby") {
    promptPrefix = "This is a hobby or leisure activity someone might enjoy: ";
  } else if (textType === "trait") {
    promptPrefix = "This is a personal trait or characteristic: ";
  }

  const embedding = await getEmbedding(`${promptPrefix}${text}`);
  return embedding;
}
