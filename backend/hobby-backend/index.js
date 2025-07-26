import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import cookieParser from "cookie-parser";
import * as XLSX from "xlsx";

// Debug utility - only logs in development
const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
    console.log(...args);
  }
};

import { vectorizeAndSave, loadVectors, vectorizeText, arrayToVectorString } from "./openAIhelpers.js";import traitRoutes from "./traitRoutes.js";
import spotifyRoutes from "./spotifyRoutes.js";

dotenv.config();
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Database migration: Add preferred_student_id column if it doesn't exist
(async () => {
  try {
    await pool.query(`
      ALTER TABLE mentor_mentee_submissions 
      ADD COLUMN IF NOT EXISTS preferred_student_id VARCHAR(9);
    `);
    debugLog("✅ Database migration completed: preferred_student_id column added");
  } catch (err) {
    console.error("Database migration error:", err);
  }
})();

// Database migration: Create approved_matches table
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS approved_matches (
        id SERIAL PRIMARY KEY,
        mentor_id INTEGER NOT NULL,
        mentee_id INTEGER NOT NULL,
        mentor_data JSONB NOT NULL,
        mentee_data JSONB NOT NULL,
        match_score DECIMAL(10,6) NOT NULL,
        match_details JSONB NOT NULL,
        approved_at TIMESTAMP DEFAULT NOW(),
        approved_by VARCHAR(255),
        UNIQUE(mentor_id, mentee_id)
      );
    `);
    debugLog("✅ Database migration completed: approved_matches table created");
  } catch (err) {
    console.error("Approved matches table migration error:", err);
  }
})();

const app = express();
const PORT = process.env.PORT || 5009;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load hobbies with robust path detection (CORRECTED PATHS)
let hobbies;
let actualHobbiesPath;

console.log(`🔍 Debug: __dirname = ${__dirname}`);
console.log(`🔍 Debug: process.cwd() = ${process.cwd()}`);

// CORRECTED: Try paths in order of most likely to work
const candidatePaths = [
  // In production: /opt/render/project/src/backend/hobby-backend -> /opt/render/project/src/data/hobbies.json  
  path.join(__dirname, "..", "..", "data", "hobbies.json"), // From backend up 2 levels to project/src/data
  
  // From working directory (if process.cwd() is /opt/render/project/src/)
  path.join(process.cwd(), "data", "hobbies.json"), 
  
  // From working directory up one level (if process.cwd() is /opt/render/project/src/backend/hobby-backend)
  path.join(process.cwd(), "..", "..", "data", "hobbies.json"),
  
  // Original path that was causing double-src (LAST RESORT)
  path.join(__dirname, "..", "..", "..", "src", "data", "hobbies.json"),
];

let loaded = false;
for (let i = 0; i < candidatePaths.length; i++) {
  const testPath = candidatePaths[i];
  console.log(`🔍 Trying path ${i + 1}/${candidatePaths.length}: ${testPath}`);
  
  try {
    hobbies = JSON.parse(fs.readFileSync(testPath, 'utf8'));
    actualHobbiesPath = testPath;
    console.log(`✅ SUCCESS: Loaded ${hobbies.length} hobbies from: ${testPath}`);
    loaded = true;
    break;
  } catch (error) {
    console.log(`❌ FAILED: ${testPath} - ${error.message}`);
  }
}

if (!loaded) {
  console.log(`🆕 No hobbies file found at any path, creating default list...`);
  
  // Default to the most likely correct path for creation
  actualHobbiesPath = path.join(__dirname, "..", "..", "data", "hobbies.json");
  
  hobbies = [
    "Reading", "Writing", "Running", "Swimming", "Cooking", "Traveling", 
    "Photography", "Music", "Dancing", "Hiking", "Gaming", "Painting",
    "Yoga", "Tennis", "Basketball", "Soccer", "Golf", "Fishing"
  ];
  
  // Try to create the file
  try {
    const dir = path.dirname(actualHobbiesPath);
    console.log(`🔍 Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(actualHobbiesPath, JSON.stringify(hobbies, null, 2));
    console.log(`✅ Created default hobbies file at ${actualHobbiesPath}`);
  } catch (writeError) {
    console.log(`⚠️ Could not create hobbies file: ${writeError.message}`);
  }
}

console.log(`🎯 FINAL: Using hobbies path: ${actualHobbiesPath}`);
const hobbyVectorPath = path.join(__dirname, "openAI_hobby_vectors.json");
let hobbyVectors = loadVectors(hobbyVectorPath);

// ✅ ADD: Load trait vectors globally
// Load traits with robust path detection (CORRECTED PATHS)  
let traits;
let actualTraitsPath;

console.log(`🔍 Debug traits: __dirname = ${__dirname}`);
console.log(`🔍 Debug traits: process.cwd() = ${process.cwd()}`);

// CORRECTED: Try paths in order of most likely to work
const traitCandidatePaths = [
  // In production: /opt/render/project/src/backend/hobby-backend -> /opt/render/project/src/data/traits.json  
  path.join(__dirname, "..", "..", "data", "traits.json"), // From backend up 2 levels to project/src/data
  
  // From working directory (if process.cwd() is /opt/render/project/src/)
  path.join(process.cwd(), "data", "traits.json"), 
  
  // From working directory up one level (if process.cwd() is /opt/render/project/src/backend/hobby-backend)
  path.join(process.cwd(), "..", "..", "data", "traits.json"),
  
  // Original path that was causing double-src (LAST RESORT)
  path.join(__dirname, "..", "..", "..", "src", "data", "traits.json"),
];

let traitsLoaded = false;
for (let i = 0; i < traitCandidatePaths.length; i++) {
  const testPath = traitCandidatePaths[i];
  console.log(`🔍 Trying traits path ${i + 1}/${traitCandidatePaths.length}: ${testPath}`);
  
  try {
    traits = JSON.parse(fs.readFileSync(testPath, 'utf8'));
    actualTraitsPath = testPath;
    console.log(`✅ SUCCESS: Loaded ${traits.length} traits from: ${testPath}`);
    traitsLoaded = true;
    break;
  } catch (error) {
    console.log(`❌ FAILED: ${testPath} - ${error.message}`);
  }
}

