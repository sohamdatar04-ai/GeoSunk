/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"]
      },
      colors: {
        ink: {
          950: "#080D16",
          900: "#0B1220",
          800: "#0F1626",
          700: "#131B2C",
          600: "#1A2438",
          500: "#243247",
          400: "#33455F"
        },
        mist: {
          400: "#5C6B84",
          300: "#8A96AC",
          200: "#B7C0D1",
          100: "#E8ECF3"
        },
        survey: {
          DEFAULT: "#2FB8AC",
          dim: "#1E7F77",
          bright: "#5FDCD1"
        },
        risk: {
          stable: "#3FA796",
          moderate: "#E0A63E",
          severe: "#C1452E",
          critical: "#8C2A1E"
        }
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 24px -12px rgba(0,0,0,0.55)"
      },
      backgroundImage: {
        contour:
          "radial-gradient(circle at 20% 20%, rgba(47,184,172,0.06), transparent 35%), radial-gradient(circle at 80% 60%, rgba(193,69,46,0.08), transparent 40%)"
      }
    }
  },
  plugins: []
};
