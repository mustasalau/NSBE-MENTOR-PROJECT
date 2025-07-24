import { useState } from "react";
import { useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

export default function MatchingPage({ onLogin }) {
  const navigate = useNavigate(); // ✅ Move this inside the component
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const axiosInstance = axios.create({
    withCredentials: true,
    validateStatus: (status) => status < 500
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("Making request...");
      
      const res = await axios.post(
        "https://nsbe-mentor-project.onrender.com/api/login",
        { password },
        {
          withCredentials: true,
          validateStatus: () => true
        }
      );

      console.log("Response received:", res.status, res.data);

      if (res.status === 401) {
        console.log("Setting error: Incorrect password");
        setError("Incorrect password");
      } else if (res.status === 200 && res.data.success) {
        console.log("Login successful, checking auth...");
        const check = await axiosInstance.get("https://nsbe-mentor-project.onrender.com/api/check");
        console.log("Auth check response:", check.data);

        if (check.data.loggedIn) {
          console.log("Authentication successful, navigating to dashboard");
          navigate("/dashboard");
        } else {
          console.warn("Check failed, not logged in:", check.data);
          setError("Login succeeded but authentication failed.");
        }
      } else {
        console.log("Unexpected response:", res.status, res.data);
        setError("Unexpected error. Please try again.");
      }
    } catch (err) {
      console.error("Caught error:", err);
      console.error("Error details:", {
        message: err.message,
        code: err.code,
        response: err.response?.status,
        data: err.response?.data
      });
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center relative px-4">
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
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError("");
          }}
          className="w-56 sm:w-64 p-2 sm:p-3 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700 shadow-2xl focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm sm:text-base"
        />

        {error && <p className="text-red-500 text-center text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 sm:px-6 py-2 sm:py-3 rounded shadow-2xl transition mx-auto text-sm sm:text-base"
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