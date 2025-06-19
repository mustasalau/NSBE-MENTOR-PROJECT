// MentorForm.jsx
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import majorsList from '../data/majors.json';
import clubList from '/Users/msalau/NSBE-MENTOR-PROJECT/src/data/clubs.json';



export default function MentorForm() {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', personalEmail: '', studentId: '', major: '',
    gender: '', year: '', pairGenderPreference: '', hobbies: [''], musicalArtists: [''],
    expectations: '', meetingFrequency: '', organizations: [''], personalityWords: '',
    introExtrovert: '', idealMentee: '', menteeInMajor: '', openToMultiple: '',
  });

  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState([]);
  const [filteredMajors, setFilteredMajors] = useState([]);
  const [majorSelected, setMajorSelected] = useState(false);
  const [filteredOrgs, setFilteredOrgs] = useState([]);
  const nextBtnRef = useRef(null);
  const [focusedOrgOption, setFocusedOrgOption] = useState([]);
  const [focusedMajorIndex, setFocusedMajorIndex] = useState(-1);

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
    hobbies[index] = value;
    setFormData((prev) => ({ ...prev, hobbies }));
    if (errors.includes('hobbies') && hobbies.some((h) => h.trim())) {
      setErrors((prev) => prev.filter((e) => e !== 'hobbies'));
    }
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
    if (formData.hobbies.at(-1).trim() === '') return;
    setFormData((prev) => ({ ...prev, hobbies: [...prev.hobbies, ''] }));
  };

  const removeHobby = (index) => {
    const updated = formData.hobbies.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, hobbies: updated.length > 0 ? updated : [''] }));
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
  setFocusedOrgOption((prev) => [...prev, -1]); // no item focused initially
};

const removeOrg = (index) => {
  const updatedOrgs = formData.organizations.filter((_, i) => i !== index);
  const updatedFilters = filteredOrgs.filter((_, i) => i !== index);
  const updatedFocus = focusedOrgOption.filter((_, i) => i !== index);
  setFormData((prev) => ({ ...prev, organizations: updatedOrgs.length > 0 ? updatedOrgs : [''] }));
  setFilteredOrgs(updatedFilters.length > 0 ? updatedFilters : [[]]);
  setFocusedOrgOption(updatedFocus.length > 0 ? updatedFocus : [-1]);
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
        ? val.some((v) => v.trim() === '') || val.length === 0
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
  
  const handleNext = () => {
    if (validateStep()) setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setErrors([]);
    setStep((prev) => prev - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateStep()) {
      console.log(formData);
    }
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

    <p className="font-medium text-base text-violet-500 text-center">What do you do when classes aren't beating you down?</p>

    <div className="space-y-2">
      {formData.hobbies.map((hobby, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={hobby}
            onChange={(e) => handleHobbyChange(index, e.target.value)}
            placeholder="Enter Hobbies"
            className="w-full border px-4 py-2 rounded"
          />
          {formData.hobbies.length > 1 && (
            <button type="button" onClick={() => removeHobby(index)} className="text-red-500 text-xl px-2 rounded hover:bg-red-100" title="Remove hobby">
              ×
            </button>
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
    {filteredOrgs[index].length > 0 && (
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