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

import { EntityFields } from '../enums/AdvancedSearch.enum';

export const DATAPRODUCT_DEFAULT_QUICK_FILTERS = [
  EntityFields.OWNERS,
  EntityFields.DOMAINS,
  EntityFields.CLASSIFICATION_TAGS,
  EntityFields.GLOSSARY_TERMS,
];

export const DATAPRODUCT_FILTERS = [
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.domain-plural',
    key: EntityFields.DOMAINS,
  },
  {
    label: 'label.tag-plural',
    key: EntityFields.CLASSIFICATION_TAGS,
  },
  {
    label: 'label.glossary-term-plural',
    key: EntityFields.GLOSSARY_TERMS,
  },
];
