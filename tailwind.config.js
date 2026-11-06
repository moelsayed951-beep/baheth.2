/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        academic: {
          green: { DEFAULT: '#0F4C3A', hover: '#0A3427', light: '#186A52' },
          // gold.dark أغمق قليلاً لتحسين التباين (Contrast) للنصوص على الخلفية الفاتحة
          gold: { DEFAULT: '#D4AF37', light: '#F3E5AB', dark: '#7A6419' },
          bgLight: '#FAFAF9',
          bgDark: '#0C0A09'
        }
      },
      fontFamily: {
        tajawal: ['Tajawal', 'system-ui', 'sans-serif'],
        plex: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
