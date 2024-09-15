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
import { getEntityTypeFromSearchIndex, getGroupLabel } from './SearchUtils';

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

describe('getGroupLabel', () => {
  it('should return topic details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.TOPIC));

    expect(result).toContain('label.topic-plural');
  });

  it('should return dashboard details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.DASHBOARD));

    expect(result).toContain('label.dashboard-plural');
  });

  it('should return pipeline details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.PIPELINE));

    expect(result).toContain('label.pipeline-plural');
  });

  it('should return ml-model details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.MLMODEL));

    expect(result).toContain('label.ml-model-plural');
  });

  it('should return glossary-term details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.GLOSSARY_TERM));

    expect(result).toContain('label.glossary-term-plural');
  });

  it('should return chart details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.CHART));

    expect(result).toContain('label.chart-plural');
  });

  it('should return tag details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.TAG));

    expect(result).toContain('label.tag-plural');
  });

  it('should return container details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.CONTAINER));

    expect(result).toContain('label.container-plural');
  });

  it('should return stored-procedure details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.STORED_PROCEDURE));

    expect(result).toContain('label.stored-procedure-plural');
  });

  it('should return data-model details if index type is chart', () => {
    const result = JSON.stringify(
      getGroupLabel(SearchIndex.DASHBOARD_DATA_MODEL)
    );

    expect(result).toContain('label.data-model-plural');
  });

  it('should return search-index details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.SEARCH_INDEX));

    expect(result).toContain('label.search-index-plural');
  });

  it('should return data-product details if index type is chart', () => {
    const result = JSON.stringify(getGroupLabel(SearchIndex.DATA_PRODUCT));

    expect(result).toContain('label.data-product-plural');
  });
});
