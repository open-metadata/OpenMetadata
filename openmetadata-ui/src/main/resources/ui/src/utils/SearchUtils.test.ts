/*
 *  Copyright 2023 Collate.
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
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { getEntityTypeFromSearchIndex } from './SearchUtils';

describe('getEntityTypeFromSearchIndex', () => {
  it.each([
    [SearchIndex.TABLE, EntityType.TABLE],
    [SearchIndex.PIPELINE, EntityType.PIPELINE],
    [SearchIndex.DASHBOARD, EntityType.DASHBOARD],
    [SearchIndex.MLMODEL, EntityType.MLMODEL],
    [SearchIndex.TOPIC, EntityType.TOPIC],
    [SearchIndex.CONTAINER, EntityType.CONTAINER],
    [SearchIndex.STORED_PROCEDURE, EntityType.STORED_PROCEDURE],
    [SearchIndex.DASHBOARD_DATA_MODEL, EntityType.DASHBOARD_DATA_MODEL],
    [SearchIndex.SEARCH_INDEX, EntityType.SEARCH_INDEX],
    [SearchIndex.DATABASE_SCHEMA, EntityType.DATABASE_SCHEMA],
    [SearchIndex.DATABASE_SERVICE, EntityType.DATABASE_SERVICE],
    [SearchIndex.MESSAGING_SERVICE, EntityType.MESSAGING_SERVICE],
    [SearchIndex.DASHBOARD_SERVICE, EntityType.DASHBOARD_SERVICE],
    [SearchIndex.PIPELINE_SERVICE, EntityType.PIPELINE_SERVICE],
    [SearchIndex.ML_MODEL_SERVICE, EntityType.MLMODEL_SERVICE],
    [SearchIndex.STORAGE_SERVICE, EntityType.STORAGE_SERVICE],
    [SearchIndex.SEARCH_SERVICE, EntityType.SEARCH_SERVICE],
    [SearchIndex.GLOSSARY_TERM, EntityType.GLOSSARY_TERM],
    [SearchIndex.TAG, EntityType.TAG],
    [SearchIndex.DATABASE, EntityType.DATABASE],
    [SearchIndex.DOMAIN, EntityType.DOMAIN],
    [SearchIndex.DATA_PRODUCT, EntityType.DATA_PRODUCT],
  ])('returns %p for %p', (searchIndex, expectedEntityType) => {
    expect(getEntityTypeFromSearchIndex(searchIndex)).toBe(expectedEntityType);
  });

  it('returns null for an unknown search index', () => {
    expect(getEntityTypeFromSearchIndex('DUMMY_INDEX')).toBeNull();
  });
});
