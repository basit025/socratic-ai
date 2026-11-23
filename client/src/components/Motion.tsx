/** Motion is used only for feedback (something completed or appeared), never decoration. Respects reduced motion. */
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export function Appear({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

export function Pop({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span className={className} initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
      {children}
    </motion.span>
  );
}
