/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

const defaultTheme = require('tailwindcss/defaultTheme');

const bluePrimaryDark = '#0366D6';
const bluePrimaryLight = '#D4E2FC';

// Primary colors for text and controls
const primary = '#7147E8';
const primaryHover = '#5523E0';
const primaryActive = '#450DE2';
const primaryHoverLite = '#DBD1F9';

// state colors
const success = '#51C41A';
const error = '#FF4C3B';
const info = '#1890FF';
const warning = '#FFC34E';

// Background colors
const bodyBG = '#F9F8FD';
const bodyHoverBG = '#F5F3FC';
const tagBG = '#EEEAF8';

// Borders and Separators
const mainBorder = '#AFA8BA';
const mainSeparator = '#D9CEEE';

// Text color - Gray variants
const textBody = '#37352f';
const textMuted = '#6B7280';
const textDark = '#000000';

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
        body: bodyBG,
        'body-hover': bodyHoverBG,
        tag: tagBG,
        success: success,
        error: error,
        warning: warning,
        info: info,
        'primary-dark': bluePrimaryDark,
        'primary-light': bluePrimaryLight,
        primary: primary,
        'primary-hover': primaryHover,
        'primary-active': primaryActive,
        'primary-hover-lite': primaryHoverLite,
      },
      borderColor: {
        'orange-400': '#F9826C',
        main: mainBorder,
        separator: mainSeparator,
        hover: textBody,
        focus: primary,
        success: success,
        error: error,
        warning: warning,
        info: info,
        'primary-dark': bluePrimaryDark,
        'primary-light': bluePrimaryLight,
        search: '#D5D6D9',
        primary: primary,
        'primary-hover': primaryHover,
        'primary-active': primaryActive,
      },
      textColor: {
        success: success,
        error: error,
        warning: warning,
        info: info,
        'grey-body': textBody,
        'grey-muted': textMuted,
        'grey-dark': textDark,
        primary: primary,
        'primary-hover': primaryHover,
        'primary-active': primaryActive,
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
