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
import { useTheme } from '../../context/UntitledUIThemeProvider/theme-provider';
import { resolveCssColor } from '../../utils/common/cssColor.utils';

const PROGRESS_COLOR = 'var(--om-color-brand-200, #B3D4F4)';

export const useDataInsightChartColors = () => {
  const { brandColors, theme } = useTheme();

  return useMemo(() => {
    // The progress bar needs a concrete value, so resolve it again after theme
    // classes or runtime brand variables change.
    void brandColors;
    void theme;

    return { progress: resolveCssColor(PROGRESS_COLOR, '#B3D4F4') };
  }, [brandColors, theme]);
};