if (!traitsLoaded) {
  console.log(`🆕 No traits file found at any path, creating default list...`);
  
  // Default to the most likely correct path for creation
  actualTraitsPath = path.join(__dirname, "..", "..", "data", "traits.json");
  
  traits = [
    "ambitious", "analytical", "articulate", "confident", "creative", "curious",
    "dedicated", "driven", "empathetic", "enthusiastic", "flexible", "friendly",
    "hardworking", "innovative", "intelligent", "kind", "motivated", "organized",
    "passionate", "patient", "reliable", "resourceful", "responsible", "thoughtful"
  ];
  
  // Try to create the file
  try {
    const dir = path.dirname(actualTraitsPath);
    console.log(`🔍 Creating traits directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(actualTraitsPath, JSON.stringify(traits, null, 2));
    console.log(`✅ Created default traits file at ${actualTraitsPath}`);
  } catch (writeError) {
    console.log(`⚠️ Could not create traits file: ${writeError.message}`);
  }
}

console.log(`🎯 FINAL: Using traits path: ${actualTraitsPath}`);
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
    'http://localhost:5175',                   // Local development
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

app.use("/api/traits", traitRoutes);

app.use("/api/spotify", spotifyRoutes);

// === AUTH LOGIC ===
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;


app.post("/api/login", (req, res) => {
  const { password } = req.body;

  debugLog("Login attempt with password:", password);

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

// Health check endpoint for monitoring services (no auth required)
app.get("/api/health", (req, res) => {
  const healthCheck = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0"
  };

  try {
    // Optional: Quick database connectivity check
    // You can uncomment this if you want to verify DB connection
    // const dbCheck = await pool.query('SELECT 1');
    // healthCheck.database = "connected";
    
    res.status(200).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});


app.head("/api/health", (req, res) => {
  const healthCheck = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0"
  };

  try {
    // Optional: Quick database connectivity check
    // You can uncomment this if you want to verify DB connection
    // const dbCheck = await pool.query('SELECT 1');
    // healthCheck.database = "connected";
    
    res.status(200).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message
    });
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
    // ✅ NEW: Use sentence case (only first letter capitalized)
    const normalized = hobby.trim().toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
  
    if (!normalized) continue;

    const exists = hobbies.find(h => h.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      results.push(exists);
      continue;
    }

    if (!hobbyVectors[normalized]) {
      debugLog(`Vectorizing new hobby: "${normalized}"`);
      console.log(`🔍 Before adding - hobbies count: ${hobbies.length}`);
      const vec = await vectorizeAndSave(normalized, hobbyVectorPath, hobbyVectors, "This is a hobby or leisure activity someone might enjoy: ");
      if (vec) {
        hobbyVectors[normalized] = vec;
        hobbies.push(normalized);
        updated = true;
        console.log(`✅ Added "${normalized}" to hobby list. New count: ${hobbies.length}`);
        debugLog(`Added "${normalized}" to hobby list and vector set.`);
      } else {
        console.warn(`Failed to vectorize: "${normalized}"`);
        continue;
      }
    }
    results.push(normalized);
  }

  if (updated) {
    console.log(`💾 Writing ${hobbies.length} hobbies to file...`);
    console.log(`🔍 Current working directory: ${process.cwd()}`);
    console.log(`🔍 __dirname is: ${__dirname}`);
    
    const hobbiesFilePath = actualHobbiesPath; // Use the same path we found during loading
    console.log(`🔍 Calculated hobbies path: ${hobbiesFilePath}`);
    console.log(`🔍 Path exists before write: ${fs.existsSync(hobbiesFilePath)}`);
    
    fs.writeFileSync(hobbyVectorPath, JSON.stringify(hobbyVectors, null, 2));
    fs.writeFileSync(hobbiesFilePath, JSON.stringify(hobbies, null, 2));
    
    // Verify the write worked
    const written = JSON.parse(fs.readFileSync(hobbiesFilePath, 'utf8'));
    console.log(`✅ Verified: ${written.length} hobbies written to ${hobbiesFilePath}`);
    
    // IMPORTANT: Reload the hobbies array from the file to ensure consistency
    hobbies.length = 0; // Clear current array
    hobbies.push(...written); // Reload from file
    console.log(`🔄 Reloaded hobbies array from file: ${hobbies.length} hobbies`);
    
    debugLog("Hobby list and vector file updated.");
  }

  res.json({ normalized: results });
});

app.get("/api/hobbies/vectors", (req, res) => {
  res.json(hobbyVectors);
});

app.get("/api/hobbies", (req, res) => {
  console.log(`🔍 /api/hobbies called - returning ${hobbies.length} hobbies`);
  console.log(`🔍 Last 3 hobbies in memory: ${hobbies.slice(-3).join(', ')}`);
  res.json(hobbies);
});

app.get("/api/traits", (req, res) => {
  res.json(traits);
});

// Test endpoint for text vectorization
app.post("/api/test-text-vectorization", async (req, res) => {
  try {
    const { text, textType, role } = req.body;
    
    if (!text || !textType || !role) {
      return res.status(400).json({ 
        error: "Missing required fields: text, textType (expectations|idealMatch), and role (mentor|mentee)" 
      });
    }

    debugLog(`Testing vectorization for ${role} ${textType}: "${text}"`);
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

// Export submissions to XLSX
app.get("/api/export/submissions", async (req, res) => {
  try {
    debugLog("📊 Exporting submissions to XLSX...");
    
    const result = await pool.query(`
      SELECT 
        first_name as "First Name",
        last_name as "Last Name", 
        role as "Role",
        major as "Major",
        gender as "Gender",
        email as "PSU Email",
        personal_email as "Personal Email",
        student_id as "Student ID",
        year as "Year",
        meeting_frequency as "Meeting Frequency",
        created_at as "Submission Date"
      FROM mentor_mentee_submissions 
      ORDER BY created_at DESC
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No submissions found to export" });
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(result.rows);

    // Set column widths for better readability
    const colWidths = [
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 10 }, // Role
      { wch: 25 }, // Major
      { wch: 10 }, // Gender
      { wch: 25 }, // PSU Email
      { wch: 25 }, // Personal Email
      { wch: 12 }, // Student ID
      { wch: 8 },  // Year
      { wch: 18 }, // Meeting Frequency
      { wch: 20 }  // Submission Date
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");

    // Generate XLSX buffer
    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `NSBE_Submissions_${timestamp}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', xlsxBuffer.length);

    debugLog(`✅ Exported ${result.rows.length} submissions to ${filename}`);
    res.send(xlsxBuffer);

  } catch (err) {
    console.error("Failed to export submissions:", err);
    res.status(500).json({ error: "Failed to export submissions", details: err.message });
  }
});

// Export approved matches to XLSX
app.get("/api/export/approved-matches", async (req, res) => {
  try {
    debugLog("📊 Exporting approved matches to XLSX...");
    
    const result = await pool.query(`
      SELECT 
        id,
        mentor_data,
        mentee_data,
        match_score,
        approved_at,
        approved_by
      FROM approved_matches 
      ORDER BY approved_at DESC
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No approved matches found to export" });
    }

    // Transform the data for better readability
    const exportData = result.rows.map(match => {
      const mentorData = match.mentor_data;
      const menteeData = match.mentee_data;
      
      return {
        "Match ID": match.id,
        "Mentor Name": `${mentorData.firstName} ${mentorData.lastName}`,
        "Mentor Email": mentorData.email,
        "Mentor Major": mentorData.major,
        "Mentor Year": mentorData.year,
        "Mentee Name": `${menteeData.firstName} ${menteeData.lastName}`,
        "Mentee Email": menteeData.email, 
        "Mentee Major": menteeData.major,
        "Mentee Year": menteeData.year,
        "Match Score": Number(match.match_score).toFixed(2),
        "Approved Date": new Date(match.approved_at).toLocaleDateString(),
        "Approved By": match.approved_by || "Admin"
      };
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths for better readability
    const colWidths = [
      { wch: 10 }, // Match ID
      { wch: 20 }, // Mentor Name
      { wch: 25 }, // Mentor Email
      { wch: 25 }, // Mentor Major
      { wch: 8 },  // Mentor Year
      { wch: 20 }, // Mentee Name
      { wch: 25 }, // Mentee Email
      { wch: 25 }, // Mentee Major
      { wch: 8 },  // Mentee Year
      { wch: 12 }, // Match Score
      { wch: 15 }, // Approved Date
      { wch: 12 }  // Approved By
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Approved Matches");

    // Generate XLSX buffer
    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `NSBE_Approved_Matches_${timestamp}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', xlsxBuffer.length);

    debugLog(`✅ Exported ${result.rows.length} approved matches to ${filename}`);
    res.send(xlsxBuffer);

  } catch (err) {
    console.error("Failed to export approved matches:", err);
    res.status(500).json({ error: "Failed to export approved matches", details: err.message });
  }
});


app.post("/api/submit", async (req, res) => {
  const data = req.body;
  
  // console.log(`🐛 Debug - Full request body:`, JSON.stringify(data, null, 2));

  try {
    const {
      role, firstName, lastName, email, personalEmail, studentId,
      major, gender, year, pairGenderPreference, meetingFrequency,
      hobbies, musicalArtists, organizations, personalityWords,
      expectations, idealMatchDescription, menteeInMajor, openToMultiple,
      preferredStudentId
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
      debugLog(`Vectorizing expectations for ${role}: "${expectations}"`);
      expectationsVector = await vectorizeText(expectations, "expectations", role);
    }

    if (idealMatchDescription && idealMatchDescription.trim()) {
      debugLog(`Vectorizing ideal match description for ${role}: "${idealMatchDescription}"`);
      idealMatchVector = await vectorizeText(idealMatchDescription, "idealMatch", role);
    }

    // ✅ Much simpler approach - store raw arrays as JSON

    // Vectorize hobbies using CACHED vectors
    let hobbyVectorArrays = [];
    if (hobbies && hobbies.length > 0) {
      debugLog(`Getting cached vectors for hobbies:`, hobbies);
      
      for (const hobby of hobbies) {
        if (hobby && hobby.trim()) {
          // ✅ Use sentence case to match static list
          const hobbyKey = hobby.trim().toLowerCase()
            .replace(/^\w/, (c) => c.toUpperCase());
          
          let embeddingArray = hobbyVectors[hobbyKey];
          if (!embeddingArray) {
            debugLog(`Vectorizing new hobby: "${hobbyKey}"`);
            embeddingArray = await vectorizeAndSave(hobbyKey, hobbyVectorPath, hobbyVectors, "This is a hobby or leisure activity someone might enjoy: ");
          }
          
          if (embeddingArray && embeddingArray.length === 1536) {
            hobbyVectorArrays.push(embeddingArray); // ✅ Just push the raw array
          }
        }
      }
    }

    // Vectorize traits using CACHED vectors  
    let traitVectorArrays = [];
    // console.log(`🐛 Debug - personalityWords received:`, personalityWords);
    // console.log(`🐛 Debug - personalityWords type:`, typeof personalityWords);
    // console.log(`🐛 Debug - personalityWords isArray:`, Array.isArray(personalityWords));
    
    if (personalityWords && personalityWords.length > 0) {
      debugLog(`Getting cached vectors for traits:`, personalityWords.map(p => p.raw));
      
      for (const trait of personalityWords) {
        if (trait.raw && trait.raw.trim()) {
          const traitKey = trait.raw.trim().toLowerCase();
          
          let embeddingArray = traitVectors[traitKey];
          if (!embeddingArray) {
            debugLog(`Vectorizing new trait: "${traitKey}"`);
            embeddingArray = await vectorizeAndSave(traitKey, traitVectorPath, traitVectors, "This is a personal trait or characteristic: ");
          }
          
          if (embeddingArray && embeddingArray.length === 1536) {
            traitVectorArrays.push(embeddingArray); // ✅ Just push the raw array
          }
        }
      }
    }

    // ✅ Store as JSON - no complex formatting needed
    await pool.query(
      `INSERT INTO mentor_mentee_submissions (
        role, first_name, last_name, email, personal_email, student_id,
        major, gender, year, pair_gender_preference, meeting_frequency,
        hobbies, organizations, personality_words,
        expectations, ideal_match_description, mentee_in_major, open_to_multiple,
        musical_artists_json, preferred_student_id,
        expectations_vector, ideal_match_vector,
        hobby_vectors, trait_vectors
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24
      )`,
      [
        role, firstName, lastName, email, personalEmail, studentId,
        major, gender, year, pairGenderPreference, meetingFrequency,
        hobbies,
        organizations,
        personalityWords.map((p) => p.raw.toLowerCase()),
        expectations,
        idealMatchDescription,
        menteeInMajor,
        openToMultiple,
        JSON.stringify(musicalArtists),
        preferredStudentId || null,
        expectationsVector ? JSON.stringify(expectationsVector) : null,
        idealMatchVector ? JSON.stringify(idealMatchVector) : null,
        hobbyVectorArrays.length > 0 ? JSON.stringify(hobbyVectorArrays) : null, // ✅ Simple JSON
        traitVectorArrays.length > 0 ? JSON.stringify(traitVectorArrays) : null   // ✅ Simple JSON
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
  // Handle undefined or null displayName
  if (!displayName || typeof displayName !== 'string') {
    return '';
  }
  
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
  
  // Filter out artists with invalid displayName before processing
  const validMentorArtists = mentorArtists.filter(a => a && a.displayName);
  const validMenteeArtists = menteeArtists.filter(a => a && a.displayName);
  
  if (!validMentorArtists.length || !validMenteeArtists.length) return 0;
  
  // Extract actual artist names from displayNames
  const mentorNames = new Set(validMentorArtists.map(a => extractArtistName(a.displayName).toLowerCase()).filter(name => name));
  const menteeNames = new Set(validMenteeArtists.map(a => extractArtistName(a.displayName).toLowerCase()).filter(name => name));
  
  const overlap = [...mentorNames].filter(name => menteeNames.has(name)).length;
  const union = new Set([...mentorNames, ...menteeNames]).size;
  
  debugLog(`    🎤 Artist Overlap Debug:`);
  debugLog(`      Mentor Names: [${Array.from(mentorNames).join(', ')}]`);
  debugLog(`      Mentee Names: [${Array.from(menteeNames).join(', ')}]`);
  debugLog(`      Overlap: ${overlap}, Union: ${union}, Jaccard: ${union > 0 ? (overlap / union).toFixed(4) : 0}`);
  
  return union > 0 ? overlap / union : 0; // Jaccard similarity
}

function calculateGenreSimilarity(mentorArtists, menteeArtists) {
  if (!mentorArtists.length || !menteeArtists.length) return 0;
  
  // Filter out artists with invalid genres before processing
  const validMentorArtists = mentorArtists.filter(a => a && Array.isArray(a.genres));
  const validMenteeArtists = menteeArtists.filter(a => a && Array.isArray(a.genres));
  
  if (!validMentorArtists.length || !validMenteeArtists.length) return 0;
  
  // Extract all genres from artists
  const mentorGenres = new Set();
  const menteeGenres = new Set();
  
  validMentorArtists.forEach(artist => {
    artist.genres.forEach(genre => {
      if (genre && typeof genre === 'string') {
        mentorGenres.add(genre.toLowerCase());
      }
    });
  });
  
  validMenteeArtists.forEach(artist => {
    artist.genres.forEach(genre => {
      if (genre && typeof genre === 'string') {
        menteeGenres.add(genre.toLowerCase());
      }
    });
  });
  
  if (!mentorGenres.size || !menteeGenres.size) return 0;
  
  const overlap = [...mentorGenres].filter(genre => menteeGenres.has(genre)).length;
  const union = new Set([...mentorGenres, ...menteeGenres]).size;
  
  debugLog(`    🎼 Genre Similarity Debug:`);
  debugLog(`      Mentor Genres: [${Array.from(mentorGenres).join(', ')}]`);
  debugLog(`      Mentee Genres: [${Array.from(menteeGenres).join(', ')}]`);
  debugLog(`      Overlap: ${overlap}, Union: ${union}, Jaccard: ${union > 0 ? (overlap / union).toFixed(4) : 0}`);
  
  return union > 0 ? overlap / union : 0; // Jaccard similarity
}

function calculateMusicalDiversity(mentorArtists, menteeArtists) {
  if (!mentorArtists.length || !menteeArtists.length) return 0;
  
  // Filter out artists with invalid genres before processing
  const validMentorArtists = mentorArtists.filter(a => a && Array.isArray(a.genres));
  const validMenteeArtists = menteeArtists.filter(a => a && Array.isArray(a.genres));
  
  if (!validMentorArtists.length || !validMenteeArtists.length) return 0;
  
  // Calculate genre diversity for each person
  const mentorGenres = new Set();
  const menteeGenres = new Set();
  
  validMentorArtists.forEach(artist => {
    artist.genres.forEach(genre => {
      if (genre && typeof genre === 'string') {
        mentorGenres.add(genre.toLowerCase());
      }
    });
  });
  
  validMenteeArtists.forEach(artist => {
    artist.genres.forEach(genre => {
      if (genre && typeof genre === 'string') {
        menteeGenres.add(genre.toLowerCase());
      }
    });
  });
  
  const mentorDiversity = mentorGenres.size / Math.max(validMentorArtists.length, 1);
  const menteeDiversity = menteeGenres.size / Math.max(validMenteeArtists.length, 1);
  
  debugLog(`    🎭 Musical Diversity Debug:`);
  debugLog(`      Mentor: ${mentorGenres.size} genres / ${validMentorArtists.length} artists = ${mentorDiversity.toFixed(4)}`);
  debugLog(`      Mentee: ${menteeGenres.size} genres / ${validMenteeArtists.length} artists = ${menteeDiversity.toFixed(4)}`);
  
  // Reward pairs where both have diverse tastes (more likely to discover new music together)
  // Use harmonic mean to ensure both have good diversity
  if (mentorDiversity === 0 || menteeDiversity === 0) {
    debugLog(`      Result: 0 (one person has no diversity)`);
    return 0;
  }
  
  const harmonicMean = (2 * mentorDiversity * menteeDiversity) / (mentorDiversity + menteeDiversity);
  debugLog(`      Harmonic Mean: ${harmonicMean.toFixed(4)}`);
  
  return harmonicMean;
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
  
  // 🐛 DEBUG: Log the raw musical data and calculations
  debugLog(`🎵 Musical Compatibility Debug:`);
  debugLog(`  Mentor Artists:`, mentorArtists.map(a => ({ name: a.displayName, genres: a.genres })));
  debugLog(`  Mentee Artists:`, menteeArtists.map(a => ({ name: a.displayName, genres: a.genres })));
  debugLog(`  Artist Overlap: ${artistOverlap.toFixed(4)}`);
  debugLog(`  Genre Similarity: ${genreSimilarity.toFixed(4)}`);
  debugLog(`  Musical Diversity: ${musicalDiversity.toFixed(4)}`);
  
  // Weighted combination:
  // - Artist overlap: 30% (direct shared interests)
  // - Genre similarity: 50% (broader musical compatibility)  
  // - Musical diversity: 20% (potential for mutual discovery)
  const combinedScore = (artistOverlap * 0.3) + (genreSimilarity * 0.5) + (musicalDiversity * 0.2);
  const finalScore = combinedScore * mapWeight(weight);
  
  debugLog(`  Formula: (${artistOverlap.toFixed(4)} × 0.3) + (${genreSimilarity.toFixed(4)} × 0.5) + (${musicalDiversity.toFixed(4)} × 0.2)`);
  debugLog(`  Combined Score: ${combinedScore.toFixed(4)}`);
  debugLog(`  Weight: ${weight} (${mapWeight(weight)}x)`);
  debugLog(`  Final Score: ${finalScore.toFixed(4)}`);
  debugLog(`  ==================`);
  
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
    const capacity = getMentorCapacity(mentor);
    debugLog(`👨‍🏫 Mentor ${mentor.first_name} ${mentor.last_name} (ID: ${mentor.id}) - Capacity: ${capacity} (open_to_multiple: ${mentor.open_to_multiple})`);
    mentorAssignments.set(mentor.id, {
      mentor: mentor,
      capacity: capacity,
      assigned: 0,
      mentees: []
    });
  });

  // Greedy assignment based on scores
  debugLog(`🎯 Processing ${allPairs.length} potential mentor-mentee pairs (sorted by score):`);
  allPairs.slice(0, 5).forEach((pair, idx) => {
    debugLog(`  ${idx + 1}. Mentor ${pair.mentor.first_name} + Mentee ${pair.mentee.first_name} = ${pair.score.toFixed(2)}`);
  });

  for (const pair of allPairs) {
    const { menteeId, mentorId, score, details, mentee, mentor } = pair;

    debugLog(`🔄 Evaluating: Mentor ${mentor.first_name} (ID: ${mentorId}) + Mentee ${mentee.first_name} (ID: ${menteeId}) = ${score.toFixed(2)}`);

    // Skip if mentee is already assigned
    if (menteeAssignments.has(menteeId)) {
      debugLog(`  ❌ Mentee ${mentee.first_name} already assigned`);
      continue;
    }

    // Skip if mentor is at capacity
    const mentorInfo = mentorAssignments.get(mentorId);
    if (mentorInfo.assigned >= mentorInfo.capacity) {
      debugLog(`  ❌ Mentor ${mentor.first_name} at capacity (${mentorInfo.assigned}/${mentorInfo.capacity})`);
      continue;
    }

    // Make the assignment
    debugLog(`  ✅ Assigning Mentee ${mentee.first_name} to Mentor ${mentor.first_name} (${mentorInfo.assigned + 1}/${mentorInfo.capacity})`);
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

  // Preferred Student ID Match (highest priority)
  let preferredIdBonus = 0;
  const mentorPrefersSpecificMentee = mentor.preferred_student_id && mentor.preferred_student_id === mentee.student_id;
  const menteePrefersSpecificMentor = mentee.preferred_student_id && mentee.preferred_student_id === mentor.student_id;
  
  if (mentorPrefersSpecificMentee || menteePrefersSpecificMentor) {
    preferredIdBonus = 100; // Massive bonus to ensure preferred matches happen
    score += preferredIdBonus;
    details.preferredId = {
      score: preferredIdBonus,
      mentorRequestedMentee: mentorPrefersSpecificMentee,
      menteeRequestedMentor: menteePrefersSpecificMentor,
      matched: true
    };
  } else {
    details.preferredId = {
      score: 0,
      mentorRequestedMentee: false,
      menteeRequestedMentor: false,
      matched: false
    };
  }

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
    debugLog("🔄 Generating matches with mentor capacity management...");
    
    const result = await pool.query("SELECT * FROM mentor_mentee_submissions ORDER BY created_at DESC");
    const settingsResult = await pool.query("SELECT * FROM match_settings LIMIT 1");
    
    if (!settingsResult.rows.length) {
      return res.status(400).json({ error: "Match settings missing. Please configure match settings first." });
    }

    const submissions = result.rows;
    const settings = settingsResult.rows[0];

    // Get already matched users from approved matches
    const approvedMatchesResult = await pool.query("SELECT mentor_id, mentee_id FROM approved_matches");
    const matchedUserIds = new Set();
    
    approvedMatchesResult.rows.forEach(row => {
      matchedUserIds.add(row.mentor_id);
      matchedUserIds.add(row.mentee_id);
    });

    // Filter out already-matched users
    const allMentors = submissions.filter(s => s.role === "mentor");
    const allMentees = submissions.filter(s => s.role === "mentee");
    
    const mentors = allMentors.filter(mentor => !matchedUserIds.has(mentor.id));
    const mentees = allMentees.filter(mentee => !matchedUserIds.has(mentee.id));

    debugLog(`Found ${allMentors.length} total mentors (${mentors.length} unmatched) and ${allMentees.length} total mentees (${mentees.length} unmatched)`);
    
    if (matchedUserIds.size > 0) {
      debugLog(`🔒 Filtered out ${matchedUserIds.size} already-matched users`);
    }

    if (mentors.length === 0) {
      const message = allMentors.length === 0 
        ? "No mentors available for matching." 
        : "No unmatched mentors available. All mentors have already been matched.";
      return res.json({ message, matches: [] });
    }

    if (mentees.length === 0) {
      const message = allMentees.length === 0 
        ? "No mentees to match." 
        : "No unmatched mentees available. All mentees have already been matched.";
      return res.json({ message, matches: [] });
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

    debugLog("✅ Capacity-aware matches generated successfully");

    // Check for potential improvements to existing matches
    debugLog("🔍 Checking for potential match improvements...");
    const potentialImprovements = [];
    
    if (approvedMatchesResult.rows.length > 0) {
      // Get full data for already matched users
      const matchedMentors = allMentors.filter(mentor => matchedUserIds.has(mentor.id));
      const matchedMentees = allMentees.filter(mentee => matchedUserIds.has(mentee.id));
      
      // Check if any new mentors could better match existing mentees
      for (const newMentor of mentors) {
        for (const existingMentee of matchedMentees) {
          const newScore = await calculateSimilarity(newMentor, existingMentee, settings);
          
          // Find the current match for this mentee
          const currentMatch = approvedMatchesResult.rows.find(row => row.mentee_id === existingMentee.id);
          if (currentMatch) {
            const currentScore = parseFloat(currentMatch.match_score);
            
            if (newScore.score > currentScore + 0.5) { // Only suggest if significantly better
              potentialImprovements.push({
                type: 'better_mentor',
                currentMatch: {
                  id: currentMatch.id,
                  mentorId: currentMatch.mentor_id,
                  menteeId: currentMatch.mentee_id,
                  currentScore: currentScore
                },
                newMatch: {
                  mentor: {
                    id: newMentor.id,
                    firstName: newMentor.first_name,
                    lastName: newMentor.last_name,
                    email: newMentor.email,
                    major: newMentor.major,
                    year: newMentor.year
                  },
                  mentee: {
                    id: existingMentee.id,
                    firstName: existingMentee.first_name,
                    lastName: existingMentee.last_name,
                    email: existingMentee.email,
                    major: existingMentee.major,
                    year: existingMentee.year
                  },
                  newScore: newScore.score,
                  improvementAmount: newScore.score - currentScore,
                  details: newScore.details
                }
              });
            }
          }
        }
      }
      
      // Check if any new mentees could better match existing mentors
      for (const newMentee of mentees) {
        for (const existingMentor of matchedMentors) {
          const newScore = await calculateSimilarity(existingMentor, newMentee, settings);
          
          // Find the current match for this mentor
          const currentMatch = approvedMatchesResult.rows.find(row => row.mentor_id === existingMentor.id);
          if (currentMatch) {
            const currentScore = parseFloat(currentMatch.match_score);
            
            if (newScore.score > currentScore + 0.5) { // Only suggest if significantly better
              potentialImprovements.push({
                type: 'better_mentee',
                currentMatch: {
                  id: currentMatch.id,
                  mentorId: currentMatch.mentor_id,
                  menteeId: currentMatch.mentee_id,
                  currentScore: currentScore
                },
                newMatch: {
                  mentor: {
                    id: existingMentor.id,
                    firstName: existingMentor.first_name,
                    lastName: existingMentor.last_name,
                    email: existingMentor.email,
                    major: existingMentor.major,
                    year: existingMentor.year
                  },
                  mentee: {
                    id: newMentee.id,
                    firstName: newMentee.first_name,
                    lastName: newMentee.last_name,
                    email: newMentee.email,
                    major: newMentee.major,
                    year: newMentee.year
                  },
                  newScore: newScore.score,
                  improvementAmount: newScore.score - currentScore,
                  details: newScore.details
                }
              });
            }
          }
        }
      }
      
      if (potentialImprovements.length > 0) {
        debugLog(`🚨 Found ${potentialImprovements.length} potential match improvements`);
      }
    }
    
    const totalCapacity = mentors.reduce((sum, mentor) => sum + getMentorCapacity(mentor), 0);
    const totalAssigned = assignmentResult.assignments.length;
    
    res.json({ 
      mentorMatches,
      menteeMatches,
      unassignedMentees,
      potentialImprovements,
      summary: {
        totalMentors: mentors.length,
        totalMentees: mentees.length,
        totalCapacity: totalCapacity,
        totalAssigned: totalAssigned,
        utilizationRate: totalCapacity > 0 ? (totalAssigned / totalCapacity * 100).toFixed(1) : "0.0",
        unassignedCount: unassignedMentees.length,
        mentorsOpenToMultiple: mentors.filter(m => m.open_to_multiple === "Yes").length,
        potentialImprovementsCount: potentialImprovements.length,
        settings: settings
      }
    });
    
  } catch (err) {
    console.error("Error generating matches:", err);
    res.status(500).json({ error: "Match generation failed.", detail: err.message });
  }
});

// Approved Matches endpoints
app.post("/api/approved-matches", async (req, res) => {
  try {
    const { match } = req.body;
    
    if (!match || !match.mentor || !match.assignedMentees || !match.assignedMentees[0]) {
      return res.status(400).json({ error: "Invalid match data provided" });
    }

    const mentee = match.assignedMentees[0];
    
    const result = await pool.query(`
      INSERT INTO approved_matches (
        mentor_id, mentee_id, mentor_data, mentee_data, 
        match_score, match_details, approved_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (mentor_id, mentee_id) 
      DO UPDATE SET 
        match_score = EXCLUDED.match_score,
        match_details = EXCLUDED.match_details,
        approved_at = NOW(),
        approved_by = EXCLUDED.approved_by
      RETURNING id, approved_at;
    `, [
      match.mentor.id,
      mentee.mentee.id,
      JSON.stringify(match.mentor),
      JSON.stringify(mentee.mentee),
      mentee.score,
      JSON.stringify(mentee.details),
      req.body.approvedBy || 'admin'
    ]);

            debugLog(`✅ Match approved and saved: Mentor ${match.mentor.firstName} ${match.mentor.lastName} & Mentee ${mentee.mentee.firstName} ${mentee.mentee.lastName}`);
    
    res.json({ 
      success: true, 
      id: result.rows[0].id,
      approvedAt: result.rows[0].approved_at,
      message: "Match approved and saved successfully" 
    });

  } catch (err) {
    console.error("Error saving approved match:", err);
    res.status(500).json({ error: "Failed to save approved match", detail: err.message });
  }
});

app.get("/api/approved-matches", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        mentor_id,
        mentee_id,
        mentor_data,
        mentee_data,
        match_score,
        match_details,
        approved_at,
        approved_by
      FROM approved_matches 
      ORDER BY approved_at DESC
    `);

    const approvedMatches = result.rows.map(row => ({
      id: row.id,
      mentor: row.mentor_data,
      assignedMentees: [{
        mentee: row.mentee_data,
        score: parseFloat(row.match_score),
        details: row.match_details
      }],
      approvedAt: row.approved_at,
      approvedBy: row.approved_by
    }));

    res.json(approvedMatches);

  } catch (err) {
    console.error("Error fetching approved matches:", err);
    res.status(500).json({ error: "Failed to fetch approved matches", detail: err.message });
  }
});

app.delete("/api/approved-matches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      "DELETE FROM approved_matches WHERE id = $1 RETURNING mentor_data->>'firstName' as mentor_name, mentee_data->>'firstName' as mentee_name",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Approved match not found" });
    }

    debugLog(`✅ Approved match removed: ${result.rows[0].mentor_name} & ${result.rows[0].mentee_name}`);
    
    res.json({ 
      success: true, 
      message: "Approved match removed successfully" 
    });

  } catch (err) {
    console.error("Error removing approved match:", err);
    res.status(500).json({ error: "Failed to remove approved match", detail: err.message });
  }
});

