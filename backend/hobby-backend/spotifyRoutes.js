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

// Fetch Genres Helper
async function fetchArtistGenres(artistId) {
  try {
    const resp = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.genres || [];
  } catch (err) {
    console.warn(`Genre fetch failed for artist ${artistId}:`, err.message);
    return [];
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

        if (track.artists?.[0]?.id) {
          genres = await fetchArtistGenres(track.artists[0].id);
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
        genres: await fetchArtistGenres(artist.id),
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
        genres: album.artists?.[0]?.id ? await fetchArtistGenres(album.artists[0].id) : [],
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
