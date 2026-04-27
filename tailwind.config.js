/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'gold':      '#c9a84c',
        'gold-light':'#e8c96a',
        'gold-dim':  '#8c7235',
        'pharaoh-bg':'#0f0a04',
        'sand':      '#f5e6c8',
        'sand-dim':  '#c8b99a',
        'dark-card': '#1c1408',
        'dark-border':'#3a2e1a',
      },
      fontFamily: {
        display: ['"Cinzel"', 'serif'],
        body:    ['"Inter"', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #c9a84c 0%, #e8c96a 50%, #c9a84c 100%)',
        'dark-gradient': 'linear-gradient(180deg, #1c1408 0%, #0f0a04 100%)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-gold': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' },         '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
