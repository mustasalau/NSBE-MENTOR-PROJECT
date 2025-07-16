import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import cookieParser from "cookie-parser";

import { vectorizeAndSave, loadVectors, vectorizeText, arrayToVectorString } from "./openAIhelpers.js";import traitRoutes from "./traitRoutes.js";
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

// ✅ ADD: Load trait vectors globally
const traits = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "data", "traits.json")));
const traitVectorPath = path.join(__dirname, "openAI_trait_vectors.json");
let traitVectors = loadVectors(traitVectorPath);

// Security Headers Middleware
app.use((req, res, next) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.openai.com https://api.spotify.com https://accounts.spotify.com; " +
    "font-src 'self' data:; " +
    "object-src 'none'; " +
    "frame-ancestors 'none';"
  );
  
  // Additional security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  next();
});

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
app.use(express.json({ limit: '10mb' })); // Add size limit
app.use(cookieParser());

// Input validation and sanitization middleware
const validateAndSanitize = (req, res, next) => {
  // Sanitize string inputs by removing HTML and script tags
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Apply sanitization to request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

app.use(validateAndSanitize);

// Simple rate limiting middleware
const rateLimitMap = new Map();

const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => { // 100 requests per 15 minutes
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitMap.has(clientIP)) {
      rateLimitMap.set(clientIP, []);
    }
    
    const requests = rateLimitMap.get(clientIP);
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    recentRequests.push(now);
    rateLimitMap.set(clientIP, recentRequests);
    
    next();
  };
};

// Apply rate limiting to all routes
app.use(rateLimit());

// Stricter rate limiting for expensive operations
const strictRateLimit = rateLimit(10, 15 * 60 * 1000); // 10 requests per 15 minutes

app.use("/api/traits", traitRoutes);
app.use("/api/spotify", spotifyRoutes);

// === AUTH LOGIC ===
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;


