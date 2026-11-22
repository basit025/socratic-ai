import { useEffect } from "react";
import { Link } from "react-router";
import { Compass } from "lucide-react";
import { Logo } from "../components/Logo";
import { EmptyState } from "../components/ui";

export function NotFound() {
  useEffect(() => {
    document.title = "Page not found · Socratic AI";
  }, []);
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" aria-label="Socratic AI home">
        <Logo />
      </Link>
      <div className="mt-10">
        <EmptyState
          icon={Compass}
          title="This page doesn't exist"
          body="The link may be old or mistyped."
          action={
            <Link to="/" className="inline-flex min-h-11 items-center rounded-lg bg-action px-4 font-semibold text-white hover:bg-action-hover">
              Go to the start page
            </Link>
          }
        />
      </div>
    </div>
  );
}
