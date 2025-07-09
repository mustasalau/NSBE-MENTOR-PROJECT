import { useState } from "react";
import axios from "axios";

export default function MatchingPage({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(
        "https://nsbe-mentor-project.onrender.com/api/login",
        { password },
        { withCredentials: true }
      );

      if (res.data.success) {
        const check = await axios.get(
          "https://nsbe-mentor-project.onrender.com/api/check",
          { withCredentials: true }
        );
        if (check.data.loggedIn) {
          onLogin(); // success
        } else {
          setError("Login succeeded but check failed.");
        }
      } else {
        setError("Incorrect password");
      }
    } catch (err) {
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-4">
      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 w-full"
      />
      <button
        type="submit"
        className="bg-black text-white px-4 py-2"
        disabled={loading}
      >
        {loading ? "Logging in..." : "Login"}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
}
