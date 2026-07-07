import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050507",
        panel: "#111116",
        ember: "#ff355d",
        plasma: "#8b5cf6",
        signal: "#45f0a0"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Georgia", "Times New Roman", "serif"],
        playfair: ["Playfair Display", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      boxShadow: {
        glow: "0 0 70px rgba(255, 53, 93, 0.22)",
        signal: "0 0 70px rgba(69, 240, 160, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
