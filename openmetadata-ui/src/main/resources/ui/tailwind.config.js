/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const defaultTheme = require('tailwindcss/defaultTheme');

// Primary colors for text and controls
const primary = '#7147E8';
const primaryII = '#8D6AF1';
const primaryHover = '#5523E0';
const primaryActive = '#450DE2';
const primaryHoverLite = '#DBD1F9';
const secondary = '#B02AAC';
const secondaryBG = '#B02AAC40';

// state colors
const ideal = '#C4C4C4';
const idealBG = '#C4C4C440';
const success = '#008376';
const successBG = '#00837640';
const error = '#E54937';
const error_70 = '#E5493770';
const errorBG = '#E5493740';
const info = '#1890FF';
const infoBG = '#1890FF40';
const warning = '#FFC34E';
const warningBG = '#FFC34E40';
const feedBorder = '#D1E9FF';

// status colors

const statusSuccess = '#07A35A';
const statusFailed = '#E54937';
const statusRunning = '#276EF1';
const statusQueued = '#777777';

// Background colors
const bodyBG = '#F8F9FA';
const bodyHoverBG = '#F5F6F8';
const tagBG = '#EEEAF8';
const badgeBG = '#D5D8DC';
const primaryBG = '#7147E840'; // 'rgba(113, 71, 232, 0.25)';
const backdropBG = '#302E36';
const lightBG = '#F4F0FD';

// Borders and Separators
const mainBorder = '#DCE3EC';
const mainSeparator = '#DCE3EC';
const grayBorder = '#DDE3EA';
const liteGrayBorder = '#f1f4f7';
const liteGrayBorder60 = '#f1f4f760';

// Text color - Gray variants
const textBody = '#37352f';
const textMuted = '#6B7280';
const textDark = '#000000';
const textMutedLite = '#6B728026'; // 'rgba(107, 114, 128, 0.15)'

module.exports = {
  purge: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/styles/tailwind.css',
    './public/index.html',
  ],
  darkMode: false,
  prefix: 'tw-',
  theme: {
    screens: {
      sm: '576px',
      md: '768px',
      lg: '1280px',
      xl: '1440px',
      xxl: '2560px',
    },
    extend: {
      borderColor: {
        'orange-400': '#F9826C',
        main: mainBorder,
        text: textBody,
        hover: textBody,
        focus: primary,
        search: '#D5D6D9',
        feed: feedBorder,
      },
      boxShadow: {
        modal: '1px 1px 5px rgba(0, 0, 0, 0.2)',
        form: '2px 4px 10px rgba(0, 0, 0, 0.04)',
        box: '1px 1px 3px 0px rgba(0, 0, 0, 0.12)',
      },
      colors: {
        'grey-body': textBody,
        'grey-muted': textMuted,
        'grey-muted-lite': textMutedLite,
        'grey-dark': textDark,
        'grey-backdrop': backdropBG,
        'primary-lite': primaryBG,
        primary: primary,
        'primary-II': primaryII,
        'primary-hover': primaryHover,
        'primary-active': primaryActive,
        'primary-hover-lite': primaryHoverLite,
        'primary-lite': lightBG,
        secondary: secondary,
        'secondary-lite': secondaryBG,
        'body-main': bodyBG,
        'body-hover': bodyHoverBG,
        tag: tagBG,
        badge: badgeBG,
        // Snackbar statuses begin
        success: success,
        'success-lite': successBG,
        error: error,
        'error-lite': errorBG,
        'error-70': error_70,
        warning: warning,
        'warning-lite': warningBG,
        info: info,
        'info-lite': infoBG,
        // Snackbar statuses end
        // Ingestion statuses begin
        'status-success': statusSuccess,
        'status-failed': statusFailed,
        'status-running': statusRunning,
        'status-queued': statusQueued,
        // Ingestion statuses end
        // Webhook statuses begin
        disabled: ideal,
        active: success,
        failed: error,
        awaitingRetry: success,
        retryLimitReached: warning,
        'disabled-lite': idealBG,
        'active-lite': successBG,
        'failed-lite': errorBG,
        'awaitingRetry-lite': successBG,
        'retryLimitReached-lite': warningBG,
        // Webhook statuses end
        separator: mainSeparator,
        'border-lite': liteGrayBorder,
        'border-lite-60': liteGrayBorder60,
        'border-gray': grayBorder,
        'feed-background': '#F8FBFF',
        'feed-hover': '#EBF2F9',
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
      height: {
        100: '25rem',
        '70vh': '70vh',
        '80vh': '80vh',
      },
      width: {
        120: '30rem',
        'screen-sm': '576px',
        'screen-md': '768px',
        'screen-lg': '1280px',
        'screen-xl': '1440px',
        'screen-xxl': '2560px',
        'full-hd': '1080px',
        600: '600px',
        700: '700px',
      },
      minWidth: {
        badgeCount: '30px',
        64: '16rem',
      },
      maxWidth: {
        'full-hd': '1080px',
      },
      maxHeight: {
        32: '8rem',
        '80vh': '80vh',
        '90vh': '90vh',
      },
      minHeight: {
        12: '3rem',
        32: '8rem',
        168: '10.5rem',
        256: '16rem',
        tab: '24rem',
      },
      padding: {
        '5px': '5px',
      },
      zIndex: {
        9999: 9999,
        1: 1,
        9998: 9998,
        9997: 9997,
      },
    },
  },
  variants: {
    extend: {
      backgroundColor: ['checked'],
      borderStyle: ['hover'],
      borderWidth: ['hover'],
      display: ['group-hover'],
      opacity: ['disabled'],
    },
  },
  plugins: [require('@tailwindcss/custom-forms')],
};
