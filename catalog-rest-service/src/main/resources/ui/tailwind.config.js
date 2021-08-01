const defaultTheme = require('tailwindcss/defaultTheme');

const bluePrimaryDark = '#0366D6';
const bluePrimaryLight = '#D4E2FC';

module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false,
  prefix: 'tw-',
  theme: {
    screens: {
      sm: '480px',
      md: '768px',
      lg: '976px',
      xl: '1440px',
    },
    extend: {
      backgroundColor: {
        success: '#28a745',
        'primary-dark': bluePrimaryDark,
        'primary-light': bluePrimaryLight,
        'primary-tag': '#EECEDD',
        'secondary-tag': '#F2E8D0',
        search: '#F4F6FA',
      },
      borderColor: {
        'orange-400': '#F9826C',
        success: '#28a745',
        'primary-dark': bluePrimaryDark,
        'primary-light': bluePrimaryLight,
        search: '#D5D6D9',
      },
      textColor: {
        success: '#28a745',
        'grey-body': '#37352f',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        h1: '2.5rem',
        h2: '2rem',
        h3: '1.75rem',
        h4: '1.5rem',
        h5: '1.25rem',
        h6: '14px',
        body: '14px',
      },
      maxHeight: {
        32: '8rem',
      },
      minHeight: {
        32: '8rem',
      },
      padding: {
        '5px': '5px',
      },
      zIndex: {
        9999: 9999,
      },
    },
  },
  variants: {
    extend: {
      borderStyle: ['hover'],
      borderWidth: ['hover'],
      display: ['group-hover'],
    },
  },
  plugins: [],
};
