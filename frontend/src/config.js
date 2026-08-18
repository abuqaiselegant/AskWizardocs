// Environment configuration for the Vite build.

// No env file is committed, so a fresh clone has none and every VITE_ variable
// comes back undefined. Left unchecked that is silent: API_BASE becomes the
// string "undefined", fetch("undefined/ask/stream") fails as a relative URL, and
// the UI reports "Cannot reach the API" — which sends you inspecting the backend
// instead of the variable that was never set. Fail at load with the actual cause.
export function requireEnv(name, value) {
  if (!value) {
    throw new Error(
      `Missing ${name}. Create frontend/.env.development — README.md lists the ` +
      `three VITE_ variables it needs. In production these are Vercel env vars.`
    );
  }
  return value;
}

// API base URL. http://localhost:8000 in dev, the API domain in production.
export const API_BASE = requireEnv("VITE_API_BASE", import.meta.env.VITE_API_BASE);
