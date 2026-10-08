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
import { CSSProperties } from 'react';

// Item padding preserves 24-column ratios without gaps consuming all 23 grid tracks.
export const getLayoutGutter = (
  horizontal: number,
  vertical = 0
): CSSProperties & { '--om-layout-gutter': string } => ({
  '--om-layout-gutter': `var(--om-space-${horizontal})`,
  marginInline: horizontal
    ? `calc(var(--om-space-${horizontal}) / -2)`
    : undefined,
  rowGap: vertical ? `var(--om-space-${vertical})` : undefined,
});
