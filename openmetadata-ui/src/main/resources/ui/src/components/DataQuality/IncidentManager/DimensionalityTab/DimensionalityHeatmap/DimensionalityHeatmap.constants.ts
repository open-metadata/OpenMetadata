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

import { TooltipProps } from '@mui/material';

/**
 * Heatmap layout and behavior constants
 * These values are tuned for optimal visualization of daily time-series data
 */
export const HEATMAP_CONSTANTS = {
  /** Width of the dimension label column - sized to prevent truncation of typical dimension names */
  DIMENSION_LABEL_WIDTH: 150,
  DIMENSION_LABEL_WIDTH_PX: '150px',

  /** Width of each date cell - optimized for daily data visibility (48px total with gap) */
  CELL_WIDTH: 44,
  CELL_WIDTH_PX: '44px',

  /** Visual spacing between cells for clear separation */
  CELL_GAP: 4,

  /** Horizontal scroll distance when clicking scroll indicator (~6 days worth of cells) */
  SCROLL_STEP: 300,

  /** Debounce delay in ms for scroll position checks to improve performance */
  SCROLL_CHECK_DELAY: 100,

  /** Minimum scroll position (in px) to hide the scroll indicator */
  SCROLL_THRESHOLD: 5,

  /** Right padding to accommodate the scroll indicator overlay */
  CONTAINER_PADDING_RIGHT: 60,
} as const;

/**
 * Tooltip styling constants
 * Using consistent spacing and typography for data quality metrics display
 */
export const TOOLTIP_STYLES = {
  /** Padding around tooltip content */
  CARD_PADDING: '10px',

  /** Spacing around divider line (MUI spacing units) */
  DIVIDER_MARGIN: 2,

  /** Vertical spacing between tooltip rows (MUI spacing units) */
  STACK_SPACING: 1,

  /** Font size for tooltip header (date) */
  HEADER_FONT_SIZE: 13,

  /** Font size for tooltip content (metrics) */
  CONTENT_FONT_SIZE: 12,
} as const;

/**
 * Tooltip popper configuration for heatmap cells
 * Optimized for viewport boundaries and responsive positioning
 */
export const HEATMAP_TOOLTIP_SLOT_PROPS: TooltipProps['slotProps'] = {
  popper: {
    disablePortal: false,
    popperOptions: {
      strategy: 'fixed',
    },
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, 8],
        },
      },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          boundary: 'viewport',
          padding: 16,
          altAxis: true,
        },
      },
      {
        name: 'flip',
        enabled: true,
        options: {
          fallbackPlacements: [
            'bottom',
            'left',
            'right',
            'top-start',
            'bottom-start',
          ],
        },
      },
    ],
  },
  tooltip: {
    sx: {
      backgroundColor: 'transparent',
      padding: 0,
      boxShadow: 'none',
      maxWidth: 'none',
    },
  },
};
