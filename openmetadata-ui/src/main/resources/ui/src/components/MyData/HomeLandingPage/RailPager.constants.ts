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
import type { RailScrollState } from '../../../hooks/useRailPager';

export type RailPagerSide = keyof RailScrollState;

// A 24px circle (ButtonUtility `sm`): the touch-target minimum.
export const PAGER_BUTTON_CLASSES = 'tw:rounded-full';

export const OPPOSITE_PAGER_SIDE: Record<RailPagerSide, RailPagerSide> = {
  next: 'previous',
  previous: 'next',
};