// Replace approved match with a better one
app.put("/api/approved-matches/:id/replace", async (req, res) => {
  try {
    const { id } = req.params;
    const { newMatch } = req.body;
    
    if (!newMatch || !newMatch.mentor || !newMatch.mentee) {
      return res.status(400).json({ error: "Invalid new match data provided" });
    }

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Get the current match data
      const currentMatchResult = await pool.query(
        "SELECT * FROM approved_matches WHERE id = $1",
        [id]
      );

      if (currentMatchResult.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: "Current match not found" });
      }

      const currentMatch = currentMatchResult.rows[0];

      // Update the match with new data
      const updateResult = await pool.query(`
        UPDATE approved_matches SET
          mentor_id = $1,
          mentee_id = $2,
          mentor_data = $3,
          mentee_data = $4,
          match_score = $5,
          match_details = $6,
          approved_at = NOW(),
          approved_by = $7
        WHERE id = $8
        RETURNING id, approved_at;
      `, [
        newMatch.mentor.id,
        newMatch.mentee.id,
        JSON.stringify(newMatch.mentor),
        JSON.stringify(newMatch.mentee),
        newMatch.newScore,
        JSON.stringify(newMatch.details),
        req.body.approvedBy || 'admin',
        id
      ]);

      await pool.query('COMMIT');

      debugLog(`🔄 Match replaced: ${currentMatch.mentor_data.firstName} ${currentMatch.mentor_data.lastName} & ${currentMatch.mentee_data.firstName} ${currentMatch.mentee_data.lastName} → ${newMatch.mentor.firstName} ${newMatch.mentor.lastName} & ${newMatch.mentee.firstName} ${newMatch.mentee.lastName} (${newMatch.improvementAmount.toFixed(2)} point improvement)`);
      
      res.json({ 
        success: true, 
        id: updateResult.rows[0].id,
        approvedAt: updateResult.rows[0].approved_at,
        improvementAmount: newMatch.improvementAmount,
        message: "Match replaced successfully" 
      });

    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

  } catch (err) {
    console.error("Error replacing approved match:", err);
    res.status(500).json({ error: "Failed to replace approved match", detail: err.message });
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
    debugLog("✅ Assignments table ready");
  } catch (err) {
    console.error("Failed to create assignments table:", err);
  }
}

