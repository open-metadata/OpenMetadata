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
export const MOCK_TAG_OPTIONS = [
  {
    label: 'Personal',
    value: 'PersonalData.Personal',
    data: {
      tagFQN: 'PersonalData.Personal',
      name: 'Personal',
      displayName: 'Personal Data',
      description: 'Personal data tag',
      source: 'Classification',
    },
  },
  {
    label: 'PII',
    value: 'PersonalData.PII',
    data: {
      tagFQN: 'PersonalData.PII',
      name: 'PII',
      displayName: 'Personally Identifiable Information',
      description: 'PII data tag',
      source: 'Classification',
    },
  },
  {
    label: 'Sensitive',
    value: 'SecurityData.Sensitive',
    data: {
      tagFQN: 'SecurityData.Sensitive',
      name: 'Sensitive',
      displayName: 'Sensitive Data',
      description: 'Sensitive data tag',
      source: 'Classification',
    },
  },
];
