import { Routes, Route } from 'react-router-dom';
import Home from './pages/home.jsx';
import MentorForm from './pages/MentorForm.jsx';
import MenteeForm from './pages/MenteeForm.jsx';
import MatchingPage from './pages/MatchingPage.jsx';
import Dashboard, { DataReloadContext } from './pages/Dashboard.jsx';
import DuplicatesPage from './pages/DuplicatesPage.jsx';
import React, { useRef } from 'react';

export default function App() {
  // Use a ref to hold the reloadData function from Dashboard
  const reloadDataRef = useRef(() => {});

  return (
    <DataReloadContext.Consumer>
      {({ reloadData }) => {
        reloadDataRef.current = reloadData;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/mentor" element={<MentorForm />} />
      <Route path="/mentee" element={<MenteeForm />} />
      <Route path="/matching" element={<MatchingPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/duplicates" element={<DuplicatesPage reloadData={() => reloadDataRef.current()} />} />
    </Routes>
        );
      }}
    </DataReloadContext.Consumer>
  );
}

