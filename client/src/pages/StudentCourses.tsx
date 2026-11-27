/** Every course the student is in, as cards, plus joining a new one with the teacher's code. */
import { useEffect } from "react";
import { BookOpen } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { CourseCard } from "../components/CourseCard";
import { JoinCourseCard } from "../components/CourseActions";
import { useStudentData } from "../components/Shell";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui";

export function StudentCourses() {
  const home = useStudentData();
  useEffect(() => {
    document.title = "My courses · Socratic AI";
  }, []);
  const term = home.status === "ready" ? home.data.courses.find((c) => c.term)?.term : null;
  return (
    <AppShell>
      <PageHeader title="My courses" subtitle={`${term ? `${term} · ` : ""}Open a course for its lectures, assignments, quizzes and marks.`} />
      {home.status === "loading" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52" />)}
        </div>
      )}
      {home.status === "error" && <ErrorState message={home.message} onRetry={home.reload} />}
      {home.status === "ready" && (
        <>
          {home.data.courses.length === 0 ? (
            <EmptyState icon={BookOpen} title="You're not in a course yet" body="Enter the join code your teacher gave you below, and the course appears here." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {home.data.courses.map((c) => <CourseCard key={c.id} c={c} />)}
            </div>
          )}
          <div id="join" className="mt-8 max-w-xl">
            <JoinCourseCard onJoined={home.reload} />
          </div>
        </>
      )}
    </AppShell>
  );
}
