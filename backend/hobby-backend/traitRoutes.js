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

// Resolve traits.json robustly across environments
function resolveTraitsPath() {
  const candidates = [
    // 1) Copied during postinstall
    path.join(__dirname, "data", "traits.json"),
    // 2) Project src/data from backend dir (two ..)
    path.join(__dirname, "..", "..", "src", "data", "traits.json"),
    // 3) From CWD typical root
    path.join(process.cwd(), "src", "data", "traits.json"),
    // 4) Flat data in CWD
    path.join(process.cwd(), "data", "traits.json"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  // Default to backend local data path (ensure directory exists later)
  return path.join(__dirname, "data", "traits.json");
}

const traitsPath = resolveTraitsPath();

let staticTraits = [];
try {
  staticTraits = JSON.parse(fs.readFileSync(traitsPath, "utf-8"));
} catch {
  console.warn(`No existing traits.json found at ${traitsPath}. Starting fresh.`);
  staticTraits = [];
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
    // Ensure directory exists before writing
    const dir = path.dirname(traitsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(traitsPath, JSON.stringify(staticTraits, null, 2));
    debugLog(`✅ Added new trait to traits.json at ${traitsPath}: "${titleCaseTrait}"`);
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
