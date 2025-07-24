import React, { useEffect, useState, createContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import CountUp from "react-countup";

// Debug utility - only logs in development
const debugLog = (...args) => {
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
    console.log(...args);
  }
};

// Debug warning - only logs in development (keeps console.error in production for important errors)
const debugWarn = (...args) => {
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
    console.warn(...args);
  }
};

const COLORS = ["#4F46E5", "#60A5FA"];

  

export const DataReloadContext = createContext({ reloadData: () => {} });

// Tooltip Component for Score Explanations
const ScoreTooltip = ({ category, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const getExplanation = (category) => {
    const explanations = {
      // Direct matches for camelCase keys from backend
      'major': 'Considers both mentor and mentee major preferences. Higher scores when both want a major match and it\'s satisfied.',
      'gender': 'Considers both mentor and mentee gender preferences. Maximum score when both preferences are satisfied.',
      'hobbies': 'Measures similarity between shared interests and leisure activities.',
      'musicalcompatibility': 'Evaluates musical taste compatibility based on artist overlap, genre similarity, and musical diversity.',
      'musicalartists': 'Evaluates musical taste compatibility based on artist overlap, genre similarity, and musical diversity.',
      'personalitywords': 'Compares personality traits and characteristics.',
      'expectations': 'Matches mentor expectations with mentee\'s ideal mentor.',
      'idealmatch': 'Calculated from the user\'s description of their ideal mentor/mentee compared to counterpart\'s expectations.',
      'organizations': 'Awards points for shared organizational involvement and extracurricular activities.',
      'meetingfrequency': 'Compatibility scoring based on preferred meeting schedules (Weekly, Bi-Weekly, Monthly).',
      'preferredid': 'Massive bonus (+100) when users specify each other\'s as a preferred match.',
      
      // Space-separated versions for display names
      'musical compatibility': 'Evaluates musical taste compatibility based on artist overlap, genre similarity, and musical diversity.',
      'musical artists': 'Evaluates musical taste compatibility based on artist overlap, genre similarity, and musical diversity.',
      'personality words': 'Compares personality traits and characteristics.',
      'ideal match': 'Calculated from the user\'s description of their ideal mentor/mentee compared to counterpart\'s expectations.',
      'meeting frequency': 'Compatibility scoring based on preferred meeting schedules (Weekly, Bi-Weekly, Monthly).',
      'preferred id': 'Massive bonus (+100) when users specify each other\'s as a preferred match.'
    };
    
    // Try multiple normalization approaches
    const normalizedCategory = category.toLowerCase().replace(/([A-Z])/g, ' $1').trim();
    const camelCaseKey = category.toLowerCase().replace(/\s+/g, '');
    
    // Debug logging to see what keys we're getting
    if (!explanations[normalizedCategory] && !explanations[camelCaseKey] && !explanations[category.toLowerCase()]) {
      debugLog(`🐛 No explanation found for category: "${category}"`, {
        original: category,
        normalized: normalizedCategory,
        camelCase: camelCaseKey,
        lowercase: category.toLowerCase()
      });
    }
    
    return explanations[normalizedCategory] || explanations[camelCaseKey] || explanations[category.toLowerCase()] || 'Score component explanation not available.';
  };

  return (
    <span className="relative inline-block">
      {children}
      <button
        className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => e.preventDefault()}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
        </svg>
      </button>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg">
            <div className="text-center">{getExplanation(category)}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}
    </span>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState("dashboard");
  const [matchWeights, setMatchWeights] = useState({
    major: "Medium",
    gender: "Medium",
    hobbies: "Medium",
    musicalArtists: "Medium",
    personalityWords: "Medium",
    expectations: "Medium",
    organizations: "Medium",
    meetingFrequency: "Medium",
  });
  const defaultMatchWeights = {
  major: "Medium",
  gender: "Medium",
  hobbies: "Medium",
  musicalArtists: "Medium",
  personalityWords: "Medium",
  expectations: "Medium",
  organizations: "Medium",
  meetingFrequency: "Medium",
};

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  
  // Matches state
  const [matches, setMatches] = useState([]);
  const [approvedMatches, setApprovedMatches] = useState([]);
  const [generatingMatches, setGeneratingMatches] = useState(false);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [hasNewSubmissions, setHasNewSubmissions] = useState(true);
  
  // Potential improvements state
  const [potentialImprovements, setPotentialImprovements] = useState([]);
  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [selectedImprovement, setSelectedImprovement] = useState(null);
  
  // Unmatched users tracking
  const [unmatchedCounts, setUnmatchedCounts] = useState({ mentors: 0, mentees: 0 });
  
  // Duplicate checking state
  const [duplicates, setDuplicates] = useState({ hasDuplicates: false, count: 0 });
  const [duplicatesLoading, setDuplicatesLoading] = useState(true);
  
  // Notification center state
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set());
  
  // Settings change warning state
  const [showSettingsWarning, setShowSettingsWarning] = useState(false);
  const [pendingSettings, setPendingSettings] = useState(null);
  const [previousSettings, setPreviousSettings] = useState(null);
  
  // Submission deletion state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [submissionToDelete, setSubmissionToDelete] = useState(null);
  const [deletingSubmission, setDeletingSubmission] = useState(false);

  const handleWeightChange = (key, value) => {
    setMatchWeights((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = async () => {
    // Check if there are approved matches before allowing settings reset
    if (approvedMatches.length > 0) {
      // Store the current settings and set pending to default
      setPreviousSettings({ ...matchWeights });
      setPendingSettings({ ...defaultMatchWeights });
      setMatchWeights(defaultMatchWeights); // Update UI immediately
      setShowSettingsWarning(true);
      return;
    }

    // No approved matches, proceed with normal reset
    setMatchWeights(defaultMatchWeights);
    await saveSettingsDirectly(defaultMatchWeights);
  };

  const handleSave = async () => {
    // Check if there are approved matches before allowing settings change
    if (approvedMatches.length > 0) {
      // Store the current settings and pending changes
      setPreviousSettings({ ...matchWeights });
      setPendingSettings({ ...matchWeights });
      setShowSettingsWarning(true);
      return;
    }

    // No approved matches, proceed with normal save
    await saveSettingsDirectly(matchWeights);
  };

  const saveSettingsDirectly = async (settings) => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/save-match-settings`, settings);
      if (response.status === 200) {
        setSaveSuccess(true);
      } else {
        throw new Error("Unexpected response");
      }
    } catch (error) {
      setSaveError("Failed to save settings.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSettingsWarningProceed = async () => {
    try {
      // Clear all approved matches
      for (const match of approvedMatches) {
        await axios.delete(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/approved-matches/${match.id}`);
      }
      
      // Clear approved matches from state
      setApprovedMatches([]);
      
      // Save the new settings
      await saveSettingsDirectly(pendingSettings);
      
      // Reset dismissed notifications to trigger matching notifications
      setDismissedNotifications(new Set());
      
      // Close the warning modal
      setShowSettingsWarning(false);
      setPendingSettings(null);
      setPreviousSettings(null);
      
      debugLog("🔄 Settings changed - All approved matches cleared, notifications reset");
      
    } catch (error) {
      console.error("Error clearing approved matches:", error);
      setSaveError("Failed to clear approved matches and save settings.");
    }
  };

  const handleSettingsWarningCancel = () => {
    // Revert to previous settings
    if (previousSettings) {
      setMatchWeights(previousSettings);
    }
    
    // Close the warning modal
    setShowSettingsWarning(false);
    setPendingSettings(null);
    setPreviousSettings(null);
  };

  // Submission deletion functions
  const handleDeleteSubmission = (submission) => {
    setSubmissionToDelete(submission);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteSubmission = async () => {
    if (!submissionToDelete) return;

    setDeletingSubmission(true);
    try {
      const response = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/submission/${submissionToDelete.id}`
      );

      if (response.status === 200) {
        // Remove from data state
        setData(prev => prev.filter(item => item.id !== submissionToDelete.id));
        
        // Close modal
        setShowDeleteConfirmation(false);
        setSubmissionToDelete(null);
        
        debugLog(`✅ Deleted submission for ${submissionToDelete.first_name} ${submissionToDelete.last_name}`);
      }
    } catch (error) {
      console.error("Error deleting submission:", error);
      alert("Failed to delete submission. Please try again.");
    } finally {
      setDeletingSubmission(false);
    }
  };

  const cancelDeleteSubmission = () => {
    setShowDeleteConfirmation(false);
    setSubmissionToDelete(null);
  };

  const settingsConfig = [
    { key: "major", label: "Major", explanation: 'Bidirectional matching considers BOTH mentor and mentee major preferences. When either party wants a major match, weight increases. Penalties apply when preferences are not satisfied.' },
    { key: "gender", label: "Gender", explanation: 'Bidirectional matching considers BOTH mentor and mentee gender preferences. Maximum score when both preferences are satisfied, partial score for one-sided satisfaction, penalties for conflicts.' },
    { key: "hobbies", label: "Hobbies", explanation: "Set the weight that hobby matching should hold in matching." },
    { key: "musicalArtists", label: "Musical Taste", explanation: "Set the weight that musical profile  matching should hold in matching." },
    { key: "personalityWords", label: "Personality Words", explanation: "Set the weight that personality matching should hold in matching." },
    { key: "expectations", label: "Expectations/Ideal Match", explanation: "Each user submits their expectations for their counterpart as well as their ideal counterpart." },
    { key: "organizations", label: "Org Involvement", explanation: "Set the weight that org involvement matching should hold in matching." },
    { key: "meetingFrequency", label: "Meeting Frequency", explanation: "Enhanced compatibility scoring: exact matches get full points, similar frequencies (Weekly↔Bi-Weekly) get partial points, incompatible frequencies (Weekly↔Monthly) get minimal points." },
  ];
  
  /*
  useEffect(() => {
    axios
      .get("https://nsbe-mentor-project.onrender.com/api/check", {
        withCredentials: true,
      })
      .then((res) => {
        if (!res.data.loggedIn) {
          navigate("/"); 
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Auth check failed:", err);
        navigate("/"); 
      });
  }, [navigate]);
  
  */

  useEffect(() => {
  axios
    .get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/submissions`, {
      withCredentials: true,
    })
    .then((res) => {
      debugLog("Fetched data:", res.data); // ✅ Should print your submissions
      setData(res.data);
    })
    .catch((err) => console.error("Data fetch failed:", err))
    .finally(() => setLoading(false));
}, []);

