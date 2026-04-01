import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17312b",
        mist: "#f3f6f4",
        field: "#d9ead3",
        canopy: "#3f7d58",
        river: "#4d8bb7",
        alert: "#bf5b04"
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Georgia", "serif"]
      }
    }
  },
  plugins: []
};

export default config;

