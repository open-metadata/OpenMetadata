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
const errorBG = '#E5493740';
const info = '#1890FF';
const infoBG = '#1890FF40';
const warning = '#FFC34E';
const warningBG = '#FFC34E40';

// status colors

const statusSuccess = '#07A35A';
const statusFailed = '#E54937';
const statusRunning = '#276EF1';
const statusQueued = '#777777';

// Background colors
const bodyBG = '#F8F9FA';
const bodyHoverBG = '#F5F6F8';
const tagBG = '#EEEAF8';
const badgeBG = '#E3E5E8';
const primaryBG = '#7147E840'; // 'rgba(113, 71, 232, 0.25)';
const backdropBG = '#302E36';

// Borders and Separators
const mainBorder = '#DCE3EC';
const mainSeparator = '#DCE3EC';

// Text color - Gray variants
const textBody = '#37352f';
const textMuted = '#6B7280';
const textDark = '#000000';
const textMutedLite = '#6B728026'; // 'rgba(107, 114, 128, 0.15)'

module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false,
  prefix: 'tw-',
  theme: {
    screens: {
      sm: '576px',
      md: '768px',
      lg: '992px',
      xl: '1200px',
      xxl: '1440px',
    },
    extend: {
      borderColor: {
        'orange-400': '#F9826C',
        main: mainBorder,
        text: textBody,
        hover: textBody,
        focus: primary,
        search: '#D5D6D9',
      },
      boxShadow: {
        modal: '1px 1px 5px rgba(0, 0, 0, 0.2)',
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
        notStarted: ideal,
        started: success,
        failed: error,
        awaitingRetry: info,
        retryLimitReached: warning,
        'notStarted-lite': idealBG,
        'started-lite': successBG,
        'failed-lite': errorBG,
        'awaitingRetry-lite': infoBG,
        'retryLimitReached-lite': warningBG,
        // Webhook statuses end
        separator: mainSeparator,
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
      },
      width: {
        120: '30rem',
        'screen-sm': '576px',
        'screen-md': '768px',
        'screen-lg': '992px',
        'screen-xl': '1200px',
        'screen-xxl': '1440px',
        'full-hd': '1080px',
        600: '600px',
      },
      minWidth: {
        badgeCount: '30px',
      },
      maxWidth: {
        'full-hd': '1080px',
      },
      maxHeight: {
        32: '8rem',
        '90vh': '90vh',
      },
      minHeight: {
        12: '3rem',
        32: '8rem',
        168: '10.5rem',
        tab: '24rem',
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
      backgroundColor: ['checked'],
      borderStyle: ['hover'],
      borderWidth: ['hover'],
      display: ['group-hover'],
      opacity: ['disabled'],
    },
  },
  plugins: [require('@tailwindcss/custom-forms')],
};
