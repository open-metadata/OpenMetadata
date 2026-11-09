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
import { readFileSync } from 'fs';
import { join } from 'path';
import { CURATED_ASSETS_SORT_BY_KEYS } from '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsWidget.constants';
import { EntityType } from '../enums/entity.enum';
import { CURATED_ASSETS_LIST } from './AdvancedSearch.constants';
import { getSortField, getSortOrder } from './Widgets.constant';

const SPEC_RESOURCES = join(
  __dirname,
  '../../../../../../../openmetadata-spec/src/main/resources'
);
const SEARCH_LANGUAGES = ['en', 'jp', 'ko', 'ru', 'zh'];

const readSpecJson = (path: string) =>
  JSON.parse(readFileSync(join(SPEC_RESOURCES, path), 'utf8'));

describe('getSortField', () => {
  it.each([
    [CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z, 'asc'],
    [CURATED_ASSETS_SORT_BY_KEYS.Z_TO_A, 'desc'],
  ])('sorts %s on the visible title, not the internal name', (key, order) => {
    expect(getSortField(key)).toBe('displayName.keyword');
    expect(getSortOrder(key)).toBe(order);
  });

  it('sorts Latest on updatedAt', () => {
    expect(getSortField(CURATED_ASSETS_SORT_BY_KEYS.LATEST)).toBe('updatedAt');
  });

  it('prefers an explicit field over the default', () => {
    expect(getSortField(CURATED_ASSETS_SORT_BY_KEYS.A_TO_Z, 'custom')).toBe(
      'custom'
    );
  });
});

// A to Z sorts on displayName.keyword; an index without the lowercase
// normalizer would put capitalised titles ahead of every lowercase one.
describe('curated asset indexes', () => {
  const indexMapping: Record<string, { indexMappingFile: string }> =
    readSpecJson('elasticsearch/indexMapping.json');
  const curatedTypes = CURATED_ASSETS_LIST.filter(
    (type) => type !== EntityType.ALL
  );

  it.each(curatedTypes)(
    'map %s displayName.keyword case-insensitively in every language',
    (type) => {
      const mappingFile = indexMapping[type]?.indexMappingFile;

      expect(mappingFile).toBeDefined();

      SEARCH_LANGUAGES.forEach((language) => {
        const { mappings } = readSpecJson(
          mappingFile.replace('%s', language).replace(/^\//, '')
        );

        expect({
          language,
          normalizer:
            mappings.properties.displayName?.fields?.keyword?.normalizer,
        }).toEqual({ language, normalizer: 'lowercase_normalizer' });
      });
    }
  );
});
