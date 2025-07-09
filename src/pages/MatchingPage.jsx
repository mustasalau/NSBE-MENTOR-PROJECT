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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-800 to-black">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1f1f1f] text-white p-8 rounded-xl shadow-lg w-full max-w-sm space-y-4"
      >
        <h2 className="text-center text-2xl font-semibold">Login</h2>

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />

        {error && <p className="text-red-500 text-center">{error}</p>}

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-6 py-2 rounded transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      </form>
    </div>
  );
}
