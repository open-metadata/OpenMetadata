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

export const buttonConstants = {
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
      secondary: (colors: any) => ({
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
      }),
      tertiary: (colors: any) => ({
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
      }),
    },
  },
};

export const createIconButtonSizeVariant = (
  size: 'small' | 'medium' | 'large'
) => {
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

export const createIconButtonColorVariant = (
  variant: 'secondary' | 'tertiary',
  colors: any
) => {
  const config = buttonConstants.iconButton.colorVariants[variant](colors);

  return {
    backgroundColor: config.backgroundColor,
    color: config.color,
    ...(variant === 'secondary' &&
      'boxShadow' in config && {
        boxShadow: (config as any).boxShadow(buttonConstants.shadows),
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
      ...(variant === 'secondary' &&
        'boxShadow' in config.disabled && {
          boxShadow: (config.disabled as any).boxShadow(
            buttonConstants.shadows
          ),
        }),
      ...(variant === 'tertiary' && { boxShadow: 'none' }),
    },
  };
};
