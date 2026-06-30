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

import { startCase } from 'lodash';

export const TYPE_BADGE_KEY = 'Type';

const TYPE_BADGE_CLASS_NAME = [
  'tw:inline-flex',
  'tw:max-w-full',
  'tw:min-h-5.5',
  'tw:items-center',
  'tw:rounded-md',
  'tw:border',
  'tw:border-utility-gray-blue-200',
  'tw:bg-utility-gray-blue-50',
  'tw:break-words',
  'tw:px-1.5',
  'tw:py-0.5',
  'tw:text-xs',
  'tw:font-medium',
  'tw:text-utility-gray-blue-700',
  'tw:whitespace-normal',
].join(' ');

export const getTypeBadge = (label?: string, preserveFormatting = false) =>
  label ? (
    <span className={TYPE_BADGE_CLASS_NAME}>
      {(preserveFormatting ? label : startCase(label)).toUpperCase()}
    </span>
  ) : null;
