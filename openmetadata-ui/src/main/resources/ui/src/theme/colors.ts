/*
 *  Copyright 2025 Collate.
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
const colors = {
  white: 'rgb(255 255 255)',
  brand: {
    25: 'rgb(252 250 255)',
    50: 'rgb(249 245 255)',
    100: 'rgb(244 235 255)',
    200: 'rgb(233 215 254)',
    300: 'rgb(214 187 251)',
    400: 'rgb(182 146 246)',
    500: 'rgb(158 119 237)',
    600: 'rgb(127 86 217)',
    700: 'rgb(105 65 198)',
    800: 'rgb(83 56 158)',
    900: 'rgb(66 48 125)',
    950: 'rgb(44 28 95)',
  },
  gray: {
    25: 'rgb(253 253 253)',
    50: 'rgb(250 250 250)',
    100: 'rgb(245 245 245)',
    200: 'rgb(233 234 235)',
    300: 'rgb(213 215 218)',
    400: 'rgb(164 167 174)',
    500: 'rgb(113 118 128)',
    600: 'rgb(83 88 98)',
    650: 'rgb(64 64 64)', // #404040
    700: 'rgb(65 70 81)',
    800: 'rgb(37 43 55)',
    900: 'rgb(24 29 39)',
    950: 'rgb(10 13 18)',
  },
  blueGray: {
    25: 'rgb(239 248 255)', // #eff8ff - pagination active background
    50: 'rgb(239 244 250)', // #EFF4FA - chip background
    200: 'rgb(210 219 235)', // #D2DBEB - chip border
  },
  error: {
    25: 'rgb(255 251 250)',
    50: 'rgb(254 243 242)',
    100: 'rgb(254 228 226)',
    200: 'rgb(254 205 202)',
    300: 'rgb(253 162 155)',
    400: 'rgb(249 112 102)',
    500: 'rgb(240 68 56)',
    600: 'rgb(217 45 32)',
    700: 'rgb(180 35 24)',
    800: 'rgb(145 32 24)',
    900: 'rgb(122 39 26)',
    950: 'rgb(85 22 12)',
  },
  warning: {
    25: 'rgb(255 252 245)',
    50: 'rgb(255 250 235)',
    100: 'rgb(254 240 199)',
    200: 'rgb(254 223 137)',
    300: 'rgb(254 200 75)',
    400: 'rgb(253 176 34)',
    500: 'rgb(247 144 9)',
    600: 'rgb(220 104 3)',
    700: 'rgb(181 71 8)',
    800: 'rgb(147 55 13)',
    900: 'rgb(122 46 14)',
    950: 'rgb(78 29 9)',
  },
  success: {
    25: 'rgb(246 254 249)',
    50: 'rgb(236 253 243)',
    100: 'rgb(220 250 230)',
    200: 'rgb(171 239 198)',
    300: 'rgb(117 224 167)',
    400: 'rgb(71 205 137)',
    500: 'rgb(23 178 106)',
    600: 'rgb(7 148 85)',
    700: 'rgb(6 118 71)',
    800: 'rgb(8 93 58)',
    900: 'rgb(7 77 49)',
    950: 'rgb(5 51 33)',
  },
};

const shadows = {
  xs: '0px 1px 2px rgba(10, 13, 18, 0.05)',
  sm: '0px 1px 3px rgba(10, 13, 18, 0.1), 0px 1px 2px -1px rgba(10, 13, 18, 0.1)',
  md: '0px 4px 6px -1px rgba(10, 13, 18, 0.1), 0px 2px 4px -2px rgba(10, 13, 18, 0.06)',
  lg: '0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03), 0px 2px 2px -1px rgba(10, 13, 18, 0.04)',
  xl: '0px 20px 24px -4px rgba(10, 13, 18, 0.08), 0px 8px 8px -4px rgba(10, 13, 18, 0.03), 0px 3px 3px -1.5px rgba(10, 13, 18, 0.04)',
  '2xl':
    '0px 24px 48px -12px rgba(10, 13, 18, 0.18), 0px 4px 4px -2px rgba(10, 13, 18, 0.04)',
  skeumorphic:
    '0px 0px 0px 1px rgba(10, 13, 18, 0.18) inset, 0px -2px 0px 0px rgba(10, 13, 18, 0.05) inset',
};

const buttonConstants = {
  shadows: {
    XS: '0px 1px 2px rgba(10, 13, 18, 0.05)',
    XS_SKEUMORPHIC: (ringColor: string) =>
      `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${ringColor} inset, 0px -2px 0px 0px rgba(10, 13, 18, 0.05) inset`,
    XS_DISABLED: (ringColor: string) =>
      `0px 1px 2px rgba(10, 13, 18, 0.05), 0px 0px 0px 1px ${ringColor} inset`,
  },
  iconStyles: {
    createIconColors: () => ({
      '& .MuiButton-startIcon svg, & .MuiButton-endIcon svg': {
        color: 'currentColor',
        strokeWidth: '1.5',
      },
    }),
    sizeMargins: {
      small: {
        '& .MuiButton-startIcon': {
          marginLeft: '-4px',
          marginRight: '4px',
        },
        '& .MuiButton-endIcon': {
          marginLeft: '4px',
          marginRight: '-4px',
        },
      },
      medium: {
        '& .MuiButton-startIcon': {
          marginLeft: '-4px',
          marginRight: '4px',
        },
        '& .MuiButton-endIcon': {
          marginLeft: '4px',
          marginRight: '-4px',
        },
      },
      large: {
        '& .MuiButton-startIcon': {
          marginLeft: '-4px',
          marginRight: '6px',
        },
        '& .MuiButton-endIcon': {
          marginLeft: '6px',
          marginRight: '-4px',
        },
      },
    },
  },
  pseudoElements: {
    whiteBorder: {
      '&::before': {
        content: '""',
        position: 'absolute',
        inset: '1px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '7px',
        pointerEvents: 'none',
        maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, black 0%, transparent 100%)',
      },
      '&.Mui-disabled::before': {
        display: 'none',
      },
    },
  },
  iconButton: {
    baseSvgStyles: {
      pointerEvents: 'none',
      flexShrink: 0,
      color: 'currentColor',
      transition: 'inherit',
      strokeWidth: '1.5',
    },
    sizeMappings: {
      small: { padding: '6px', iconSize: '16px' },
      medium: { padding: '6px', iconSize: '20px' },
      large: { padding: '8px', iconSize: '24px' },
    },
    colorVariants: {
      secondary: {
        backgroundColor: colors.white,
        color: colors.gray[400],
        boxShadow: (shadows: any) => shadows.XS_SKEUMORPHIC(colors.gray[300]),
        hover: {
          backgroundColor: colors.gray[50],
          color: colors.gray[500],
        },
        disabled: {
          backgroundColor: colors.white,
          color: colors.gray[300],
          boxShadow: (shadows: any) => shadows.XS_DISABLED(colors.gray[200]),
        },
      },
      tertiary: {
        backgroundColor: 'transparent',
        color: colors.gray[400],
        hover: {
          backgroundColor: colors.gray[50],
          color: colors.gray[500],
        },
        disabled: {
          backgroundColor: 'transparent',
          color: colors.gray[300],
        },
      },
    },
  },
};

const createIconButtonSizeVariant = (size: 'small' | 'medium' | 'large') => {
  const config = buttonConstants.iconButton.sizeMappings[size];

  return {
    padding: config.padding,
    '& svg': {
      width: config.iconSize,
      height: config.iconSize,
      ...buttonConstants.iconButton.baseSvgStyles,
    },
  };
};

const createIconButtonColorVariant = (variant: 'secondary' | 'tertiary') => {
  const config = buttonConstants.iconButton.colorVariants[variant];

  return {
    backgroundColor: config.backgroundColor,
    color: config.color,
    ...(variant === 'secondary' && {
      boxShadow: config.boxShadow(buttonConstants.shadows),
    }),
    ...(variant === 'tertiary' && { boxShadow: 'none' }),
    '&:hover': {
      backgroundColor: config.hover.backgroundColor,
      color: config.hover.color,
    },
    '&.Mui-disabled': {
      cursor: 'not-allowed',
      backgroundColor: config.disabled.backgroundColor,
      color: config.disabled.color,
      ...(variant === 'secondary' && {
        boxShadow: config.disabled.boxShadow(buttonConstants.shadows),
      }),
      ...(variant === 'tertiary' && { boxShadow: 'none' }),
    },
  };
};

export {
  colors,
  shadows,
  buttonConstants,
  createIconButtonSizeVariant,
  createIconButtonColorVariant,
};
