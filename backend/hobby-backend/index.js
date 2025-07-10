import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import cookieParser from "cookie-parser";

import { vectorizeAndSave, loadVectors } from "./openAIhelpers.js";
import traitRoutes from "./traitRoutes.js";
import spotifyRoutes from "./spotifyRoutes.js";

dotenv.config();
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const app = express();
const PORT = process.env.PORT || 5009;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hobbies = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "data", "hobbies.json")));
const hobbyVectorPath = path.join(__dirname, "openAI_hobby_vectors.json");
let hobbyVectors = loadVectors(hobbyVectorPath);

app.use(cors({
  origin: [
    'https://nsbe-mentor-project.vercel.app',  // Production
    'http://localhost:5174',                   // Local development
    'http://localhost:3000',                   // Common React dev port
    'http://localhost:5173'                    // Another common Vite port
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/traits", traitRoutes);
app.use("/api/spotify", spotifyRoutes);

// === AUTH LOGIC ===
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;


app.post("/api/login", (req, res) => {
  const { password } = req.body;

  console.log("Login attempt with password:", password);
  console.log("Expected password:", ADMIN_PASSWORD);

  if (password === ADMIN_PASSWORD) {
    res.cookie("loggedIn", "true", {
      httpOnly: true,
      sameSite: "None",
      secure: true,
      maxAge: 24 * 60 * 60 * 1000
    });
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false });
  }
});


app.get("/api/check", (req, res) => {
  if (req.cookies.loggedIn === "true") {
    res.json({ loggedIn: true });
  } else {
    res.status(403).json({ loggedIn: false });
  }
});

// === END AUTH ===

app.post("/api/hobbies/normalize", async (req, res) => {
  let userHobbies = req.body.hobbies;
  if (typeof userHobbies === "string") userHobbies = [userHobbies];

  if (!Array.isArray(userHobbies)) {
    return res.status(400).json({ error: "Invalid hobbies format. Provide a string or array." });
  }

  const results = [];
  let updated = false;

  for (const hobby of userHobbies) {
    const normalized = hobby.trim().replace(/\b\w/g, (c) => c.toUpperCase());
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

app.get("/api/submissions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM mentor_mentee_submissions ORDER BY created_at DESC LIMIT 100");
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch submissions:", err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
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
