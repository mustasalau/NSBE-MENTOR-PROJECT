import { useState, useEffect, useRef } from "react";
import Fuse from "fuse.js";
import axios from "axios";
import majorsList from "@/data/majors.json";
import clubList from "@/data/clubs.json";
import hobbiesList from "@/data/hobbies.json";
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
  const [hobbiesLoading, setHobbiesLoading] = useState(false);
  const [traitSuggestions, setTraitSuggestions] = useState([]);
  const [activeTraitIndex, setActiveTraitIndex] = useState(null);
  const [focusedTraitOption, setFocusedTraitOption] = useState(-1);
  const [traitsLoading, setTraitsLoading] = useState(false);
  const [traitVectors, setTraitVectors] = useState({});
  const [traitFuse, setTraitFuse] = useState(null);
  const [traitClickInProgress, setTraitClickInProgress] = useState(false);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [hobbyVectors, setHobbyVectors] = useState({});
  const progressPercent = Math.round((step / 8) * 100);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const BASE_URL = import.meta.env.VITE_BACKEND_URL;

  const errorMessages = {
    email: "Email should end with @psu.edu",
    studentId: "Student ID must be exactly 9 digits.",
    hobbies: "Please fill out all hobby fields (no blanks).",
    musicalArtists: "Please fill out all music fields (no blanks).",
    organizations: "Please fill out all organization fields (no blanks).",
    major: "Please select a major from the list.",
    firstName: "First Name is required.",
    lastName: "Last Name is required.",
    gender: "Please select your gender.",
    year: "Please select your academic year.",
    pairGenderPreference: "Please select your preferred mentee gender.",
    meetingFrequency: "Please select your preferred meeting frequency.",
    openToMultiple: "Please indicate if you are open to mentoring two mentees.",
    expectations: "Please describe your mentorship style.",
    personalityWords: "Please describe yourself in 3 words.",
    idealMatchDescription: role === "mentor"
    ? "Please describe your ideal mentee."
    : "Please describe your ideal mentor.",
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
  };

  const validateStep = (stepToValidate) => {
    const fields = requiredFields[stepToValidate];
    if (!fields) return true; // No validation if undefined step

    const missing = fields.filter((field) => {
      const val = formData[field];

      if (Array.isArray(val)) {
        if (field === "hobbies") {
          return val.some((h) => (h || "").trim() === "") || val.length === 0;
        }

        if (field === "musicalArtists" || field === "organizations") {
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
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/api/traits/vectors`)
      .then((res) => {
        setTraitVectors(res.data);
        setTraitFuse(
          new Fuse(Object.keys(res.data), {
            includeScore: true,
            threshold: 0.3,
            minMatchCharLength: 3,
            shouldSort: true,
          }),
        );
      })
      .catch((err) => {
        console.error("Failed to load trait vectors:", err);
      });
  }, []);

  const selectSpotifyResult = (index, item) => {
    console.log(`Selected item:`, item);
    console.log(`Preview URL for "${item.name}":`, item.preview_url);

    const displayName = `${item.name}${item.artists ? ` by ${item.artists.join(", ")}` : ""}`;
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
    if (step === 8) {
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

  const fuse = new Fuse(hobbiesList, {
    threshold: 0.3,
    minMatchCharLength: 2,
    shouldSort: true,
  });

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

  try {
    const response = await fetch(import.meta.env.VITE_BACKEND_URL + '/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...cleanData,
        role, // assuming this is passed as a prop
        meetingFrequency: formData.meetingFrequency,
        personalityWords: formData.personalityWords,
        expectations: formData.expectations,
        idealMatchDescription: formData.idealMatchDescription,
        menteeInMajor: formData.menteeInMajor,
        openToMultiple: formData.openToMultiple,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to submit form");
    }

    console.log("✅ Submission successful!");
  } catch (err) {
    console.error("🚨 Submission error:", err);
  }

  // Logging (optional)
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
};

  const handleHobbyChange = (index, value) => {
    const hobbies = [...formData.hobbies];
    hobbies[index] = value;
    setFormData((prev) => ({ ...prev, hobbies }));

    if (value.trim()) {
      const results = fuse.search(value.trim()).map((r) => r.item);
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
          `${import.meta.env.VITE_BACKEND_URL}/api/spotify/search?query=${encodeURIComponent(value)}`,
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
  };

  const handleSelectMajor = (selectedMajor) => {
    setFormData((prev) => ({ ...prev, major: selectedMajor }));
    setMajorSelected(true);
    setFilteredMajors([]);
    setFocusedMajorIndex(-1);
  };

  const handleNext = async () => {
    if (!validateStep(step)) return;

    if (step === 2) {
      const unknowns = formData.hobbies
        .map((h, i) => ({ text: h.trim(), index: i }))
        .filter(
          (h) =>
            h.text &&
            !fuse
              .search(h.text)
              .some((r) => r.item.toLowerCase() === h.text.toLowerCase()) &&
            !hobbyVectors[h.text],
        );

      if (unknowns.length > 0) {
        try {
          setHobbiesLoading(true);

          const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/hobbies/normalize`,
            {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hobbies: unknowns.map((h) => h.text) }),
            },
          );

          const data = await res.json();
          console.log("New hobbies normalized:", data);

          // Reload vector list after backend updates
          const updated = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/hobbies/vectors`,
          );
          const vectors = await updated.json();

          setHobbyVectors(vectors);

          fuse.setCollection(Object.keys(vectors));
        } catch (err) {
          console.error("Error submitting unknown hobbies:", err);
        } finally {
          setHobbiesLoading(false);
        }
      }
    }

    if (step === 7) {
      const pending = formData.personalityWords
        .map((t, i) => ({ ...t, index: i }))
        .filter((t) => {
          const term = toTitleCase(t.raw?.trim());
          const isExact = traitFuse
            ?.search(term)
            .some((r) => r.item.toLowerCase() === term.toLowerCase());
          return term && !traitVectors[term] && !isExact;
        });

      if (pending.length > 0) {
        try {
          setTraitsLoading(true);
          for (const t of pending) {
            const term = toTitleCase(t.raw?.trim());
            const res = await axios.post(
              `${import.meta.env.VITE_BACKEND_URL}/api/traits/add`,
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
                console.log(`✅ "${term}" added to Fuse suggestions.`);
              }
            }
          }
        } catch (err) {
          console.error("Error adding traits:", err);
          setTraitsLoading(false);
          return;
        } finally {
          setTraitsLoading(false);
        }
      }
    }

    if (step < 8) {
      setErrors([]);
      setStep((prev) => prev + 1);
    }
  };

  const handleTraitChange = (index, value) => {
    const updated = [...formData.personalityWords];
    updated[index].raw = value;
    setFormData({ ...formData, personalityWords: updated });

    if (value.trim().length >= 3 && traitFuse) {  
    const results = traitFuse.search(value).map((r) => r.item);
    setTraitSuggestions(results);
    setActiveTraitIndex(index);
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

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4 mx-auto ${step < 8 ? "bg-white p-6 rounded shadow-lg max-w-lg" : ""}`}
    >
      {" "}
      {errors.length > 0 && (
        <div className="absolute right-6 top-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-md w-80">
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
      {step <= 7 && (
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          {role === "mentor"
            ? `Mentor Sign-Up (Step ${step} of 7)`
            : `Mentee Sign-Up (Step ${step} of 7)`}
        </h2>
      )}
      {/* Progress Bar */}
      {step < 8 && (
        <div className="w-full max-w-md mx-auto mb-6 px-4">
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
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="First Name"
              className={`w-full border px-4 py-2 rounded ${errors.includes("firstName") ? "border-red-500" : ""}`}
            />
            <input
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Last Name"
              className={`w-full border px-4 py-2 rounded ${errors.includes("lastName") ? "border-red-500" : ""}`}
            />
          </div>

          <input
            name="email"
            value={formData.email}
            onChange={handleChange}
            type="email"
            placeholder="PSU Email"
            className={`w-full border px-4 py-2 rounded ${errors.includes("email") ? "border-red-500" : ""}`}
          />

          <input
            name="personalEmail"
            value={formData.personalEmail}
            onChange={handleChange}
            type="email"
            placeholder="Personal Email"
            className="w-full border px-4 py-2 rounded"
          />

          <input
            name="studentId"
            value={formData.studentId}
            onChange={handleChange}
            type="number"
            placeholder="9-Digit Student ID"
            className={`w-full border px-4 py-2 rounded ${errors.includes("studentId") ? "border-red-500" : ""}`}
          />

          <div className="relative">
            <input
              name="major"
              value={formData.major}
              onChange={handleChange}
              placeholder="Major"
              autoComplete="off"
              className={`w-full border px-4 py-2 rounded ${errors.includes("major") ? "border-red-500" : ""}`}
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
              className={`w-full border px-4 py-2 rounded ${errors.includes("gender") ? "border-red-500" : ""}`}
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
              className={`w-full border px-4 py-2 rounded ${errors.includes("year") ? "border-red-500" : ""}`}
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
            className={`w-full border px-4 py-2 rounded ${errors.includes("pairGenderPreference") ? "border-red-500" : ""}`}
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
        <div className="space-y-4 relative">
          {hobbiesLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-50 flex justify-center items-center z-20">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          <h3 className="text-xl font-semibold text-gray-800">Hobbies</h3>
          <p className="font-medium text-base text-violet-500 text-center">
            What do you do when classes aren't beating you down?
          </p>

          <div className="space-y-2">
            {formData.hobbies.map((hobbyObj, index) => (
              <div key={index} className="relative">
                <div className="flex items-center gap-2">
                  <input
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
                        const results = fuse.search(value).map((r) => r.item);
                        setHobbySuggestions(results);
                        setActiveHobbyIndex(index);
                        setFocusedHobbyOption(-1);
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
                              handleHobbyChange(index, hobbyObj || "");
                              setHobbySuggestions([]);
                              setActiveHobbyIndex(null);
                            }}
                            className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer italic"
                          >
                            Keep “{hobbyObj || ""}”
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
                    className={`flex-grow relative border rounded flex items-center px-2 py-1 min-h-[48px] ${errors.includes("musicalArtists") &&
                        (!artist || artist.trim() === "")
                        ? "border-red-500"
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
              className={`w-full border px-4 py-2 rounded ${errors.includes("meetingFrequency") ? "border-red-500" : ""}`}
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
                className={`w-full border px-4 py-2 rounded ${errors.includes("openToMultiple") ? "border-red-500" : ""}`}
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
              className={`w-full border px-4 py-2 rounded ${errors.includes("menteeInMajor") ? "border-red-500" : ""}`}
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
                    value={org}
                    onChange={(e) =>
                      handleOrgInputChange(index, e.target.value)
                    }
                    placeholder="e.g., NSBE, Club Basketball"
                    className={`w-full border px-4 py-2 rounded pr-10 ${errors.includes("organizations") &&
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
          <textarea
            name="expectations"
            value={formData.expectations}
            onChange={handleChange}
            placeholder={
              role === "mentor"
                ? "What do you expect from your mentee?"
                : "What do you expect from your mentor?"
            }
            className={`w-full border px-4 py-2 rounded ${errors.includes("expectations") ? "border-red-500" : ""}`}
            rows="3"
          />
        </div>
      )}
      
      {step === 7 && (
        <div className="space-y-4 relative">
          {traitsLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-50 flex justify-center items-center z-20">
              <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          <h3 className="text-xl font-semibold text-gray-800">
            Last minute things...
          </h3>
          <p className="font-medium text-base text-violet-500 text-center">
            Who are you in three words? (e.g., "Curious, Driven, Friendly")
          </p>

          <div className="space-y-2">
            {formData.personalityWords.map((traitObj, index) => (
              <div key={index} className="relative">
                <div className="flex items-center gap-2">
                  <input
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
  if (value && traitFuse?.search) {
    const results = traitFuse.search(value).map((r) => r.item);
    setTraitSuggestions(results);
    setActiveTraitIndex(index);
    setFocusedTraitOption(-1);
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
                            onMouseDown={async (e) => {
                              e.preventDefault();
                              setTraitClickInProgress(true);
                              handleTraitChange(
                                index,
                                toTitleCase(traitObj?.raw || ""),
                              );
                              setTraitSuggestions([]);
                              setActiveTraitIndex(null);

                              const term = toTitleCase(
                                traitObj?.raw || "",
                              ).trim();

                              if (!traitVectors[term]) {
                                try {
                                  setTraitsLoading(true);

                                  const res = await axios.post(
                                    `${import.meta.env.VITE_BACKEND_URL}/api/traits/add`,
                                    { trait: term },
                                  );
                                  if (res.data.embedding) {
                                    console.log(
                                      `✅ "${term}" vectorized and saved.`,
                                    );

                                    setTraitVectors((prev) => ({
                                      ...prev,
                                      [term]: res.data.embedding,
                                    }));

                                    if (traitFuse) {
                                      traitFuse.add(term);
                                      console.log(
                                        `✅ "${term}" added to Fuse suggestions.`,
                                      );
                                    }
                                  }
                                } catch (err) {
                                  console.error("Error adding new trait:", err);
                                } finally {
                                  setTraitsLoading(false);
                                }
                              }
                            }}
                            className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer italic"
                          >
                            Keep “{toTitleCase(traitObj?.raw || "")}”
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

          <p className="font-medium text-base text-violet-500 text-center">
            {role === "mentor"
              ? `Describe your ideal mentee in a few words.`
              : `Describe your ideal mentor in a few words.`}
          </p>
          <textarea
            name="idealMatchDescription"
            value={formData.idealMatchDescription}
            onChange={handleChange}
            placeholder="My twin 🤪"
            className={`w-full border px-4 py-2 rounded mt-4 ${errors.includes("idealMatchDescription") ? "border-red-500" : ""
              }`}
            rows="3"
          />
        </div>
      )}
      {step === 8 && (
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
      <div className="flex justify-between pt-4">
        {step > 1 && step < 8 && (
          <button
            type="button"
            onClick={handleBack}
            className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
          >
            Back
          </button>
        )}

        {step < 7 ? (
          <button
            ref={nextBtnRef}
            type="button"
            onClick={handleNext}
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Next
          </button>
        ) : step === 7 ? (
          <button
            type="button"
            onClick={(e) => {
              if (!validateStep(step)) return;

              handleSubmit(e);
              setShowConfetti(true);

              setTimeout(() => {
                setErrors([]);
                setStep(8);
              }, 50); // 50-100ms is enough for confetti to fire first
            }}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Submit
          </button>
        ) : null}
      </div>
    </form>
  );
  
}

