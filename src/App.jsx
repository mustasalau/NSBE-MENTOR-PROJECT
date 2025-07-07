import { Routes, Route } from 'react-router-dom';
import Home from './pages/home.jsx';
import MentorForm from './pages/MentorForm.jsx';
import MenteeForm from './pages/MenteeForm.jsx';
import MatchingPage from './pages/MatchingPage.jsx';



export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/mentor" element={<MentorForm />} />
      <Route path="/mentee" element={<MenteeForm />} />
      <Route path="/matching" element={<MatchingPage />} />
    </Routes>
  );
}

