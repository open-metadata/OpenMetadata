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
export const GLOSSARY_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'replace',
    path: '/description',
    value: 'Description for newly added glossary',
  },
];

export const GLOSSARY_TERM_PATCH_PAYLOAD = [
  {
    op: 'add',
    path: '/synonyms/0',
    value: 'test-synonym',
  },
  {
    op: 'add',
    path: '/references/0',
    value: {
      name: 'reference1',
      endpoint: 'https://example.com',
    },
  },
  {
    op: 'add',
    path: '/tags/0',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PersonalData.SpecialCategory',
    },
  },
  {
    op: 'add',
    path: '/tags/1',
    value: {
      labelType: 'Manual',
      state: 'Confirmed',
      source: 'Classification',
      tagFQN: 'PII.Sensitive',
    },
  },
  {
    op: 'replace',
    path: '/description',
    value: 'Description for newly added glossaryTerm',
  },
];
