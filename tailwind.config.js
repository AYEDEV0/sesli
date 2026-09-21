/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          bg: "#1e1f22",
          sidebar: "#2b2d31",
          card: "#313338",
          input: "#1e1f22",
          hover: "#35373c",
          active: "#404249",
          accent: "#5865f2",
          accentHover: "#4752c4",
          success: "#23a55a",
          danger: "#f23f43",
          text: "#f2f3f5",
          muted: "#949ba4",
        },
      },
    },
  },
  plugins: [],
};