// Initialize assignments table
createAssignmentsTable();

// Submit final assignments
app.post("/api/submit-assignments", async (req, res) => {
  try {
    const { assignments } = req.body;
    
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: "Assignments must be an array" });
    }

    debugLog(`📝 Submitting ${assignments.length} mentor-mentee assignments...`);

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

    debugLog("✅ Assignments submitted successfully");
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

// Duplicate detection endpoint
app.get("/api/duplicates", async (req, res) => {
  try {
    const result = await pool.query(`
      WITH duplicate_student_ids AS (
        SELECT student_id, COUNT(*) as count, 
               ARRAY_AGG(id ORDER BY created_at) as ids,
               ARRAY_AGG(first_name ORDER BY created_at) as first_names,
               ARRAY_AGG(last_name ORDER BY created_at) as last_names,
               ARRAY_AGG(created_at ORDER BY created_at) as timestamps,
               ARRAY_AGG(role ORDER BY created_at) as roles
        FROM mentor_mentee_submissions 
        WHERE student_id IS NOT NULL AND student_id != ''
        GROUP BY student_id 
        HAVING COUNT(*) > 1
      ),
      duplicate_names AS (
        SELECT LOWER(TRIM(first_name)) as first_name_lower, 
               LOWER(TRIM(last_name)) as last_name_lower, 
               COUNT(*) as count,
               ARRAY_AGG(id ORDER BY created_at) as ids,
               ARRAY_AGG(first_name ORDER BY created_at) as first_names,
               ARRAY_AGG(last_name ORDER BY created_at) as last_names,
               ARRAY_AGG(student_id ORDER BY created_at) as student_ids,
               ARRAY_AGG(created_at ORDER BY created_at) as timestamps,
               ARRAY_AGG(role ORDER BY created_at) as roles
        FROM mentor_mentee_submissions 
        WHERE first_name IS NOT NULL AND last_name IS NOT NULL 
          AND TRIM(first_name) != '' AND TRIM(last_name) != ''
        GROUP BY LOWER(TRIM(first_name)), LOWER(TRIM(last_name))
        HAVING COUNT(*) > 1
      ),
      combined_duplicates AS (
        SELECT 'student_id' as duplicate_type, student_id as identifier, ids, first_names, last_names, timestamps, roles, 
               NULL as student_ids
        FROM duplicate_student_ids
        UNION ALL
        SELECT 'name' as duplicate_type, 
               first_name_lower || ' ' || last_name_lower as identifier, 
               ids, first_names, last_names, timestamps, roles, student_ids
        FROM duplicate_names
        WHERE NOT EXISTS (
          SELECT 1 FROM duplicate_student_ids 
          WHERE duplicate_student_ids.ids && duplicate_names.ids
        )
      )
      SELECT * FROM combined_duplicates ORDER BY duplicate_type, identifier
    `);

    const duplicates = result.rows.map(row => ({
      type: row.duplicate_type,
      identifier: row.identifier,
      submissions: row.ids.map((id, index) => ({
        id: id,
        firstName: row.first_names[index],
        lastName: row.last_names[index],
        studentId: row.student_ids ? row.student_ids[index] : row.identifier,
        timestamp: row.timestamps[index],
        role: row.roles[index]
      }))
    }));

    res.json({
      hasDuplicates: duplicates.length > 0,
      duplicates: duplicates,
      count: duplicates.length
    });

  } catch (err) {
    console.error("Error fetching duplicates:", err);
    res.status(500).json({ error: "Failed to fetch duplicates" });
  }
});

