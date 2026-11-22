import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { RequireRole } from "./lib/session";
import { Landing } from "./pages/Landing";
import { StudentHome } from "./pages/StudentHome";
import { TeacherHome } from "./pages/TeacherHome";
import { Placeholder } from "./pages/Placeholder";
import { NotFound } from "./pages/NotFound";
import { runner } from "./runner/runner";
import "./index.css";

// Development only: lets the browser smoke test drive the Python runner directly.
if (import.meta.env.DEV) (window as unknown as { __runner: typeof runner }).__runner = runner;

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/student" element={<RequireRole role="student"><StudentHome /></RequireRole>} />
        <Route path="/student/assignments/:id" element={<RequireRole role="student"><Placeholder title="The assignment workspace" /></RequireRole>} />
        <Route path="/teacher" element={<RequireRole role="teacher"><TeacherHome /></RequireRole>} />
        <Route path="/teacher/assignments/new" element={<RequireRole role="teacher"><Placeholder title="The assignment builder" /></RequireRole>} />
        <Route path="/teacher/assignments/:id" element={<RequireRole role="teacher"><Placeholder title="The submissions and integrity report" /></RequireRole>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
