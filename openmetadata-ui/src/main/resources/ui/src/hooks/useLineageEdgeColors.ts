/*
 *  Copyright 2026 Collate.
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
import {
  defaultColors,
  generateAllMuiPalettes,
} from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_THEME } from '../constants/Appearance.constants';
import { LineageEdgeColors } from '../utils/EdgeStyleUtils';
import { useApplicationStore } from './useApplicationStore';

/**
 * Resolves the literal colors used to paint lineage edges on the canvas.
 *
 * Mirrors the palette computation in `createMuiTheme` so the canvas keeps the
 * exact same colors it had while reading them from the MUI theme, but without
 * depending on MUI. The MUI theme is not dark-mode aware (dark mode is handled
 * via CSS variables), so these values are intentionally the same in both modes.
 */
export const useLineageEdgeColors = (): LineageEdgeColors => {
  const { customTheme } = useApplicationStore(
    useShallow((state) => ({
      customTheme: state.applicationConfig?.customTheme,
    }))
  );

  return useMemo(() => {
    const dynamicPalettes = customTheme
      ? generateAllMuiPalettes(customTheme, defaultColors, DEFAULT_THEME)
      : null;

    const themeColors = {
      ...defaultColors,
      ...(dynamicPalettes && {
        brand: dynamicPalettes.brand,
        error: dynamicPalettes.error,
      }),
    };

    return {
      primary: themeColors.brand[600],
      columnHighlight: themeColors.indigo[600],
      dqHighlight: themeColors.error[600],
    };
  }, [customTheme]);
};
