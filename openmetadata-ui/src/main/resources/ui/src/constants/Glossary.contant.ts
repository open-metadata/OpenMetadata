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

import { Status } from '../generated/entity/data/glossaryTerm';
import i18n from '../utils/i18next/LocalUtil';

export const GLOSSARY_TERM_TABLE_COLUMNS_KEYS = {
  NAME: 'name',
  DESCRIPTION: 'description',
  REVIEWERS: 'reviewers',
  SYNONYMS: 'synonyms',
  OWNERS: 'owners',
  STATUS: 'status',
  ACTIONS: 'actions',
};

export const DEFAULT_VISIBLE_COLUMNS = [
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.DESCRIPTION,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.OWNERS,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
];

export const STATIC_VISIBLE_COLUMNS = [
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.NAME,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
];

export const GLOSSARY_TERM_STATUS_OPTIONS = [
  {
    value: 'all',
    text: i18n.t('label.all'),
  },
  ...Object.values(Status).map((status) => ({
    value: status,
    text: status,
  })),
];