useEffect(() => {
  const loadSettings = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/get-match-settings`);
      if (res.data) {
        setMatchWeights((prev) => ({
          ...prev,
          ...res.data,
        }));
      }
    } catch (error) {
      console.error("Failed to load match settings:", error);
    }
  };

  loadSettings();
}, []);

// Load approved matches and check for duplicates on component mount
useEffect(() => {
  loadApprovedMatches();
  checkForDuplicates();
}, []);

// Recheck for duplicates when returning to dashboard
useEffect(() => {
  if (window.location.pathname === '/dashboard') {
    checkForDuplicates();
    // Reset dismissed duplicates notification when returning to dashboard
    // in case duplicates were resolved
    setDismissedNotifications(prev => {
      const newSet = new Set(prev);
      newSet.delete('duplicates');
      return newSet;
    });
  }
}, [window.location.pathname]);

// Update hasNewSubmissions whenever data or approved matches change
useEffect(() => {
  if (data.length === 0) return; // Don't run if no data yet
  
  const prevUnmatched = unmatchedCounts.mentors + unmatchedCounts.mentees;
  const hasUnmatched = checkForUnmatchedSubmissions();
  setHasNewSubmissions(hasUnmatched);
  
  debugLog(`🔄 Data/Matches changed - Recalculating unmatched counts`);
  debugLog(`📊 Previous unmatched: ${prevUnmatched}, New unmatched: ${unmatchedCounts.mentors + unmatchedCounts.mentees}`);
  
  // Reset dismissed notifications if new unmatched users appear
  // Note: We'll use a setTimeout to ensure the state has been updated
  setTimeout(() => {
    const currentUnmatched = unmatchedCounts.mentors + unmatchedCounts.mentees;
    if (currentUnmatched > prevUnmatched) {
      setDismissedNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete('unmatched');
        return newSet;
      });
    }
  }, 0);
}, [data, approvedMatches]);
  
/*
 if (loading)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <img
        src="/pictures/nsbelogo.png"
        alt="NSBE Logo"
        className="w-24 h-24 animate-flip transform-style preserve-3d"
      />
      <p className="mt-4 text-gray-500 text-sm">Loading...</p>
    </div>
  );
  */
  const totalSubmissions = data.length;
 const mentors = data.filter((entry) => entry.role?.toLowerCase() === "mentor");
const mentees = data.filter((entry) => entry.role?.toLowerCase() === "mentee");

  const getGenderBreakdown = (entries) => {
    const male = entries.filter((e) => e.gender?.toLowerCase().trim() === "male").length;
    const female = entries.filter((e) => e.gender?.toLowerCase().trim() === "female").length;
    
    // If no entries, return a single full pie chart for "No Data"
    if (male === 0 && female === 0) {
      return [
        { name: "No Data", value: 1, isEmpty: true }
      ];
    }
    
    return [
      { name: "Male", value: male },
      { name: "Female", value: female },
    ];
  };
  const CustomTooltip = ({ active, payload, total }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const { name } = payload[0];
    
    // Handle empty state
    if (data.isEmpty) {
      return (
        <div className="bg-white border px-2 py-1 rounded shadow text-sm">
          <strong>{name}</strong>: 0 (0%)
        </div>
      );
    }
    
    // Handle normal state
    const { value } = payload[0];
    const percent = ((value / total) * 100).toFixed(1);
    return (
      <div className="bg-white border px-2 py-1 rounded shadow text-sm">
        <strong>{name}</strong>: {value} ({percent}%)
      </div>
    );
  }
  return null;
};
  const renderCard = (title, count, pieData) => (
  <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md w-full transition-opacity duration-1000 relative">
    <h2 className="text-lg font-semibold mb-2">{title}</h2>
    <CountUp end={count} duration={1.5} className="text-3xl font-bold" />

    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
  data={pieData}
  dataKey="value"
  nameKey="name"
  cx="50%"
  cy="50%"
  outerRadius={50}
  fill="#8884d8"
>
  {pieData.map((entry, index) => (
    <Cell 
      key={`cell-${index}`} 
      fill={entry.isEmpty ? "#E5E7EB" : COLORS[index % COLORS.length]} 
    />
  ))}
</Pie>
<Tooltip content={<CustomTooltip total={count} />} />
      </PieChart>
    </ResponsiveContainer>

    {/* Legend */}
    <div className="absolute bottom-4 right-4 text-xs text-gray-600 space-y-1">
      {pieData.map((entry, index) => (
        <div key={index} className="flex items-center space-x-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ 
              backgroundColor: entry.isEmpty ? "#E5E7EB" : COLORS[index % COLORS.length] 
            }}
          />
          <span>{entry.name}</span>
        </div>
      ))}
    </div>
  </div>
);



  const filteredData = data.filter((entry) =>
    entry.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.last_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // NSBE Loading Component  
  const NSBELoadingOverlay = ({ message = "Generating matches..." }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <div className="mb-4">
          <img 
            src="/pictures/nsbelogo.png" 
            alt="NSBE Logo" 
            className="w-24 h-24 mx-auto animate-pulse"
          />
        </div>
        <div className="flex items-center justify-center space-x-2">
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
        </div>
        <p className="mt-4 text-gray-700 font-medium">{message}</p>
        <p className="text-sm text-gray-500">"I will WAIT for you" - Tems</p>
      </div>
    </div>
  );

  // Match generation function
  const generateMatches = async () => {
    setGeneratingMatches(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/generate-matches`);
      setMatches(response.data.mentorMatches || []);
      
      // If new improvements are found, reset the dismissed state
      const newImprovements = response.data.potentialImprovements || [];
      if (newImprovements.length > potentialImprovements.length) {
        setDismissedNotifications(prev => {
          const newSet = new Set(prev);
          newSet.delete('improvements');
          return newSet;
        });
      }
      
      setPotentialImprovements(newImprovements);
      setSelectedMatchIndex(0);
      
      if (newImprovements.length > 0) {
        debugLog(`🚨 Found ${newImprovements.length} potential match improvements`);
      }
      
      // hasNewSubmissions will be updated by the useEffect that monitors data/approvedMatches
    } catch (error) {
      console.error("Error generating matches:", error);
      alert("Failed to generate matches. Please try again.");
    } finally {
      setGeneratingMatches(false);
    }
  };

  // Load approved matches from database
  const loadApprovedMatches = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/approved-matches`);
      setApprovedMatches(response.data);
    } catch (error) {
      console.error("Error loading approved matches:", error);
    }
  };

  // Check for duplicate submissions
  const checkForDuplicates = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/duplicates`);
      setDuplicates(response.data);
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      setDuplicates({ hasDuplicates: false, count: 0 });
    } finally {
      setDuplicatesLoading(false);
    }
  };

  // Check if there are unmatched submissions available for matching
  const checkForUnmatchedSubmissions = () => {
    if (!data.length) {
      setUnmatchedCounts({ mentors: 0, mentees: 0 });
      return false;
    }

    // Get all matched user IDs from approved matches
    const matchedUserIds = new Set();
    approvedMatches.forEach(match => {
      matchedUserIds.add(match.mentor.id);
      if (match.assignedMentees && match.assignedMentees[0]) {
        matchedUserIds.add(match.assignedMentees[0].mentee.id);
      }
    });

    debugLog(`🔍 Approved matches count: ${approvedMatches.length}`);
    debugLog(`🔍 Matched user IDs:`, Array.from(matchedUserIds));

    // Check if there are unmatched mentors and mentees
    const unmatchedMentors = data.filter(user => 
      user.role?.toLowerCase() === "mentor" && !matchedUserIds.has(user.id)
    );
    const unmatchedMentees = data.filter(user => 
      user.role?.toLowerCase() === "mentee" && !matchedUserIds.has(user.id)
    );

    debugLog(
      "🔍 Unmatched mentors:",
      unmatchedMentors.map(u => `${u.first_name} ${u.last_name} (ID: ${u.id})`)
    );
    debugLog(
      "🔍 Unmatched mentees:",
      unmatchedMentees.map(u => `${u.first_name} ${u.last_name} (ID: ${u.id})`)
    );

    // Update unmatched counts for notifications
    setUnmatchedCounts({ mentors: unmatchedMentors.length, mentees: unmatchedMentees.length });

    // Need at least one mentor and one mentee to generate matches
    const hasUnmatchedPairs = unmatchedMentors.length > 0 && unmatchedMentees.length > 0;
    
    debugLog(`🔍 Unmatched check: ${unmatchedMentors.length} mentors, ${unmatchedMentees.length} mentees available`);
    
    return hasUnmatchedPairs;
  };

  // Match approval function with database persistence
  const approveMatch = async (match) => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/approved-matches`, {
        match: match,
        approvedBy: 'admin' // Could be enhanced with actual user info
      });

      if (response.data.success) {
        // Add database ID to the match for future reference
        const approvedMatch = {
          ...match,
          id: response.data.id,
          approvedAt: response.data.approvedAt,
          approvedBy: 'admin'
        };
        
        setApprovedMatches(prev => [...prev, approvedMatch]);
        setMatches(prev => prev.filter((_, index) => index !== selectedMatchIndex));
        setSelectedMatchIndex(prev => Math.max(0, prev - 1));
        setShowMatchDetails(false);
        
        debugLog("✅ Match approved and saved to database");
      }
    } catch (error) {
      console.error("Error approving match:", error);
      alert("Failed to approve match. Please try again.");
    }
  };

  // Remove approved match function
  const removeApprovedMatch = async (matchId, index) => {
    if (!window.confirm("Are you sure you want to remove this approved match?")) {
      return;
    }

    try {
      const response = await axios.delete(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/approved-matches/${matchId}`);
      
      if (response.data.success) {
        setApprovedMatches(prev => prev.filter((_, i) => i !== index));
        // Remove any improvements related to this match
        setPotentialImprovements(prev => prev.filter(imp => imp.currentMatch.id !== matchId));
        debugLog("✅ Approved match removed from database");
      }
    } catch (error) {
      console.error("Error removing approved match:", error);
      alert("Failed to remove approved match. Please try again.");
    }
  };

  // Get improvement for a specific match
  const getImprovementForMatch = (matchId) => {
    return potentialImprovements.find(imp => imp.currentMatch.id === matchId);
  };

  // Show improvement details
  const showImprovementDetails = (improvement) => {
    setSelectedImprovement(improvement);
    setShowImprovementModal(true);
  };

  // Replace match with better option
  const replaceMatch = async (improvement) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/approved-matches/${improvement.currentMatch.id}/replace`,
        {
          newMatch: improvement.newMatch,
          approvedBy: 'admin'
        }
      );

      if (response.data.success) {
        // Reload approved matches to reflect the change
        await loadApprovedMatches();
        
        // Remove this improvement from the list
        setPotentialImprovements(prev => prev.filter(imp => imp.currentMatch.id !== improvement.currentMatch.id));
        
        setShowImprovementModal(false);
        setSelectedImprovement(null);
        
        debugLog(`✅ Match replaced with ${response.data.improvementAmount.toFixed(2)} point improvement`);
        alert(`Match updated successfully! Improvement: +${response.data.improvementAmount.toFixed(2)} points`);
      }
    } catch (error) {
      console.error("Error replacing match:", error);
      alert("Failed to replace match. Please try again.");
    }
  };

  // Navigate through match options
  const navigateMatch = (direction) => {
    if (direction === 'next' && selectedMatchIndex < matches.length - 1) {
      setSelectedMatchIndex(prev => prev + 1);
    } else if (direction === 'prev' && selectedMatchIndex > 0) {
      setSelectedMatchIndex(prev => prev - 1);
    }
  };

    // Get all active notifications
  const getNotifications = () => {
    const notifications = [];
    
    // Duplicate submissions notification
    if (duplicates.hasDuplicates && !dismissedNotifications.has('duplicates')) {
      notifications.push({
        id: 'duplicates',
        type: 'error',
        icon: '⚠️',
        title: 'Duplicate Submissions Detected',
        message: `${duplicates.count} duplicate${duplicates.count !== 1 ? 's' : ''} found that need(s) review`,
        actions: [
          {
            label: 'Review Duplicates',
            onClick: () => navigate("/duplicates"),
            primary: true
          }
        ]
      });
    }
    
    // Unmatched users notification
    const totalUnmatched = unmatchedCounts.mentors + unmatchedCounts.mentees;
    if (totalUnmatched > 0 && hasNewSubmissions && !dismissedNotifications.has('unmatched')) {
      notifications.push({
        id: 'unmatched',
        type: 'warning',
        icon: '👥',
        title: 'Unmatched Users Need Attention',
        message: `${totalUnmatched} user${totalUnmatched !== 1 ? 's' : ''} waiting: ${
          unmatchedCounts.mentors > 0 ? `${unmatchedCounts.mentors} mentor${unmatchedCounts.mentors !== 1 ? 's' : ''}` : ''
        }${unmatchedCounts.mentors > 0 && unmatchedCounts.mentees > 0 ? ' + ' : ''}${
          unmatchedCounts.mentees > 0 ? `${unmatchedCounts.mentees} mentee${unmatchedCounts.mentees !== 1 ? 's' : ''}` : ''
        }`,
        actions: [
          {
            label: 'Generate Matches',
            onClick: generateMatches,
            disabled: generatingMatches,
            primary: true
          },
          {
            label: 'View Matches',
            onClick: () => setView("matches"),
            primary: false
          }
        ]
      });
    }
    
    // Potential improvements notification
    if (potentialImprovements.length > 0 && !dismissedNotifications.has('improvements')) {
      notifications.push({
        id: 'improvements',
        type: 'info',
        icon: '⚡',
        title: 'Better Matches Available',
        message: `${potentialImprovements.length} potential improvement${potentialImprovements.length !== 1 ? 's' : ''} found for existing matches`,
        actions: [
          {
            label: 'Review Improvements',
            onClick: () => setView("approved"),
            primary: true
          }
        ]
      });
    }
    
    return notifications;
  };

  // Notification Center Component
  const NotificationCenter = () => {
    const notifications = getNotifications();
    const notificationCount = notifications.length;
    
    const dismissNotification = (notificationId) => {
      setDismissedNotifications(prev => new Set([...prev, notificationId]));
    };
    
    const handleClickOutside = (e) => {
      if (showNotifications && !e.target.closest('.notification-center')) {
        setShowNotifications(false);
      }
    };
    
    React.useEffect(() => {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
      
    }, [showNotifications]);
    
    return (
      <div className="notification-center relative">
        {/* Bell Icon */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 text-gray-600 hover:text-gray-800 transition-colors"
          title="Notifications"
        >
          {/* Bell SVG Icon */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V9a5 5 0 00-10 0v3l-5 5h5m5 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          
          {/* Notification Badge */}
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>
        
        {/* Notification Dropdown */}
        {showNotifications && (
          <div className="absolute top-12 right-0 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-80 sm:max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                <span className="text-xs text-gray-500">{notificationCount} active</span>
              </div>
            </div>
            
            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <div className="mb-2">🔔</div>
                  <p className="text-sm">No notifications</p>
                  <p className="text-xs text-gray-400">You're all caught up!</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                      notification.type === 'error' ? 'border-l-4 border-l-red-400' :
                      notification.type === 'warning' ? 'border-l-4 border-l-amber-400' :
                      notification.type === 'info' ? 'border-l-4 border-l-blue-400' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          <span className="text-lg">{notification.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            {notification.message}
                          </p>
                          {notification.actions && (
                            <div className="flex items-center space-x-2">
                              {notification.actions.map((action, index) => (
                                <button
                                  key={index}
                                  onClick={action.onClick}
                                  disabled={action.disabled}
                                  className={`text-xs px-3 py-1 rounded font-medium transition-colors disabled:opacity-50 ${
                                    action.primary
                                      ? notification.type === 'error'
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : notification.type === 'warning'
                                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => dismissNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
                        title="Dismiss"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <button
                  onClick={() => setDismissedNotifications(new Set([...dismissedNotifications, ...notifications.map(n => n.id)]))}
                  className="text-xs text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Dismiss all notifications
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Add reloadData function
  const reloadData = () => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/submissions`, {
        withCredentials: true,
      })
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => console.error("Data fetch failed:", err));
  };

  return (
  <div className="min-h-screen bg-blue-50 relative p-3 sm:p-6">
    {generatingMatches && <NSBELoadingOverlay message="Generating matches..." />}
    
    {/* Top Navigation Bar */}
    <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 flex justify-between items-center">
      <a href="/">
        <img
          src="/pictures/nsbelogo.png"
          alt="NSBE Logo"
          className="w-12 sm:w-16 cursor-pointer"
        />
      </a>
      <NotificationCenter />
    </div>

    <div className="max-w-5xl mx-auto mt-16 sm:mt-20 p-4 sm:p-8 bg-white rounded-2xl sm:rounded-3xl shadow-xl">
      {/* Nav Buttons */}
      <div className="flex flex-wrap gap-2 sm:gap-4 mb-4">
        <button
          onClick={() => setView("dashboard")}
          className={`text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 sm:py-2 rounded-full transition relative ${
            view === "dashboard"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-400 hover:bg-gray-100"
          }`}
        >
          Dashboard
          {duplicates.hasDuplicates && !dismissedNotifications.has('duplicates') && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              !
            </span>
          )}
        </button>
        <button
          onClick={() => setView("matches")}
          className={`text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 sm:py-2 rounded-full transition relative ${
            view === "matches"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-400 hover:bg-gray-100"
          }`}
        >
          Matches
          {hasNewSubmissions && !dismissedNotifications.has('unmatched') && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              !
            </span>
          )}
        </button>
        <button
          onClick={() => setView("approved")}
          className={`text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 sm:py-2 rounded-full transition relative ${
            view === "approved"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-400 hover:bg-gray-100"
          }`}
        >
          Approved Matches
          {potentialImprovements.length > 0 && !dismissedNotifications.has('improvements') && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {potentialImprovements.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setView("Match Settings")}
          className={`text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 sm:py-2 rounded-full transition ${
            view === "Match Settings"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-400 hover:bg-gray-100"
          }`}
        >
          Match Settings
        </button>
      </div>

      {/* Dashboard View */}
      {view === "dashboard" && (
        <>
          <h1 className="text-2xl sm:text-3xl font-bold text-center">Dashboard</h1>
          <div className="w-24 h-1 bg-blue-300 mx-auto mt-2 mb-6 rounded-full" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {renderCard("Total Submissions", totalSubmissions, [
              { name: "Mentors", value: mentors.length },
              { name: "Mentees", value: mentees.length },
            ])}
            {renderCard("Mentors", mentors.length, getGenderBreakdown(mentors))}
            {renderCard("Mentees", mentees.length, getGenderBreakdown(mentees))}
          </div>

          <div className="mt-10">
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-center">Latest Submissions</h2>
            <input
              type="text"
              placeholder="Search by name..."
              className="w-full border p-2 rounded mb-4 text-sm sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs sm:text-sm text-left min-w-full">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-2 sm:p-3 whitespace-nowrap">First Name</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Last Name</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Role</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Major</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Gender</th>
                    <th className="p-2 sm:p-3 w-16 sm:w-20 text-center">Delete?</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((entry, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-1 sm:p-2 whitespace-nowrap">{entry.first_name}</td>
                      <td className="p-1 sm:p-2 whitespace-nowrap">{entry.last_name}</td>
                      <td className="p-1 sm:p-2 capitalize whitespace-nowrap">{entry.role}</td>
                      <td className="p-1 sm:p-2 max-w-32 sm:max-w-none truncate">{entry.major}</td>
                      <td className="p-1 sm:p-2 capitalize whitespace-nowrap">{entry.gender}</td>
                      <td className="p-1 sm:p-2 text-center">
                        <button
                          onClick={() => handleDeleteSubmission(entry)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 sm:p-2 rounded transition-colors touch-manipulation"
                          title={`Delete submission for ${entry.first_name} ${entry.last_name}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Match Settings View */}
      {view === "Match Settings" && (
        <div className="max-w-4xl mx-auto mt-10 sm:mt-20 px-4 sm:px-6">
                      <h2 className="text-2xl sm:text-3xl font-semibold text-center text-gray-800 mb-6 sm:mb-10">
              Match Settings
            </h2>

          {settingsConfig.map(({ key, label, explanation }) => {
  const isAutoCalculated = key === "major" || key === "gender";

  return (
    <div
      key={key}
                            className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 border-b border-gray-200 py-3 sm:py-6"
                    >
                      <div className="w-full sm:w-40">
        <select
          value={matchWeights[key]}
          disabled={isAutoCalculated}
          onChange={(e) => handleWeightChange(key, e.target.value)}
          className={`w-full border rounded px-4 py-2 text-gray-700 focus:outline-none ${
            isAutoCalculated
              ? "bg-gray-100 cursor-not-allowed"
              : "border-gray-300 focus:ring-2 focus:ring-blue-500"
          }`}
        >
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      <div className="flex-1">
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-sm text-gray-500 mt-1">
          {isAutoCalculated ? (
            <>
              <span className="italic">Bidirectional matching considers both parties.</span>{" "}
              {key === "major"
                ? 'Weight scales based on how many parties want major matches. Penalties apply when preferences conflict.'
                : 'Weight scales based on preference strength from both mentor and mentee. Higher scores for mutual satisfaction.'}
            </>
          ) : (
            explanation
          )}
        </p>
      </div>
    </div>
  );
})}



          <div className="mt-10 flex justify-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>

            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Reset to Default
            </button>
          </div>

          {saveSuccess && (
            <p className="mt-4 text-green-600 text-center">
              Settings saved successfully!
            </p>
          )}
          {saveError && (
            <p className="mt-4 text-red-600 text-center">{saveError}</p>
          )}
        </div>
      )}

      {/* Matches View */}
      {view === "matches" && (
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">Matches</h1>
          <div className="w-24 h-1 bg-blue-300 mx-auto mt-2 mb-6 rounded-full" />
          
          {/* Generate Matches Button */}
          {hasNewSubmissions && (
            <div className="text-center mb-6">
              <div>
                <button
                  onClick={generateMatches}
                  disabled={generatingMatches}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 mx-auto text-sm sm:text-base"
                >
                  <span>{generatingMatches ? "Generating..." : "Generate Matches"}</span>
                  <span>🫂</span>
                </button>
              </div>
            </div>
          )}

          {/* Matches Display */}
          {matches.length > 0 && (
            <div className="space-y-4">
              {matches.map((match, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    index === selectedMatchIndex ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setSelectedMatchIndex(index);
                    setSelectedMatch(match);
                    setShowMatchDetails(true);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">
                          {index + 1}/{matches.length}
                        </span>
                        <span className="font-medium">
                          {match.mentor.firstName} {match.mentor.lastName} & {
                            match.assignedMentees.length === 1 
                              ? `${match.assignedMentees[0]?.mentee?.firstName} ${match.assignedMentees[0]?.mentee?.lastName}`
                              : `${match.assignedMentees.length} mentees (${match.assignedMentees.map(m => m.mentee.firstName).join(', ')})`
                          }
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {match.assignedMentees.length === 1 ? (
                          <>Score: {match.assignedMentees[0]?.score?.toFixed(1)} | Mentor: {match.mentor.major} | Mentee: {match.assignedMentees[0]?.mentee?.major}</>
                        ) : (
                          <>
                            <div>Mentor: {match.mentor.major} | Capacity: {match.assignedMentees.length}/{match.mentor.capacity || 2}</div>
                            <div className="mt-1">
                              {match.assignedMentees.map((assignment, idx) => (
                                <div key={idx} className="text-xs">
                                  • {assignment.mentee.firstName} {assignment.mentee.lastName} (Score: {assignment.score.toFixed(1)}, {assignment.mentee.major})
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        approveMatch(match);
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full transition-colors"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ))}

              {/* Navigation Arrows */}
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => navigateMatch('prev')}
                  disabled={selectedMatchIndex === 0}
                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-full transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={() => navigateMatch('next')}
                  disabled={selectedMatchIndex === matches.length - 1}
                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-full transition-colors"
                >
                  →
                </button>
              </div>
            </div>
          )}

          {/* No Matches Message */}
          {matches.length === 0 && !hasNewSubmissions && (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-lg">No new matches to display.</p>
              <p className="text-sm">All available users have already been matched, or new form submissions are needed.</p>
            </div>
          )}
        </div>
      )}

      {/* Approved Matches View */}
      {view === "approved" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold">Approved Matches</h1>
              <div className="w-24 h-1 bg-blue-300 mx-auto mt-2 rounded-full" />
            </div>
            {potentialImprovements.length > 0 && (
              <div className="bg-amber-100 border border-amber-300 rounded-lg px-4 py-2 flex items-center space-x-2">
                <span className="text-amber-600">⚡</span>
                <span className="text-amber-800 font-medium">
                  {potentialImprovements.length} potential improvement{potentialImprovements.length !== 1 ? 's' : ''} available
                </span>
              </div>
            )}
          </div>
          <div className="mb-6"></div>
          
          {approvedMatches.length > 0 ? (
            <div className="space-y-4">
              {approvedMatches.map((match, index) => {
                const improvement = getImprovementForMatch(match.id);
                return (
                  <div key={match.id || index} className={`${improvement ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'} border rounded-lg p-4 relative`}>
                    {/* Improvement notification badge */}
                    {improvement && (
                      <div className="absolute -top-2 -right-2">
                        <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1 shadow-lg">
                          <span>⚡</span>
                          <span>+{improvement.newMatch.improvementAmount.toFixed(1)}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Improvement alert banner */}
                    {improvement && (
                      <div className="mb-3 p-2 bg-amber-100 border border-amber-300 rounded text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-amber-600">🚨</span>
                            <span className="font-medium text-amber-800">
                              Better match available! (+{improvement.newMatch.improvementAmount.toFixed(1)} points)
                            </span>
                          </div>
                          <button
                            onClick={() => showImprovementDetails(improvement)}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-xs transition-colors"
                          >
                            Review
                          </button>
                        </div>
                        <div className="mt-1 text-amber-700 text-xs">
                          {improvement.type === 'better_mentor' 
                            ? `New mentor "${improvement.newMatch.mentor.firstName} ${improvement.newMatch.mentor.lastName}" could be a better match for this mentee`
                            : `New mentee "${improvement.newMatch.mentee.firstName} ${improvement.newMatch.mentee.lastName}" could be a better match for this mentor`
                          }
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">
                          {match.mentor.firstName} {match.mentor.lastName} & {match.assignedMentees[0]?.mentee?.firstName} {match.assignedMentees[0]?.mentee?.lastName}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Score: {match.assignedMentees[0]?.score?.toFixed(1)} | Approved Match
                        </div>
                        {match.approvedAt && (
                          <div className="text-xs text-gray-500 mt-1">
                            Approved: {new Date(match.approvedAt).toLocaleDateString()} at {new Date(match.approvedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className={improvement ? "text-amber-600" : "text-green-600"}>
                          ✓ Approved
                        </div>
                        {match.id && (
                          <button
                            onClick={() => removeApprovedMatch(match.id, index)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
                            title="Remove approved match"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-lg">No approved matches yet.</p>
              <p className="text-sm">Approved matches will appear here after you review and approve them from the Matches tab.</p>
            </div>
          )}
                 </div>
       )}

      {/* Match Details Modal */}
      {showMatchDetails && selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowMatchDetails(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-2 sm:mx-4 max-h-[90vh] sm:max-h-96 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg sm:text-xl font-bold">Match Details</h3>
                <button
                  onClick={() => setShowMatchDetails(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="border-b pb-4">
                  <h4 className="font-semibold text-lg mb-2">
                    {selectedMatch.mentor.firstName} {selectedMatch.mentor.lastName} & {
                      selectedMatch.assignedMentees.length === 1 
                        ? `${selectedMatch.assignedMentees[0]?.mentee?.firstName} ${selectedMatch.assignedMentees[0]?.mentee?.lastName}`
                        : `${selectedMatch.assignedMentees.length} Mentees`
                    }
                  </h4>
                  {selectedMatch.assignedMentees.length === 1 ? (
                    <div className="text-2xl font-bold text-green-600">
                      Total Score: {selectedMatch.assignedMentees[0]?.score?.toFixed(1)}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-lg font-bold text-green-600">Multiple Mentee Match</div>
                      {selectedMatch.assignedMentees.map((assignment, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                          <span className="font-medium">{assignment.mentee.firstName} {assignment.mentee.lastName}</span>
                          <span className="text-green-600 font-bold">Score: {assignment.score.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-blue-700 mb-2">Mentor Details</h5>
                    <p><strong>Name:</strong> {selectedMatch.mentor.firstName} {selectedMatch.mentor.lastName}</p>
                    <p><strong>Major:</strong> {selectedMatch.mentor.major}</p>
                    <p><strong>Year:</strong> {selectedMatch.mentor.year}</p>
                    <p><strong>Email:</strong> {selectedMatch.mentor.email}</p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-purple-700 mb-2">
                      Mentee Details {selectedMatch.assignedMentees.length > 1 && `(${selectedMatch.assignedMentees.length} mentees)`}
                    </h5>
                    {selectedMatch.assignedMentees.length === 1 ? (
                      <>
                        <p><strong>Name:</strong> {selectedMatch.assignedMentees[0]?.mentee?.firstName} {selectedMatch.assignedMentees[0]?.mentee?.lastName}</p>
                        <p><strong>Major:</strong> {selectedMatch.assignedMentees[0]?.mentee?.major}</p>
                        <p><strong>Year:</strong> {selectedMatch.assignedMentees[0]?.mentee?.year}</p>
                        <p><strong>Email:</strong> {selectedMatch.assignedMentees[0]?.mentee?.email}</p>
                      </>
                    ) : (
                      <div className="space-y-3">
                        {selectedMatch.assignedMentees.map((assignment, idx) => (
                          <div key={idx} className="border-l-4 border-purple-200 pl-3">
                            <p><strong>Name:</strong> {assignment.mentee.firstName} {assignment.mentee.lastName}</p>
                            <p><strong>Major:</strong> {assignment.mentee.major}</p>
                            <p><strong>Year:</strong> {assignment.mentee.year}</p>
                            <p><strong>Email:</strong> {assignment.mentee.email}</p>
                            <p><strong>Score:</strong> {assignment.score.toFixed(1)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Score Breakdown */}
                {selectedMatch.assignedMentees.length > 0 && selectedMatch.assignedMentees.some(mentee => mentee.details) && (
                  <div className="mt-6">
                    <h5 className="font-medium text-gray-700 mb-3">Score Breakdown</h5>
                    {selectedMatch.assignedMentees.length === 1 ? (
                      // Single mentee - show as before
                      <div className="space-y-2 text-sm">
                        {Object.entries(selectedMatch.assignedMentees[0].details).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center py-1 border-b border-gray-100">
                            <ScoreTooltip category={key}>
                              <span className="capitalize font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            </ScoreTooltip>
                            <span className="font-semibold">
                              {typeof value === 'object' && value !== null ? (
                                value.score !== undefined ? 
                                  value.score.toFixed(2) : 
                                  key.toLowerCase().includes('musical') ? (
                                    <div className="text-xs text-right space-y-1">
                                      <div className="text-gray-800">Combined Score: {(value.combinedScore || 0).toFixed(2)}</div>
                                      <div className="text-gray-600">Artist Overlap: {(value.artistOverlap || 0).toFixed(2)} (×30% = {((value.artistOverlap || 0) * 0.3).toFixed(2)})</div>
                                      <div className="text-gray-600">Genre Similarity: {(value.genreSimilarity || 0).toFixed(2)} (×50% = {((value.genreSimilarity || 0) * 0.5).toFixed(2)})</div>
                                      <div className="text-gray-600">Musical Diversity: {(value.musicalDiversity || 0).toFixed(2)} (×20% = {((value.musicalDiversity || 0) * 0.2).toFixed(2)})</div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-right">
                                      {Object.entries(value).map(([subKey, subValue]) => (
                                        <div key={subKey} className="text-gray-600">
                                          {subKey}: {typeof subValue === 'number' ? subValue.toFixed(2) : String(subValue)}
                                        </div>
                                      ))}
                                    </div>
                                  )
                              ) : typeof value === 'number' ? 
                                value.toFixed(2) : 
                                String(value)
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Multiple mentees - show side-by-side comparison
                      <div className="space-y-4">
                        <div className="text-center text-sm text-gray-600 font-medium">
                          Side-by-Side Score Comparison
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {selectedMatch.assignedMentees.map((assignment, idx) => (
                            assignment.details && (
                              <div key={idx} className="bg-gray-50 rounded-lg p-4 border-2 border-purple-200">
                                <div className="text-center mb-3">
                                  <h6 className="font-bold text-purple-700 text-lg">
                                    {assignment.mentee.firstName} {assignment.mentee.lastName}
                                  </h6>
                                  <div className="text-2xl font-bold text-green-600 mt-1">
                                    {assignment.score.toFixed(1)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {assignment.mentee.major} • {assignment.mentee.year}
                                  </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                                                      {Object.entries(assignment.details).map(([key, value]) => (
                                      <div key={key} className="flex justify-between items-start py-1 border-b border-gray-200 last:border-b-0">
                                        <ScoreTooltip category={key}>
                                          <span className="capitalize font-medium text-xs text-gray-700 flex-shrink-0">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                                          </span>
                                        </ScoreTooltip>
                                      <span className="font-semibold text-right ml-2">
                                        {typeof value === 'object' && value !== null ? (
                                          value.score !== undefined ? 
                                            value.score.toFixed(2) : 
                                            key.toLowerCase().includes('musical') ? (
                                              <div className="text-xs space-y-1">
                                                <div className="text-gray-800 font-bold">{(value.combinedScore || 0).toFixed(2)}</div>
                                                <div className="text-gray-600">Artist Overlap: {((value.artistOverlap || 0) * 0.3).toFixed(2)}</div>
                                                <div className="text-gray-600">Genre Similarity: {((value.genreSimilarity || 0) * 0.5).toFixed(2)}</div>
                                                <div className="text-gray-600">Musical Diversity: {((value.musicalDiversity || 0) * 0.2).toFixed(2)}</div>
                                              </div>
                                            ) : (
                                              <div className="text-xs">
                                                {Object.entries(value).map(([subKey, subValue]) => (
                                                  <div key={subKey} className="text-gray-600">
                                                    {typeof subValue === 'number' ? subValue.toFixed(2) : String(subValue)}
                                                  </div>
                                                ))}
                                              </div>
                                            )
                                        ) : typeof value === 'number' ? 
                                          value.toFixed(2) : 
                                          String(value)
                                        }
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowMatchDetails(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => approveMatch(selectedMatch)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Approve Match
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Improvement Review Modal */}
      {showImprovementModal && selectedImprovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowImprovementModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-bold text-amber-800">🚨 Potential Match Improvement</h3>
                <button
                  onClick={() => setShowImprovementModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600 mb-2">
                    +{selectedImprovement.newMatch.improvementAmount.toFixed(1)} Point Improvement
                  </div>
                  <p className="text-amber-800">
                    {selectedImprovement.type === 'better_mentor' 
                      ? `A new mentor submission could provide a better match for an existing mentee`
                      : `A new mentee submission could provide a better match for an existing mentor`
                    }
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Match */}
                <div className="border rounded-lg p-4 bg-red-50 border-red-200">
                  <h4 className="font-semibold text-red-700 mb-3 flex items-center">
                    <span className="mr-2">📋</span>
                    Current Match (Score: {selectedImprovement.currentMatch.currentScore.toFixed(1)})
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>This would be replaced</strong></p>
                    <div className="text-gray-600 mt-2">
                      Current approved match would be updated with the new person
                    </div>
                  </div>
                </div>

                {/* Proposed Match */}
                <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                  <h4 className="font-semibold text-green-700 mb-3 flex items-center">
                    <span className="mr-2">⭐</span>
                    Proposed Match (Score: {selectedImprovement.newMatch.newScore.toFixed(1)})
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Mentor:</strong> {selectedImprovement.newMatch.mentor.firstName} {selectedImprovement.newMatch.mentor.lastName}</p>
                    <p><strong>Major:</strong> {selectedImprovement.newMatch.mentor.major}</p>
                    <p><strong>Year:</strong> {selectedImprovement.newMatch.mentor.year}</p>
                    <hr className="my-2" />
                    <p><strong>Mentee:</strong> {selectedImprovement.newMatch.mentee.firstName} {selectedImprovement.newMatch.mentee.lastName}</p>
                    <p><strong>Major:</strong> {selectedImprovement.newMatch.mentee.major}</p>
                    <p><strong>Year:</strong> {selectedImprovement.newMatch.mentee.year}</p>
                  </div>
                </div>
              </div>

              {/* Score Breakdown */}
              {selectedImprovement.newMatch.details && (
                <div className="mt-6">
                  <h5 className="font-medium text-gray-700 mb-3">New Match Score Breakdown</h5>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {Object.entries(selectedImprovement.newMatch.details).map(([key, value]) => (
                        <div key={key} className="text-center">
                          <ScoreTooltip category={key}>
                            <div className="font-medium capitalize text-gray-600">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                          </ScoreTooltip>
                          <div className="font-bold text-lg">
                            {typeof value === 'object' && value !== null ? (
                              value.score !== undefined ? 
                                value.score.toFixed(1) : 
                                key.toLowerCase().includes('musical') ? (
                                  <div className="text-xs space-y-1">
                                    <div className="text-gray-800">Combined Score: {(value.combinedScore || 0).toFixed(2)}</div>
                                    <div className="text-gray-600">Artist Overlap: {(value.artistOverlap || 0).toFixed(2)} (×30% = {((value.artistOverlap || 0) * 0.3).toFixed(2)})</div>
                                    <div className="text-gray-600">Genre Similarity: {(value.genreSimilarity || 0).toFixed(2)} (×50% = {((value.genreSimilarity || 0) * 0.5).toFixed(2)})</div>
                                    <div className="text-gray-600">Musical Diversity: {(value.musicalDiversity || 0).toFixed(2)} (×20% = {((value.musicalDiversity || 0) * 0.2).toFixed(2)})</div>
                                  </div>
                                ) : (
                                  <div className="text-xs">
                                    {Object.entries(value).map(([subKey, subValue]) => (
                                      <div key={subKey} className="text-gray-600">
                                        {subKey}: {typeof subValue === 'number' ? subValue.toFixed(1) : String(subValue)}
                                      </div>
                                    ))}
                                  </div>
                                )
                            ) : typeof value === 'number' ? 
                              value.toFixed(1) : 
                              String(value)
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-8">
                <button
                  onClick={() => setShowImprovementModal(false)}
                  className="px-6 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Keep Current Match
                </button>
                <button
                  onClick={() => replaceMatch(selectedImprovement)}
                  className="px-6 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors font-medium"
                >
                  Replace with Better Match
                </button>
              </div>
            </div>
          </div>
        </div>
             )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && submissionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Submission
              </h3>
              
              <div className="text-sm text-gray-600 mb-6">
                <p className="mb-2">
                  Are you sure you want to delete the submission for:
                </p>
                <p className="font-semibold text-gray-800">
                  {submissionToDelete.first_name} {submissionToDelete.last_name}
                </p>
                <p className="text-gray-500 mt-1">
                  ({submissionToDelete.role} • {submissionToDelete.major})
                </p>
                <p className="text-red-600 text-xs mt-3 font-medium">
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={cancelDeleteSubmission}
                  disabled={deletingSubmission}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSubmission}
                  disabled={deletingSubmission}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                >
                  {deletingSubmission ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Change Warning Modal */}
      {showSettingsWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                 Approved Matches Will Be Removed
              </h3>
              
              <div className="text-sm text-gray-600 mb-6 space-y-2">
                <p>
                  You currently have <span className="font-semibold text-red-600">{approvedMatches.length} approved match{approvedMatches.length !== 1 ? 'es' : ''}</span>.
                </p>
                <p>
                  Changing match settings will <span className="font-semibold">remove all approved matches</span> because the scoring algorithm will change, potentially creating different optimal pairings.
                </p>
                <p className="text-gray-500 text-xs">
                  You will need to regenerate and re-approve matches after the settings change.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleSettingsWarningCancel}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSettingsWarningProceed}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                >
                  {saving ? "Processing..." : "Proceed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>  
  );
}
