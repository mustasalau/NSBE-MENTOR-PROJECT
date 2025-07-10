import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import CountUp from "react-countup";

const COLORS = ["#4F46E5", "#60A5FA"];

  

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

  const handleWeightChange = (key, value) => {
    setMatchWeights((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = async () => {
  setMatchWeights(defaultMatchWeights);

  try {
    await axios.post("https://nsbe-mentor-project.onrender.com/api/save-match-settings", defaultMatchWeights);
    setSaveSuccess(true);
    setSaveError("");
  } catch (error) {
    console.error("Failed to reset settings:", error);
    setSaveError("Failed to reset settings.");
  }
};

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const response = await axios.post("https://nsbe-mentor-project.onrender.com/api/save-match-settings", matchWeights);
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

  const settingsConfig = [
    { key: "major", label: "Major", explanation: 'If a mentor/mentee selects that they want a counterpart in their major, this will default to high. If they say "no preference" it will default to medium, and if they say "no" it will default to low.' },
    { key: "gender", label: "Gender", explanation: 'If a mentor/mentee selects a preferred gender, this will default to high. If they say "no preference" it will default to medium, and if they say "no" it will default to low.' },
    { key: "hobbies", label: "Hobbies", explanation: "Set the weight that hobby matching should hold in matching." },
    { key: "musicalArtists", label: "Musical Artists", explanation: "Set the weight that musical artist matching should hold in matching." },
    { key: "personalityWords", label: "Personality Words", explanation: "Set the weight that personality matching should hold in matching." },
    { key: "expectations", label: "Expectations/Ideal Match", explanation: "Each user submits their expectations for their counterpart as well as their ideal counterpart." },
    { key: "organizations", label: "Organizations", explanation: "Set the weight that organizational matching should hold in matching." },
    { key: "meetingFrequency", label: "Meeting Frequency", explanation: "Users enter how often they hope to meet with their counterparts." },
  ];
  

  useEffect(() => {
    axios
      .get("https://nsbe-mentor-project.onrender.com/api/check", {
        withCredentials: true,
      })
      .then((res) => {
        if (!res.data.loggedIn) {
          navigate("/"); // ✅ works fine now
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Auth check failed:", err);
        navigate("/"); // ✅ works here too
      });
  }, [navigate]);
  
  
  useEffect(() => {
  if (!loading) {
    axios
      .get("https://nsbe-mentor-project.onrender.com/api/submissions", {
        withCredentials: true,
      })
      .then((res) => {
        console.log("Fetched data:", res.data);  // 👈 Add this
        setData(res.data);
      })
      .catch((err) => console.error("Data fetch failed:", err));
  }
}, [loading]);

useEffect(() => {
  const loadSettings = async () => {
    try {
      const res = await axios.get("https://nsbe-mentor-project.onrender.com/api/get-match-settings");
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  
  const totalSubmissions = data.length;
  const mentors = data.filter((entry) => entry.role === "mentor");
  const mentees = data.filter((entry) => entry.role === "mentee");

  const getGenderBreakdown = (entries) => {
    const male = entries.filter((e) => e.gender?.toLowerCase().trim() === "male").length;
    const female = entries.filter((e) => e.gender?.toLowerCase().trim() === "female").length;
    return [
      { name: "Male", value: male },
      { name: "Female", value: female },
    ];
  };
  const CustomTooltip = ({ active, payload, total }) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
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
  <div className="bg-white rounded-2xl p-6 shadow-md w-full md:w-1/3 transition-opacity duration-1000 relative">
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
  {pieData.map((_, index) => (
    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
            style={{ backgroundColor: COLORS[index % COLORS.length] }}
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

  return (
  <div className="min-h-screen bg-blue-50 relative p-6">
    <a href="/">
      <img
        src="/pictures/nsbelogo.png"
        alt="NSBE Logo"
        className="absolute top-4 left-4 w-16 cursor-pointer"
      />
    </a>

    <div className="max-w-5xl mx-auto mt-20 p-8 bg-white rounded-3xl shadow-xl">
      {/* Nav Buttons */}
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setView("dashboard")}
          className={`text-xs font-medium px-3 py-1 rounded-full transition ${
            view === "dashboard"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-400 hover:bg-gray-100"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setView("Match Settings")}
          className={`text-xs font-medium px-3 py-1 rounded-full transition ${
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
          <h1 className="text-3xl font-bold text-center">Dashboard</h1>
          <div className="w-24 h-1 bg-blue-300 mx-auto mt-2 mb-6 rounded-full" />

          <div className="flex flex-col md:flex-row justify-between gap-6">
            {renderCard("Total Submissions", totalSubmissions, [
              { name: "Mentors", value: mentors.length },
              { name: "Mentees", value: mentees.length },
            ])}
            {renderCard("Mentors", mentors.length, getGenderBreakdown(mentors))}
            {renderCard("Mentees", mentees.length, getGenderBreakdown(mentees))}
          </div>

          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-2 text-center">Latest Submissions</h2>
            <input
              type="text"
              placeholder="Search by name..."
              className="w-full border p-2 rounded mb-4"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-2">First Name</th>
                    <th className="p-2">Last Name</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Major</th>
                    <th className="p-2">Gender</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((entry, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2">{entry.first_name}</td>
                      <td className="p-2">{entry.last_name}</td>
                      <td className="p-2 capitalize">{entry.role}</td>
                      <td className="p-2">{entry.major}</td>
                      <td className="p-2 capitalize">{entry.gender}</td>
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
        <div className="max-w-4xl mx-auto mt-20 px-6">
          <h2 className="text-3xl font-semibold text-center text-gray-800 mb-10">
            Match Settings
          </h2>

          {settingsConfig.map(({ key, label, explanation }) => (
            <div
              key={key}
              className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 py-6"
            >
              <div className="mb-2 sm:mb-0">
                <select
                  value={matchWeights[key]}
                  onChange={(e) => handleWeightChange(key, e.target.value)}
                  className="border border-gray-300 rounded px-4 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="sm:ml-6 max-w-xl">
                <p className="font-semibold text-gray-800">{label}</p>
                <p className="text-sm text-gray-500 mt-1">{explanation}</p>
              </div>
            </div>
          ))}

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
    </div>
  </div>  
  );
}
