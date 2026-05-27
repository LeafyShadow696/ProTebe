/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        display: [
          '"Helvetica Neue"',
          'Helvetica',
          '-apple-system',
          'BlinkMacSystemFont',
          'Arial',
          'sans-serif',
        ],
        sans: [
          '"Helvetica Neue"',
          'Helvetica',
          '-apple-system',
          'BlinkMacSystemFont',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        ink: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          400: '#A19D9E',
          800: '#27272A',
          900: '#18181B',
          950: '#09090B',
        },
        rose: {
          accent: '#E5B3BB',
          deep: '#3A1C28',
        },
        glass: 'rgba(255, 255, 255, 0.06)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        breathe: 'breathe 10s ease-in-out infinite',
        shimmer: 'shimmer 3s ease-in-out infinite',
        float: 'float 8s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: 0.7, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