app.post("/api/login", (req, res) => {
  const { password } = req.body;

  console.log("Login attempt with password:", password);

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

app.post("/api/hobbies/normalize", strictRateLimit, async (req, res) => {
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

// Test endpoint for text vectorization
app.post("/api/test-text-vectorization", strictRateLimit, async (req, res) => {
  try {
    const { text, textType, role } = req.body;
    
    if (!text || !textType || !role) {
      return res.status(400).json({ 
        error: "Missing required fields: text, textType (expectations|idealMatch), and role (mentor|mentee)" 
      });
    }

    console.log(`Testing vectorization for ${role} ${textType}: "${text}"`);
    const vector = await vectorizeText(text, textType, role);
    
    if (vector) {
      res.json({
        success: true,
        text,
        textType,
        role,
        vectorLength: vector.length,
        sampleVector: vector.slice(0, 5) // First 5 dimensions for testing
      });
    } else {
      res.status(500).json({ error: "Failed to generate vector" });
    }
  } catch (err) {
    console.error("Text vectorization test error:", err);
    res.status(500).json({ error: "Vectorization failed", detail: err.message });
  }
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


app.post("/api/submit", strictRateLimit, async (req, res) => {
  const data = req.body;

  try {
    const {
      role, firstName, lastName, email, personalEmail, studentId,
      major, gender, year, pairGenderPreference, meetingFrequency,
      hobbies, musicalArtists, organizations, personalityWords,
      expectations, idealMatchDescription, menteeInMajor, openToMultiple
    } = data;

    // Validate character limits for expectations and ideal match description
    if (expectations && expectations.length > 250) {
      return res.status(400).json({ 
        error: "Expectations must be 250 characters or less",
        field: "expectations",
        current: expectations.length,
        max: 250
      });
    }

    if (idealMatchDescription && idealMatchDescription.length > 250) {
      return res.status(400).json({ 
        error: "Ideal match description must be 250 characters or less",
        field: "idealMatchDescription", 
        current: idealMatchDescription.length,
        max: 250
      });
    }

    // ✅ EXISTING: Vectorize expectations and ideal match (JSONB)
    let expectationsVector = null;
    let idealMatchVector = null;

    if (expectations && expectations.trim()) {
      console.log(`Vectorizing expectations for ${role}: "${expectations}"`);
      expectationsVector = await vectorizeText(expectations, "expectations", role);
    }

    if (idealMatchDescription && idealMatchDescription.trim()) {
      console.log(`Vectorizing ideal match description for ${role}: "${idealMatchDescription}"`);
      idealMatchVector = await vectorizeText(idealMatchDescription, "idealMatch", role);
    }

    // ✅ Update around lines 320-355 - Use cached vectors instead of fresh API calls

    // Vectorize hobbies using CACHED vectors
    let hobbyVectorArray = null;
    if (hobbies && hobbies.length > 0) {
      console.log(`Getting cached vectors for hobbies:`, hobbies);
      const hobbyVectorStrings = [];
      
      for (const hobby of hobbies) {
        if (hobby && hobby.trim()) {
          const hobbyKey = hobby.trim();
          
          // ✅ Try cached vector first
          let embeddingArray = hobbyVectors[hobbyKey];
          
          // ✅ If not cached, vectorize and cache it
          if (!embeddingArray) {
            console.log(`Vectorizing new hobby: "${hobbyKey}"`);
            embeddingArray = await vectorizeAndSave(hobbyKey, hobbyVectorPath, hobbyVectors, "This is a hobby or leisure activity someone might enjoy: ");
          }
          
          if (embeddingArray && embeddingArray.length === 1536) {
            hobbyVectorStrings.push(arrayToVectorString(embeddingArray));
          }
        }
      }
      
      if (hobbyVectorStrings.length > 0) {
        hobbyVectorArray = `{${hobbyVectorStrings.map(v => `"${v}"`).join(',')}}`;
      }
    }

    // Vectorize traits using CACHED vectors  
    let traitVectorArray = null;
    if (personalityWords && personalityWords.length > 0) {
      console.log(`Getting cached vectors for traits:`, personalityWords.map(p => p.raw));
      const traitVectorStrings = [];
      
      for (const trait of personalityWords) {
        if (trait.raw && trait.raw.trim()) {
          const traitKey = trait.raw.trim();
          
          // ✅ Try cached vector first
          let embeddingArray = traitVectors[traitKey];
          
          // ✅ If not cached, vectorize and cache it
          if (!embeddingArray) {
            console.log(`Vectorizing new trait: "${traitKey}"`);
            embeddingArray = await vectorizeAndSave(traitKey, traitVectorPath, traitVectors, "This is a personal trait or characteristic: ");
          }
          
          if (embeddingArray && embeddingArray.length === 1536) {
            traitVectorStrings.push(arrayToVectorString(embeddingArray));
          }
        }
      }
      
      if (traitVectorStrings.length > 0) {
        traitVectorArray = `{${traitVectorStrings.map(v => `"${v}"`).join(',')}}`;
      }
    }

    await pool.query(
      `INSERT INTO mentor_mentee_submissions (
        role, first_name, last_name, email, personal_email, student_id,
        major, gender, year, pair_gender_preference, meeting_frequency,
        hobbies, organizations, personality_words,
        expectations, ideal_match_description, mentee_in_major, open_to_multiple,
        musical_artists_json, 
        expectations_vector, ideal_match_vector,
        hobby_vectors, trait_vectors
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23
      )`,
      [
        role, firstName, lastName, email, personalEmail, studentId,
        major, gender, year, pairGenderPreference, meetingFrequency,
        hobbies,
        organizations,
        personalityWords.map((p) => p.raw),
        expectations,
        idealMatchDescription,
        menteeInMajor,
        openToMultiple,
        JSON.stringify(musicalArtists),
        expectationsVector ? JSON.stringify(expectationsVector) : null,  // ✅ EXISTING: JSONB
        idealMatchVector ? JSON.stringify(idealMatchVector) : null,      // ✅ EXISTING: JSONB
        hobbyVectorArray,                                                // ✅ NEW: Native vector
        traitVectorArray                                                 // ✅ NEW: Native vector
      ]
    );

    res.status(200).json({ message: "Submission saved successfully." });
  } catch (err) {
    console.error("Error inserting data:", err);
    res.status(500).json({ error: "Database insert failed.", detail: err.message });
  }
});

app.post("/api/save-match-settings", async (req, res) => {
  const {
    major,
    gender,
    hobbies,
    musicalArtists,
    personalityWords,
    expectations,
    organizations,
    meetingFrequency,
  } = req.body;

  try {
    const existing = await pool.query("SELECT id FROM match_settings LIMIT 1");

    if (existing.rows.length > 0) {
      // Update existing row
      await pool.query(
        `UPDATE match_settings SET
          major = $1,
          gender = $2,
          hobbies = $3,
          musical_artists = $4,
          personality_words = $5,
          expectations = $6,
          organizations = $7,
          meeting_frequency = $8,
          updated_at = NOW()
        WHERE id = $9`,
        [
          major,
          gender,
          hobbies,
          musicalArtists,
          personalityWords,
          expectations,
          organizations,
          meetingFrequency,
          existing.rows[0].id,
        ]
      );
    } else {
      // Insert new row
      await pool.query(
        `INSERT INTO match_settings
        (major, gender, hobbies, musical_artists, personality_words, expectations, organizations, meeting_frequency)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          major,
          gender,
          hobbies,
          musicalArtists,
          personalityWords,
          expectations,
          organizations,
          meetingFrequency,
        ]
      );
    }

    res.status(200).json({ message: "Match settings saved successfully." });
  } catch (err) {
    console.error("Error saving match settings:", err);
    res.status(500).json({ error: "Failed to save match settings." });
  }
});

app.get("/api/get-match-settings", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM match_settings LIMIT 1");

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No settings found." });
    }

    const row = result.rows[0];

    res.status(200).json({
      major: row.major,
      gender: row.gender,
      hobbies: row.hobbies,
      musicalArtists: row.musical_artists,
      personalityWords: row.personality_words,
      expectations: row.expectations,
      organizations: row.organizations,
      meetingFrequency: row.meeting_frequency,
    });
  } catch (err) {
    console.error("Error fetching match settings:", err);
    res.status(500).json({ error: "Failed to load match settings." });
  }
});



// Utility functions for matching algorithm
function mapWeight(level) {
  switch (level) {
    case "High": return 3;
    case "Medium": return 2;
    case "Low": return 1;
    default: return 1;
  }
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function averageVector(vectors) {
  if (!vectors.length) return null;
  const dimensions = vectors[0].length;
  const avgVector = new Array(dimensions).fill(0);
  
  vectors.forEach(vector => {
    vector.forEach((val, i) => {
      avgVector[i] += val;
    });
  });
  
  return avgVector.map(val => val / vectors.length);
}

// Convert array to pgvector string format


// ✅ EXISTING: For JSONB vectors (expectations/ideal match)
function computeTextVectorSimilarity(vectorStr1, vectorStr2) {
  if (!vectorStr1 || !vectorStr2) return 0;
  
  try {
    const vec1 = JSON.parse(vectorStr1);
    const vec2 = JSON.parse(vectorStr2);
    return cosineSimilarity(vec1, vec2);
  } catch (e) {
    console.warn("Failed to parse text vectors for similarity:", e);
    return 0;
  }
}

// ✅ NEW: For native vector arrays (hobbies/traits)
async function calculateNativeVectorSimilarity(mentorId, menteeId, vectorType) {
  const columnName = vectorType === 'hobby' ? 'hobby_vectors' : 'trait_vectors';
  
  try {
    const result = await pool.query(`
      WITH mentor_avg AS (
        SELECT vector_avg(unnest(${columnName})) as avg_vector 
        FROM mentor_mentee_submissions 
        WHERE id = $1 AND ${columnName} IS NOT NULL
      ),
      mentee_avg AS (
        SELECT vector_avg(unnest(${columnName})) as avg_vector 
        FROM mentor_mentee_submissions 
        WHERE id = $2 AND ${columnName} IS NOT NULL
      )
      SELECT 1 - (mentor_avg.avg_vector <=> mentee_avg.avg_vector) as similarity
      FROM mentor_avg, mentee_avg
      WHERE mentor_avg.avg_vector IS NOT NULL 
        AND mentee_avg.avg_vector IS NOT NULL
    `, [mentorId, menteeId]);

    return result.rows.length > 0 ? result.rows[0].similarity : 0;
  } catch (err) {
    console.error(`Error calculating ${vectorType} similarity:`, err);
    return 0;
  }
}

// Mentor capacity management functions
function getMentorCapacity(mentor) {
  // Mentors open to multiple can have max 2 mentees, others can have max 1
  return mentor.open_to_multiple === "Yes" ? 2 : 1;
}

// Musical compatibility functions
function parseMusicalArtists(musicalArtistsJson) {
  if (!musicalArtistsJson) return [];
  try {
    return typeof musicalArtistsJson === 'string' ? JSON.parse(musicalArtistsJson) : musicalArtistsJson;
  } catch (e) {
    console.warn("Failed to parse musical artists JSON:", e);
    return [];
  }
}

// Extract artist name from displayName (handles both "Artist" and "Song by Artist" formats)
function extractArtistName(displayName) {
  // Check if it contains " by " (song/album format)
  const byIndex = displayName.lastIndexOf(' by ');
  if (byIndex !== -1) {
    // Extract everything after " by "
    return displayName.substring(byIndex + 4).trim();
  }
  // Otherwise, it's just the artist name
  return displayName.trim();
}

function calculateArtistOverlap(mentorArtists, menteeArtists) {
  if (!mentorArtists.length || !menteeArtists.length) return 0;
  
  // Extract actual artist names from displayNames
  const mentorNames = new Set(mentorArtists.map(a => extractArtistName(a.displayName).toLowerCase()));
  const menteeNames = new Set(menteeArtists.map(a => extractArtistName(a.displayName).toLowerCase()));
  
  const overlap = [...mentorNames].filter(name => menteeNames.has(name)).length;
  const union = new Set([...mentorNames, ...menteeNames]).size;
  
  return union > 0 ? overlap / union : 0; // Jaccard similarity
}

function calculateGenreSimilarity(mentorArtists, menteeArtists) {
  if (!mentorArtists.length || !menteeArtists.length) return 0;
  
  // Extract all genres from artists
  const mentorGenres = new Set();
  const menteeGenres = new Set();
  
  mentorArtists.forEach(artist => {
    artist.genres.forEach(genre => mentorGenres.add(genre.toLowerCase()));
  });
  
  menteeArtists.forEach(artist => {
    artist.genres.forEach(genre => menteeGenres.add(genre.toLowerCase()));
  });
  
  if (!mentorGenres.size || !menteeGenres.size) return 0;
  
  const overlap = [...mentorGenres].filter(genre => menteeGenres.has(genre)).length;
  const union = new Set([...mentorGenres, ...menteeGenres]).size;
  
  return union > 0 ? overlap / union : 0; // Jaccard similarity
}

function calculateMusicalDiversity(mentorArtists, menteeArtists) {
  if (!mentorArtists.length || !menteeArtists.length) return 0;
  
  // Calculate genre diversity for each person
  const mentorGenres = new Set();
  const menteeGenres = new Set();
  
  mentorArtists.forEach(artist => {
    artist.genres.forEach(genre => mentorGenres.add(genre.toLowerCase()));
  });
  
  menteeArtists.forEach(artist => {
    artist.genres.forEach(genre => menteeGenres.add(genre.toLowerCase()));
  });
  
  const mentorDiversity = mentorGenres.size / Math.max(mentorArtists.length, 1);
  const menteeDiversity = menteeGenres.size / Math.max(menteeArtists.length, 1);
  
  // Reward pairs where both have diverse tastes (more likely to discover new music together)
  // Use harmonic mean to ensure both have good diversity
  if (mentorDiversity === 0 || menteeDiversity === 0) return 0;
  
  return (2 * mentorDiversity * menteeDiversity) / (mentorDiversity + menteeDiversity);
}

function calculateMusicalCompatibility(mentor, mentee, weight) {
  const mentorArtists = parseMusicalArtists(mentor.musical_artists_json);
  const menteeArtists = parseMusicalArtists(mentee.musical_artists_json);
  
  if (!mentorArtists.length || !menteeArtists.length) {
    return { score: 0, details: { artistOverlap: 0, genreSimilarity: 0, musicalDiversity: 0, hasData: false } };
  }
  
  // Calculate individual components
  const artistOverlap = calculateArtistOverlap(mentorArtists, menteeArtists);
  const genreSimilarity = calculateGenreSimilarity(mentorArtists, menteeArtists);
  const musicalDiversity = calculateMusicalDiversity(mentorArtists, menteeArtists);
  
  // Weighted combination:
  // - Artist overlap: 40% (direct shared interests)
  // - Genre similarity: 40% (broader musical compatibility)
  // - Musical diversity: 20% (potential for mutual discovery)
  const combinedScore = (artistOverlap * 0.3) + (genreSimilarity * 0.5) + (musicalDiversity * 0.2);
  const finalScore = combinedScore * mapWeight(weight);
  
  return {
    score: finalScore,
    details: {
      artistOverlap: artistOverlap,
      genreSimilarity: genreSimilarity,
      musicalDiversity: musicalDiversity,
      combinedScore: combinedScore,
      hasData: true,
      mentorArtistsCount: mentorArtists.length,
      menteeArtistsCount: menteeArtists.length
    }
  };
}

async function optimizeAssignments(mentees, mentors, settings) {
  // Create all possible mentor-mentee pairs with scores
  const allPairs = [];
  
  for (const mentee of mentees) {
    for (const mentor of mentors) {
      const result = await calculateSimilarity(mentor, mentee, settings);
      allPairs.push({
        menteeId: mentee.id,
        mentorId: mentor.id,
        score: result.score,
        details: result.details,
        mentee: mentee,
        mentor: mentor
      });
    }
  } 

  // Sort pairs by score (highest first)
  allPairs.sort((a, b) => b.score - a.score);

  // Track mentor assignments and capacity
  const mentorAssignments = new Map();
  const menteeAssignments = new Map();
  const assignments = [];

  // Initialize mentor tracking
  mentors.forEach(mentor => {
    mentorAssignments.set(mentor.id, {
      mentor: mentor,
      capacity: getMentorCapacity(mentor),
      assigned: 0,
      mentees: []
    });
  });

  // Greedy assignment based on scores
  for (const pair of allPairs) {
    const { menteeId, mentorId, score, details, mentee, mentor } = pair;

    // Skip if mentee is already assigned
    if (menteeAssignments.has(menteeId)) continue;

    // Skip if mentor is at capacity
    const mentorInfo = mentorAssignments.get(mentorId);
    if (mentorInfo.assigned >= mentorInfo.capacity) continue;

    // Make the assignment
    mentorInfo.assigned++;
    mentorInfo.mentees.push({
      mentee: {
        id: mentee.id,
        firstName: mentee.first_name,
        lastName: mentee.last_name,
        email: mentee.email,
        major: mentee.major,
        year: mentee.year,
        hobbies: mentee.hobbies,
        organizations: mentee.organizations,
        meetingFrequency: mentee.meeting_frequency,
        menteeInMajor: mentee.mentee_in_major,
        pairGenderPreference: mentee.pair_gender_preference
      },
      score: score,
      details: details
    });

    menteeAssignments.set(menteeId, {
      mentorId: mentorId,
      score: score,
      details: details
    });

    assignments.push({
      menteeId: menteeId,
      mentorId: mentorId,
      score: score,
      details: details
    });
  }

  return {
    assignments: assignments,
    mentorAssignments: mentorAssignments,
    menteeAssignments: menteeAssignments,
    unassignedMentees: mentees.filter(m => !menteeAssignments.has(m.id))
  };
}

async function calculateSimilarity(mentor, mentee, weights) {
  let score = 0;
  let details = {}; // For debugging

  // Major Match (bidirectional - considers both mentor and mentee preferences)
  const menteeWantsMajorMatch = mentee.mentee_in_major === "Yes";
  const mentorWantsMajorMatch = mentor.mentee_in_major === "Yes";
  
  // Calculate weight based on both parties' preferences
  let majorWeight;
  if (menteeWantsMajorMatch && mentorWantsMajorMatch) {
    majorWeight = (weights.major === "High" ? 3 : weights.major === "Medium" ? 2 : 1);
  } else if (menteeWantsMajorMatch || mentorWantsMajorMatch) {
    majorWeight = (weights.major === "High" ? 1.5 : weights.major === "Medium" ? 1 : 0.5);
  } else {
    majorWeight = (weights.major === "Low" ? 1 : 0.5);
  }
  
  // Check if majors actually match
  const majorsMatch = mentor.major && mentee.major && 
    mentor.major.toLowerCase().includes(mentee.major.toLowerCase());
  
  // Check if each party's major preference is satisfied
  const menteeMajorSatisfied = !menteeWantsMajorMatch || majorsMatch;
  const mentorMajorSatisfied = !mentorWantsMajorMatch || majorsMatch;
  
  let majorScore = 0;
  let majorDetails = {
    menteeWantedMatch: menteeWantsMajorMatch,
    mentorWantedMatch: mentorWantsMajorMatch,
    menteeMajorSatisfied: menteeMajorSatisfied,
    mentorMajorSatisfied: mentorMajorSatisfied,
    majorsMatch: majorsMatch
  };
  
  if (menteeMajorSatisfied && mentorMajorSatisfied) {
    // Both preferences satisfied - full score
    majorScore = majorWeight;
    majorDetails.matched = true;
    majorDetails.bothSatisfied = true;
  } else if (menteeMajorSatisfied || mentorMajorSatisfied) {
    // Only one preference satisfied - partial score
    majorScore = majorWeight * 0.5;
    majorDetails.matched = "partial";
    majorDetails.bothSatisfied = false;
  } else {
    // Neither preference satisfied - penalty
    majorScore = -2;
    majorDetails.matched = false;
    majorDetails.bothSatisfied = false;
    majorDetails.penalty = true;
  }
  
  score += majorScore;
  details.major = { score: majorScore, ...majorDetails };

  // Gender Preference (bidirectional - considers both mentor and mentee preferences)
  const menteeHasGenderPref = mentee.pair_gender_preference !== "No Preference";
  const mentorHasGenderPref = mentor.pair_gender_preference !== "No Preference";
  
  // Check if preferences are satisfied
  const menteeGenderSatisfied = !menteeHasGenderPref || mentor.gender === mentee.pair_gender_preference;
  const mentorGenderSatisfied = !mentorHasGenderPref || mentee.gender === mentor.pair_gender_preference;
  
  let genderScore = 0;
  let genderDetails = {
    menteePreference: mentee.pair_gender_preference,
    mentorPreference: mentor.pair_gender_preference,
    menteeGenderSatisfied: menteeGenderSatisfied,
    mentorGenderSatisfied: mentorGenderSatisfied
  };
  
  // Calculate gender weight based on preference strength
  let genderWeight;
  if (menteeHasGenderPref && mentorHasGenderPref) {
    genderWeight = (weights.gender === "High" ? 3 : weights.gender === "Medium" ? 2 : 1);
  } else if (menteeHasGenderPref || mentorHasGenderPref) {
    genderWeight = (weights.gender === "High" ? 1.5 : weights.gender === "Medium" ? 1 : 0.5);
  } else {
    genderWeight = (weights.gender === "Low" ? 1 : 0.5);
  }

  if (menteeGenderSatisfied && mentorGenderSatisfied) {
    // Both preferences satisfied - full score
    genderScore = genderWeight;
    genderDetails.matched = true;
    genderDetails.bothSatisfied = true;
  } else if (menteeGenderSatisfied || mentorGenderSatisfied) {
    // Only one preference satisfied - partial score
    genderScore = genderWeight * 0.5;
    genderDetails.matched = "partial";
    genderDetails.bothSatisfied = false;
  } else {
    // Neither preference satisfied - penalty
    genderScore = -2;
    genderDetails.matched = false;
    genderDetails.bothSatisfied = false;
    genderDetails.penalty = true;
  }
  
  score += genderScore;
  details.gender = { score: genderScore, ...genderDetails };

  // Meeting Frequency (enhanced compatibility scoring)
  function getMeetingFrequencyCompatibility(freq1, freq2) {
    if (!freq1 || !freq2) return 0;
    
    // Exact match gets full compatibility
    if (freq1 === freq2) return 1.0;
    
    // Define compatibility matrix
    const compatibilityMatrix = {
      "Weekly": {
        "Bi-Weekly": 0.7,  // Both are frequent meetings
        "Monthly": 0.2     // Very different commitment levels
      },
      "Bi-Weekly": {
        "Weekly": 0.7,     // Both are frequent meetings
        "Monthly": 0.5     // Moderate compatibility
      },
      "Monthly": {
        "Weekly": 0.2,     // Very different commitment levels
        "Bi-Weekly": 0.5   // Moderate compatibility
      }
    };
    
    return compatibilityMatrix[freq1]?.[freq2] || 0;
  }
  
  const frequencyCompatibility = getMeetingFrequencyCompatibility(
    mentor.meeting_frequency, 
    mentee.meeting_frequency
  );
  
  const frequencyScore = frequencyCompatibility * mapWeight(weights.meeting_frequency);
  score += frequencyScore;
  
  details.meetingFrequency = { 
    score: frequencyScore,
    compatibility: frequencyCompatibility,
    mentorPreference: mentor.meeting_frequency,
    menteePreference: mentee.meeting_frequency,
    matched: frequencyCompatibility === 1.0 ? true : 
             frequencyCompatibility > 0.5 ? "high" :
             frequencyCompatibility > 0.2 ? "moderate" : "low"
  };

  // Hobby Similarity using vectors
  const hobbySimilarity = await calculateNativeVectorSimilarity(mentor.id, mentee.id, 'hobby');
  const hobbyScore = hobbySimilarity * mapWeight(weights.hobbies);
  score += hobbyScore;
  details.hobbies = { score: hobbyScore, similarity: hobbySimilarity };

  // Personality Traits Similarity using vectors
  const traitSimilarity = await calculateNativeVectorSimilarity(mentor.id, mentee.id, 'trait');
  const traitScore = traitSimilarity * mapWeight(weights.personality_words);
  score += traitScore;
  details.personalityWords = { score: traitScore, similarity: traitSimilarity };

  // Expectations vs Ideal Match Description (cross-comparison)
  const expectationsScore = computeTextVectorSimilarity(mentor.expectations_vector, mentee.ideal_match_vector) * mapWeight(weights.expectations);
  score += expectationsScore;
  details.expectations = { score: expectationsScore };

  // Ideal Match vs Expectations (reverse comparison)
  const idealMatchScore = computeTextVectorSimilarity(mentor.ideal_match_vector, mentee.expectations_vector) * mapWeight(weights.expectations);
  score += idealMatchScore;
  details.idealMatch = { score: idealMatchScore };

  // Organizations (simple string overlap)
  const mentorOrgs = mentor.organizations || [];
  const menteeOrgs = mentee.organizations || [];
  const orgOverlap = mentorOrgs.filter(org => menteeOrgs.includes(org)).length;
  const orgScore = orgOverlap * mapWeight(weights.organizations);
  score += orgScore;
  details.organizations = { score: orgScore, overlap: orgOverlap };

  // Musical Compatibility
  const musicalCompatibility = calculateMusicalCompatibility(mentor, mentee, weights.musical_artists);
  score += musicalCompatibility.score;
  details.musicalCompatibility = musicalCompatibility.details;

  return { score, details };
}

// Generate matches endpoint with mentor capacity management
app.get("/api/generate-matches", async (req, res) => {
  try {
    console.log("🔄 Generating matches with mentor capacity management...");
    
    const result = await pool.query("SELECT * FROM mentor_mentee_submissions ORDER BY created_at DESC");
    const settingsResult = await pool.query("SELECT * FROM match_settings LIMIT 1");
    
    if (!settingsResult.rows.length) {
      return res.status(400).json({ error: "Match settings missing. Please configure match settings first." });
    }

    const submissions = result.rows;
    const settings = settingsResult.rows[0];

    const mentors = submissions.filter(s => s.role === "mentor");
    const mentees = submissions.filter(s => s.role === "mentee");

    console.log(`Found ${mentors.length} mentors and ${mentees.length} mentees`);

    if (mentors.length === 0) {
      return res.json({ message: "No mentors available for matching.", matches: [] });
    }

    if (mentees.length === 0) {
      return res.json({ message: "No mentees to match.", matches: [] });
    }

    // Use capacity-aware assignment optimization
    const assignmentResult = await optimizeAssignments(mentees, mentors, settings);
    
    // Convert mentor assignments to response format
    const mentorMatches = [];
    assignmentResult.mentorAssignments.forEach((mentorInfo, mentorId) => {
      if (mentorInfo.assigned > 0) {
        mentorMatches.push({
          mentor: {
            id: mentorInfo.mentor.id,
            firstName: mentorInfo.mentor.first_name,
            lastName: mentorInfo.mentor.last_name,
            email: mentorInfo.mentor.email,
            major: mentorInfo.mentor.major,
            year: mentorInfo.mentor.year,
            hobbies: mentorInfo.mentor.hobbies,
            organizations: mentorInfo.mentor.organizations,
            meetingFrequency: mentorInfo.mentor.meeting_frequency,
            openToMultiple: mentorInfo.mentor.open_to_multiple,
            capacity: mentorInfo.capacity,
            assigned: mentorInfo.assigned
          },
          assignedMentees: mentorInfo.mentees,
          utilizationRate: (mentorInfo.assigned / mentorInfo.capacity * 100).toFixed(1)
        });
      }
    });

    // Convert mentee assignments to response format
    const menteeMatches = [];
    const unassignedMentees = [];
    
    mentees.forEach(mentee => {
      const assignment = assignmentResult.menteeAssignments.get(mentee.id);
      const menteeData = {
        id: mentee.id,
        firstName: mentee.first_name,
        lastName: mentee.last_name,
        email: mentee.email,
        major: mentee.major,
        year: mentee.year,
        hobbies: mentee.hobbies,
        organizations: mentee.organizations,
        meetingFrequency: mentee.meeting_frequency,
        menteeInMajor: mentee.mentee_in_major,
        pairGenderPreference: mentee.pair_gender_preference
      };

      if (assignment) {
        const assignedMentor = assignmentResult.mentorAssignments.get(assignment.mentorId);
        menteeMatches.push({
          mentee: menteeData,
          assignedMentor: {
            id: assignedMentor.mentor.id,
            firstName: assignedMentor.mentor.first_name,
            lastName: assignedMentor.mentor.last_name,
            email: assignedMentor.mentor.email,
            major: assignedMentor.mentor.major,
            year: assignedMentor.mentor.year,
            hobbies: assignedMentor.mentor.hobbies,
            organizations: assignedMentor.mentor.organizations,
            meetingFrequency: assignedMentor.mentor.meeting_frequency,
            openToMultiple: assignedMentor.mentor.open_to_multiple
          },
          matchScore: assignment.score,
          matchDetails: assignment.details
        });
      } else {
        unassignedMentees.push({
          mentee: menteeData,
          reason: "No available mentor with compatible preferences and capacity"
        });
      }
    });

    console.log("✅ Capacity-aware matches generated successfully");
    
    const totalCapacity = mentors.reduce((sum, mentor) => sum + getMentorCapacity(mentor), 0);
    const totalAssigned = assignmentResult.assignments.length;
    
    res.json({ 
      mentorMatches,
      menteeMatches,
      unassignedMentees,
      summary: {
        totalMentors: mentors.length,
        totalMentees: mentees.length,
        totalCapacity: totalCapacity,
        totalAssigned: totalAssigned,
        utilizationRate: totalCapacity > 0 ? (totalAssigned / totalCapacity * 100).toFixed(1) : "0.0",
        unassignedCount: unassignedMentees.length,
        mentorsOpenToMultiple: mentors.filter(m => m.open_to_multiple === "Yes").length,
        settings: settings
      }
    });
    
  } catch (err) {
    console.error("Error generating matches:", err);
    res.status(500).json({ error: "Match generation failed.", detail: err.message });
  }
});

// Debug endpoint for detailed match analysis
app.get("/api/debug-match/:menteeId/:mentorId", async (req, res) => {
  try {
    const { menteeId, mentorId } = req.params;
    
    const menteeResult = await pool.query("SELECT * FROM mentor_mentee_submissions WHERE id = $1 AND role = 'mentee'", [menteeId]);
    const mentorResult = await pool.query("SELECT * FROM mentor_mentee_submissions WHERE id = $1 AND role = 'mentor'", [mentorId]);
    const settingsResult = await pool.query("SELECT * FROM match_settings LIMIT 1");
    
    if (!menteeResult.rows.length) {
      return res.status(404).json({ error: "Mentee not found" });
    }
    
    if (!mentorResult.rows.length) {
      return res.status(404).json({ error: "Mentor not found" });
    }
    
    if (!settingsResult.rows.length) {
      return res.status(400).json({ error: "Match settings missing" });
    }

    const mentee = menteeResult.rows[0];
    const mentor = mentorResult.rows[0];
    const settings = settingsResult.rows[0];

    const result = await calculateSimilarity(mentor, mentee, settings);

    res.json({
      mentee: {
        id: mentee.id,
        name: `${mentee.first_name} ${mentee.last_name}`,
        major: mentee.major,
        hobbies: mentee.hobbies,
        musicalArtists: parseMusicalArtists(mentee.musical_artists_json),
        personalityWords: mentee.personality_words,
        expectations: mentee.expectations,
        idealMatchDescription: mentee.ideal_match_description,
        organizations: mentee.organizations,
        meetingFrequency: mentee.meeting_frequency,
        menteeInMajor: mentee.mentee_in_major,
        pairGenderPreference: mentee.pair_gender_preference
      },
      mentor: {
        id: mentor.id,
        name: `${mentor.first_name} ${mentor.last_name}`,
        major: mentor.major,
        hobbies: mentor.hobbies,
        musicalArtists: parseMusicalArtists(mentor.musical_artists_json),
        personalityWords: mentor.personality_words,
        expectations: mentor.expectations,
        idealMatchDescription: mentor.ideal_match_description,
        organizations: mentor.organizations,
        meetingFrequency: mentor.meeting_frequency,
        openToMultiple: mentor.open_to_multiple
      },
      similarity: result,
      settings: settings,
      vectorInfo: {
        hobbyVectorsCount: Object.keys(hobbyVectors).length,
        traitVectorsCount: Object.keys(traitVectors).length,
        menteeHobbiesVectorized: mentee.hobbies.filter(h => hobbyVectors[h]).length,
        mentorHobbiesVectorized: mentor.hobbies.filter(h => hobbyVectors[h]).length,
        menteeTraitsVectorized: mentee.personality_words.filter(t => traitVectors[t]).length,
        mentorTraitsVectorized: mentor.personality_words.filter(t => traitVectors[t]).length
      }
    });

  } catch (err) {
    console.error("Error in debug match:", err);
    res.status(500).json({ error: "Debug match failed.", detail: err.message });
  }
});

// Musical compatibility analysis endpoint
app.get("/api/musical-analysis/:menteeId/:mentorId", async (req, res) => {
  try {
    const { menteeId, mentorId } = req.params;
    
    const menteeResult = await pool.query("SELECT * FROM mentor_mentee_submissions WHERE id = $1", [menteeId]);
    const mentorResult = await pool.query("SELECT * FROM mentor_mentee_submissions WHERE id = $1", [mentorId]);
    
    if (!menteeResult.rows.length || !mentorResult.rows.length) {
      return res.status(404).json({ error: "User(s) not found" });
    }

    const mentee = menteeResult.rows[0];
    const mentor = mentorResult.rows[0];
    
    const mentorArtists = parseMusicalArtists(mentor.musical_artists_json);
    const menteeArtists = parseMusicalArtists(mentee.musical_artists_json);
    
    // Extract genres for analysis
    const mentorGenres = new Set();
    const menteeGenres = new Set();
    
    mentorArtists.forEach(artist => {
      artist.genres.forEach(genre => mentorGenres.add(genre.toLowerCase()));
    });
    
    menteeArtists.forEach(artist => {
      artist.genres.forEach(genre => menteeGenres.add(genre.toLowerCase()));
    });
    
    const sharedArtists = mentorArtists.filter(mArtist => 
      menteeArtists.some(nArtist => 
        extractArtistName(mArtist.displayName).toLowerCase() === extractArtistName(nArtist.displayName).toLowerCase()
      )
    );
    
    const sharedGenres = [...mentorGenres].filter(genre => menteeGenres.has(genre));
    
    // Calculate compatibility
    const compatibility = calculateMusicalCompatibility(mentor, mentee, "Medium");
    
    res.json({
      mentor: {
        id: mentor.id,
        name: `${mentor.first_name} ${mentor.last_name}`,
        artists: mentorArtists,
        genres: [...mentorGenres].sort(),
        artistCount: mentorArtists.length,
        genreCount: mentorGenres.size
      },
      mentee: {
        id: mentee.id,
        name: `${mentee.first_name} ${mentee.last_name}`,
        artists: menteeArtists,
        genres: [...menteeGenres].sort(),
        artistCount: menteeArtists.length,
        genreCount: menteeGenres.size
      },
      compatibility: {
        sharedArtists: sharedArtists,
        sharedGenres: sharedGenres,
        artistOverlap: compatibility.details.artistOverlap,
        genreSimilarity: compatibility.details.genreSimilarity,
        musicalDiversity: compatibility.details.musicalDiversity,
        overallScore: compatibility.score,
        combinedScore: compatibility.details.combinedScore
      }
    });

  } catch (err) {
    console.error("Error in musical analysis:", err);
    res.status(500).json({ error: "Musical analysis failed.", detail: err.message });
  }
});

// Create assignments table if it doesn't exist
async function createAssignmentsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mentor_mentee_assignments (
        id SERIAL PRIMARY KEY,
        mentor_id INTEGER REFERENCES mentor_mentee_submissions(id),
        mentee_id INTEGER REFERENCES mentor_mentee_submissions(id),
        match_score DECIMAL(10,4),
        match_details JSONB,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(mentee_id)
      )
    `);
    console.log("✅ Assignments table ready");
  } catch (err) {
    console.error("Failed to create assignments table:", err);
  }
}

// Initialize assignments table
createAssignmentsTable();

// Submit final assignments
app.post("/api/submit-assignments", strictRateLimit, async (req, res) => {
  try {
    const { assignments } = req.body;
    
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: "Assignments must be an array" });
    }

    console.log(`📝 Submitting ${assignments.length} mentor-mentee assignments...`);

    // Clear existing assignments (start fresh)
    await pool.query("DELETE FROM mentor_mentee_assignments");

    // Insert new assignments
    for (const assignment of assignments) {
      const { menteeId, mentorId, score, details } = assignment;
      
      await pool.query(`
        INSERT INTO mentor_mentee_assignments (mentor_id, mentee_id, match_score, match_details)
        VALUES ($1, $2, $3, $4)
      `, [mentorId, menteeId, score, JSON.stringify(details)]);
    }

    console.log("✅ Assignments submitted successfully");
    res.json({ 
      message: "Assignments submitted successfully",
      count: assignments.length
    });

  } catch (err) {
    console.error("Error submitting assignments:", err);
    res.status(500).json({ error: "Failed to submit assignments", detail: err.message });
  }
});

// Get current assignments
app.get("/api/assignments", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        mentor.first_name as mentor_first_name,
        mentor.last_name as mentor_last_name,
        mentor.email as mentor_email,
        mentor.major as mentor_major,
        mentor.open_to_multiple as mentor_open_to_multiple,
        mentee.first_name as mentee_first_name,
        mentee.last_name as mentee_last_name,
        mentee.email as mentee_email,
        mentee.major as mentee_major,
        mentee.mentee_in_major as mentee_in_major
      FROM mentor_mentee_assignments a
      JOIN mentor_mentee_submissions mentor ON a.mentor_id = mentor.id
      JOIN mentor_mentee_submissions mentee ON a.mentee_id = mentee.id
      ORDER BY a.match_score DESC
    `);

    const assignments = result.rows.map(row => ({
      id: row.id,
      mentor: {
        id: row.mentor_id,
        firstName: row.mentor_first_name,
        lastName: row.mentor_last_name,
        email: row.mentor_email,
        major: row.mentor_major,
        openToMultiple: row.mentor_open_to_multiple
      },
      mentee: {
        id: row.mentee_id,
        firstName: row.mentee_first_name,
        lastName: row.mentee_last_name,
        email: row.mentee_email,
        major: row.mentee_major,
        menteeInMajor: row.mentee_in_major
      },
      matchScore: parseFloat(row.match_score),
      matchDetails: row.match_details,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({ assignments });

  } catch (err) {
    console.error("Error fetching assignments:", err);
    res.status(500).json({ error: "Failed to fetch assignments", detail: err.message });
  }
});

app.get('/api/test/trait-vectors', async (req, res) => {
  try {
    console.log('\n=== TRAIT VECTOR COMPARISON TEST ===\n');
    
    // 1. Load static traits list
    const staticTraits = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "data", "traits.json")));
    console.log(`📋 Static traits count: ${staticTraits.length}`);
    console.log(`📋 First 5 static traits:`, staticTraits.slice(0, 5));
    
    // 2. Load cached trait vectors
    const cachedTraitKeys = Object.keys(traitVectors);
    console.log(`💾 Cached trait vectors count: ${cachedTraitKeys.length}`);
    console.log(`💾 First 5 cached traits:`, cachedTraitKeys.slice(0, 5));
    
    // 3. Query database for user trait data
    const dbResult = await pool.query(`
      SELECT personality_words, trait_vectors 
      FROM mentor_mentee_submissions 
      WHERE personality_words IS NOT NULL 
      AND array_length(personality_words, 1) > 0 
      LIMIT 5
    `);
    
    console.log(`🗃️ Database submissions with traits: ${dbResult.rows.length}`);
    
    const dbTraits = new Set();
    dbResult.rows.forEach(row => {
      if (row.personality_words) {
        row.personality_words.forEach(trait => dbTraits.add(trait));
      }
    });
    
    console.log(`🗃️ Unique traits in database: ${dbTraits.size}`);
    console.log(`🗃️ Sample DB traits:`, Array.from(dbTraits).slice(0, 5));
    
    // 4. Find mismatches
    const mismatches = {
      inDbNotInStatic: Array.from(dbTraits).filter(trait => !staticTraits.includes(trait)),
      inStaticNotCached: staticTraits.filter(trait => !cachedTraitKeys.includes(trait)),
      inDbNotCached: Array.from(dbTraits).filter(trait => !cachedTraitKeys.includes(trait)),
      inCachedNotInStatic: cachedTraitKeys.filter(trait => !staticTraits.includes(trait))
    };
    
    console.log('\n=== MISMATCHES FOUND ===');
    console.log(`❌ Traits in DB but not in static list: ${mismatches.inDbNotInStatic.length}`);
    if (mismatches.inDbNotInStatic.length > 0) {
      console.log(`   Examples:`, mismatches.inDbNotInStatic.slice(0, 10));
    }
    
    console.log(`❌ Traits in static list but not cached: ${mismatches.inStaticNotCached.length}`);
    if (mismatches.inStaticNotCached.length > 0) {
      console.log(`   Examples:`, mismatches.inStaticNotCached.slice(0, 10));
    }
    
    console.log(`❌ Traits in DB but not cached: ${mismatches.inDbNotCached.length}`);
    if (mismatches.inDbNotCached.length > 0) {
      console.log(`   Examples:`, mismatches.inDbNotCached.slice(0, 10));
    }
    
    console.log(`❌ Traits cached but not in static list: ${mismatches.inCachedNotInStatic.length}`);
    if (mismatches.inCachedNotInStatic.length > 0) {
      console.log(`   Examples:`, mismatches.inCachedNotInStatic.slice(0, 10));
    }
    
    // 5. Vector validation for DB entries
    const vectorIssues = [];
    dbResult.rows.forEach((row, index) => {
      if (row.trait_vectors) {
        console.log(`🔍 Row ${index + 1} traits:`, row.personality_words);
        console.log(`🔍 Row ${index + 1} vector count:`, row.trait_vectors ? row.trait_vectors.length : 0);
        
        if (row.personality_words.length !== (row.trait_vectors ? row.trait_vectors.length : 0)) {
          vectorIssues.push({
            rowIndex: index + 1,
            traits: row.personality_words,
            expectedVectors: row.personality_words.length,
            actualVectors: row.trait_vectors ? row.trait_vectors.length : 0
          });
        }
      }
    });
    
    console.log(`❌ Vector count mismatches: ${vectorIssues.length}`);
    vectorIssues.forEach(issue => {
      console.log(`   Row ${issue.rowIndex}: Expected ${issue.expectedVectors} vectors, got ${issue.actualVectors}`);
      console.log(`   Traits: ${issue.traits.join(', ')}`);
    });
    
    res.json({
      staticTraitsCount: staticTraits.length,
      cachedTraitsCount: cachedTraitKeys.length,
      dbTraitsCount: dbTraits.size,
      mismatches,
      vectorIssues,
      sampleData: {
        staticTraits: staticTraits.slice(0, 5),
        cachedTraits: cachedTraitKeys.slice(0, 5),
        dbTraits: Array.from(dbTraits).slice(0, 5)
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
