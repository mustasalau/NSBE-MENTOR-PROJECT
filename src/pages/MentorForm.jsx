// MentorForm.jsx
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import majorsList from '../data/majors.json';
import clubList from '@/data/clubs.json';
import Fuse from 'fuse.js';
import hobbiesList from '@/data/hobbies.json'; // your static list of hobbies
const DEBUG = true;

const fuse = new Fuse(hobbiesList, {
  includeScore: true,
  threshold: 0.3, // adjust sensitivity
  minMatchCharLength: 3, // minimum characters to start matching
  shouldSort: true,

});

console.log("Hobbies list loaded:", hobbiesList);
console.log("Fuse instance created with:", fuse.getIndex().size());



export default function MentorForm() {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', personalEmail: '', studentId: '', major: '',
    gender: '', year: '', pairGenderPreference: '', hobbies: [{
    raw: "",           // What the user sees
  normalized: "",    // Backend normalized term
  known: false         // True if matched to static list or already normalized
}], musicalArtists: [''],
    expectations: '', meetingFrequency: '', organizations: [''], personalityWords: '',
    introExtrovert: '', idealMentee: '', menteeInMajor: '', openToMultiple: '',
  });

  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState([]);
  const [filteredMajors, setFilteredMajors] = useState([]);
  const [majorSelected, setMajorSelected] = useState(false);
  const [hobbySuggestions, setHobbySuggestions] = useState([]);
  const [activeHobbyIndex, setActiveHobbyIndex] = useState(null);
  const [filteredOrgs, setFilteredOrgs] = useState([[]]);
  const nextBtnRef = useRef(null);
  const [focusedOrgOption, setFocusedOrgOption] = useState([-1]);
  const [focusedMajorIndex, setFocusedMajorIndex] = useState(-1);
  const [focusedHobbyOption, setFocusedHobbyOption] = useState(-1);
  const [hobbiesNormalized, setHobbiesNormalized] = useState(false);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'major') {
      setMajorSelected(false);
      const matches = majorsList.filter((m) => m.toLowerCase().includes(value.toLowerCase()));
      setFilteredMajors(matches);
      setFocusedMajorIndex(-1);

    }

    if (errors.length > 0) {
      setErrors((prevErrors) => prevErrors.filter((err) => err !== name));
    }
  };

  const handleHobbyChange = (index, value) => {
  const hobbies = [...formData.hobbies];
  const previous = hobbies[index] || { raw: "", normalized: "", known: false };

  hobbies[index] = {
    raw: value,
    normalized: previous.normalized && previous.normalized === value ? previous.normalized : "",
    known: previous.normalized && previous.normalized === value ? true : false
  };

  setFormData((prev) => ({ ...prev, hobbies }));

  if (value.trim()) {
    const results = fuse.search(value.trim()).map(r => r.item);
    setHobbySuggestions(results);
    setActiveHobbyIndex(index);
  } else {
    setHobbySuggestions([]);
    setActiveHobbyIndex(null);
  }

  if (errors.includes('hobbies') && hobbies.some(h => h.raw?.trim())) {
    setErrors((prev) => prev.filter(e => e !== 'hobbies'));
  }

  setFocusedHobbyOption(-1);
};





  const handleArtistChange = (index, value) => {
    const artists = [...formData.musicalArtists];
    artists[index] = value;
    setFormData((prev) => ({ ...prev, musicalArtists: artists }));
    if (errors.includes('musicalArtists') && artists.some((a) => a.trim())) {
      setErrors((prev) => prev.filter((e) => e !== 'musicalArtists'));
    }
  };

  const addHobbyField = () => {
    if (formData.hobbies.at(-1)?.raw?.trim() === '') return;
    setFormData((prev) => ({
  ...prev,
  hobbies: [...prev.hobbies, { raw: "", normalized: "", known: false }]
}));
    setHobbySuggestions([]);
    setActiveHobbyIndex(null);
  };

  const removeHobby = (index) => {
  const updated = formData.hobbies.filter((_, i) => i !== index);
    setFormData((prev) => ({
  ...prev,
  hobbies: updated.length > 0 ? updated : [{ raw: "", normalized: "", known: false }]
}));


  };

  const addArtistField = () => {
    if (formData.musicalArtists.at(-1).trim() === '') return;
    setFormData((prev) => ({ ...prev, musicalArtists: [...prev.musicalArtists, ''] }));
  };

  const removeArtist = (index) => {
    const updated = formData.musicalArtists.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, musicalArtists: updated.length > 0 ? updated : [''] }));
  };
