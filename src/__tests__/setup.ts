// jsdom does not implement ResizeObserver. Assign a no-op polyfill via a class
// expression (not a named `class ResizeObserver` — that collides with the
// built-in lib.dom global declaration, TS2300).
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as typeof ResizeObserver;
