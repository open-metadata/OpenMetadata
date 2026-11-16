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
import { PaletteKey } from '../../generated/entity/data/relationshipType';

export const NEW_RELATION_TYPE_PREFIX = 'new:';

export const RELATION_PALETTE_SWATCH_CLASSES: Record<PaletteKey, string> = {
  [PaletteKey.Amber]: 'tw:bg-utility-warning-500',
  [PaletteKey.Blue]: 'tw:bg-utility-blue-500',
  [PaletteKey.Gray]: 'tw:bg-utility-gray-500',
  [PaletteKey.Green]: 'tw:bg-utility-success-500',
  [PaletteKey.Indigo]: 'tw:bg-utility-indigo-500',
  [PaletteKey.Pink]: 'tw:bg-utility-pink-500',
  [PaletteKey.Purple]: 'tw:bg-utility-purple-500',
  [PaletteKey.Rose]: 'tw:bg-error-solid',
  [PaletteKey.Teal]: 'tw:bg-utility-success-500',
  [PaletteKey.Violet]: 'tw:bg-utility-purple-500',
};
