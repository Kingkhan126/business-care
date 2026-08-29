import type { Config } from "tailwindcss";

// Design direction: a civic document-processing platform. Palette and
// signature element (the "stamp" motif on reference numbers and status
// badges) are drawn from the subject itself — official paperwork, seals,
// ink — rather than a generic SaaS dashboard look.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF8F3",
        ink: "#1B2430",
        "ink-soft": "#4A5568",
        seal: "#2F6F62",
        "seal-dark": "#20504A",
        amber: "#B8863B",
        brick: "#A8433A",
        line: "#E4DED0",
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
