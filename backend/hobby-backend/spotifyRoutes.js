import express from "express";
import fetch from "node-fetch";
import previewFinder from "spotify-preview-finder";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

let token = "";

// Genre cache to reduce API calls and provide fallbacks
const genreCache = new Map();
// Track in-flight requests to coalesce concurrent fetches per artist
const inFlightGenreRequests = new Map();

// Jittered exponential backoff helper (in ms)
function backoffWithJitter(attempt, baseMs = 500, maxMs = 4000) {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
  const jitter = Math.random() * (exp * 0.2); // +/-20%
  return Math.floor(exp - jitter);
}

// Comprehensive genre mappings for popular artists (fallback when API fails)
// CRITICAL: These ensure matching algorithm works even when Spotify API fails
const fallbackGenres = {
  // Pop artists
  'taylor swift': ['pop', 'country', 'singer-songwriter'],
  'ariana grande': ['pop', 'r&b', 'dance pop'],
  'billie eilish': ['pop', 'alternative', 'electropop'],
  'dua lipa': ['pop', 'dance pop', 'nu-disco'],
  'olivia rodrigo': ['pop', 'pop rock', 'singer-songwriter'],
  'ed sheeran': ['pop', 'singer-songwriter', 'acoustic pop'],
  'adele': ['pop', 'soul', 'singer-songwriter'],
  'bruno mars': ['pop', 'funk', 'r&b'],
  'lady gaga': ['pop', 'dance pop', 'electropop'],
  'katy perry': ['pop', 'dance pop', 'electropop'],
  
  // Hip-hop/Rap
  'drake': ['hip hop', 'rap', 'canadian hip hop'],
  'kendrick lamar': ['hip hop', 'conscious hip hop', 'rap'],
  'kanye west': ['hip hop', 'rap', 'chicago rap'],
  'travis scott': ['hip hop', 'trap', 'rap'],
  'j cole': ['hip hop', 'conscious hip hop', 'rap'],
  'lil baby': ['hip hop', 'trap', 'atlanta rap'],
  'future': ['hip hop', 'trap', 'atlanta rap'],
  'polo g': ['hip hop', 'chicago rap', 'melodic rap'],
  'dababy': ['hip hop', 'charlotte rap', 'trap'],
  'juice wrld': ['hip hop', 'emo rap', 'melodic rap'],
  
  // R&B/Soul
  'the weeknd': ['r&b', 'pop', 'alternative r&b'],
  'sza': ['r&b', 'neo soul', 'alternative r&b'],
  'frank ocean': ['r&b', 'alternative r&b', 'hip hop'],
  'daniel caesar': ['r&b', 'neo soul', 'alternative r&b'],
  'summer walker': ['r&b', 'contemporary r&b', 'alternative r&b'],
  'jhene aiko': ['r&b', 'neo soul', 'alternative r&b'],
  'chris brown': ['r&b', 'pop', 'hip hop'],
  'beyonce': ['r&b', 'pop', 'dance'],
  
  // Rock/Alternative
  'imagine dragons': ['pop rock', 'alternative rock', 'indie rock'],
  'twenty one pilots': ['alternative rock', 'indie pop', 'electropop'],
  'arctic monkeys': ['indie rock', 'alternative rock', 'garage rock'],
  'panic! at the disco': ['pop rock', 'alternative rock', 'emo'],
  'fall out boy': ['pop rock', 'alternative rock', 'pop punk'],
  'my chemical romance': ['alternative rock', 'emo', 'pop punk'],
  'green day': ['punk rock', 'pop punk', 'alternative rock'],
  'red hot chili peppers': ['alternative rock', 'funk rock', 'rap rock'],
  
  // Electronic/EDM
  'calvin harris': ['edm', 'house', 'electro house'],
  'marshmello': ['edm', 'future bass', 'trap'],
  'skrillex': ['dubstep', 'edm', 'electro house'],
  'david guetta': ['edm', 'house', 'progressive house'],
  'martin garrix': ['edm', 'big room house', 'progressive house'],
  'diplo': ['edm', 'trap', 'moombahton'],
  'deadmau5': ['progressive house', 'electro house', 'techno'],
  
  // Country
  'morgan wallen': ['country', 'country pop', 'contemporary country'],
  'luke combs': ['country', 'country rock', 'contemporary country'],
  'chris stapleton': ['country', 'country soul', 'americana'],
  'kacey musgraves': ['country', 'country pop', 'indie country'],
  'maren morris': ['country', 'country pop', 'contemporary country'],
  
  // Latin/Reggaeton
  'bad bunny': ['reggaeton', 'latin trap', 'latin'],
  'j balvin': ['reggaeton', 'latin pop', 'urbano'],
  'ozuna': ['reggaeton', 'latin trap', 'latin pop'],
  'daddy yankee': ['reggaeton', 'latin pop', 'urbano'],
  'karol g': ['reggaeton', 'latin pop', 'urbano'],
  
  // Indie/Alternative
  'lorde': ['indie pop', 'electropop', 'art pop'],
  'tame impala': ['psychedelic pop', 'indie rock', 'neo-psychedelia'],
  'the 1975': ['pop rock', 'indie pop', 'alternative rock'],
  'vampire weekend': ['indie rock', 'indie pop', 'art rock'],
  'clairo': ['indie pop', 'bedroom pop', 'lo-fi'],
  
  // Classic/Timeless
  'michael jackson': ['pop', 'r&b', 'dance'],
  'prince': ['funk', 'r&b', 'pop'],
  'whitney houston': ['r&b', 'pop', 'soul'],
  'stevie wonder': ['r&b', 'soul', 'funk'],
  'marvin gaye': ['soul', 'r&b', 'motown'],
};

