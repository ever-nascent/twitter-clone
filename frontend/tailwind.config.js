/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1DA1F2',    // Twitter blue
        dark: '#15202B',       // Twitter dark background
        darkHover: '#1C2732',  // Hover state
        lightGray: '#657786',  // Muted text
      },
    },
  },
  plugins: [],
}
