import { useState, useEffect } from 'react';

export default function useSpotifySearch(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const delayDebounce = setTimeout(() => {
      setLoading(true);
      fetch(`http://localhost:5002/search?query=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(res => res.json())
        .then(data => {
          setResults(data);
          setLoading(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') console.error(err);
          setLoading(false);
        });
    }, 400); // Debounce delay

    return () => {
      clearTimeout(delayDebounce);
      controller.abort();
    };
  }, [query]);

  return { results, loading };
}
