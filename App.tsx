import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard'; // This imports your main app
import Landing from './Landing';     // This imports your new showcase page

function App() {
  return (
    <Router>
      <Routes>
        {/* If user goes to ozarchviz.com/ -> Show the Main Dashboard */}
        <Route path="/" element={<Dashboard />} />

        {/* If user goes to ozarchviz.com/landing -> Show the Landing Page */}
        <Route path="/landing" element={<Landing />} />
      </Routes>
    </Router>
  );
}

export default App;