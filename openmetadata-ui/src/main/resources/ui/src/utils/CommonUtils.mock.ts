/*
 *  Copyright 2022 Collate.
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

import { LabelType, State, TagSource } from '../generated/entity/data/chart';

export const mockTags = [
  {
    tagFQN: 'PII.NonSensitive',
    description:
      'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'PersonalData.Personal',
    description:
      'Data that can be used to directly or indirectly identify a person.',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'ab.tag',
    description: '',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'persona.tag',
    description: '',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'aa.tag',
    description: '',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'ac.tag',
    description: '',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
];

export const sortedMockTags = [
  {
    tagFQN: 'aa.tag',
    description: '',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'ab.tag',
    description: '',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'ac.tag',
    description: '',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'persona.tag',
    description: '',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'PersonalData.Personal',
    description:
      'Data that can be used to directly or indirectly identify a person.',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'PII.NonSensitive',
    description:
      'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
];

export const mockFQN = 'sample_data.ecommerce_db.dim_product';
export const mockFQNWithSpecialChar1 =
  'sample_data.ecommerce_db."dim.api/client"';
export const mockFQNWithSpecialChar2 =
  'sample_data."ecommerce_db"."dim.api/client"';
export const mockFQNWithSpecialChar3 =
  'sample_data.ecommerce_db."dim.api/"client"';
export const mockFQNWithSpecialChar4 =
  'sample_data.ecommerce_db."dim.api/client""';
export const mockFQNWithSpecialChar5 =
  'sample_data.ecommerce_db.""dim.api/client"';

export const mockTableNameFromFQN = 'dim_product';
export const mockTableNameWithSpecialChar = 'dim.api/client';
export const mockTableNameWithSpecialChar3 = 'api/"client"';
export const mockTableNameWithSpecialChar4 = 'api/client""';
export const mockTableNameWithSpecialChar5 = 'api/client"';
