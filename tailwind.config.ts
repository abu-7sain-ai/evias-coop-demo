import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token("bg"), surface: token("surface"), "surface-2": token("surface-2"), border: token("border"),
        text: token("text"), "text-2": token("text-2"), accent: token("accent"), "accent-soft": token("accent-soft"),
        good: token("good"), warn: token("warn"), bad: token("bad"), info: token("info"),
      },
      fontFamily: { sans: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
