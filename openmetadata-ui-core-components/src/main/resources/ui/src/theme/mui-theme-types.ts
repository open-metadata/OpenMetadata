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
import '@mui/material/styles';
import '@mui/material/Chip';
import type { ThemeColors } from '../types';

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