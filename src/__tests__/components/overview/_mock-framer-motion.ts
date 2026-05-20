/**
 * Shared `framer-motion` mock for overview component tests.
 *
 * Usage (inside a test file):
 *   vi.mock("framer-motion", () => import("./_mock-framer-motion"));
 *
 * `vi.mock` is hoisted by Vitest, so the factory runs before any other imports.
 * Dynamic `import()` inside the factory is supported by Vitest and returns the
 * full module-shape object exported here.
 */
import * as React from "react";

type MotionProps = React.HTMLAttributes<HTMLElement> & {
  whileTap?: unknown;
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
};

export const motion = {
  div: ({ children, whileTap: _w, animate: _a, exit: _e, initial: _i, transition: _t, ...props }: MotionProps) =>
    React.createElement("div", props, children),
  span: ({ children, whileTap: _w, animate: _a, exit: _e, initial: _i, transition: _t, ...props }: MotionProps) =>
    React.createElement("span", props, children),
};

export const AnimatePresence = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const useReducedMotion = () => false;

export const animate = (
  _from: number,
  to: number,
  opts: { onUpdate?: (v: number) => void }
) => {
  opts.onUpdate?.(to);
  return { stop: () => {} };
};

export default {
  motion,
  AnimatePresence,
  useReducedMotion,
  animate,
};
