import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

export default function DuplicateAlert() {
  const [duplicates, setDuplicates] = useState({ hasDuplicates: false, count: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkForDuplicates();
  }, []);

  // Recheck for duplicates when returning from duplicates page
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      checkForDuplicates();
    }
  }, [location.pathname]);

  const checkForDuplicates = async () => {
    try {
      const response = await axios.get("https://nsbe-mentor-project.onrender.com/api/duplicates");
      setDuplicates(response.data);
    } catch (error) {
      console.error("Error checking for duplicates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    navigate("/duplicates");
  };

  if (loading || !duplicates.hasDuplicates) {
    return null;
  }

  return (
    <div 
      onClick={handleClick}
      className="fixed top-4 right-4 z-50 bg-yellow-100 border border-yellow-300 rounded-lg p-3 cursor-pointer hover:bg-yellow-200 transition-colors duration-200 shadow-lg max-w-sm"
    >
      <div className="flex items-center space-x-2">
        <div className="flex-shrink-0">
          <svg 
            className="w-5 h-5 text-yellow-600" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-yellow-800">
            Duplicate Submissions Detected
          </p>
          <p className="text-xs text-yellow-700">
            {duplicates.count} duplicate{duplicates.count !== 1 ? 's' : ''} found. Click to review.
          </p>
        </div>
        <div className="flex-shrink-0">
          <svg 
            className="w-4 h-4 text-yellow-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5l7 7-7 7" 
            />
          </svg>
        </div>
      </div>
    </div>
  );
} 