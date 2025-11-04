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
import {
  getEntityTypeFromSearchIndex,
  getGroupLabel,
  getTermQuery,
  parseBucketsData,
} from './SearchUtils';

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

describe('parseBucketsData', () => {
  it('should parse buckets with only key property', () => {
    const buckets = [{ key: 'value1' }, { key: 'value2' }];

    const result = parseBucketsData(buckets);

    expect(result).toEqual([
      { value: 'value1', title: 'value1' },
      { value: 'value2', title: 'value2' },
    ]);
  });

  it('should use label property for title when available', () => {
    const buckets = [
      { key: 'value1', label: 'Label 1' },
      { key: 'value2', label: 'Label 2' },
    ];

    const result = parseBucketsData(buckets);

    expect(result).toEqual([
      { value: 'value1', title: 'Label 1' },
      { value: 'value2', title: 'Label 2' },
    ]);
  });

  it('should extract value from source using sourceFields path', () => {
    const buckets = [
      {
        key: 'fallback1',
        'top_hits#top': {
          hits: {
            hits: [
              {
                _source: {
                  display: {
                    name: 'extracted1',
                  },
                },
              },
            ],
          },
        },
      },
      {
        key: 'fallback2',
        'top_hits#top': {
          hits: {
            hits: [
              {
                _source: {
                  display: {
                    name: 'extracted2',
                  },
                },
              },
            ],
          },
        },
      },
    ];

    const result = parseBucketsData(buckets, 'display.name');

    expect(result).toEqual([
      { value: 'extracted1', title: 'extracted1' },
      { value: 'extracted2', title: 'extracted2' },
    ]);
  });

  it('should fallback to key when sourceFields path does not exist', () => {
    const buckets = [
      {
        key: 'fallback1',
        'top_hits#top': {
          hits: {
            hits: [
              {
                _source: {
                  other: {
                    property: 'not-used',
                  },
                },
              },
            ],
          },
        },
      },
    ];

    const result = parseBucketsData(buckets, 'display.name');

    expect(result).toEqual([{ value: 'fallback1', title: 'fallback1' }]);
  });

  it('should handle incomplete or malformed bucket data gracefully', () => {
    const buckets = [
      { key: 'key1' },
      {
        key: 'key2',
        'top_hits#top': {}, // Missing hits property
      },
      {
        key: 'key3',
        'top_hits#top': {
          hits: {}, // Missing hits array
        },
      },
      {
        key: 'key4',
        'top_hits#top': {
          hits: {
            hits: [], // Empty hits array
          },
        },
      },
    ];

    const result = parseBucketsData(buckets, 'some.path');

    expect(result).toEqual([
      { value: 'key1', title: 'key1' },
      { value: 'key2', title: 'key2' },
      { value: 'key3', title: 'key3' },
      { value: 'key4', title: 'key4' },
    ]);
  });

  describe('with sourceFieldOptionType parameter', () => {
    it('should extract label and value from sourceFieldOptionType mapping', () => {
      const buckets = [
        {
          key: 'bucket1',
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    displayName: 'User 1',
                    fullyQualifiedName: 'user1@domain.com',
                  },
                },
              ],
            },
          },
        },
        {
          key: 'bucket2',
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    displayName: 'User 2',
                    fullyQualifiedName: 'user2@domain.com',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = parseBucketsData(buckets, undefined, {
        label: 'displayName',
        value: 'fullyQualifiedName',
      });

      expect(result).toEqual([
        { title: 'User 1', value: 'user1@domain.com' },
        { title: 'User 2', value: 'user2@domain.com' },
      ]);
    });

    it('should handle missing label field in sourceFieldOptionType', () => {
      const buckets = [
        {
          key: 'bucket1',
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    fullyQualifiedName: 'user1@domain.com',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = parseBucketsData(buckets, undefined, {
        label: 'displayName',
        value: 'fullyQualifiedName',
      });

      expect(result).toEqual([{ title: undefined, value: 'user1@domain.com' }]);
    });

    it('should handle missing value field in sourceFieldOptionType', () => {
      const buckets = [
        {
          key: 'bucket1',
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    displayName: 'User 1',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = parseBucketsData(buckets, undefined, {
        label: 'displayName',
        value: 'fullyQualifiedName',
      });

      expect(result).toEqual([{ title: 'User 1', value: undefined }]);
    });

    it('should handle empty _source in sourceFieldOptionType', () => {
      const buckets = [
        {
          key: 'bucket1',
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {},
                },
              ],
            },
          },
        },
      ];

      const result = parseBucketsData(buckets, undefined, {
        label: 'displayName',
        value: 'fullyQualifiedName',
      });

      expect(result).toEqual([{ title: undefined, value: undefined }]);
    });

    it('should prioritize sourceFieldOptionType over sourceFields', () => {
      const buckets = [
        {
          key: 'bucket1',
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    displayName: 'Display Name',
                    fullyQualifiedName: 'fqn@domain.com',
                    nested: {
                      field: 'nested value',
                    },
                  },
                },
              ],
            },
          },
        },
      ];

      const result = parseBucketsData(buckets, 'nested.field', {
        label: 'displayName',
        value: 'fullyQualifiedName',
      });

      expect(result).toEqual([
        { title: 'Display Name', value: 'fqn@domain.com' },
      ]);
    });

    it('should handle multiple buckets with different source data', () => {
      const buckets = [
        {
          key: 'bucket1',
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    displayName: 'Team A',
                    fullyQualifiedName: 'team_a',
                  },
                },
              ],
            },
          },
        },
        {
          key: 'bucket2',
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    displayName: 'Team B',
                    fullyQualifiedName: 'team_b',
                  },
                },
              ],
            },
          },
        },
        {
          key: 'bucket3',
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    displayName: 'Team C',
                    fullyQualifiedName: 'team_c',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = parseBucketsData(buckets, undefined, {
        label: 'displayName',
        value: 'fullyQualifiedName',
      });

      expect(result).toEqual([
        { title: 'Team A', value: 'team_a' },
        { title: 'Team B', value: 'team_b' },
        { title: 'Team C', value: 'team_c' },
      ]);
    });
  });
});

