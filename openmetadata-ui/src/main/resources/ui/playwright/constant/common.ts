/*
 *  Copyright 2024 Collate.
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
export const TAG_INVALID_NAMES = {
  MIN_LENGTH: 'c',
  MAX_LENGTH: 'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890ab',
  WITH_SPECIAL_CHARS: '!@#$%^&*()',
};

export const INVALID_NAMES = {
  MAX_LENGTH:
    'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890aba87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890abName can be a maximum of 128 characters',
  WITH_SPECIAL_CHARS: '::normalName::',
};

export const NAME_VALIDATION_ERROR =
  'Name must contain only letters, numbers, underscores, hyphens, periods, parenthesis, and ampersands.';

export const NAME_MIN_MAX_LENGTH_VALIDATION_ERROR =
  'Name size must be between 2 and 64';

export const NAME_MAX_LENGTH_VALIDATION_ERROR =
  'Name size must be between 1 and 128';

export const DELETE_TERM = 'DELETE';

export const COMMON_TIER_TAG = [
  {
    id: 'd9b52629-0288-4d29-99bf-ecdd1713d285',
    name: 'Tier1',
    fullyQualifiedName: 'Tier.Tier1',
  },
  {
    id: 'fafc6234-f036-4e02-9666-20e30ceb593b',
    name: 'Tier2',
    fullyQualifiedName: 'Tier.Tier2',
  },
  {
    id: 'de9dba4b-a92c-4a58-a3d8-93e72f315a29',
    name: 'Tier3',
    fullyQualifiedName: 'Tier.Tier3',
  },
  {
    id: '9ee864ea-d8e6-4ecc-9017-57d1e72e501e',
    name: 'Tier4',
    fullyQualifiedName: 'Tier.Tier4',
  },
  {
    id: '36c08b3b-85b5-460b-86b7-806857314883',
    name: 'Tier5',
    fullyQualifiedName: 'Tier.Tier5',
  },
];
