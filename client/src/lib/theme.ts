/**
 * Light or dark theme for the signed-in platform. The choice is remembered per browser.
 * Dark mode only redefines the colour tokens in index.css (class "dark" on <html>), so every screen follows.
 * The public landing page stays light: the Shell applies the theme while it is mounted and removes it after.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "socratic.theme";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function writeTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private mode: the theme simply isn't remembered */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    return () => {
      root.classList.remove("dark");
      root.style.colorScheme = "";
    };
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      writeTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}

/** A remembered on/off preference (sidebar collapsed, panel width, …). */
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* not remembered in private mode */
  }
}