describe('getTermQuery', () => {
  describe('Basic term queries', () => {
    it('should create a basic must query with single term', () => {
      const result = getTermQuery({ field: 'value' });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: 'value' } }],
          },
        },
      });
    });

    it('should create a basic must query with multiple terms', () => {
      const result = getTermQuery({ field1: 'value1', field2: 'value2' });

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { field1: 'value1' } },
              { term: { field2: 'value2' } },
            ],
          },
        },
      });
    });

    it('should handle array values by creating multiple term queries', () => {
      const result = getTermQuery({ field: ['value1', 'value2'] });

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { field: 'value1' } },
              { term: { field: 'value2' } },
            ],
          },
        },
      });
    });

    it('should handle mixed single values and arrays', () => {
      const result = getTermQuery({
        singleField: 'value',
        arrayField: ['value1', 'value2'],
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { singleField: 'value' } },
              { term: { arrayField: 'value1' } },
              { term: { arrayField: 'value2' } },
            ],
          },
        },
      });
    });
  });

  describe('Query types', () => {
    it('should create must_not query when queryType is must_not', () => {
      const result = getTermQuery({ field: 'value' }, 'must_not');

      expect(result).toEqual({
        query: {
          bool: {
            must_not: [{ term: { field: 'value' } }],
          },
        },
      });
    });

    it('should create should query when queryType is should', () => {
      const result = getTermQuery({ field: 'value' }, 'should');

      expect(result).toEqual({
        query: {
          bool: {
            should: [{ term: { field: 'value' } }],
          },
        },
      });
    });

    it('should create should query with minimum_should_match', () => {
      const result = getTermQuery({ field: 'value' }, 'should', 1);

      expect(result).toEqual({
        query: {
          bool: {
            should: [{ term: { field: 'value' } }],
            minimum_should_match: 1,
          },
        },
      });
    });
  });

  describe('Wildcard queries', () => {
    it('should add wildcard queries when wildcardTerms is provided', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        wildcardTerms: { name: '*search*' },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { field: 'value' } },
              { wildcard: { name: '*search*' } },
            ],
          },
        },
      });
    });

    it('should add nested bool query with should clauses for wildcardShouldQueries', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        wildcardShouldQueries: {
          'name.keyword': '*search*',
          'description.keyword': '*search*',
        },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { field: 'value' } },
              {
                bool: {
                  should: [
                    { wildcard: { 'name.keyword': '*search*' } },
                    { wildcard: { 'description.keyword': '*search*' } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
          },
        },
      });
    });

    it('should add wildcard must_not queries', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        wildcardMustNotQueries: { fullyQualifiedName: 'Tier.*' },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: 'value' } }],
            must_not: [{ wildcard: { fullyQualifiedName: 'Tier.*' } }],
          },
        },
      });
    });

    it('should handle array values in wildcardMustNotQueries', () => {
      const result = getTermQuery({}, 'must', undefined, {
        wildcardMustNotQueries: {
          fullyQualifiedName: ['Certification.*', 'Tier.*'],
        },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [],
            must_not: [
              { wildcard: { fullyQualifiedName: 'Certification.*' } },
              { wildcard: { fullyQualifiedName: 'Tier.*' } },
            ],
          },
        },
      });
    });
  });

  describe('Match queries', () => {
    it('should add match queries when matchTerms is provided', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        matchTerms: { teamType: 'Group' },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { field: 'value' } },
              { match: { teamType: 'Group' } },
            ],
          },
        },
      });
    });

    it('should handle multiple match terms', () => {
      const result = getTermQuery({}, 'must', undefined, {
        matchTerms: {
          teamType: 'Group',
          status: 'active',
        },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { match: { teamType: 'Group' } },
              { match: { status: 'active' } },
            ],
          },
        },
      });
    });
  });

  describe('Must not terms', () => {
    it('should add must_not term queries when mustNotTerms is provided', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        mustNotTerms: { deleted: 'true' },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: 'value' } }],
            must_not: [{ term: { deleted: 'true' } }],
          },
        },
      });
    });

    it('should handle array values in mustNotTerms', () => {
      const result = getTermQuery({}, 'must', undefined, {
        mustNotTerms: { type: ['bot', 'system'] },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [],
            must_not: [{ term: { type: 'bot' } }, { term: { type: 'system' } }],
          },
        },
      });
    });
  });

  describe('Complex combinations', () => {
    it('should combine all options together', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        wildcardTerms: { name: '*search*' },
        matchTerms: { teamType: 'Group' },
        mustNotTerms: { deleted: 'true' },
        wildcardMustNotQueries: { fullyQualifiedName: 'Tier.*' },
        wildcardShouldQueries: { 'description.keyword': '*desc*' },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { field: 'value' } },
              { wildcard: { name: '*search*' } },
              { match: { teamType: 'Group' } },
              {
                bool: {
                  should: [{ wildcard: { 'description.keyword': '*desc*' } }],
                  minimum_should_match: 1,
                },
              },
            ],
            must_not: [
              { term: { deleted: 'true' } },
              { wildcard: { fullyQualifiedName: 'Tier.*' } },
            ],
          },
        },
      });
    });

    it('should work with empty terms and only options', () => {
      const result = getTermQuery({}, 'must', undefined, {
        matchTerms: { teamType: 'Group' },
        mustNotTerms: { deleted: 'true' },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ match: { teamType: 'Group' } }],
            must_not: [{ term: { deleted: 'true' } }],
          },
        },
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty terms object', () => {
      const result = getTermQuery({});

      expect(result).toEqual({
        query: {
          bool: {
            must: [],
          },
        },
      });
    });

    it('should handle numeric values', () => {
      const result = getTermQuery({ count: 5, rating: 4.5 });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { count: 5 } }, { term: { rating: 4.5 } }],
          },
        },
      });
    });

    it('should not add minimum_should_match for non-should queries', () => {
      const result = getTermQuery({ field: 'value' }, 'must', 5);

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: 'value' } }],
          },
        },
      });
    });

    it('should handle should_not query type', () => {
      const result = getTermQuery({ field: 'value' }, 'should_not');

      expect(result).toEqual({
        query: {
          bool: {
            should_not: [{ term: { field: 'value' } }],
          },
        },
      });
    });

    it('should handle empty string values', () => {
      const result = getTermQuery({ field: '' });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: '' } }],
          },
        },
      });
    });

    it('should handle zero as a value', () => {
      const result = getTermQuery({ count: 0 });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { count: 0 } }],
          },
        },
      });
    });

    it('should handle empty arrays in terms', () => {
      const result = getTermQuery({ field: [] });

      expect(result).toEqual({
        query: {
          bool: {
            must: [],
          },
        },
      });
    });

    it('should handle empty arrays in mustNotTerms options', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        mustNotTerms: { type: [] },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: 'value' } }],
          },
        },
      });
    });

    it('should handle empty arrays in wildcardMustNotQueries options', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        wildcardMustNotQueries: { fqn: [] },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: 'value' } }],
          },
        },
      });
    });

    it('should handle undefined and null in options gracefully', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        wildcardTerms: undefined,
        matchTerms: undefined,
        mustNotTerms: undefined,
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: 'value' } }],
          },
        },
      });
    });

    it('should handle empty objects in all options', () => {
      const result = getTermQuery({ field: 'value' }, 'must', undefined, {
        wildcardTerms: {},
        matchTerms: {},
        mustNotTerms: {},
        wildcardMustNotQueries: {},
        wildcardShouldQueries: {},
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: 'value' } }],
          },
        },
      });
    });

    it('should handle special characters in field names', () => {
      const result = getTermQuery({ 'field.with.dots': 'value' });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { 'field.with.dots': 'value' } }],
          },
        },
      });
    });

    it('should handle special characters in values', () => {
      const result = getTermQuery({ field: 'value@with#special$chars' });

      expect(result).toEqual({
        query: {
          bool: {
            must: [{ term: { field: 'value@with#special$chars' } }],
          },
        },
      });
    });
  });

  describe('Real-world scenarios', () => {
    it('should create query for filtering tables by tags and excluding deleted items', () => {
      const result = getTermQuery(
        { 'tags.tagFQN': ['PII.Sensitive', 'PersonalData'] },
        'must',
        undefined,
        {
          mustNotTerms: { deleted: true },
        }
      );

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { 'tags.tagFQN': 'PII.Sensitive' } },
              { term: { 'tags.tagFQN': 'PersonalData' } },
            ],
            must_not: [{ term: { deleted: true } }],
          },
        },
      });
    });

    it('should create query for searching with wildcard patterns and excluding Tier tags', () => {
      const result = getTermQuery(
        { 'owners.id': 'user123' },
        'must',
        undefined,
        {
          wildcardShouldQueries: {
            'name.keyword': '*table*',
            'description.keyword': '*table*',
          },
          wildcardMustNotQueries: {
            fullyQualifiedName: ['Tier.*', 'Certification.*'],
          },
        }
      );

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { 'owners.id': 'user123' } },
              {
                bool: {
                  should: [
                    { wildcard: { 'name.keyword': '*table*' } },
                    { wildcard: { 'description.keyword': '*table*' } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
            must_not: [
              { wildcard: { fullyQualifiedName: 'Tier.*' } },
              { wildcard: { fullyQualifiedName: 'Certification.*' } },
            ],
          },
        },
      });
    });

    it('should create query for filtering teams by type and matching users', () => {
      const result = getTermQuery({}, 'must', undefined, {
        matchTerms: { teamType: 'Group' },
        wildcardTerms: { 'users.name': '*admin*' },
      });

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { wildcard: { 'users.name': '*admin*' } },
              { match: { teamType: 'Group' } },
            ],
          },
        },
      });
    });

    it('should create should query with multiple conditions and minimum match', () => {
      const result = getTermQuery(
        {
          'tags.tagFQN': ['PII', 'Sensitive'],
          tier: 'Tier.Tier1',
        },
        'should',
        2
      );

      expect(result).toEqual({
        query: {
          bool: {
            should: [
              { term: { 'tags.tagFQN': 'PII' } },
              { term: { 'tags.tagFQN': 'Sensitive' } },
              { term: { tier: 'Tier.Tier1' } },
            ],
            minimum_should_match: 2,
          },
        },
      });
    });

    it('should create complex query combining all features for advanced filtering', () => {
      const result = getTermQuery(
        {
          entityType: 'table',
          'database.name': 'production',
        },
        'must',
        undefined,
        {
          matchTerms: { serviceType: 'BigQuery' },
          wildcardTerms: { 'name.keyword': '*customer*' },
          mustNotTerms: { deleted: true, disabled: true },
          wildcardMustNotQueries: {
            fullyQualifiedName: ['test.*', '*.temp'],
          },
          wildcardShouldQueries: {
            'description.keyword': '*important*',
            'displayName.keyword': '*important*',
          },
        }
      );

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              { term: { entityType: 'table' } },
              { term: { 'database.name': 'production' } },
              { wildcard: { 'name.keyword': '*customer*' } },
              { match: { serviceType: 'BigQuery' } },
              {
                bool: {
                  should: [
                    { wildcard: { 'description.keyword': '*important*' } },
                    { wildcard: { 'displayName.keyword': '*important*' } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
            must_not: [
              { term: { deleted: true } },
              { term: { disabled: true } },
              { wildcard: { fullyQualifiedName: 'test.*' } },
              { wildcard: { fullyQualifiedName: '*.temp' } },
            ],
          },
        },
      });
    });
  });
});
