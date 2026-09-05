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

import { reduceColorOpacity } from '../../../../utils/ColorUtils';

/**
 * Derives the three inline-style color values used across all tag components
 * from a single hex color.
 *
 * Opacities:
 *   bg        →  5%   (very light tint for chip background)
 *   border    → 32%   (readable border against the tinted bg)
 *   closeIcon → 60%   (muted relative to text, clearly distinct from bg)
 *   text      → raw hex (full opacity for accessible contrast)
 */
export const computeTagColors = (color: string) => ({
  bg: reduceColorOpacity(color, 0.05),
  border: reduceColorOpacity(color, 0.32),
  closeIcon: reduceColorOpacity(color, 0.6),
  text: color,
});
