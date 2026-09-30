import type { Config } from "tailwindcss";

// Design direction: 3D dark-mode glassmorphism — frosted glass panels,
// indigo glow accents, raised bevels, and depth layering over a deep
// slate/indigo gradient background. Original civic palette tokens are
// preserved for backward-compatibility.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ── Original civic palette (preserved) ── */
        paper: "#FAF8F3",
        ink: "#1B2430",
        "ink-soft": "#4A5568",
        seal: "#2F6F62",
        "seal-dark": "#20504A",
        amber: "#B8863B",
        brick: "#A8433A",
        line: "#E4DED0",

        /* ── Glassmorphism dark palette ── */
        "glass-bg": "rgba(15, 23, 42, 0.75)",
        "glass-border": "rgba(99, 102, 241, 0.12)",
        "glass-highlight": "rgba(255, 255, 255, 0.05)",
        "surface-elevated": "rgba(30, 41, 59, 0.80)",
        "surface-sunken": "rgba(2, 6, 23, 0.50)",
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        "glass-sm": "0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)",
        "glass-md": "0 4px 16px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(0, 0, 0, 0.2)",
        "glass-lg": "0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.25)",
        "glass-inset": "inset 0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(0, 0, 0, 0.3)",
        "glow-indigo": "0 0 20px rgba(99, 102, 241, 0.3), 0 0 8px rgba(99, 102, 241, 0.15)",
        "glow-indigo-lg": "0 0 30px rgba(99, 102, 241, 0.4), 0 0 12px rgba(99, 102, 241, 0.2)",
        "bevel-up": "0 1px 0 rgba(255, 255, 255, 0.07) inset, 0 -1px 0 rgba(0, 0, 0, 0.2) inset, 0 4px 12px rgba(0, 0, 0, 0.3)",
        "bevel-active": "0 1px 0 rgba(99, 102, 241, 0.3) inset, 0 -1px 0 rgba(0, 0, 0, 0.3) inset, 0 0 20px rgba(99, 102, 241, 0.15), 0 4px 16px rgba(99, 102, 241, 0.2)",
      },
      backdropBlur: {
        glass: "16px",
      },
      animation: {
        "float-3d": "float-3d 6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
