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

  const renderCard = (title, count, pieData) => (
  <div className="bg-white rounded-2xl p-6 shadow-md w-full md:w-1/3 relative transition-opacity duration-1000">
    <h2 className="text-lg font-semibold mb-2">{title}</h2>
    <CountUp end={count} duration={1.5} className="text-3xl font-bold" />

    <ResponsiveContainer width="100%" height={150}>
      <PieChart>
        <Pie
  data={pieData}
  dataKey="value"
  nameKey="name"
  cx="50%"
  cy="50%"
  outerRadius={50}
  fill="#8884d8"
  label={({ value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
>
  {pieData.map((_, index) => (
    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
  ))}
</Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>

    {/* Key/Legend in bottom-right */}
    <div className="absolute bottom-4 right-4 text-xs text-gray-600">
      <div className="flex items-center space-x-1 mb-1">
        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[0] }} />
        <span>Male</span>
      </div>
      <div className="flex items-center space-x-1">
        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[1] }} />
        <span>Female</span>
      </div>
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
      <img src="/pictures/nsbelogo.png" alt="NSBE Logo" className="absolute top-4 left-4 w-16 cursor-pointer" />
    </a>

    <div className="max-w-5xl mx-auto mt-20 p-8 bg-white rounded-3xl shadow-xl">
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
    onClick={() => setView("matches")}
    className={`text-xs font-medium px-3 py-1 rounded-full transition ${
      view === "matches"
        ? "bg-blue-100 text-blue-700"
        : "text-gray-400 hover:bg-gray-100"
    }`}
  >
    Matches
  </button>
</div>


      {view === "dashboard" && (
        <>
          <h1 className="text-3xl font-bold text-center">Dashboard</h1>
          <div className="w-24 h-1 bg-blue-300 mx-auto mt-2 mb-6 rounded-full" />

          <div className="flex flex-col md:flex-row justify-between gap-6">
            {renderCard("Total Submissions", totalSubmissions, getGenderBreakdown(data))}
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

      {view === "matches" && (
        <div className="text-center text-gray-600 mt-20">
          <h2 className="text-2xl font-semibold mb-4">Matches</h2>
          <p>This is where matched mentor-mentee pairs will be displayed.</p>
        </div>
      )}
    </div>
  </div>
)};
