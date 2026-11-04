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

/**
 * Tile colours for the icon on settings landing cards, applied in order and
 * repeated. Utility tokens, so each tile also adapts in dark mode.
 */
export const LANDING_ICON_COLORS = [
  'tw:bg-utility-purple-50 tw:text-utility-purple-500',
  'tw:bg-utility-pink-50 tw:text-utility-pink-500',
  'tw:bg-utility-green-50 tw:text-utility-green-500',
  'tw:bg-utility-yellow-50 tw:text-utility-yellow-500',
  'tw:bg-utility-blue-50 tw:text-utility-blue-700',
  'tw:bg-utility-blue-light-50 tw:text-utility-blue-light-500',
  'tw:bg-utility-orange-dark-50 tw:text-utility-orange-dark-500',
  'tw:bg-utility-success-50 tw:text-utility-success-600',
];

export const getLandingIconColor = (index: number) =>
  LANDING_ICON_COLORS[index % LANDING_ICON_COLORS.length];
