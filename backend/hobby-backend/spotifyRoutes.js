import express from "express";
import fetch from "node-fetch";
import previewFinder from "spotify-preview-finder";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

let token = "";

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

// Fetch Genres Helper with improved error handling
async function fetchArtistGenres(artistId) {
  // Check if genre fetching is disabled
  if (process.env.DISABLE_SPOTIFY_GENRES === 'true') {
    return [];
  }

  // Validate artistId first
  if (!artistId || typeof artistId !== 'string' || artistId.trim() === '') {
    console.warn(`Invalid artist ID provided: ${artistId}`);
    return [];
  }

  const maxRetries = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const resp = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        if (resp.status === 401) {
          // Token might be expired, refresh and retry
          await getToken();
          continue;
        }
        if (resp.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = resp.headers.get('retry-after') || 1;
          console.warn(`Rate limited for artist ${artistId}, waiting ${retryAfter}s...`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
          continue;
        }
        if (resp.status === 404) {
          // Artist not found - this is final, don't retry
          console.warn(`Artist not found: ${artistId}`);
          return [];
        }
        console.warn(`HTTP ${resp.status} for artist ${artistId}`);
        return [];
      }

      const data = await resp.json();
      return data.genres || [];

    } catch (err) {
      lastError = err;
      
      if (err.name === 'AbortError') {
        console.warn(`Timeout fetching genres for artist ${artistId} (attempt ${attempt}/${maxRetries})`);
      } else {
        console.warn(`Network error fetching genres for artist ${artistId} (attempt ${attempt}/${maxRetries}): ${err.message}`);
      }
      
      // If this is the last attempt, don't wait
      if (attempt < maxRetries) {
        // Wait briefly before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Progressive backoff
      }
    }
  }

  // All retries failed
  console.warn(`All attempts failed for artist ${artistId}. Last error:`, lastError?.message || 'Unknown error');
  return [];
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
            genres = await fetchArtistGenres(track.artists[0].id);
          }
        } catch (err) {
          console.warn(`Failed to fetch genres for track "${track.name}":`, err.message);
          genres = []; // Fallback to empty genres
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
        genres: await fetchArtistGenres(artist.id).catch(err => {
          console.warn(`Failed to fetch genres for artist "${artist.name}":`, err.message);
          return [];
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
        genres: album.artists?.[0]?.id ? await fetchArtistGenres(album.artists[0].id).catch(err => {
          console.warn(`Failed to fetch genres for album "${album.name}":`, err.message);
          return [];
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
