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
import { SearchIndex } from '../enums/search.enum';
import advancedSearchClassBase, {
  AdvancedSearchClassBase,
} from './AdvancedSearchClassBase';

jest.mock('../rest/miscAPI', () => ({
  getAggregateFieldOptions: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {},
    })
  ),
}));

jest.mock('./JSONLogicSearchClassBase', () => ({
  getQueryBuilderFields: jest.fn(),
}));

describe('AdvancedSearchClassBase', () => {
  let advancedSearchClassBase: AdvancedSearchClassBase;

  beforeEach(() => {
    advancedSearchClassBase = new AdvancedSearchClassBase();
  });

  it('getCommonConfig function should return expected fields', () => {
    const result = advancedSearchClassBase.getCommonConfig({});

    expect(Object.keys(result)).toEqual([
      EntityFields.DISPLAY_NAME_KEYWORD,
      EntityFields.NAME_KEYWORD,
      'deleted',
      EntityFields.OWNERS,
      EntityFields.DOMAIN,
      'serviceType',
      EntityFields.TAG,
      EntityFields.TIER,
      'extension',
      'descriptionStatus',
      'entityType',
      'descriptionSources.Suggested',
      'tags.labelType',
    ]);
  });
});

describe('getEntitySpecificQueryBuilderFields', () => {
  it('should return table specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.TABLE,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.DATABASE,
      EntityFields.DATABASE_SCHEMA,
      EntityFields.TABLE_TYPE,
      EntityFields.COLUMN_DESCRIPTION_STATUS,
    ]);
  });

  it('should return pipeline specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.PIPELINE,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.TASK]);
  });

  it('should return dashboard specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.DASHBOARD,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.DATA_MODEL,
      EntityFields.CHART,
      EntityFields.PROJECT,
    ]);
  });

  it('should return topic specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.TOPIC,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.SCHEMA_FIELD]);
  });

  it('should return mlModel specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.MLMODEL,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.FEATURE]);
  });

  it('should return container specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.CONTAINER,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.CONTAINER_COLUMN]);
  });

  it('should return searchIndex specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.SEARCH_INDEX,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.FIELD]);
  });

  it('should return dataModel specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.DASHBOARD_DATA_MODEL,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.DATA_MODEL_TYPE,
      EntityFields.PROJECT,
    ]);
  });

  it('should return apiEndpoint specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.API_ENDPOINT_INDEX,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.API_COLLECTION,
      EntityFields.REQUEST_SCHEMA_FIELD,
      EntityFields.RESPONSE_SCHEMA_FIELD,
    ]);
  });

  it('should return glossary specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.GLOSSARY_TERM,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.GLOSSARY_TERM_STATUS,
      EntityFields.GLOSSARY,
    ]);
  });

  it('should return databaseSchema specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.DATABASE_SCHEMA,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.DATABASE]);
  });

  it('should return empty fields for multiple indices with no common fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.TABLE,
      SearchIndex.PIPELINE,
    ]);

    expect(Object.keys(result)).toEqual([]);
  });

  it('should return combined fields for multiple indices with common fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.TABLE,
      SearchIndex.DATABASE_SCHEMA,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.DATABASE]);
  });

  it('should return empty object for unknown index', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      'UNKNOWN_INDEX' as SearchIndex,
    ]);

    expect(Object.keys(result)).toEqual([]);
  });
});
