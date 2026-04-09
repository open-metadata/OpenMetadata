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

export const AVATAR_SIZE_CLASS_MAP: Record<number, string> = {
  16: 'tw:w-4 tw:h-4',
  18: 'tw:w-4.5 tw:h-4.5',
  20: 'tw:w-5 tw:h-5',
  24: 'tw:w-6 tw:h-6',
  32: 'tw:w-8 tw:h-8',
  40: 'tw:w-10 tw:h-10',
  48: 'tw:w-12 tw:h-12',
  56: 'tw:w-14 tw:h-14',
  64: 'tw:w-16 tw:h-16',
};

export const AVATAR_SIZE_NAME_MAP: Record<
  number,
  'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
> = {
  16: 'xxs',
  18: 'xxs',
  20: 'xs',
  24: 'xs',
  32: 'sm',
  40: 'md',
  48: 'lg',
  56: 'xl',
  64: '2xl',
};

export const AVATAR_FONT_SIZE_MAP: Record<number, string> = {
  16: 'tw:text-[8px]',
  18: 'tw:text-[8px]',
  20: 'tw:text-[8px]',
  24: 'tw:text-[10px]',
  32: 'tw:text-xs',
  40: 'tw:text-base',
  48: 'tw:text-[20px]',
  56: 'tw:text-[22px]',
  64: 'tw:text-[26px]',
};
