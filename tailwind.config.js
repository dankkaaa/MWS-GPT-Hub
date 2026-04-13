/** @type {import('tailwindcss').Config} */
export default {
  content: ["./frontend/src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#fbfcfe",
        panel: "#ffffff",
        sidebar: "#edf3ff",
        line: "#dbe6f4",
        ink: "#181a20",
        muted: "#6d7382",
        accent: {
          DEFAULT: "#3b94ff",
          dark: "#2d82e9",
          soft: "#eff6ff",
        },
      },
      boxShadow: {
        shell: "0 28px 80px -34px rgba(37, 64, 106, 0.18)",
        panel: "0 22px 50px -28px rgba(26, 43, 74, 0.18)",
        float: "0 16px 40px -30px rgba(31, 47, 79, 0.28)",
      },
      fontFamily: {
        sans: ['"Manrope"', '"Segoe UI"', "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
