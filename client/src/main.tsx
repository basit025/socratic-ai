import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { RequireRole } from "./lib/session";
import { Landing } from "./pages/Landing";
import { StudentHome } from "./pages/StudentHome";
import { TeacherHome } from "./pages/TeacherHome";
import { FullPageLoading } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";

// The workspace (code editor) is loaded only when a student opens an assignment, keeping the landing page light.
const Workspace = lazy(() => import("./pages/Workspace").then((m) => ({ default: m.Workspace })));
const Viva = lazy(() => import("./pages/Viva").then((m) => ({ default: m.Viva })));
const TeacherAssignment = lazy(() => import("./pages/TeacherAssignment").then((m) => ({ default: m.TeacherAssignment })));
const Builder = lazy(() => import("./pages/Builder").then((m) => ({ default: m.Builder })));
const Report = lazy(() => import("./pages/Report").then((m) => ({ default: m.Report })));
import { NotFound } from "./pages/NotFound";
import { runner } from "./runner/runner";
import "./index.css";

// Development only: lets the browser smoke test drive the Python runner directly.
if (import.meta.env.DEV) (window as unknown as { __runner: typeof runner }).__runner = runner;

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/student" element={<RequireRole role="student"><StudentHome /></RequireRole>} />
        <Route path="/student/assignments/:id" element={<RequireRole role="student"><Suspense fallback={<FullPageLoading label="Opening the workspace…" />}><Workspace /></Suspense></RequireRole>} />
        <Route path="/student/assignments/:id/viva" element={<RequireRole role="student"><Suspense fallback={<FullPageLoading label="Opening your viva…" />}><Viva /></Suspense></RequireRole>} />
        <Route path="/teacher" element={<RequireRole role="teacher"><TeacherHome /></RequireRole>} />
        <Route path="/teacher/assignments/new" element={<RequireRole role="teacher"><Suspense fallback={<FullPageLoading label="Opening the builder…" />}><Builder /></Suspense></RequireRole>} />
        <Route path="/teacher/assignments/:id" element={<RequireRole role="teacher"><Suspense fallback={<FullPageLoading label="Loading submissions…" />}><TeacherAssignment /></Suspense></RequireRole>} />
        <Route path="/teacher/submissions/:id" element={<RequireRole role="teacher"><Suspense fallback={<FullPageLoading label="Loading the report…" />}><Report /></Suspense></RequireRole>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
