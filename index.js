const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();
const PORT = 3001;

app.use(cors()); // allow frontend to call this
let token = '';
let tokenExpiresAt = 0;

// Function to get access token
async function getSpotifyToken() {
  const now = Date.now();
  if (token && now < tokenExpiresAt) return token;

  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  token = response.data.access_token;
  tokenExpiresAt = now + response.data.expires_in * 1000;
  return token;
}

app.get('/search-song', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Missing query' });

    const accessToken = await getSpotifyToken();

    const result = await axios.get('https://api.spotify.com/v1/search', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q,
        type: 'track',
        limit: 5
      },
      catch (err) {
        console.error('Network error:', err.message);
      }
    });

    const tracks = result.data.tracks.items.map(track => ({
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      id: track.id,
      preview_url: track.preview_url,
      image: track.album.images[0]?.url
    }));

    res.json(tracks);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
