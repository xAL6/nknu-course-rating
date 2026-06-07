"use client";

import { motion, useReducedMotion } from "motion/react";

/** Silky per-route transition (App Router re-mounts template on navigation). */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  // opacity + transform only — GPU-composited, no layout/filter cost (stays silky).
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}
