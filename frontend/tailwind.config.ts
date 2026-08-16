import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6fe",
          200: "#bfd2fe",
          300: "#93b5fd",
          400: "#608df9",
          500: "#3b68f3",
          600: "#2547e8",
          700: "#1e37d4",
          800: "#1f30ac",
          900: "#1f2e88",
        },
      },
    },
  },
  plugins: [],
};

export default config;
