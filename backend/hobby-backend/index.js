// @ts-nocheck
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { vectorizeAndSave, loadVectors } = require("./openAIhelpers.js");
const hobbies = require(path.join(__dirname, "..", "..", "src", "data", "hobbies.json"));
const hobbyVectorPath = path.join(__dirname, "openAI_hobby_vectors.json");
let hobbyVectors = loadVectors(hobbyVectorPath);

const traitRoutes = require("./traitRoutes.js");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/traits", traitRoutes);

function toTitleCase(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

app.post("/api/hobbies/normalize", async (req, res) => {
  let userHobbies = req.body.hobbies;
  if (typeof userHobbies === "string") userHobbies = [userHobbies];

  if (!Array.isArray(userHobbies)) {
    return res.status(400).json({ error: "Invalid hobbies format. Provide a string or array." });
  }

  const results = [];
  let updated = false;

  for (const hobby of userHobbies) {
    const normalized = toTitleCase(hobby.trim());
    if (!normalized) continue;

    const exists = hobbies.find(h => h.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      results.push(exists);
      continue;
    }

    if (!hobbyVectors[normalized]) {
      console.log(`Vectorizing new hobby: "${normalized}"`);
      const vec = await vectorizeAndSave(normalized, hobbyVectorPath, hobbyVectors, "This is a hobby or leisure activity someone might enjoy: ");

      if (vec) {
        hobbyVectors[normalized] = vec;
        hobbies.push(normalized);
        updated = true;
        console.log(`Added "${normalized}" to hobby list and vector set.`);
      } else {
        console.warn(`Failed to vectorize: "${normalized}"`);
        continue;
      }
    }

    results.push(normalized);
  }

  if (updated) {
    fs.writeFileSync(hobbyVectorPath, JSON.stringify(hobbyVectors, null, 2));
    fs.writeFileSync(path.join(__dirname, "..", "..", "src", "data", "hobbies.json"), JSON.stringify(hobbies, null, 2));
    console.log("Hobby list and vector file updated.");
  }

  res.json({ normalized: results });
});

app.get("/api/hobbies/vectors", (req, res) => {
  res.json(hobbyVectors);
});

const PORT = 5009;
app.listen(PORT, () => console.log(`Hobby Backend running on port ${PORT}`));
