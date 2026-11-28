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

import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import {
  COLUMN_GRID_FILTERS,
  COLUMN_GLOSSARY_FIELD,
  COLUMN_TAG_FIELD,
} from './ColumnGrid.constants';

describe('COLUMN_GRID_FILTERS', () => {
  const findFilter = (key: string) =>
    COLUMN_GRID_FILTERS.find((f) => f.key === key);

  describe('single-select filters (backend only honours a single value)', () => {
    it.each([
      ['service', EntityFields.SERVICE],
      ['domains', EntityFields.DOMAINS],
      ['metadataStatus', 'metadataStatus'],
    ])('marks the %s filter as singleSelect', (_label, key) => {
      expect(findFilter(key)?.singleSelect).toBe(true);
    });
  });

  describe('multi-select filters (backend accepts comma-joined lists)', () => {
    it.each([
      ['entityType', EntityFields.ENTITY_TYPE],
      ['serviceType', EntityFields.SERVICE_TYPE],
      ['columnTags', COLUMN_TAG_FIELD],
      ['columnGlossaryTerms', COLUMN_GLOSSARY_FIELD],
    ])('does NOT mark the %s filter as singleSelect', (_label, key) => {
      expect(findFilter(key)?.singleSelect ?? false).toBe(false);
    });
  });
});
