import { useState, useEffect, useRef } from "react";
import Fuse from "fuse.js";
import axios from "axios";
import majorsList from "@/data/majors.json";
import clubList from "@/data/clubs.json";
// import hobbiesList from "@/data/hobbies.json"; // Now loaded dynamically
import Confetti from "react-confetti";
import { Link } from "react-router-dom";

export default function SharedForm({ role, onSubmit }) {
  const [formData, setFormData] = useState({
  firstName: "",
  lastName: "",
  email: "",
  personalEmail: "",
  studentId: "",
  major: "",
  gender: "",
  year: "",
  pairGenderPreference: "",
  meetingFrequency: "", 
  hobbies: [""],
  musicalArtists: [""],
  organizations: [""],
  personalityWords: [{ raw: "" }],
  expectations: "",
  idealMatchDescription: "",
  menteeInMajor: "",
  openToMultiple: "",
  preferredStudentId: "",
});


  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState([]);
  const nextBtnRef = useRef(null);
  const [filteredMajors, setFilteredMajors] = useState([]);
  const [majorSelected, setMajorSelected] = useState(false);
  const [hobbySuggestions, setHobbySuggestions] = useState([]);
  const [activeHobbyIndex, setActiveHobbyIndex] = useState(null);
  const [filteredOrgs, setFilteredOrgs] = useState([[]]);
  const [focusedOrgOption, setFocusedOrgOption] = useState([-1]);
  const [focusedMajorIndex, setFocusedMajorIndex] = useState(-1);
  const [focusedHobbyOption, setFocusedHobbyOption] = useState(-1);
  const [spotifyResults, setSpotifyResults] = useState([]);
  const searchTimeouts = useRef([]);
  const audioRefs = useRef([]);

  const [traitSuggestions, setTraitSuggestions] = useState([]);
  const [activeTraitIndex, setActiveTraitIndex] = useState(null);
  const [focusedTraitOption, setFocusedTraitOption] = useState(-1);

  const [traitVectors, setTraitVectors] = useState({});
  const [traitFuse, setTraitFuse] = useState(null);
  const [traitClickInProgress, setTraitClickInProgress] = useState(false);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [hobbyVectors, setHobbyVectors] = useState({});
  const [hobbiesList, setHobbiesList] = useState([]);
  const [hobbyFuse, setHobbyFuse] = useState(null);
  const [confirmedHobbies, setConfirmedHobbies] = useState(new Set()); // Track which hobbies have been confirmed
  const [lastHobbiesRefresh, setLastHobbiesRefresh] = useState(Date.now());
  const [hobbiesRefreshInterval, setHobbiesRefreshInterval] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastTraitsRefresh, setLastTraitsRefresh] = useState(Date.now());
  const [isRefreshingTraits, setIsRefreshingTraits] = useState(false);
  const progressPercent = Math.round(((step - 1) / 8) * 100);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const BASE_URL = import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com";

  // Function to refresh hobbies list and vectors
  const refreshHobbiesList = async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    try {
      setIsRefreshing(true);
      console.log("🔄 Refreshing hobbies list...");
      
      const [vectorsResponse, hobbiesResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/hobbies/vectors`),
        axios.get(`${BASE_URL}/api/hobbies`)
      ]);
      
      const vectors = vectorsResponse.data;
      const updatedHobbies = hobbiesResponse.data;
      

      
      setHobbyVectors(vectors);
      setHobbiesList(updatedHobbies);
      setLastHobbiesRefresh(Date.now());
      
      console.log(`✅ Hobbies list refreshed: ${updatedHobbies.length} hobbies, ${Object.keys(vectors).length} vectors`);
      console.log(`🔍 Last 3 new hobbies:`, updatedHobbies.slice(-3));
    } catch (err) {
      console.error("❌ Failed to refresh hobbies list:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to refresh traits list and vectors
  const refreshTraitsList = async () => {
    if (isRefreshingTraits) return; // Prevent multiple simultaneous refreshes
    
    try {
      setIsRefreshingTraits(true);
      console.log("🔄 Refreshing traits list...");
      
      const [vectorsResponse, traitsResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/traits/vectors`),
        axios.get(`${BASE_URL}/api/traits`)
      ]);
      
      const vectors = vectorsResponse.data;
      const updatedTraits = traitsResponse.data;
      

      
      setTraitVectors(vectors);
      setLastTraitsRefresh(Date.now());
      
      console.log(`✅ Traits list refreshed: ${updatedTraits.length} traits, ${Object.keys(vectors).length} vectors`);
      console.log(`🔍 Last 3 new traits:`, updatedTraits.slice(-3));
    } catch (err) {
      console.error("❌ Failed to refresh traits list:", err);
    } finally {
      setIsRefreshingTraits(false);
    }
    }

  const errorMessages = {
    email: "Email should end with @psu.edu",
    studentId: "Student ID must be exactly 9 digits.",
    hobbies: "Please fill out all hobby fields (no blanks).",
    musicalArtists: "Please select all artists from Spotify results (no custom entries allowed).",
    organizations: "Please fill out all organization fields (no blanks).",
    major: "Please select a major from the list.",
    firstName: "First Name is required.",
    lastName: "Last Name is required.",
    gender: "Please select your gender.",
    year: "Please select your academic year.",
    pairGenderPreference: "Please select your preferred mentee gender.",
    meetingFrequency: "Please select your preferred meeting frequency.",
    openToMultiple: "Please indicate if you are open to mentoring two mentees.",
    expectations: "Please describe your mentorship style (250 characters max).",
    personalityWords: "Please describe yourself in 3 words.",
    idealMatchDescription: role === "mentor"
    ? "Please describe your ideal mentee (250 characters max)."
    : "Please describe your ideal mentor (250 characters max).",
    menteeInMajor: role === "mentor" 
    ? "Please indicate if you prefer mentees in your major."
    : "Please indicate if you are looking for a mentor in your major.",
  };

  const requiredFields = {
    1: [
      "firstName",
      "lastName",
      "email",
      "studentId",
      "major",
      "gender",
      "year",
      "pairGenderPreference",
    ],
    2: ["hobbies"],
    3: ["musicalArtists"],
    4:
      role === "mentor"
        ? ["meetingFrequency", "openToMultiple", "menteeInMajor"]
        : ["meetingFrequency", "menteeInMajor"],
    5: ["organizations"],
    6: ["expectations"],
    7: ["personalityWords", "idealMatchDescription"],
    8: [], // No required fields for step 8 (preferred student ID is optional)
  };

  const validateStep = (stepToValidate) => {
    const fields = requiredFields[stepToValidate];
    if (!fields) return true; // No validation if undefined step

    const missing = fields.filter((field) => {
      const val = formData[field];

      if (Array.isArray(val)) {
        if (field === "hobbies") {
          // Check if all hobby fields are filled and confirmed
          return val.some((h, index) => {
            const hobby = (h || "").trim();
            if (hobby === "") return true; // Empty field
            // Check if hobby is confirmed (either from suggestions or explicitly kept)
            return !confirmedHobbies.has(index);
          }) || val.length === 0;
        }

        if (field === "musicalArtists") {
          // Check if all artists have been selected from Spotify (not just typed)
          return (
            val.some((v) => (v?.trim?.() || "") === "") || 
            val.length === 0 ||
            // Check if all artists have corresponding Spotify selections
            val.some((_, index) => !spotifyResults[index]?.selectedItem)
          );
        }
        
        if (field === "organizations") {
          return (
            val.some((v) => (v?.trim?.() || "") === "") || val.length === 0
          );
        }
        if (field === "personalityWords") {
          return (
            val.some((t) => (t?.raw || "").trim() === "") || val.length === 0
          );
        }
        return val.length === 0;
      }

      return !val;
    });

    if (stepToValidate === 1) {
      if (!formData.major || !majorSelected) {
        if (!missing.includes("major")) missing.push("major");
      }
      if (formData.email && (!formData.email.toLowerCase().endsWith("@psu.edu"))) {
        if (!missing.includes("email")) missing.push("email");
      }
      if (!/^\d{9}$/.test(formData.studentId)) {
        if (!missing.includes("studentId")) missing.push("studentId");
      }
    }

    if (stepToValidate === 5) {
      const invalidOrgs = formData.organizations.filter(
        (org) => !clubList.some((c) => c.name === org),
      );
      if (invalidOrgs.length > 0 && !missing.includes("organizations")) {
        missing.push("organizations");
      }
    }

    if (stepToValidate === 7) {
      const traits = formData.personalityWords;

      if (
        traits.length !== 3 ||
        traits.some((t) => (t.raw || "").trim() === "")
      ) {
        if (!missing.includes("personalityWords"))
          missing.push("personalityWords");
      }
    }

    // Validate character limits for expectations and ideal match description
    if (stepToValidate === 6 && formData.expectations.length > 250) {
      if (!missing.includes("expectations")) missing.push("expectations");
    }

    if (stepToValidate === 7 && formData.idealMatchDescription.length > 250) {
      if (!missing.includes("idealMatchDescription")) missing.push("idealMatchDescription");
    }

    // Validate preferred student ID format on step 8 (optional field)
    if (stepToValidate === 8 && formData.preferredStudentId && !/^\d{9}$/.test(formData.preferredStudentId)) {
      if (!missing.includes("preferredStudentId")) missing.push("preferredStudentId");
    }

    setErrors(missing);
    if (missing.length > 0) {
      nextBtnRef.current?.classList.add("animate-shake");
      setTimeout(
        () => nextBtnRef.current?.classList.remove("animate-shake"),
        500,
      );
      return false;
    }

    return true;
  };

  const updatePreviewState = (index, isPlaying) => {
    setSpotifyResults((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], previewPlaying: isPlaying };
      return copy;
    });
  };

  useEffect(() => {
    // Load trait vectors
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/traits/vectors`)
      .then((res) => {
        setTraitVectors(res.data);
        setTraitFuse(
          new Fuse(Object.keys(res.data), {
            includeScore: true,
            threshold: 0.3,
            minMatchCharLength: 2,
            shouldSort: true,
          }),
        );
      })
      .catch((err) => {
        console.error("Failed to load trait vectors:", err);
      });

    // Load hobbies list dynamically
    console.log("🔄 Loading hobbies from API...");
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/hobbies`)
      .then((res) => {
        console.log("✅ Loaded hobbies dynamically:", res.data.length);
        console.log("🔍 Last 5 hobbies from API:", res.data.slice(-5));
        console.log("🔍 Netflix in hobbies?", res.data.includes("Netflix"));
        setHobbiesList(res.data);
      })
      .catch((err) => {
        console.error("❌ Failed to load hobbies from API:", err);
        console.log("🔄 Trying fallback to static import...");
        // Fallback to static import if API fails
        import("@/data/hobbies.json").then((staticHobbies) => {
          console.log("⚠️ Using static hobbies fallback:", staticHobbies.default.length);
          console.log("🔍 Netflix in static hobbies?", staticHobbies.default.includes("Netflix"));
          setHobbiesList(staticHobbies.default);
        });
      });

    // Load traits list dynamically (for potential future dynamic trait additions)
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/traits`)
      .then((res) => {
        console.log("✅ Loaded traits dynamically:", res.data.length);
        // Update traitFuse if needed in the future
      })
      .catch((err) => {
        console.error("Failed to load traits:", err);
      });

    // Load hobby vectors
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/hobbies/vectors`)
      .then((res) => {
        setHobbyVectors(res.data);
      })
      .catch((err) => {
        console.error("Failed to load hobby vectors:", err);
             });
  }, []);

  // Create Fuse instance when hobbies list changes
  useEffect(() => {
    if (hobbiesList.length > 0) {
      console.log("🔄 Creating Fuse instance...");
      console.log("🔍 hobbiesList length:", hobbiesList.length);
      console.log("🔍 Last 3 hobbies for Fuse:", hobbiesList.slice(-3));
      console.log("🔍 Netflix in hobbiesList for Fuse?", hobbiesList.includes("Netflix"));
      
      const fuse = new Fuse(hobbiesList, {
        threshold: 0.3,
        minMatchCharLength: 2,
        shouldSort: true,
      });
      setHobbyFuse(fuse);
      console.log("✅ Created Fuse instance with", hobbiesList.length, "hobbies");
      
      // Test search for Netflix specifically
      const testSearch = fuse.search("Netflix");
      console.log("🧪 Test search for 'Netflix':", testSearch);
    }
  }, [hobbiesList]);

  // Set up periodic refresh of hobbies list (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSinceLastRefresh = Date.now() - lastHobbiesRefresh;
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      if (timeSinceLastRefresh >= fiveMinutes) {
        console.log("⏰ Periodic refresh triggered - refreshing hobbies list...");
        refreshHobbiesList();
      }
    }, 60000); // Check every minute
    
    setHobbiesRefreshInterval(interval);
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [lastHobbiesRefresh]);

  // Set up periodic refresh of traits list (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSinceLastRefresh = Date.now() - lastTraitsRefresh;
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      if (timeSinceLastRefresh >= fiveMinutes) {
        console.log("⏰ Periodic refresh triggered - refreshing traits list...");
        refreshTraitsList();
      }
    }, 60000); // Check every minute
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [lastTraitsRefresh]);

  // Smart refresh when form becomes visible (using Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const timeSinceLastRefresh = Date.now() - lastHobbiesRefresh;
        const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
        
        if (timeSinceLastRefresh >= twoMinutes) {
          console.log("👁️ Form became visible - refreshing hobbies list...");
          refreshHobbiesList();
        }
        
        const timeSinceLastTraitsRefresh = Date.now() - lastTraitsRefresh;
        if (timeSinceLastTraitsRefresh >= twoMinutes) {
          console.log("👁️ Form became visible - refreshing traits list...");
          refreshTraitsList();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastHobbiesRefresh, lastTraitsRefresh]);

  // Refresh hobbies when navigating to step 2 (hobbies step)
  useEffect(() => {
    if (step === 2) {
      const timeSinceLastRefresh = Date.now() - lastHobbiesRefresh;
      const thirtySeconds = 30 * 1000; // 30 seconds in milliseconds
      
      if (timeSinceLastRefresh >= thirtySeconds) {
        console.log("🎯 Navigated to hobbies step - refreshing hobbies list...");
        refreshHobbiesList();
      }
    }
  }, [step, lastHobbiesRefresh]);

  // Refresh traits when navigating to step 7 (personality traits step)
  useEffect(() => {
    if (step === 7) {
      const timeSinceLastRefresh = Date.now() - lastTraitsRefresh;
      const thirtySeconds = 30 * 1000; // 30 seconds in milliseconds
      
      if (timeSinceLastRefresh >= thirtySeconds) {
        console.log("🎯 Navigated to traits step - refreshing traits list...");
        refreshTraitsList();
      }
    }
  }, [step, lastTraitsRefresh]);

  const selectSpotifyResult = (index, item) => {
    console.log(`Selected item:`, item);
    console.log(`Preview URL for "${item.name}":`, item.preview_url);

    // Format displayName based on type
    let displayName;
    if (item.type === "artist") {
      // For artists, just use the artist name
      displayName = item.name;
    } else {
      // For songs and albums, use "Name by Artist" format
      displayName = `${item.name}${item.artists ? ` by ${item.artists.join(", ")}` : ""}`;
    }
    
    const updated = [...formData.musicalArtists];
    updated[index] = displayName;

    setFormData((prev) => ({ ...prev, musicalArtists: updated }));

    setSpotifyResults((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        selectedItem: item,
        genres: item.genres || [], // Safely store genres
        previewPlaying: false,
        results: [],
      };
      return copy;
    });

    if (item.preview_url) {
      console.log(`Setting up preview for "${item.name}": ${item.preview_url}`);
      console.log("genres are:", item.genres);

      try {
        if (!audioRefs.current[index]) {
          audioRefs.current[index] = new Audio(item.preview_url);
        } else {
          audioRefs.current[index].pause();
          audioRefs.current[index].src = item.preview_url;
        }
      } catch (err) {
        console.error(`Error creating audio element for "${item.name}":`, err);
      }
    } else {
      console.warn(`No preview available for "${item.name}"`);
    }
  };

  useEffect(() => {
    if (step === 9) {
      setShowTitle(false);
      setShowMessage(false);

      setTimeout(() => setShowTitle(true), 100); // slight delay for better visual
      setTimeout(() => setShowMessage(true), 1500); // waits for title to fully appear
    }
  }, [step]);

  const togglePreview = (index) => {
    const audio = audioRefs.current[index];
    const selected = spotifyResults[index]?.selectedItem;

    if (!selected || !selected.preview_url) {
      console.warn(`No valid preview URL to play for index ${index}`, selected);
      return;
    }

    if (!audio) {
      console.warn(`Audio element not initialized for index ${index}`);
      return;
    }

    if (spotifyResults[index]?.previewPlaying) {
      console.log(`Pausing preview for "${selected.name}"`);
      audio.pause();
      updatePreviewState(index, false);
    } else {
      console.log(`Playing preview for "${selected.name}"`);
      audio
        .play()
        .then(() => {
          updatePreviewState(index, true);
          audio.onended = () => updatePreviewState(index, false);
        })
        .catch((err) => {
          console.error(`Error playing preview for "${selected.name}":`, err);
        });
    }
  };

  const addTraitField = () => {
    setFormData({
      ...formData,
      personalityWords: [...formData.personalityWords, { raw: "" }],
    });
  };

  const removeTrait = (index) => {
    const updated = [...formData.personalityWords];
    updated.splice(index, 1);
    setFormData({ ...formData, personalityWords: updated });
  };

  const addHobbyField = () => {
    if (formData.hobbies.at(-1)?.trim() === "") return;
    setFormData((prev) => ({
      ...prev,
      hobbies: [...prev.hobbies, ""],
    }));
    setHobbySuggestions([]);
    setActiveHobbyIndex(null);
  };

  const removeHobby = (index) => {
    const updated = formData.hobbies.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      hobbies: updated.length > 0 ? updated : [""],
    }));
  };

  const addArtistField = () => {
    if (formData.musicalArtists.at(-1).trim() === "") return;
    setFormData((prev) => ({
      ...prev,
      musicalArtists: [...prev.musicalArtists, ""],
    }));
    setSpotifyResults((prev) => [...prev, { results: [], loading: false }]);
  };

  const removeArtist = (index) => {
    const updatedArtists = formData.musicalArtists.filter(
      (_, i) => i !== index,
    );
    const updatedSpotify = spotifyResults.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      musicalArtists: updatedArtists.length ? updatedArtists : [""],
    }));
    setSpotifyResults(
      updatedSpotify.length
        ? updatedSpotify
        : [{ results: [], loading: false }],
    );
  };

  const addOrgField = () => {
    if (formData.organizations.at(-1).trim() === "") return;
    setFormData((prev) => ({
      ...prev,
      organizations: [...prev.organizations, ""],
    }));
    setFilteredOrgs((prev) => [...prev, []]);
    setFocusedOrgOption((prev) => [...prev, -1]);
  };

  const removeOrg = (index) => {
    const updatedOrgs = formData.organizations.filter((_, i) => i !== index);
    const updatedFilters = filteredOrgs.filter((_, i) => i !== index);
    const updatedFocus = focusedOrgOption.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      organizations: updatedOrgs.length > 0 ? updatedOrgs : [""],
    }));
    setFilteredOrgs(updatedFilters.length > 0 ? updatedFilters : [[]]);
    setFocusedOrgOption(updatedFocus.length > 0 ? updatedFocus : [-1]);
  };

  // Fuse instance now created dynamically in useEffect

  // Load trait vectors, handle hobby suggestions, etc.
  // You can extract your existing handlers like:
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "major") {
      setMajorSelected(false);
      const matches = majorsList.filter((m) =>
        m.toLowerCase().includes(value.toLowerCase()),
      );
      setFilteredMajors(matches);
      setFocusedMajorIndex(-1);
    }

    if (errors.length > 0) {
      setErrors((prevErrors) => prevErrors.filter((err) => err !== name));
    }
  };

  const handleBack = () => {
    setErrors([]);
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(step)) return;

    setIsSubmitting(true);

    try {
      console.log("🚀 Starting vectorization and submission process...");

      // Step 1: Vectorize unknown hobbies
      const unknownHobbies = formData.hobbies
        .map((h) => h.trim())
        .filter((h) => {
          if (!h) return false;
          
          // ✅ Convert to Title Case for cache lookup (matches backend)
          const titleCaseHobby = h.replace(/\b\w/g, (c) => c.toUpperCase());
          
          return !hobbyVectors[titleCaseHobby] && 
            (!hobbyFuse || !hobbyFuse.search(h).some((r) => r.item.toLowerCase() === h.toLowerCase()));
        });

      if (unknownHobbies.length > 0) {
        console.log("🔄 Vectorizing unknown hobbies:", unknownHobbies);
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/hobbies/normalize`,
          {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hobbies: unknownHobbies }),
          },
        );
        
        const data = await res.json();
        console.log("✅ Hobbies vectorized:", data);

        // Reload vectors and hobbies list after backend updates
        const [vectorsResponse, hobbiesResponse] = await Promise.all([
          fetch(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/hobbies/vectors`),
          fetch(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/hobbies`)
        ]);
        
        const vectors = await vectorsResponse.json();
        const updatedHobbies = await hobbiesResponse.json();
        
        setHobbyVectors(vectors);
        setHobbiesList(updatedHobbies);
        console.log("✅ Reloaded hobbies list after adding new ones:", updatedHobbies.length);
        
        // Also refresh traits list to ensure consistency
        try {
          const traitsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/traits`);
          const updatedTraits = await traitsResponse.json();
          console.log("✅ Reloaded traits list after hobby submission:", updatedTraits.length);
        } catch (err) {
          console.log("⚠️ Could not refresh traits list:", err);
        }
      }

      // Step 2: Vectorize unknown personality traits
      const unknownTraits = formData.personalityWords
        .map((t) => toTitleCase(t.raw?.trim()))
        .filter((term) => {
          if (!term) return false;
          const isExact = traitFuse
            ?.search(term)
            .some((r) => r.item.toLowerCase() === term.toLowerCase());
          return !traitVectors[term] && !isExact;
        });

      if (unknownTraits.length > 0) {
        console.log("🔄 Vectorizing unknown traits:", unknownTraits);
        for (const term of unknownTraits) {
          const res = await axios.post(
            `${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/traits/add`,
            { trait: term },
          );

          if (res.data.embedding) {
            console.log(`✅ "${term}" vectorized successfully.`);
            setTraitVectors((prev) => ({
              ...prev,
              [term]: res.data.embedding,
            }));

            if (traitFuse) {
              traitFuse.add(term);
            }
          }
        }
      }

      // Step 3: Prepare clean data
      const cleanData = {
        ...formData,
        hobbies: formData.hobbies.map((h) => h.trim()).filter(Boolean),
        organizations: formData.organizations
          .map((org) => org.trim())
          .filter(Boolean),
        musicalArtists: formData.musicalArtists.map((a, index) => ({
          displayName: a.trim(),
          genres: spotifyResults[index]?.genres || [],
        })),
      };

      // Step 4: Submit to backend (which will handle expectations/ideal match vectorization)
      console.log("🔄 Submitting form data...");
      const response = await fetch((import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com") + '/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cleanData,
          role,
          meetingFrequency: formData.meetingFrequency,
          personalityWords: formData.personalityWords,
          expectations: formData.expectations,
          idealMatchDescription: formData.idealMatchDescription,
          menteeInMajor: formData.menteeInMajor,
          openToMultiple: formData.openToMultiple,
          preferredStudentId: formData.preferredStudentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit form");
      }

      console.log("✅ Submission successful!");

      // Log submission data
      console.log("==== Final Submission Data ====");
      console.log("First Name:", formData.firstName);
      console.log("Last Name:", formData.lastName);
      console.log("PSU Email:", formData.email);
      console.log("Personal Email:", formData.personalEmail);
      console.log("Student ID:", formData.studentId);
      console.log("Major:", formData.major);
      console.log("Gender:", formData.gender);
      console.log("Academic Year:", formData.year);
      console.log("Mentee Gender Preference:", formData.pairGenderPreference);

      console.log("\nHobbies:", cleanData.hobbies);
      console.log("\nMusical Artists:");
      cleanData.musicalArtists.forEach((artist, i) => {
        console.log(`  ${i + 1}: ${artist.displayName} | Genres: ${artist.genres.join(", ")}`);
      });

      console.log("\nMeeting Frequency:", formData.meetingFrequency);
      console.log("Open to Multiple Mentees:", formData.openToMultiple);
      console.log("Prefers Mentees in Major:", formData.menteeInMajor);

      console.log("\nOrganizations:", cleanData.organizations);
      console.log("\nMentorship Expectations:", formData.expectations);

      console.log("\nPersonality Words:");
      formData.personalityWords.forEach((t, i) => {
        console.log(`  ${i + 1}: ${t.raw}`);
      });

      console.log("\nIdeal Mentee/Mentor Description:", formData.idealMatchDescription);
      console.log("==== End of Submission Data ====");

      // Success! Show confetti and proceed to success page
      setShowConfetti(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setStep(9);
      }, 1000); // Small delay to show the success before transitioning

    } catch (err) {
      console.error("🚨 Submission error:", err);
      alert(`Submission failed: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  const handleHobbyChange = (index, value) => {
    const hobbies = [...formData.hobbies];
    hobbies[index] = value;
    setFormData((prev) => ({ ...prev, hobbies }));

    // Reset confirmed status when user starts typing
    setConfirmedHobbies(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });

    if (value.trim()) {
      const results = hobbyFuse ? hobbyFuse.search(value.trim()).map((r) => r.item) : [];
      setHobbySuggestions(results);
      setActiveHobbyIndex(index);
    } else {
      setHobbySuggestions([]);
      setActiveHobbyIndex(null);
    }

    if (errors.includes("hobbies") && hobbies.some((h) => h.trim())) {
      setErrors((prev) => prev.filter((e) => e !== "hobbies"));
    }

    setFocusedHobbyOption(-1);
  };

  const handleArtistChange = (index, value) => {
    const updated = [...formData.musicalArtists];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, musicalArtists: updated }));

    const isClearing = !value || value.trim() === "";

    setSpotifyResults((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        results: [],
        loading: false,
        selectedItem: isClearing ? null : prev[index]?.selectedItem || null,
        previewPlaying: false,
      };
      return copy;
    });

    if (errors.includes("musicalArtists") && updated.some((a) => a.trim())) {
      setErrors((prev) => prev.filter((e) => e !== "musicalArtists"));
    }

    clearTimeout(searchTimeouts.current[index]);

    if (value.trim().length >= 3) {
      setSpotifyResults((prev) => {
        const copy = [...prev];
        copy[index] = {
          results: [],
          loading: true,
          selectedItem: prev[index]?.selectedItem || null,
          previewPlaying: false,
        };
        return copy;
      });

      searchTimeouts.current[index] = setTimeout(() => {
        fetch(
          `${import.meta.env.VITE_BACKEND_URL || "https://nsbe-mentor-project.onrender.com"}/api/spotify/search?query=${encodeURIComponent(value)}`,
        )
          .then((res) => res.json())
          .then((data) => {
            console.log("Spotify results:", data);

            setSpotifyResults((prev) => {
              const copy = [...prev];
              copy[index] = { ...copy[index], results: data, loading: false };
              return copy;
            });
          })
          .catch((err) => {
            console.error(err);
            setSpotifyResults((prev) => {
              const copy = [...prev];
              copy[index] = { ...copy[index], results: [], loading: false };
              return copy;
            });
          });
      }, 400);
    }
  };

  const handleOrgInputChange = (index, value) => {
    const updated = [...formData.organizations];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, organizations: updated }));

    setClubsLoading(true); // Show spinner immediately

    setTimeout(() => {
      const matches = clubList
        .filter((club) => {
          const input = value.toLowerCase();
          const nameMatch = club.name.toLowerCase().includes(input);
          const acronymMatch = club.acronyms?.some((acronym) =>
            acronym.toLowerCase().includes(input),
          );
          return nameMatch || acronymMatch;
        })
        .map((club) => club.name);

      const updatedFiltered = [...filteredOrgs];
      updatedFiltered[index] = matches;
      setFilteredOrgs(updatedFiltered);
      setClubsLoading(false); // Hide spinner
    }, 100); // Delay can be adjusted; 100ms feels responsive
  };

  const toTitleCase = (str) =>
    str.replace(/\b\w/g, (char) => char.toUpperCase());

  const handleSelectOrg = (index, value) => {
    const updated = [...formData.organizations];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, organizations: updated }));

    const updatedFiltered = [...filteredOrgs];
    updatedFiltered[index] = [];
    setFilteredOrgs(updatedFiltered);
  };

  const handleSelectSuggestion = (index, suggestion) => {
    const hobbies = [...formData.hobbies];
    hobbies[index] = suggestion;
    setFormData((prev) => ({ ...prev, hobbies }));
    setHobbySuggestions([]);
    setActiveHobbyIndex(null);
    // Mark this hobby as confirmed
    setConfirmedHobbies(prev => new Set([...prev, index]));
  };

  const handleSelectMajor = (selectedMajor) => {
    setFormData((prev) => ({ ...prev, major: selectedMajor }));
    setMajorSelected(true);
    setFilteredMajors([]);
    setFocusedMajorIndex(-1);
  };

  const handleNext = async () => {
    if (!validateStep(step)) return;

    if (step < 8) {
      setErrors([]);
      setStep((prev) => prev + 1);
    }
  };

  const handleTraitChange = (index, value) => {
    const updated = [...formData.personalityWords];
    updated[index].raw = value;
    setFormData({ ...formData, personalityWords: updated });

    if (value.trim().length >= 2 && traitFuse) {  
      const results = traitFuse.search(value).map((r) => r.item);
      // Only update if results are different to prevent duplicate renders
      if (JSON.stringify(results) !== JSON.stringify(traitSuggestions) || activeTraitIndex !== index) {
        setTraitSuggestions(results);
        setActiveTraitIndex(index);
      }
    } else {
      setTraitSuggestions([]);
      setActiveTraitIndex(null);
    }
  };

  const handleSelectTraitSuggestion = (index, suggestion) => {
    const updated = [...formData.personalityWords];
    updated[index].raw = toTitleCase(suggestion);
    setFormData((prev) => ({ ...prev, personalityWords: updated }));

    setTraitSuggestions([]);
    setActiveTraitIndex(null);
  };

  const handleTraitBlur = (index) => {
    // Do nothing on blur - we only vectorize when user explicitly presses Keep or on Next
    setTraitSuggestions([]);
    setActiveTraitIndex(null);
  };

  // NSBE Logo Loading Component
  const NSBELoadingOverlay = () => (
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
        <p className="mt-4 text-gray-700 font-medium">Processing your application...</p>
        <p className="text-sm text-gray-500">"Patience young one" - Mus 2025</p>
      </div>
    </div>
  );

  return (
    <>
      {isSubmitting && <NSBELoadingOverlay />}
      <form
        onSubmit={handleSubmit}
        className={`space-y-4 mx-auto ${step < 9 ? "bg-white p-4 sm:p-6 rounded shadow-lg max-w-lg" : ""}`}
      >
        {" "}
        {errors.length > 0 && (
        <div className="fixed sm:absolute right-2 sm:right-6 top-2 sm:top-6 bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-md w-72 sm:w-80 z-50">
          <strong className="font-bold">Please complete:</strong>
          <ul className="mt-2 list-disc list-inside text-sm">
            {errors.map((field) => (
              <li key={field}>
                {errorMessages[field] || "Please complete this field."}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Header */}
      {step <= 8 && (
        <h2 className="text-xl sm:text-2xl font-bold text-center text-gray-800 mb-2">
          {role === "mentor"
            ? `Mentor Sign-Up (Step ${step} of 8)`
            : `Mentee Sign-Up (Step ${step} of 8)`}
        </h2>
      )}
      {/* Progress Bar */}
      {step < 9 && (
        <div className="w-full max-w-md mx-auto mb-4 sm:mb-6 px-2 sm:px-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500">Progress</span>
            <span className="text-sm text-gray-600 font-medium">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded-full">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="First Name"
              className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("firstName") ? "border-red-500" : ""}`}
            />
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Last Name"
              className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("lastName") ? "border-red-500" : ""}`}
            />
          </div>

          <input
            name="email"
            value={formData.email}
            onChange={handleChange}
            type="email"
            placeholder="PSU Email"
            className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("email") ? "border-red-500" : ""}`}
          />

          <input
            name="personalEmail"
            value={formData.personalEmail}
            onChange={handleChange}
            type="email"
            placeholder="Personal Email"
            className="w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base"
          />

          <input
            name="studentId"
            value={formData.studentId}
            onChange={handleChange}
            type="number"
            placeholder="9-Digit Student ID"
            className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("studentId") ? "border-red-500" : ""}`}
          />

          <div className="relative">
            <input
              type="text"
              name="major"
              value={formData.major}
              onChange={handleChange}
              placeholder="Major"
              autoComplete="off"
              className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("major") ? "border-red-500" : ""}`}
              onKeyDown={(e) => {
                const list = filteredMajors || [];
                let newFocus = focusedMajorIndex;

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  newFocus = (newFocus + 1) % list.length;
                  setFocusedMajorIndex(newFocus);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  newFocus = (newFocus - 1 + list.length) % list.length;
                  setFocusedMajorIndex(newFocus);
                } else if (e.key === "Enter" && newFocus >= 0) {
                  e.preventDefault();
                  handleSelectMajor(list[newFocus]);
                  setFocusedMajorIndex(-1);
                }
              }}
            />

            {filteredMajors.length > 0 && (
              <ul className="absolute z-10 bg-white border rounded w-full mt-1 max-h-40 overflow-y-auto shadow">
                {filteredMajors.map((m, i) => (
                  <li
                    key={i}
                    onClick={() => handleSelectMajor(m)}
                    className={`px-4 py-2 cursor-pointer text-sm ${focusedMajorIndex === i
                        ? "bg-blue-100"
                        : "hover:bg-gray-200"
                      }`}
                  >
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-4">
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("gender") ? "border-red-500" : ""}`}
            >
              <option value="">Select Gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>

            <select
              name="year"
              value={formData.year}
              onChange={handleChange}
              className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("year") ? "border-red-500" : ""}`}
            >
              <option value="">Select Year</option>
              <option>1st</option>
              <option>2nd</option>
              <option>3rd</option>
              <option>4th+</option>
            </select>
          </div>

          <select
            name="pairGenderPreference"
            value={formData.pairGenderPreference}
            onChange={handleChange}
            className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("pairGenderPreference") ? "border-red-500" : ""}`}
          >
            <option value="">
              {role === "mentor"
                ? `Preferred Gender of Mentee`
                : `Preferred Gender of Mentor`}
            </option>
            <option>Male</option>
            <option>Female</option>
            <option>No Preference</option>
          </select>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">

          
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800">Hobbies</h3>
            <span className={`text-xs ${isRefreshing ? 'text-blue-500' : 'text-gray-500'}`}>
              {isRefreshing ? 'Updating...' : `Updated: ${new Date(lastHobbiesRefresh).toLocaleTimeString()}`}
            </span>
          </div>
          <p className="font-medium text-base text-violet-500 text-center">
            What do you do when classes aren't beating you down?
          </p>

          <div className="space-y-2">
            {formData.hobbies.map((hobbyObj, index) => (
              <div key={index} className="relative">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hobbyObj || ""}
                    onChange={(e) => handleHobbyChange(index, e.target.value)}
                    placeholder="Enter Hobbies"
                    className={`w-full border px-4 py-2 rounded ${
                      errors.includes("hobbies") &&
                      (!hobbyObj || hobbyObj.trim() === "")
                        ? "border-red-500"
                        : ""
                    }`}
                    onFocus={() => {
                      const value = hobbyObj.trim() || "";
                      if (value) {
                        const results = hobbyFuse ? hobbyFuse.search(value).map((r) => r.item) : [];
                        setHobbySuggestions(results);
                        setActiveHobbyIndex(index);
                        setFocusedHobbyOption(-1);
                      }
                      
                      // Smart refresh when focusing on hobby input (if it's been a while)
                      const timeSinceLastRefresh = Date.now() - lastHobbiesRefresh;
                      const oneMinute = 60 * 1000; // 1 minute in milliseconds
                      if (timeSinceLastRefresh >= oneMinute) {
                        console.log("🎯 Hobby input focused - refreshing hobbies list...");
                        refreshHobbiesList();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        activeHobbyIndex !== index ||
                        hobbySuggestions.length === 0
                      )
                        return;

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setFocusedHobbyOption(
                          (prev) => (prev + 1) % hobbySuggestions.length,
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setFocusedHobbyOption(
                          (prev) =>
                            (prev - 1 + hobbySuggestions.length) %
                            hobbySuggestions.length,
                        );
                      } else if (e.key === "Enter" && focusedHobbyOption >= 0) {
                        e.preventDefault();
                        handleSelectSuggestion(
                          index,
                          hobbySuggestions[focusedHobbyOption],
                        );
                        setFocusedHobbyOption(-1);
                      }
                    }}
                  />

                  {formData.hobbies.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHobby(index)}
                      className="text-red-500 text-xl px-2 rounded hover:bg-red-100"
                      title="Remove hobby"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Autocomplete Suggestions */}
                {activeHobbyIndex === index &&
                  (hobbyObj?.trim() || "") !== "" && (
                    <ul className="absolute z-10 bg-white border mt-1 w-full rounded shadow">
                      {hobbySuggestions.map((suggestion, sIndex) => (
                        <li
                          key={sIndex}
                          onClick={() =>
                            handleSelectSuggestion(index, suggestion)
                          }
                          className={`px-4 py-2 cursor-pointer ${focusedHobbyOption === sIndex
                              ? "bg-blue-100"
                              : "hover:bg-gray-100"
                            }`}
                        >
                          {suggestion}
                        </li>
                      ))}

                      {!hobbySuggestions.some(
                        (s) =>
                          s.toLowerCase() ===
                          (hobbyObj || "").trim().toLowerCase(),
                      ) && (
                          <li
                            onClick={() => {
                              // Mark this custom hobby as confirmed
                              setConfirmedHobbies(prev => new Set([...prev, index]));
                              setHobbySuggestions([]);
                              setActiveHobbyIndex(null);
                            }}
                            className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer italic"
                          >
                            Keep "{hobbyObj || ""}"
                          </li>
                        )}
                    </ul>
                  )}
              </div>
            ))}

            <button
              type="button"
              onClick={addHobbyField}
              className="text-green-600 border border-green-600 rounded-full px-3 py-1 text-lg leading-none hover:bg-green-50"
              title="Add another hobby"
            >
              +
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800">
            {formData.firstName.charAt(0).toUpperCase() +
              formData.firstName.slice(1)}
            's Tunes 🎵
          </h3>
          <p className="font-medium text-base text-violet-500 text-center">
            You're on aux. Who/What are you playing?
          </p>

          <div className="space-y-2">
            {formData.musicalArtists.map((artist, index) => {
              const selected = spotifyResults[index]?.selectedItem;
              const showPreview = selected?.preview_url;
              const isLoading = spotifyResults[index]?.loading;

              return (
                <div key={index} className="flex items-center w-full relative">
                  {/* Play button */}
                  <div className="flex justify-center items-center w-10 h-10 mr-2 relative">
                    {showPreview && (
                      <button
                        type="button"
                        onClick={() => togglePreview(index)}
                        aria-label={
                          spotifyResults[index]?.previewPlaying
                            ? "Pause"
                            : "Play"
                        }
                        className="flex justify-center items-center w-8 h-8 bg-black rounded-full hover:bg-gray-800 shadow-sm"
                      >
                        {spotifyResults[index]?.previewPlaying ? (
                          <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4 fill-current text-white"
                          >
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4 fill-current text-white"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Input area */}
                  <div
                    className={`flex-grow relative border rounded flex items-center px-2 py-1 min-h-[48px] ${
                      errors.includes("musicalArtists") && (!artist || artist.trim() === "")
                        ? "border-red-500"
                        : artist && artist.trim() !== "" && !selected
                        ? "border-amber-500 bg-amber-50"
                        : selected
                        ? "border-green-500 bg-green-50"
                        : ""
                    }`}
                  >
                    {/* Album Art */}
                    {selected?.image && (
                      <img
                        src={selected.image}
                        alt="cover"
                        className="w-10 h-10 object-cover rounded mr-3"
                      />
                    )}

                    {/* Text or Input */}
                    {selected ? (
                      <div className="flex flex-col">
                        <span className="font-bold">{selected.name}</span>
                        <span className="text-sm text-gray-600">
                          {selected.artists?.join(", ")}
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={artist}
                        onChange={(e) =>
                          handleArtistChange(index, e.target.value)
                        }
                        placeholder="Choose wisely..."
                        className="flex-grow outline-none"
                      />
                    )}

                    {/* Spinner */}
                    {isLoading && (
                      <div className="absolute right-2">
                        <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  {formData.musicalArtists.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArtist(index)}
                      className="text-red-500 text-xl px-2 hover:bg-red-100 ml-2"
                      title="Remove artist"
                    >
                      ×
                    </button>
                  )}

                  {/* Suggestions Dropdown */}
                  {spotifyResults[index]?.results.length > 0 && (
                    <ul className="absolute z-20 bg-white border rounded w-full mt-1 max-h-60 overflow-y-auto shadow-lg left-0 top-full">
                      {spotifyResults[index].results.map((r, i) => (
                        <li
                          key={i}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSpotifyResult(index, r);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        >
                          {r.image && (
                            <img
                              src={r.image}
                              alt="cover"
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-base">
                              {r.name}
                              {r.type === "track" && " 🎵"}
                              {r.type === "album" && " 💿"}
                              {r.type === "artist" && " 🎤"}
                            </span>
                            {r.artists && (
                              <span className="text-sm text-gray-600">
                                {r.artists.join(", ")}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {/* Warning message for unselected text */}
                  {artist && artist.trim() !== "" && !selected && (
                    <div className="absolute left-12 top-full mt-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 z-10">
                      ⚠️ Please select from Spotify results above
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add artist button */}
            <button
              type="button"
              onClick={addArtistField}
              className="text-green-600 border border-green-600 rounded-full px-3 py-1 leading-none hover:bg-green-50"
              title="Add another artist"
            >
              +
            </button>
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-800 text-center">
            Mentoring Preferences
          </h3>
          <p className="font-medium text-base text-violet-500 text-center">
            Let us know your preferences. AND BE HONEST!
          </p>

          <div className="space-y-2">
            <label className="font-medium text-gray-700">
              {role === "mentor"
                ? `How often would you want to meet your mentee?`
                : `How often would you want to meet your mentor?`}
            </label>
            <select
              name="meetingFrequency"
              value={formData.meetingFrequency}
              onChange={handleChange}
              className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("meetingFrequency") ? "border-red-500" : ""}`}
            >
              <option value="">Preferred Meeting Frequency</option>
              <option>Weekly</option>
              <option>Bi-Weekly</option>
              <option>Monthly</option>
            </select>
          </div>

          {role === "mentor" && (
            <div className="space-y-2">
              <label className="font-medium text-gray-700">
                Would you be open to mentoring two mentees?
              </label>
              <select
                name="openToMultiple"
                value={formData.openToMultiple}
                onChange={handleChange}
                className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("openToMultiple") ? "border-red-500" : ""}`}
              >
                <option value="">Select One</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="font-medium text-gray-700">
              {role === "mentor"
                ? `Do you prefer mentees in your major?`
                : `Do you prefer mentors in your major?`}
            </label>
            <select
              name="menteeInMajor"
              value={formData.menteeInMajor}
              onChange={handleChange}
              className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base ${errors.includes("menteeInMajor") ? "border-red-500" : ""}`}
            >
              <option value="">Select One</option>
              <option>Yes</option>
              <option>No Preference</option>
            </select>
          </div>
        </div>
      )}
      {step === 5 && (
        <div className="space-y-4">
          <label className="text-xl font-bold text-gray-800">
            Org Involvement
          </label>
          <div className="space-y-2">
            {formData.organizations.map((org, index) => (
              <div key={index} className="flex items-start gap-2 relative">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={org}
                    onChange={(e) =>
                      handleOrgInputChange(index, e.target.value)
                    }
                    placeholder="NSBE, Men's Club Soccer, etc."
                    className={`
                      w-full border px-4 py-2 rounded pr-10 ${errors.includes("organizations") &&
                        (!org || org.trim() === "")
                        ? "border-red-500"
                        : ""
                      }`}
                    autoComplete="off"
                    onBlur={() => {
                      setTimeout(() => {
                        const updated = [...filteredOrgs];
                        updated[index] = [];
                        setFilteredOrgs(updated);
                      }, 200);
                    }}
                    onKeyDown={(e) => {
                      const list = filteredOrgs[index] || [];
                      let newFocus = focusedOrgOption[index] ?? -1;

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        newFocus = (newFocus + 1) % list.length;
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        newFocus = (newFocus - 1 + list.length) % list.length;
                      } else if (e.key === "Enter" && newFocus >= 0) {
                        e.preventDefault();
                        handleSelectOrg(index, list[newFocus]);
                        newFocus = -1;
                      }

                      const newFocusList = [...focusedOrgOption];
                      newFocusList[index] = newFocus;
                      setFocusedOrgOption(newFocusList);
                    }}
                  />

                  {/* Spinner */}
                  {clubsLoading && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {/* Dropdown */}
                  {Array.isArray(filteredOrgs[index]) &&
                    filteredOrgs[index].length > 0 && (
                      <ul className="absolute top-full left-0 z-10 bg-white border rounded w-full mt-1 max-h-40 overflow-y-auto shadow">
                        {filteredOrgs[index].map((c, i) => (
                          <li
                            key={i}
                            onClick={() => handleSelectOrg(index, c)}
                            className={
                              `px-4 py-2 cursor-pointer text-sm ` +
                              (focusedOrgOption[index] === i
                                ? "bg-blue-100"
                                : "hover:bg-gray-200")
                            }
                          >
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                </div>

                {/* Remove button */}
                {formData.organizations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOrg(index)}
                    className="text-red-500 text-xl px-2 rounded hover:bg-red-100"
                    title="Remove organization"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addOrgField}
              className="text-green-600 border border-green-600 rounded-full px-3 py-1 text-lg leading-none hover:bg-green-50"
              title="Add another organization"
            >
              +
            </button>
          </div>
        </div>
      )}
      {step === 6 && (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              name="expectations"
              value={formData.expectations}
              onChange={handleChange}
              placeholder={
                role === "mentor"
                  ? "What do you expect from your mentee?"
                  : "What do you expect from your mentor?"
              }
              className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded pr-16 sm:pr-20 text-sm sm:text-base ${errors.includes("expectations") ? "border-red-500" : ""}`}
              rows="3"
              maxLength="250"
            />
            <div className={`absolute bottom-2 right-2 text-sm pointer-events-none ${
              formData.expectations.length > 225 ? 'text-red-500' : 
              formData.expectations.length > 200 ? 'text-yellow-500' : 
              'text-gray-500'
            }`}>
              {formData.expectations.length}/250
            </div>
          </div>
        </div>
      )}
      
      {step === 7 && (
        <div className="space-y-4">

          
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800">
              Last minute things...
            </h3>
            <span className={`text-xs ${isRefreshingTraits ? 'text-blue-500' : 'text-gray-500'}`}>
              {isRefreshingTraits ? 'Updating...' : `Updated: ${new Date(lastTraitsRefresh).toLocaleTimeString()}`}
            </span>
          </div>
          <p className="font-medium text-base text-violet-500 text-center">
            Who are you in three words? (e.g., "Curious, Driven, Friendly")
          </p>

          <div className="space-y-2">
            {formData.personalityWords.map((traitObj, index) => (
              <div key={index} className="relative">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={traitObj?.raw || ""}
                    onChange={(e) => handleTraitChange(index, e.target.value)}
                    placeholder="Enter Trait"
                    className={`w-full border px-4 py-2 rounded ${errors.includes("personalityWords") &&
                        (traitObj?.raw || "").trim() === ""
                        ? "border-red-500"
                        : ""
                      }`}
                    onFocus={() => {
                      const value = traitObj?.raw?.trim() || "";
                      if (value && value.length >= 2 && traitFuse?.search) {
                        const results = traitFuse.search(value).map((r) => r.item);
                        // Only update if results are different or field changed to prevent duplicates
                        if (JSON.stringify(results) !== JSON.stringify(traitSuggestions) || activeTraitIndex !== index) {
                          setTraitSuggestions(results);
                          setActiveTraitIndex(index);
                          setFocusedTraitOption(-1);
                        }
                      }
                      
                      // Smart refresh when focusing on trait input (if it's been a while)
                      const timeSinceLastRefresh = Date.now() - lastTraitsRefresh;
                      const oneMinute = 60 * 1000; // 1 minute in milliseconds
                      if (timeSinceLastRefresh >= oneMinute) {
                        console.log("🎯 Trait input focused - refreshing traits list...");
                        refreshTraitsList();
                      }
                    }}
                    onBlur={() => {
                      if (traitClickInProgress) {
                        setTraitClickInProgress(false);
                        return; // Don't close suggestions if click originated inside dropdown
                      }
                      setTraitSuggestions([]);
                      setActiveTraitIndex(null);
                    }}
                    onKeyDown={(e) => {
                      if (
                        activeTraitIndex !== index ||
                        traitSuggestions.length === 0
                      )
                        return;

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setFocusedTraitOption(
                          (prev) => (prev + 1) % traitSuggestions.length,
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setFocusedTraitOption(
                          (prev) =>
                            (prev - 1 + traitSuggestions.length) %
                            traitSuggestions.length,
                        );
                      } else if (e.key === "Enter" && focusedTraitOption >= 0) {
                        e.preventDefault();
                        handleSelectTraitSuggestion(
                          index,
                          traitSuggestions[focusedTraitOption],
                        );
                        setFocusedTraitOption(-1);
                      }
                    }}
                  />

                  {formData.personalityWords.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTrait(index)}
                      className="text-red-500 text-xl px-2 rounded hover:bg-red-100"
                      title="Remove trait"
                    >
                      ×
                    </button>
                  )}
                </div>

                {activeTraitIndex === index &&
                  (traitObj?.raw?.trim() || "") !== "" && (
                    <ul className="absolute z-10 bg-white border mt-1 w-full rounded shadow">
                      {traitSuggestions.map((suggestion, sIndex) => (
                        <li
                          key={`${suggestion}-${sIndex}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setTraitClickInProgress(true);
                            handleSelectTraitSuggestion(
                              index,
                              toTitleCase(suggestion),
                            );
                            setTraitSuggestions([]);
                            setActiveTraitIndex(null);
                          }}
                          className={`px-4 py-2 cursor-pointer ${focusedTraitOption === sIndex
                              ? "bg-blue-100"
                              : "hover:bg-gray-100"
                            }`}
                        >
                          {toTitleCase(suggestion)}
                        </li>
                      ))}

                      {!traitSuggestions.some(
                        (s) =>
                          s.toLowerCase() ===
                          (traitObj?.raw || "").trim().toLowerCase(),
                      ) && (
                          <li
                            key={`keep-${index}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setTraitClickInProgress(true);
                              handleTraitChange(
                                index,
                                toTitleCase(traitObj?.raw || ""),
                              );
                              setTraitSuggestions([]);
                              setActiveTraitIndex(null);
                            }}
                            className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer italic"
                          >
                            Keep "{toTitleCase(traitObj?.raw || "")}"
                          </li>
                        )}
                    </ul>
                  )}
              </div>
            ))}

            {formData.personalityWords.length < 3 && (
              <button
                type="button"
                onClick={addTraitField}
                className="text-green-600 border border-green-600 rounded-full px-3 py-1 leading-none hover:bg-green-50"
                title="Add another trait"
              >
                +
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="font-medium text-base text-violet-500 text-center">
              {role === "mentor"
                ? `Describe your ideal mentee in a few words.`
                : `Describe your ideal mentor in a few words.`}
            </p>
            <div className="relative">
              <textarea
                name="idealMatchDescription"
                value={formData.idealMatchDescription}
                onChange={handleChange}
                placeholder="My twin 🤪"
                className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded mt-4 pr-16 sm:pr-20 text-sm sm:text-base ${errors.includes("idealMatchDescription") ? "border-red-500" : ""
                  }`}
                rows="3"
                maxLength="250"
              />
              <div className={`absolute bottom-2 right-2 text-sm pointer-events-none ${
                formData.idealMatchDescription.length > 225 ? 'text-red-500' : 
                formData.idealMatchDescription.length > 200 ? 'text-yellow-500' : 
                'text-gray-500'
              }`}>
                {formData.idealMatchDescription.length}/250
              </div>
            </div>
          </div>
        </div>
      )}
      
      {step === 8 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800">One last thing...</h3>
          <p className="font-medium text-base text-violet-500 text-center">
            {role === "mentor"
              ? "Do you have a specific mentee in mind? (Optional)"
              : "Do you have a specific mentor in mind? (Optional)"}
          </p>
          
          <div className="space-y-4">
            <div className="max-w-md mx-auto">
              <input
                type="text"
                name="preferredStudentId"
                value={formData.preferredStudentId}
                onChange={handleChange}
                placeholder="Enter their 9 digit PSU ID"
                className={`w-full border px-3 sm:px-4 py-2 sm:py-3 rounded text-center text-sm sm:text-base ${
                  errors.includes("preferredStudentId") ? "border-red-500" : ""
                }`}
                maxLength="9"
              />
              {errors.includes("preferredStudentId") && (
                <p className="text-red-500 text-sm text-center mt-2">
                  Please enter exactly 9 digits
                </p>
              )}
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-gray-500 text-sm">
                If they haven't signed up yet, we'll do our best to match you when they do!
              </p>
              <p className="text-gray-600 text-sm">
                Leave blank if you don't have anyone specific in mind.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {step === 9 && (
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center space-y-6 px-4 z-50">
          {showConfetti && (
            <Confetti
              width={window.innerWidth}
              height={window.innerHeight}
              numberOfPieces={500}
              gravity={0.4}
              recycle={false}
            />
          )}

          <h2
            className={`text-3xl font-bold text-gray-800 transition-opacity duration-1000 ${showTitle ? "opacity-100" : "opacity-0"}`}
          >
            Welcome to the Big Brother Big Sister Program.
          </h2>

          <p
            className={`text-gray-700 max-w-md text-xlg transition-opacity duration-1000 ${showMessage ? "opacity-100" : "opacity-0"}`}
          >
            We're excited to have you. Be on the lookout for an email from
            [membership chair email] with further information.
          </p>

          <Link
            to="/"
            className={`text-blue-600 hover:underline text-base transition-opacity duration-1000 ${showMessage ? "opacity-100" : "opacity-0"}`}
          >
            Return to home page
          </Link>
        </div>
      )}
      <div className="flex justify-between pt-3 sm:pt-4">
        {step > 1 && step < 9 && (
          <button
            type="button"
            onClick={handleBack}
            className="bg-gray-300 px-3 sm:px-4 py-2 sm:py-3 rounded hover:bg-gray-400 text-sm sm:text-base"
          >
            Back
          </button>
        )}

        {step < 8 ? (
          <button
            ref={nextBtnRef}
            type="button"
            onClick={handleNext}
            className="bg-black text-white px-3 sm:px-4 py-2 sm:py-3 rounded hover:bg-gray-800 text-sm sm:text-base"
          >
            Next
          </button>
        ) : step === 8 ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-3 sm:px-4 py-2 sm:py-3 rounded text-white text-sm sm:text-base ${
              isSubmitting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isSubmitting ? 'Processing...' : 'Submit'}
          </button>
        ) : null}
      </div>
    </form>
    </>
  );
}