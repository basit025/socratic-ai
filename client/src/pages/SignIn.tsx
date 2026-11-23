/**
 * Sign in or create an account (FR-01) for real classes. The demo needs neither.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, GraduationCap, Presentation } from "lucide-react";
import { Logo } from "../components/Logo";
import { Button, Card, Segmented, cx } from "../components/ui";
import { api, ApiError } from "../lib/api";

const field = "min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[15px] focus:border-action focus:outline-none";

export function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${mode === "signin" ? "Sign in" : "Create an account"} · Socratic AI`;
  }, [mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ home: string }>(mode === "signin" ? "/auth/login" : "/auth/signup", {
        body: mode === "signin" ? { email, password } : { role, name, email, password },
      });
      navigate(r.home);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--color-action-soft),_transparent_60%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link to="/" aria-label="Socratic AI home"><Logo /></Link>
        <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Try the demo instead</Link>
      </header>
      <main className="mx-auto max-w-md px-4 pb-16 pt-6">
        <h1 className="text-center text-3xl font-bold tracking-tight">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-center text-ink-2">For real classes. To look around first, use the demo: no account needed.</p>
        <div className="mt-6 flex justify-center">
          <Segmented label="Sign in or create an account" value={mode} onChange={(v) => { setMode(v); setError(null); }} options={[{ value: "signin", label: "Sign in" }, { value: "signup", label: "Create account" }]} />
        </div>
        <Card className="mt-5 p-6">
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">I am a…</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: "student", label: "Student", icon: GraduationCap },
                        { value: "teacher", label: "Teacher", icon: Presentation },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={role === o.value}
                        onClick={() => setRole(o.value)}
                        className={cx("flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 font-semibold", role === o.value ? "border-action bg-action-soft text-action" : "border-line text-ink-2 hover:border-action-line")}
                      >
                        <o.icon className="size-5" aria-hidden /> {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Full name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={80} className={field} />
                </label>
              </>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={mode === "signup" ? 8 : 1} className={field} />
              {mode === "signup" && <span className="mt-1 block text-xs text-ink-3">At least 8 characters.</span>}
            </label>
            {error && <p role="alert" className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === "signin" ? "Sign in" : role === "teacher" ? "Create teacher account" : "Create student account"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-ink-3">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }} className="font-semibold text-action hover:underline">
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </main>
    </div>
  );
}
