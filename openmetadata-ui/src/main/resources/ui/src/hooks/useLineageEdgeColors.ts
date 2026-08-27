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
import { useMemo } from 'react';
import { useTheme } from '../context/UntitledUIThemeProvider/theme-provider';
import { LineageEdgeColors } from '../utils/EdgeStyleUtils';

/**
 * Resolves the literal colors used to paint lineage edges on the canvas.
 *
 * These values are intentionally the same in both light and dark mode, since
 * dark mode is handled via CSS variables rather than a recomputed palette.
 */
export const useLineageEdgeColors = (): LineageEdgeColors => {
  const { brandColors } = useTheme();

  return useMemo(() => {
    return {
      primary: brandColors?.primaryColor ?? '#1570ef',
      columnHighlight: '#444ce7', // It's a replacement to indigo-600 not a theme color
      dqHighlight: brandColors?.errorColor ?? '#d92d20',
    };
  }, [brandColors]);
};