// Delete submission endpoint
app.delete("/api/submission/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      "DELETE FROM mentor_mentee_submissions WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    res.json({ 
      message: "Submission deleted successfully",
      deleted: result.rows[0]
    });

  } catch (err) {
    console.error("Error deleting submission:", err);
    res.status(500).json({ error: "Failed to delete submission" });
  }
});

app.get('/api/test/trait-vectors', async (req, res) => {
  try {
    debugLog('\n=== TRAIT VECTOR COMPARISON TEST ===\n');
    
    // 1. Load static traits list
    const staticTraits = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "..", "src", "data", "traits.json")));
    debugLog(`📋 Static traits count: ${staticTraits.length}`);
    debugLog(`📋 First 5 static traits:`, staticTraits.slice(0, 5));
    
    // 2. Load cached trait vectors
    const cachedTraitKeys = Object.keys(traitVectors);
    debugLog(`💾 Cached trait vectors count: ${cachedTraitKeys.length}`);
    debugLog(`💾 First 5 cached traits:`, cachedTraitKeys.slice(0, 5));
    
    // 3. Query database for user trait data
    const dbResult = await pool.query(`
      SELECT personality_words, trait_vectors 
      FROM mentor_mentee_submissions 
      WHERE personality_words IS NOT NULL 
      AND array_length(personality_words, 1) > 0 
      LIMIT 5
    `);
    
    debugLog(`🗃️ Database submissions with traits: ${dbResult.rows.length}`);
    
    const dbTraits = new Set();
    dbResult.rows.forEach(row => {
      if (row.personality_words) {
        row.personality_words.forEach(trait => dbTraits.add(trait));
      }
    });
    
    debugLog(`🗃️ Unique traits in database: ${dbTraits.size}`);
    debugLog(`🗃️ Sample DB traits:`, Array.from(dbTraits).slice(0, 5));
    
    // 4. Find mismatches
    const mismatches = {
      inDbNotInStatic: Array.from(dbTraits).filter(trait => !staticTraits.includes(trait)),
      inStaticNotCached: staticTraits.filter(trait => !cachedTraitKeys.includes(trait)),
      inDbNotCached: Array.from(dbTraits).filter(trait => !cachedTraitKeys.includes(trait)),
      inCachedNotInStatic: cachedTraitKeys.filter(trait => !staticTraits.includes(trait))
    };
    
          debugLog('\n=== MISMATCHES FOUND ===');
      debugLog(`❌ Traits in DB but not in static list: ${mismatches.inDbNotInStatic.length}`);
    if (mismatches.inDbNotInStatic.length > 0) {
        debugLog(`   Examples:`, mismatches.inDbNotInStatic.slice(0, 10));
    }
    
      debugLog(`❌ Traits in static list but not cached: ${mismatches.inStaticNotCached.length}`);
    if (mismatches.inStaticNotCached.length > 0) {
        debugLog(`   Examples:`, mismatches.inStaticNotCached.slice(0, 10));
    }
    
      debugLog(`❌ Traits in DB but not cached: ${mismatches.inDbNotCached.length}`);
    if (mismatches.inDbNotCached.length > 0) {
        debugLog(`   Examples:`, mismatches.inDbNotCached.slice(0, 10));
    }
    
      debugLog(`❌ Traits cached but not in static list: ${mismatches.inCachedNotInStatic.length}`);
    if (mismatches.inCachedNotInStatic.length > 0) {
        debugLog(`   Examples:`, mismatches.inCachedNotInStatic.slice(0, 10));
    }
    
    // 5. Vector validation for DB entries
    const vectorIssues = [];
    dbResult.rows.forEach((row, index) => {
      if (row.trait_vectors) {
        debugLog(`🔍 Row ${index + 1} traits:`, row.personality_words);
        debugLog(`🔍 Row ${index + 1} vector count:`, row.trait_vectors ? row.trait_vectors.length : 0);
        
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
    
          debugLog(`❌ Vector count mismatches: ${vectorIssues.length}`);
    vectorIssues.forEach(issue => {
        debugLog(`   Row ${issue.rowIndex}: Expected ${issue.expectedVectors} vectors, got ${issue.actualVectors}`);
        debugLog(`   Traits: ${issue.traits.join(', ')}`);
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

app.listen(PORT, () => debugLog(`Backend running on port ${PORT}`));

    

