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

/*
 * MUI Theme Type Extensions - Inline Approach (Final)
 *
 * IMPORTANT: This file duplicates MUI type declarations from core-components
 * due to TypeScript 4.2.4 limitations with cross-package module augmentation.
 *
 * After testing multiple approaches (triple slash directives, package imports,
 * build configuration), cross-package module augmentation does not work reliably
 * with TypeScript 4.2.4.
 *
 * Why inline duplication is required:
 * 1. TypeScript 4.2.4 cross-package module augmentation limitations
 * 2. Triple slash directives fail with current package/build setup
 * 3. Import side-effects don't reliably work across package boundaries
 *
 * These types MUST be kept in sync with:
 * core-components/src/theme/mui-theme-types.ts
 *
 * TODO: Remove duplication when upgrading to TypeScript 5.0+
 */
import '@mui/material/Chip';
import '@mui/material/styles';
import type { ThemeColors } from '@openmetadata/ui-core-components';

// Extend MUI palette to include allShades
declare module '@mui/material/styles' {
  interface Palette {
    allShades: ThemeColors;
  }
  interface PaletteOptions {
    allShades?: ThemeColors;
  }
}

// Extend MUI Chip to include custom variants and sizes
declare module '@mui/material/Chip' {
  interface ChipPropsSizeOverrides {
    large: true;
  }
  interface ChipPropsVariantOverrides {
    blueGray: true;
  }
}
