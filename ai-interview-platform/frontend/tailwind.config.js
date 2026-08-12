/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F3EFE6",
        ink: "#1C1A17",
        rust: "#B5502F",
        moss: "#5C6B4E",
        slate: "#4A5560",
        line: "#D8D0BE"
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
        body: ["'Inter'", "sans-serif"]
      }
    }
  },
  plugins: []
};
