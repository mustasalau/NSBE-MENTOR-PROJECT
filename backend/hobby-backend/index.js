// @ts-nocheck
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";


import { vectorizeAndSave, loadVectors } from "./openAIhelpers.js";
import traitRoutes from "./traitRoutes.js";
import spotifyRoutes from "./spotifyRoutes.js";

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Neon DB URL
  ssl: { rejectUnauthorized: false },
});

const app = express();
const PORT = process.env.PORT || 5009;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hobbies = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "data", "hobbies.json")));
const hobbyVectorPath = path.join(__dirname, "openAI_hobby_vectors.json");
let hobbyVectors = loadVectors(hobbyVectorPath);

app.use(cors());
app.use(express.json());

// Mount your route modules
app.use("/api/traits", traitRoutes);
app.use("/api/spotify", spotifyRoutes);

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
app.get('/ping', (req, res) => {
  res.send('pong');
});
app.post("/api/submit", async (req, res) => {
  const data = req.body;

  try {
    const {
      role, firstName, lastName, email, personalEmail, studentId,
      major, gender, year, pairGenderPreference, meetingFrequency,
      hobbies, musicalArtists, organizations, personalityWords,
      expectations, idealMatchDescription, menteeInMajor, openToMultiple
    } = data;

    await pool.query(
      `INSERT INTO mentor_mentee_submissions (
        role, first_name, last_name, email, personal_email, student_id,
        major, gender, year, pair_gender_preference, meeting_frequency,
        hobbies, musical_artists, organizations, personality_words,
        expectations, ideal_match_description, mentee_in_major, open_to_multiple
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19
      )`,
      [
        role,
        firstName,
        lastName,
        email,
        personalEmail,
        studentId,
        major,
        gender,
        year,
        pairGenderPreference,
        meetingFrequency,
        hobbies,
        musicalArtists.map((m) => `${m.displayName} (${m.genres.join(', ')})`),
        organizations,
        personalityWords.map((p) => p.raw),
        expectations,
        idealMatchDescription,
        menteeInMajor,
        openToMultiple
      ]
    );

    res.status(200).json({ message: "Submission saved successfully." });
  } catch (err) {
    console.error("Error inserting data:", err);
    res.status(500).json({ error: "Database insert failed." });
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
