import { BrowserRouter, Routes, Route } from "react-router-dom";
import QuestPage from "./Quest";
import AuthSwipe from "./login";
import Dashboard from "./dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<QuestPage />} />

        <Route path="/login" element={<AuthSwipe />} />

        <Route path="/dashboard" element={<Dashboard />} />

      </Routes>
    </BrowserRouter>
  );
}