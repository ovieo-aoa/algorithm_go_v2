/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      keyframes: {
        floatCode: {
          '0%': { transform: 'translateY(0px)', opacity: '0.15' },
          '50%': { opacity: '0.35' },
          '100%': { transform: 'translateY(-40px)', opacity: '0.15' },
        }
      },
      animation: {
        'code-bg': 'floatCode 6s ease-in-out infinite alternate',
      }
    },
  },
  plugins: [],
}