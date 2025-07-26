import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { vectorizeAndSave, loadVectors } from "./openAIhelpers.js";

// Debug utility - only logs in development
const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
    console.log(...args);
  }
};

const router = express.Router();

// __dirname workaround in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const traitVectorPath = path.join(__dirname, "openAI_trait_vectors.json");
let traitVectors = loadVectors(traitVectorPath);
const traitsPath = path.join(__dirname, "..", "..", "..", "src", "data", "traits.json");

let staticTraits = [];
try {
  staticTraits = JSON.parse(fs.readFileSync(traitsPath, "utf-8"));
} catch {
  console.warn(`No existing traits.json found. Starting fresh.`);
}

// Routes
router.post("/add", async (req, res) => {
  const { trait } = req.body;
  if (!trait || typeof trait !== "string") {
    return res.status(400).json({ error: "Invalid or missing trait." });
  }

  const titleCaseTrait = trait.replace(/\b\w/g, char => char.toUpperCase()).trim();

  if (traitVectors[titleCaseTrait]) {
    return res.json({
      embedding: traitVectors[titleCaseTrait],
      used: titleCaseTrait
    });
  }

  const vec = await vectorizeAndSave(titleCaseTrait, traitVectorPath, traitVectors, "This is a personal trait or characteristic: ");
  if (!vec) {
    return res.status(500).json({ error: "Failed to generate embedding." });
  }

  // Add to static traits.json if missing
  if (!staticTraits.includes(titleCaseTrait)) {
    staticTraits.push(titleCaseTrait);
    staticTraits.sort();
    fs.writeFileSync(traitsPath, JSON.stringify(staticTraits, null, 2));
    debugLog(`✅ Added new trait to traits.json: "${titleCaseTrait}"`);
  }

  res.json({
    embedding: vec,
    used: titleCaseTrait
  });
});

router.get("/vectors", (req, res) => {
  res.json(traitVectors);
});

export default router;
