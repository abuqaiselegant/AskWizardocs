import { createRoot } from "react-dom/client";
import { App } from "./app.jsx";

createRoot(document.getElementById("root")).render(<App/>);

// Hide splash
setTimeout(() => {
  const s = document.getElementById("splash");
  if (s) { s.classList.add("hide"); setTimeout(() => s.remove(), 500); }
}, 400);
