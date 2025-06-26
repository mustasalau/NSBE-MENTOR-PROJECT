const express = require("express");
const cors = require("cors");
const fs = require("fs");  // Required for writing back to file

const path = require('path');

const { getEmbedding } = require(path.join(__dirname, 'openAIhelpers.js'));
const hobbies = require(path.join(__dirname, '..', '..', 'src', 'data', 'hobbies.json'));
const hobbyVectors = require(path.join(__dirname, 'openAI_hobby_vectors.json'));


const app = express();
app.use(cors());
app.use(express.json());

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}

app.post("/normalize-hobbies", async (req, res) => {
  let userHobbies = req.body.hobbies;
  if (typeof userHobbies === "string") userHobbies = [userHobbies];

  if (!Array.isArray(userHobbies)) {
    return res.status(400).json({ error: "Invalid hobbies format. Provide a string or an array of strings." });
  }

  const results = [];
  let updated = false;

  for (const hobby of userHobbies) {
    const exact = hobbies.find(h => h.toLowerCase() === hobby.toLowerCase());
    if (exact) {
      results.push(exact);
      continue;
    }

    const vec = await getEmbedding(hobby);
    if (!vec) {
      results.push(hobby);  // Fallback
      continue;
    }

    let bestMatch = null;
    let bestScore = -1;

    for (const known in hobbyVectors) {
      const score = cosineSimilarity(vec, hobbyVectors[known]);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = known;
      }
    }

    if (bestScore > 0.50) {
      results.push(`${hobby} (${bestMatch}, ${bestScore.toFixed(2)})`);
    } else {
      results.push(`${hobby} (Closest: ${bestMatch}, Score: ${bestScore.toFixed(2)})`);
    }

    if (!hobbyVectors[hobby]) {
      hobbyVectors[hobby] = vec;
      updated = true;
      console.log(`Added new hobby to vectors: ${hobby}`);
    }
  }

  if (updated) {
  const vectorPath = path.join(__dirname, 'openAI_hobby_vectors.json');
  
  fs.writeFileSync(vectorPath, JSON.stringify(hobbyVectors, null, 2));
  console.log("Hobby vector file updated.");
}

  res.json({ normalized: results });
});

const PORT = 5001;
app.listen(PORT, () => console.log(`Hobby Backend running on port ${PORT}`));
