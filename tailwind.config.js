/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          rail: "#1e1f22",
          sidebar: "#2b2d31",
          main: "#313338",
          modifier: "#404249",
        },
        text: {
          primary: "#f2f3f5",
          muted: "#949ba4",
          link: "#00a8fc",
        },
        brand: {
          DEFAULT: "#5865f2",
          hover: "#4752c4",
        },
        status: {
          online: "#23a55a",
          offline: "#80848e",
          danger: "#f23f42",
        },
      },
      spacing: {
        rail: "72px",
        sidebar: "240px",
      },
    },
  },
  plugins: [],
};
