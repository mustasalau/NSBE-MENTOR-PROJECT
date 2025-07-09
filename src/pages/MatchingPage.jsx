import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

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
          { password }, // body
          {
            withCredentials: true,
            validateStatus: (status) => status < 500
          }
      );

      if (res.data.success) {
        const check = await axios.get(
          "https://nsbe-mentor-project.onrender.com/api/check",
          { withCredentials: true }
        );
        if (check.data.loggedIn) {
          onLogin();
        } else {
          setError("Login succeeded but check failed.");
        }
      } else {
        setError("Incorrect password");
      }
    } catch (err) {
      setError("Server error");
      console.error("Login error:", {
  message: err.message,
  code: err.code,
  response: err.response?.status,
  data: err.response?.data
});

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-black flex items-center justify-center relative px-4">
      {/* Logo in top-left corner */}
      <Link to="/">
        <img
          src="/pictures/nsbelogo.png"
          alt="NSBE Logo"
          className="absolute top-4 left-4 w-16 h-auto cursor-pointer"
        />
      </Link>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 flex flex-col items-center"
      >
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => {setPassword(e.target.value)
          if (error) setError("");

          }
        }
          
          className="w-64 p-3 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700 shadow-2xl focus:outline-none focus:ring-2 focus:ring-gray-500"
        />

        {error && <p className="text-red-500 text-center text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-6 py-2 rounded shadow-2xl transition mx-auto"
        >
          {loading ? (
    <span className="flex items-center space-x-1">
  <span>Logging in</span>
  <span className="flex space-x-1">
    <span className="animate-bounce dot delay-0">.</span>
    <span className="animate-bounce dot delay-100">.</span>
    <span className="animate-bounce dot delay-200">.</span>
  </span>
</span>
  ) : (
    "Login"
  )}
</button>
      </form>
    </div>
  );
}