// Helper function to get genres from artist name as fallback
function getFallbackGenres(artistName) {
  if (!artistName) return [];
  const normalizedName = artistName.toLowerCase().trim();
  return fallbackGenres[normalizedName] || [];
}

// Export for use in other modules
export { getFallbackGenres };

// Spotify Token Fetch
async function getToken() {
  if (token) return token;
  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await resp.json();
  token = data.access_token;
  setTimeout(() => (token = ""), (data.expires_in - 60) * 1000);
  return token;
}

// Fetch Genres Helper with improved error handling and fallbacks
async function fetchArtistGenres(artistId, artistName = null) {
  // Check if genre fetching is disabled
  if (process.env.DISABLE_SPOTIFY_GENRES === 'true') {
    return getFallbackGenres(artistName);
  }

  // Validate artistId first
  if (!artistId || typeof artistId !== 'string' || artistId.trim() === '') {
    console.warn(`Invalid artist ID provided: ${artistId}`);
    return getFallbackGenres(artistName);
  }

  // Check cache first
  if (genreCache.has(artistId)) {
    return genreCache.get(artistId);
  }

  // Coalesce concurrent requests for same artist
  if (inFlightGenreRequests.has(artistId)) {
    return inFlightGenreRequests.get(artistId);
  }

  const promise = (async () => {
    const maxRetries = 4;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Ensure we have a token before the first attempt
        if (!token) await getToken();

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000); // 7 second timeout

        const resp = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          if (resp.status === 401) {
            // Token expired/invalid: refresh and retry
            await getToken();
            continue;
          }
          if (resp.status === 429) {
            // Rate limited - wait and retry
            const retryAfter = parseInt(resp.headers.get('retry-after') || '1', 10);
            const waitMs = Math.max(1000, retryAfter * 1000);
            console.warn(`Rate limited for artist ${artistId}, waiting ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
          }
          if (resp.status === 404) {
            console.warn(`Artist not found: ${artistId}`);
            return [];
          }
          if (resp.status >= 500 && resp.status < 600) {
            // Retry on server errors
            const waitMs = backoffWithJitter(attempt);
            console.warn(`HTTP ${resp.status} for artist ${artistId}; retrying in ${waitMs}ms`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
          }
          console.warn(`HTTP ${resp.status} for artist ${artistId}`);
          return [];
        }

        const data = await resp.json();
        const genres = data.genres || [];
        
        if (genres.length > 0) {
          genreCache.set(artistId, genres);
        }
        
        return genres;

      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') {
          console.warn(`Timeout fetching genres for artist ${artistId} (attempt ${attempt}/${maxRetries})`);
        } else {
          console.warn(`Network error fetching genres for artist ${artistId} (attempt ${attempt}/${maxRetries}): ${err.message}`);
        }
        if (attempt < maxRetries) {
          const waitMs = backoffWithJitter(attempt);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
      }
    }

    console.warn(`All attempts failed for artist ${artistId}. Last error:`, lastError?.message || 'Unknown error');
    const fallbackGenres = getFallbackGenres(artistName);
    if (fallbackGenres.length > 0) {
      console.log(`Using fallback genres for ${artistName}: ${fallbackGenres.join(', ')}`);
      genreCache.set(artistId, fallbackGenres);
      return fallbackGenres;
    }
    console.warn(`No fallback genres available for ${artistName || 'unknown artist'}`);
    return [];
  })();

  inFlightGenreRequests.set(artistId, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    inFlightGenreRequests.delete(artistId);
  }
}

// Search Route
router.get("/search", async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query parameter" });

  const fetchSpotify = () =>
    fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,album,artist&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  try {
    if (!token) await getToken();
    let resp = await fetchSpotify();
    if (resp.status === 401) {
      await getToken();
      resp = await fetchSpotify();
    }
    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get('retry-after') || '1', 10);
      await new Promise(resolve => setTimeout(resolve, Math.max(1000, retryAfter * 1000)));
      resp = await fetchSpotify();
    }
    if (!resp.ok) return res.status(500).json({ error: "Spotify API failed" });

    const data = await resp.json();

    // Tracks with Preview + Genres
    const trackResults = await Promise.all(
      (data.tracks?.items || []).map(async (track) => {
        let preview_url = null;
        let genres = [];

        try {
          const artistNames = track.artists.map((a) => a.name).join(", ");
          const previewData = await previewFinder(track.name, artistNames, 1);
          if (previewData.success && previewData.results?.length > 0) {
            preview_url = previewData.results[0].previewUrls?.[0] || null;
          }
        } catch (err) {
          console.warn(`Preview lookup failed for "${track.name}":`, err.message);
        }

        // Safely fetch genres - don't let genre fetch failures affect the main result
        try {
          if (track.artists?.[0]?.id) {
            const artistName = track.artists[0].name;
            genres = await fetchArtistGenres(track.artists[0].id, artistName);
          }
        } catch (err) {
          console.warn(`Failed to fetch genres for track "${track.name}":`, err.message);
          // Try fallback genres based on artist name
          const artistName = track.artists?.[0]?.name;
          genres = getFallbackGenres(artistName);
        }

        return {
          type: "track",
          id: track.id,
          name: track.name,
          artists: track.artists.map((a) => a.name),
          genres,
          preview_url,
          image: track.album?.images?.[0]?.url || null,
          popularity: track.popularity,
        };
      })
    );

    // Artist & Album Results
    const artistResults = await Promise.all(
      (data.artists?.items || []).map(async (artist) => ({
        type: "artist",
        id: artist.id,
        name: artist.name,
        artists: [artist.name],
        genres: await fetchArtistGenres(artist.id, artist.name).catch(err => {
          console.warn(`Failed to fetch genres for artist "${artist.name}":`, err.message);
          return getFallbackGenres(artist.name);
        }),
        preview_url: null,
        image: artist.images?.[0]?.url || null,
        popularity: artist.popularity,
      }))
    );

    const albumResults = await Promise.all(
      (data.albums?.items || []).map(async (album) => ({
        type: "album",
        id: album.id,
        name: album.name,
        artists: album.artists.map((a) => a.name),
        genres: album.artists?.[0]?.id ? await fetchArtistGenres(album.artists[0].id, album.artists[0].name).catch(err => {
          console.warn(`Failed to fetch genres for album "${album.name}":`, err.message);
          return getFallbackGenres(album.artists[0].name);
        }) : [],
        preview_url: null,
        image: album.images?.[0]?.url || null,
        release_date: album.release_date,
      }))
    );

    // Boost Strong Artist Matches
    const lowerQuery = query.trim().toLowerCase();
    const strongArtistMatch = artistResults.find((artist) => {
      const name = artist.name.toLowerCase();
      return name.startsWith(lowerQuery) || lowerQuery.startsWith(name) || name.includes(lowerQuery);
    });
    if (strongArtistMatch) artistResults.splice(artistResults.indexOf(strongArtistMatch), 1);

    const results = [
      ...(strongArtistMatch ? [strongArtistMatch] : []),
      ...trackResults,
      ...artistResults,
      ...albumResults,
    ];

    res.json(results);
  } catch (err) {
    console.error("Spotify Search Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
