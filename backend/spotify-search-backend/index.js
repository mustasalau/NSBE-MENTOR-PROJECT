import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import cors from 'cors';
import previewFinder from 'spotify-preview-finder';


dotenv.config({ path: './setup.env' });

const app = express();
const PORT = 5002; 


const allowedOrigins = [
  'http://localhost:5173',     // Your Vite dev server
  'http://127.0.0.1:5173',     // Sometimes this format is used locally
  'https://your-production-site.com' // Replace with your real production domain
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman) or known allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

let token = '';

const getToken = async () => {
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await resp.json();
  token = data.access_token;
};

const fetchArtistGenres = async (artistId) => {
  try {
    const resp = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resp.ok) {
      console.warn(`Genre lookup failed for artist ${artistId}: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    return data.genres || [];
  } catch (err) {
    console.warn(`Error fetching genres for ${artistId}:`, err.message);
    return [];
  }
};


app.use(express.json());

// Endpoint to search tracks or artists
app.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });

  const fetchSpotify = async () => {
    return fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,album,artist&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
  };

  try {
    if (!token) await getToken();

    let resp = await fetchSpotify();
    if (resp.status === 401) {
      console.warn('Spotify token expired, refreshing...');
      await getToken();
      resp = await fetchSpotify();
    }

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("Spotify API error:", errorText);
      return res.status(500).json({ error: "Spotify API failed" });
    }

    const data = await resp.json();

    const trackPromises = (data.tracks?.items || []).map(async (track) => {
  let preview_url = null;
  let genres = [];

  try {
    const artistNames = track.artists.map(a => a.name).join(', ');
    const previewData = await previewFinder(track.name, artistNames, 1);

    console.log(`\n[DEBUG] PreviewFinder Output for "${track.name}" by "${artistNames}":`);
    console.dir(previewData, { depth: null });

    if (previewData.success && Array.isArray(previewData.results) && previewData.results.length > 0) {
      preview_url = previewData.results[0].previewUrls?.[0] || null;
      console.log(`[DEBUG] Found preview URL: ${preview_url}`);
    }
  } catch (err) {
    console.warn(`Preview lookup failed for "${track.name}":`, err.message);
  }

  // Fetch genres from the first associated artist if possible
  if (track.artists?.[0]?.id) {
    genres = await fetchArtistGenres(track.artists[0].id);
  }

  return {
    type: 'track',
    id: track.id,
    name: track.name,
    artists: track.artists.map(a => a.name),
    genres,
    preview_url,
    image: track.album?.images?.[0]?.url || null,
    popularity: track.popularity
  };
});



    const trackResults = await Promise.all(trackPromises);

    // Artists and albums, no preview lookup
    const artistResults = await Promise.all(
  (data.artists?.items || []).map(async (artist) => {
    const genres = await fetchArtistGenres(artist.id);
    return {
      type: 'artist',
      id: artist.id,
      name: artist.name,
      artists: [artist.name],
      genres,
      preview_url: null,
      image: artist.images?.[0]?.url || null,
      popularity: artist.popularity
    };
  })
);

    const albumResults = await Promise.all(
  (data.albums?.items || []).map(async (album) => {
    let genres = [];

    // Use the first artist to fetch genres
    if (album.artists?.[0]?.id) {
      genres = await fetchArtistGenres(album.artists[0].id);
    }

    return {
      type: 'album',
      id: album.id,
      name: album.name,
      artists: album.artists.map(a => a.name),
      genres,
      preview_url: null,
      image: album.images?.[0]?.url || null,
      release_date: album.release_date
    };
  })
);
    const lowerQuery = query.trim().toLowerCase();
    const strongArtistMatch = artistResults.find(artist => {
      const artistName = artist.name.toLowerCase();
      return artistName.startsWith(lowerQuery) || lowerQuery.startsWith(artistName) || artistName.includes(lowerQuery);
    });

    if (strongArtistMatch) artistResults.splice(artistResults.indexOf(strongArtistMatch), 1);

    const results = [
      ...(strongArtistMatch ? [strongArtistMatch] : []),
      ...trackResults,
      ...artistResults,
      ...albumResults
    ];

    console.log("Returning combined results:", results);
    res.json(results);

  } catch (err) {
    console.error("Search route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.listen(PORT, () => console.log(`Spotify backend running on port ${PORT}`));
