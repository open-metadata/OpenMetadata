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
/**
 * Icon Utility Functions
 *
 * Generic utilities for styling icons with rings, borders, and effects
 * that can be reused across different components
 */

export const createIconWithRings = (
  options: {
    iconSize?: string;
    marginTop?: string;
    innerRingOpacity?: number;
    outerRingOpacity?: number;
    innerRingOffset?: string;
    outerRingOffset?: string;
    borderWidth?: string;
    innerBorderWidth?: string;
    outerBorderWidth?: string;
  } = {}
) => {
  const {
    iconSize = '22px',
    marginTop = '7px',
    innerRingOpacity = 0.4,
    outerRingOpacity = 0.14,
    innerRingOffset = '3px',
    outerRingOffset = '8px',
    borderWidth = '2px',
    innerBorderWidth,
    outerBorderWidth,
  } = options;

  return {
    position: 'relative',
    padding: 0,
    marginTop,
    width: iconSize,
    height: iconSize,
    '&::before': {
      content: '""',
      position: 'absolute',
      top: `-${innerRingOffset}`,
      left: `-${innerRingOffset}`,
      right: `-${innerRingOffset}`,
      bottom: `-${innerRingOffset}`,
      borderRadius: '50%',
      border: `${innerBorderWidth || borderWidth} solid`,
      borderColor: 'currentColor',
      opacity: innerRingOpacity,
      pointerEvents: 'none',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      top: `-${outerRingOffset}`,
      left: `-${outerRingOffset}`,
      right: `-${outerRingOffset}`,
      bottom: `-${outerRingOffset}`,
      borderRadius: '50%',
      border: `${outerBorderWidth || borderWidth} solid`,
      borderColor: 'currentColor',
      opacity: outerRingOpacity,
      pointerEvents: 'none',
    },
  };
};

export const iconRingVariants = {
  alert: createIconWithRings({
    iconSize: '22px',
    marginTop: '7px',
    innerRingOpacity: 0.4,
    outerRingOpacity: 0.14,
    innerRingOffset: '3px',
    outerRingOffset: '8px',
  }),

  notification: createIconWithRings({
    iconSize: '20px',
    marginTop: '0px',
    innerRingOpacity: 0.12,
    outerRingOpacity: 0.06,
    innerRingOffset: '-12px',
    outerRingOffset: '-4px',
    innerBorderWidth: '16px',
    outerBorderWidth: '22px',
  }),

  status: createIconWithRings({
    iconSize: '16px',
    marginTop: '2px',
    innerRingOpacity: 0.3,
    outerRingOpacity: 0.1,
    innerRingOffset: '2px',
    outerRingOffset: '6px',
  }),
} as const;

export const createAlertSx = (iconColor?: string) => {
  const baseAlert = {
    bgcolor: 'background.paper',
    borderColor: 'grey.300',
    color: 'text.primary',
    boxShadow: 1,
    py: 2,
    gap: 0.75,
    '& .MuiAlert-icon': iconColor
      ? {
          ...iconRingVariants.alert,
          color: iconColor,
        }
      : iconRingVariants.alert,
  };

  return baseAlert;
};

export default {
  createIconWithRings,
  iconRingVariants,
  createAlertSx,
};