const handleOrgInputChange = (index, value) => {
  const updated = [...formData.organizations];
  updated[index] = value;
  setFormData((prev) => ({ ...prev, organizations: updated }));

  // Filter suggestions for just this index
  const matches = clubList
  .filter((club) => {
    const input = value.toLowerCase();
    const nameMatch = club.name.toLowerCase().includes(input);
    const acronymMatch = club.acronyms?.some(acronym => acronym.toLowerCase().includes(input));
    return nameMatch || acronymMatch;
  })
  .map((club) => club.name); // Return only the name for display
  const updatedFiltered = [...filteredOrgs];
  updatedFiltered[index] = matches;
  setFilteredOrgs(updatedFiltered);
  console.log("Club list sample:", clubList.slice(0, 5));

};

const handleSelectOrg = (index, value) => {
  const updated = [...formData.organizations];
  updated[index] = value;
  setFormData((prev) => ({ ...prev, organizations: updated }));

  const updatedFiltered = [...filteredOrgs];
  updatedFiltered[index] = [];
  setFilteredOrgs(updatedFiltered);
};
  
const addOrgField = () => {
  if (formData.organizations.at(-1).trim() === '') return;
  setFormData((prev) => ({ ...prev, organizations: [...prev.organizations, ''] }));
  setFilteredOrgs((prev) => [...prev, []]);
  setFocusedOrgOption((prev) => [...prev, -1]);
};


const removeOrg = (index) => {
  const updatedOrgs = formData.organizations.filter((_, i) => i !== index);
  const updatedFilters = filteredOrgs.filter((_, i) => i !== index);
  const updatedFocus = focusedOrgOption.filter((_, i) => i !== index);
  setFormData((prev) => ({ ...prev, organizations: updatedOrgs.length > 0 ? updatedOrgs : [''] }));
  setFilteredOrgs(updatedFilters.length > 0 ? updatedFilters : [[]]);
  setFocusedOrgOption(updatedFocus.length > 0 ? updatedFocus : [-1]);
};


