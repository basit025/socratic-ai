import { lazy, StrictMode, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { RequireRole } from "./lib/session";
import { Landing } from "./pages/Landing";
import { StudentHome } from "./pages/StudentHome";
import { TeacherHome } from "./pages/TeacherHome";
import { FullPageLoading } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Shell } from "./components/Shell";

// The workspace (code editor) is loaded only when a student opens an assignment, keeping the landing page light.
const Workspace = lazy(() => import("./pages/Workspace").then((m) => ({ default: m.Workspace })));
const Viva = lazy(() => import("./pages/Viva").then((m) => ({ default: m.Viva })));
const TeacherAssignment = lazy(() => import("./pages/TeacherAssignment").then((m) => ({ default: m.TeacherAssignment })));
const Builder = lazy(() => import("./pages/Builder").then((m) => ({ default: m.Builder })));
const SignIn = lazy(() => import("./pages/SignIn").then((m) => ({ default: m.SignIn })));
const CoursePage = lazy(() => import("./pages/CoursePage").then((m) => ({ default: m.CoursePage })));
const Gradebook = lazy(() => import("./pages/Gradebook").then((m) => ({ default: m.Gradebook })));
const StudentCourses = lazy(() => import("./pages/StudentCourses").then((m) => ({ default: m.StudentCourses })));
const StudentCalendar = lazy(() => import("./pages/StudentCalendar").then((m) => ({ default: m.StudentCalendar })));
const StudentMarks = lazy(() => import("./pages/StudentMarks").then((m) => ({ default: m.StudentMarks })));
const Report = lazy(() => import("./pages/Report").then((m) => ({ default: m.Report })));
import { NotFound } from "./pages/NotFound";

/** A lazily loaded page inside the shell: the sidebar stays put while the page loads. */
const L = ({ label, children }: { label: string; children: ReactNode }) => <Suspense fallback={<FullPageLoading label={label} />}>{children}</Suspense>;
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
        <Route path="/signin" element={<Suspense fallback={<FullPageLoading label="Loading…" />}><SignIn /></Suspense>} />
        <Route path="/student" element={<RequireRole role="student"><Shell /></RequireRole>}>
          <Route index element={<StudentHome />} />
          <Route path="courses" element={<L label="Loading your courses…"><StudentCourses /></L>} />
          <Route path="courses/:id/:tab?/:sub?" element={<L label="Opening the course…"><CoursePage /></L>} />
          <Route path="calendar" element={<L label="Opening your calendar…"><StudentCalendar /></L>} />
          <Route path="marks" element={<L label="Loading your marks…"><StudentMarks /></L>} />
          <Route path="assignments/:id" element={<L label="Opening the workspace…"><Workspace /></L>} />
          <Route path="assignments/:id/viva" element={<L label="Opening your viva…"><Viva /></L>} />
        </Route>
        <Route path="/teacher" element={<RequireRole role="teacher"><Shell /></RequireRole>}>
          <Route index element={<TeacherHome />} />
          <Route path="courses/:id/gradebook" element={<L label="Opening the gradebook…"><Gradebook /></L>} />
          <Route path="courses/:id/:tab?/:sub?" element={<L label="Opening the course…"><CoursePage /></L>} />
          <Route path="assignments/new" element={<L label="Opening the builder…"><Builder /></L>} />
          <Route path="assignments/:id" element={<L label="Loading submissions…"><TeacherAssignment /></L>} />
          <Route path="submissions/:id" element={<L label="Loading the report…"><Report /></L>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
