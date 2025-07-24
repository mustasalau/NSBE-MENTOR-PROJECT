import pg from 'pg';
const { Pool } = pg;

import dotenv from 'dotenv';
dotenv.config();

// Debug utility - only logs in development
const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
    console.log(...args);
  }
};
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // or your NeonSQL connection string
});

async function migrateMusicalArtists() {
  const { rows } = await pool.query('SELECT id, musical_artists FROM mentor_mentee_submissions');
  for (const row of rows) {
    if (!row.musical_artists) continue;
    // Parse each string in the array
    const parsed = row.musical_artists.map(str => {
      // Match: "Artist Name (genre1, genre2)"
      const match = str.match(/^(.*)\s+\((.*)\)$/);
      if (match) {
        return {
          displayName: match[1].trim(),
          genres: match[2].split(',').map(g => g.trim()),
        };
      } else {
        // Fallback: just the name, no genres
        return { displayName: str, genres: [] };
      }
    });
    // Update the row with the new JSON
    await pool.query(
      'UPDATE mentor_mentee_submissions SET musical_artists_json = $1 WHERE id = $2',
      [JSON.stringify(parsed), row.id]
    );
  }
  debugLog('Migration complete!');
  await pool.end();
}

migrateMusicalArtists().catch(console.error);