const handleSelectSuggestion = (index, suggestion) => {
  const hobbies = [...formData.hobbies];
  hobbies[index] = {
  raw: suggestion,
  normalized: suggestion,
  known: true
};
  setFormData((prev) => ({ ...prev, hobbies }));
  setHobbySuggestions([]);
  setActiveHobbyIndex(null);
};



  const requiredFields = {
    1: ['firstName', 'lastName', 'email', 'studentId', 'major', 'gender', 'year', 'pairGenderPreference'],
    2: ['hobbies'],
    3: ['musicalArtists'],
    4: ['meetingFrequency', 'organizations'],
    5: ['expectations'],
    6: ['personalityWords', 'idealMentee'],
    7: ['introExtrovert', 'menteeInMajor', 'openToMultiple']
  };

  const validateStep = () => {
    const missing = requiredFields[step].filter((field) => {
      const val = formData[field];
      return Array.isArray(val)
      ? field === 'hobbies'
        ? val.some((h) => (h?.raw || "").trim() === "") || val.length === 0
        : val.some((v) => v.trim() === '') || val.length === 0
      : !val;
    });

    if (step === 1 && (!formData.major || !majorSelected)) {
      if (!missing.includes('major')) missing.push('major');
    }

    if (step === 1 && formData.email && !formData.email.endsWith('@psu.edu')) {
      if (!missing.includes('email')) missing.push('email');
    }

    if (step === 1 && (!/^\d{9}$/.test(formData.studentId))) {
      if (!missing.includes('studentId')) missing.push('studentId');
    }

    setErrors(missing);
    if (missing.length > 0) {
      nextBtnRef.current?.classList.add('animate-shake');
      setTimeout(() => nextBtnRef.current?.classList.remove('animate-shake'), 500);
      return false;
    }
    if (step === 4) {
    const invalidOrgs = formData.organizations.filter(
      (org) => !clubList.includes(org)
    );
    if (invalidOrgs.length > 0 && !missing.includes('organizations')) {
      missing.push('organizations');
    }
}
    return true;
    
  };
  const handleSelectMajor = (selectedMajor) => {
    setFormData((prev) => ({ ...prev, major: selectedMajor }));
    setMajorSelected(true);
    setFilteredMajors([]);
    setFocusedMajorIndex(-1);
  };
  
  const handleNext = async () => {
  if (!validateStep()) return;

  if (step === 2) {
    const unknowns = formData.hobbies
      .map((h, i) => ({ ...h, index: i }))
      .filter(h => !h.known && !h.normalized);

    if (unknowns.length > 0) {
      const inputs = unknowns.map(h => h.raw);

      try {
        const response = await fetch("http://localhost:5001/normalize-hobbies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hobbies: inputs }),
        });

        const data = await response.json();
        console.log("Normalized hobbies from backend:", data.normalized);

        const updated = [...formData.hobbies];
        unknowns.forEach((h, idx) => {
          updated[h.index] = {
            ...updated[h.index],
            normalized: data.normalized[idx],
            known: true
          };
        });

        setFormData(prev => ({ ...prev, hobbies: updated }));
      } catch (err) {
        console.error("Error normalizing hobbies:", err);
        return;
      }
    }
  }

  setStep(prev => prev + 1);
};







  const handleBack = () => {
    setErrors([]);
    setStep((prev) => prev - 1);
  };

  useEffect(() => {
    if (DEBUG) {
    console.log("Hobbies with normalized values:", formData.hobbies);
  }
}, [formData.hobbies]);



  const handleSubmit = (e) => {
  e.preventDefault();
  if (!validateStep()) return;

  const cleanData = {
    ...formData,
    hobbies: formData.hobbies.map(h => h.normalized || h.raw),
    organizations: formData.organizations.map(org => org.trim()).filter(Boolean),
    musicalArtists: formData.musicalArtists.map(a => a.trim()).filter(Boolean),
  };

  console.log("Final Submission:", cleanData);

  // Example API call (uncomment and update if needed)
  /*
  fetch("http://your-backend.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cleanData),
  })
    .then(res => res.json())
    .then(data => {
      console.log("Submission successful:", data);
    })
    .catch(err => {
      console.error("Submission error:", err);
    });
  */
};

  const progressPercent = Math.round((step / 7) * 100);
  

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-12 relative">
      <Link to="/">
        <img src="/pictures/nsbelogo.png" alt="NSBE Logo" className="absolute top-4 left-4 w-16 h-auto cursor-pointer" />
      </Link>

      {errors.length > 0 && (
        <div className="absolute right-6 top-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-md w-80">
          <strong className="font-bold">Please complete:</strong>
          <ul className="mt-2 list-disc list-inside text-sm">
            {errors.map((field) => (
              <li key={field}>
                {field === 'email'
                  ? 'Email should end with @psu.edu'
                  : field === 'studentId'
                  ? 'Student ID must be exactly 9 digits'
                  : field === 'hobbies'
                  ? 'Please fill out all hobby fields (no blanks)'
                  : field === 'musicalArtists'
                  ? 'Please fill out all musical artist fields (no blanks)'
                  : field === 'organizations'
                  ? 'Please fill out all organization fields (no blanks)'
                  : field === 'major'
                  ? 'Please select a major from the list'
                  : field === 'firstName'
                  ? 'First Name is required'
                  : field === 'lastName'
                  ? 'Last Name is required'
                
                  : field.replace(/([A-Z])/g, ' $1')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-xl space-y-6">
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Progress</span>
            <span className="text-sm text-gray-600 font-medium">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded-full">
            <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-800">Mentor Sign-Up (Step {step} of 7)</h2>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First Name" className="w-full border px-4 py-2 rounded" />
              <input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last Name" className="w-full border px-4 py-2 rounded" />
            </div>
            <input name="email" value={formData.email} onChange={handleChange} type="email" placeholder="PSU Email" className="w-full border px-4 py-2 rounded" />
            <input name="personalEmail" value={formData.personalEmail} onChange={handleChange} type="email" placeholder="Personal Email" className="w-full border px-4 py-2 rounded" />
            <input name="studentId" value={formData.studentId} onChange={handleChange} type="number" placeholder="9-Digit Student ID" className="w-full border px-4 py-2 rounded" />

            <div className="relative">
              <input name="major" value={formData.major} onChange={handleChange} placeholder="Major" className="w-full border px-4 py-2 rounded" autoComplete="off" 
              onKeyDown={(e) => {
                  const list = filteredMajors || [];
                  let newFocus = focusedMajorIndex;

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    newFocus = (newFocus + 1) % list.length;
                    setFocusedMajorIndex(newFocus);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    newFocus = (newFocus - 1 + list.length) % list.length;
                    setFocusedMajorIndex(newFocus);
                  } else if (e.key === 'Enter' && newFocus >= 0) {
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
                      className={`px-4 py-2 cursor-pointer text-sm ${
                        focusedMajorIndex === i ? 'bg-blue-100' : 'hover:bg-gray-200'
                      }`}
                    >
                      {m}
                    </li>
            ))}

                </ul>
              )}
            </div>

            <div className="flex gap-4">
              <select name="gender" value={formData.gender} onChange={handleChange} className="w-full border px-4 py-2 rounded">
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
              <select name="year" value={formData.year} onChange={handleChange} className="w-full border px-4 py-2 rounded">
                <option value="">Select Year</option>
                <option>1st</option>
                <option>2nd</option>
                <option>3rd</option>
                <option>4th+</option>
              </select>
            </div>
            <select name="pairGenderPreference" value={formData.pairGenderPreference} onChange={handleChange} className="w-full border px-4 py-2 rounded">
              <option value="">Preferred Gender of Mentee</option>
              <option>Male</option>
              <option>Female</option>
              <option>No Preference</option>
            </select>
          </div>
        )}
{step === 2 && (
  <div className="space-y-4">
    <h3 className="text-xl font-semibold text-gray-800">Hobbies</h3>
    <p className="font-medium text-base text-violet-500 text-center">
      What do you do when classes aren't beating you down?
    </p>

    <div className="space-y-2">
      {formData.hobbies.map((hobbyObj, index) => (
        <div key={index} className="relative">
          <div className="flex items-center gap-2">
            <input
              value={hobbyObj?.raw || ""}
              onChange={(e) => handleHobbyChange(index, e.target.value)}
              placeholder="Enter Hobbies"
              className="w-full border px-4 py-2 rounded"
              onFocus={() => {
                const value = hobbyObj?.raw?.trim() || "";
                if (value) {
                  const results = fuse.search(value).map(r => r.item);
                  setHobbySuggestions(results);
                  setActiveHobbyIndex(index);
                  setFocusedHobbyOption(-1);
                }
              }}
              onKeyDown={(e) => {
                if (activeHobbyIndex !== index || hobbySuggestions.length === 0) return;

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setFocusedHobbyOption((prev) => (prev + 1) % hobbySuggestions.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setFocusedHobbyOption((prev) => (prev - 1 + hobbySuggestions.length) % hobbySuggestions.length);
                } else if (e.key === "Enter" && focusedHobbyOption >= 0) {
                  e.preventDefault();
                  handleSelectSuggestion(index, hobbySuggestions[focusedHobbyOption]);
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
          {activeHobbyIndex === index && (hobbyObj?.raw?.trim() || "") !== "" && (
            <ul className="absolute z-10 bg-white border mt-1 w-full rounded shadow">
              {hobbySuggestions.map((suggestion, sIndex) => (
                <li
                  key={sIndex}
                  onClick={() => handleSelectSuggestion(index, suggestion)}
                  className={`px-4 py-2 cursor-pointer ${
                    focusedHobbyOption === sIndex ? "bg-blue-100" : "hover:bg-gray-100"
                  }`}
                >
                  {suggestion}
                </li>
              ))}

              <li
                onClick={() => {
                  handleHobbyChange(index, hobbyObj?.raw || "");
                  setHobbySuggestions([]);
                  setActiveHobbyIndex(null);
                }}
                className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer italic"
              >
                Keep “{hobbyObj?.raw || ""}”
              </li>
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
    {formData.firstName.charAt(0).toUpperCase() + formData.firstName.slice(1)}'s Tunes 🎵
      </h3>
    <p className="font-medium text-base text-violet-500 text-center">Your on aux. Who/What are you playing?</p>
    <div className="space-y-2">
      {formData.musicalArtists.map((artist, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={artist}
            onChange={(e) => handleArtistChange(index, e.target.value)}
            placeholder="Musical Artist/Song (ex: Uzi, drive ME craxy!, etc.)"
            className="w-full border px-4 py-2 rounded"
          />
          {formData.musicalArtists.length > 1 && (
            <button type="button" onClick={() => removeArtist(index)} className="text-red-500 text-xl px-2 rounded hover:bg-red-100" title="Remove artist">
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addArtistField}
        className="text-green-600 border border-green-600 rounded-full px-3 py-1 text-lg leading-none hover:bg-green-50"
        title="Add another artist"
      >
        +
      </button>
    </div>
  </div>
)}

{step === 4 && (
  <div className="space-y-4">
    <select name="meetingFrequency" value={formData.meetingFrequency} onChange={handleChange} className="w-full border px-4 py-2 rounded">
      <option value="">Preferred Meeting Frequency</option>
      <option>Weekly</option>
      <option>Bi-Weekly</option>
      <option>Monthly</option>
    </select>
  <div className="space-y-4">
    <label className="text-xl font-bold text-gray-800">Org Involvement</label>
    <div className="space-y-2">
{formData.organizations.map((org, index) => (
  <div key={index} className="flex items-start gap-2 relative">
  <div className="relative w-full">
    <input
      value={org}
      onChange={(e) => handleOrgInputChange(index, e.target.value)}
      placeholder="e.g., NSBE, Club Basketball"
      className="w-full border px-4 py-2 rounded"
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

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          newFocus = (newFocus + 1) % list.length;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          newFocus = (newFocus - 1 + list.length) % list.length;
        } else if (e.key === 'Enter' && newFocus >= 0) {
          e.preventDefault();
          handleSelectOrg(index, list[newFocus]);
          newFocus = -1;
        }

        const newFocusList = [...focusedOrgOption];
        newFocusList[index] = newFocus;
        setFocusedOrgOption(newFocusList);
      }}
    />

    {/* Dropdown */}
    {Array.isArray(filteredOrgs[index]) && filteredOrgs[index].length > 0 && (
  <ul className="absolute top-full left-0 z-10 bg-white border rounded w-full mt-1 max-h-40 overflow-y-auto shadow">
    {filteredOrgs[index].map((c, i) => (
      <li
        key={i}
        onClick={() => handleSelectOrg(index, c)}
        className={`px-4 py-2 cursor-pointer text-sm ${
          focusedOrgOption[index] === i ? 'bg-blue-100' : 'hover:bg-gray-200'
        }`}
      >
        {c}
      </li>
    ))}
  </ul>
)}

  </div>

  {/* Remove Button */}
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

  </div>
)}

{step === 5 && (
  <div className="space-y-4">
    <textarea
      name="expectations"
      value={formData.expectations}
      onChange={handleChange}
      placeholder="What do you want from your mentee(s)?"
      className="w-full border px-4 py-2 rounded"
      rows="3"
    />
  </div>
)}

{step === 6 && (
  <div className="space-y-4">
    <input
      name="personalityWords"
      value={formData.personalityWords}
      onChange={handleChange}
      placeholder="Describe yourself in 3 words"
      className="w-full border px-4 py-2 rounded"
    />
    <textarea
      name="idealMentee"
      value={formData.idealMentee}
      onChange={handleChange}
      placeholder="How would you describe your ideal mentee?"
      className="w-full border px-4 py-2 rounded"
      rows="3"
    />
  </div>
)}

{step === 7 && (
  <div className="space-y-4">
    <select name="introExtrovert" value={formData.introExtrovert} onChange={handleChange} className="w-full border px-4 py-2 rounded">
      <option value="">Are you more introverted or extroverted?</option>
      <option>Introverted</option>
      <option>Extroverted</option>
      <option>Somewhere in between</option>
    </select>
    <select name="menteeInMajor" value={formData.menteeInMajor} onChange={handleChange} className="w-full border px-4 py-2 rounded">
      <option value="">Do you prefer mentees in your major?</option>
      <option>Yes</option>
      <option>No</option>
      <option>No Preference</option>
    </select>
    <select name="openToMultiple" value={formData.openToMultiple} onChange={handleChange} className="w-full border px-4 py-2 rounded">
      <option value="">Are you open to mentoring multiple mentees?</option>
      <option>Yes</option>
      <option>No</option>
    </select>
  </div>
  
)}


<div className="flex justify-between pt-4">
  {step > 1 && (
    <button type="button" onClick={handleBack} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">
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
  ) : (
    <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
      Submit
    </button>
  )}
</div>
</form>
</div>
);
} 

