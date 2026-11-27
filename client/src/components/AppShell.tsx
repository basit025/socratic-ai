import type { ReactNode } from "react";
import { Page } from "./Shell";

/** Pages render inside the persistent Shell (sidebar + top bar); this is just the page body. */
export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <Page wide={wide}>{children}</Page>;
}
