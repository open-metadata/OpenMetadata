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

import { getOptionsFromAggregationBucket } from './AdvancedSearchUtils';

describe('getOptionsFromAggregationBucket - Case Preservation', () => {
  describe('with sourceFields parameter', () => {
    it('should return original cased values from top_hits when sourceFields is provided', () => {
      const buckets = [
        {
          key: 'airflow',
          doc_count: 5,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    service: {
                      displayName: 'Airflow',
                    },
                  },
                },
              ],
            },
          },
        },
        {
          key: 'glue',
          doc_count: 3,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    service: {
                      displayName: 'Glue',
                    },
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(
        buckets as any,
        'service.displayName'
      );

      expect(result).toEqual([
        { key: 'airflow', label: 'Airflow', count: 5 },
        { key: 'glue', label: 'Glue', count: 3 },
      ]);
    });

    it('should handle nested field paths in sourceFields', () => {
      const buckets = [
        {
          key: 'owner1',
          doc_count: 2,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    owners: {
                      displayName: 'John Doe',
                    },
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(
        buckets as any,
        'owners.displayName'
      );

      expect(result).toEqual([
        { key: 'owner1', label: 'John Doe', count: 2 },
      ]);
    });

    it('should fallback to bucket.key when top_hits is missing but sourceFields is provided', () => {
      const buckets = [
        {
          key: 'airflow',
          doc_count: 5,
          // No top_hits#top
        },
      ];

      const result = getOptionsFromAggregationBucket(
        buckets as any,
        'service.displayName'
      );

      expect(result).toEqual([
        { key: 'airflow', label: 'airflow', count: 5 },
      ]);
    });

    it('should fallback to bucket.key when sourceFields path does not exist in _source', () => {
      const buckets = [
        {
          key: 'airflow',
          doc_count: 5,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    someOtherField: 'value',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(
        buckets as any,
        'service.displayName'
      );

      expect(result).toEqual([
        { key: 'airflow', label: 'airflow', count: 5 },
      ]);
    });

    it('should handle domain displayNames with case preservation', () => {
      const buckets = [
        {
          key: 'product',
          doc_count: 10,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    domains: {
                      displayName: 'Product Domain',
                    },
                  },
                },
              ],
            },
          },
        },
        {
          key: 'customer',
          doc_count: 7,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    domains: {
                      displayName: 'Customer Domain',
                    },
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(
        buckets as any,
        'domains.displayName'
      );

      expect(result).toEqual([
        { key: 'product', label: 'Product Domain', count: 10 },
        { key: 'customer', label: 'Customer Domain', count: 7 },
      ]);
    });
  });

  describe('without sourceFields parameter (backward compatibility)', () => {
    it('should fallback to bucket.key when sourceFields is not provided', () => {
      const buckets = [
        { key: 'airflow', doc_count: 5 },
        { key: 'glue', doc_count: 3 },
      ];

      const result = getOptionsFromAggregationBucket(buckets as any);

      expect(result).toEqual([
        { key: 'airflow', label: 'airflow', count: 5 },
        { key: 'glue', label: 'glue', count: 3 },
      ]);
    });

    it('should ignore top_hits when sourceFields is not provided', () => {
      const buckets = [
        {
          key: 'airflow',
          doc_count: 5,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    service: {
                      displayName: 'Airflow',
                    },
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(buckets as any);

      expect(result).toEqual([
        { key: 'airflow', label: 'airflow', count: 5 },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty buckets array', () => {
      const buckets: any[] = [];

      const result = getOptionsFromAggregationBucket(buckets);

      expect(result).toEqual([]);
    });

    it('should handle null buckets', () => {
      const result = getOptionsFromAggregationBucket(null as any);

      expect(result).toEqual([]);
    });

    it('should filter out ingestion pipeline entities', () => {
      const buckets = [
        {
          key: 'ingestion_pipeline',
          doc_count: 1,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    entityType: 'INGESTION_PIPELINE',
                  },
                },
              ],
            },
          },
        },
        {
          key: 'table',
          doc_count: 5,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    entityType: 'TABLE',
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(buckets as any);

      // Only 'table' should be included, 'ingestion_pipeline' is filtered out
      expect(result.length).toBe(1);
      expect(result[0].key).toBe('table');
    });

    it('should handle special characters in field values', () => {
      const buckets = [
        {
          key: 'special-chars',
          doc_count: 2,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    service: {
                      displayName: 'Spe-cial-Chars Service',
                    },
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(
        buckets as any,
        'service.displayName'
      );

      expect(result).toEqual([
        { key: 'special-chars', label: 'Spe-cial-Chars Service', count: 2 },
      ]);
    });

    it('should handle very deep nested paths', () => {
      const buckets = [
        {
          key: 'deep',
          doc_count: 1,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    level1: {
                      level2: {
                        level3: {
                          displayName: 'Deep Value',
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(
        buckets as any,
        'level1.level2.level3.displayName'
      );

      expect(result).toEqual([
        { key: 'deep', label: 'Deep Value', count: 1 },
      ]);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle mixed case service names', () => {
      const buckets = [
        {
          key: 'bigquery',
          doc_count: 15,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    service: {
                      displayName: 'BigQuery',
                    },
                  },
                },
              ],
            },
          },
        },
        {
          key: 'snowflake',
          doc_count: 12,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    service: {
                      displayName: 'Snowflake',
                    },
                  },
                },
              ],
            },
          },
        },
        {
          key: 'postgres',
          doc_count: 8,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    service: {
                      displayName: 'PostgreSQL',
                    },
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(
        buckets as any,
        'service.displayName'
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        key: 'bigquery',
        label: 'BigQuery',
        count: 15,
      });
      expect(result[1]).toEqual({
        key: 'snowflake',
        label: 'Snowflake',
        count: 12,
      });
      expect(result[2]).toEqual({
        key: 'postgres',
        label: 'PostgreSQL',
        count: 8,
      });
    });

    it('should handle user names with proper capitalization', () => {
      const buckets = [
        {
          key: 'john.doe',
          doc_count: 45,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    owners: {
                      displayName: 'John Doe',
                    },
                  },
                },
              ],
            },
          },
        },
        {
          key: 'jane.smith',
          doc_count: 32,
          'top_hits#top': {
            hits: {
              hits: [
                {
                  _source: {
                    owners: {
                      displayName: 'Jane Smith',
                    },
                  },
                },
              ],
            },
          },
        },
      ];

      const result = getOptionsFromAggregationBucket(
        buckets as any,
        'owners.displayName'
      );

      expect(result).toEqual([
        { key: 'john.doe', label: 'John Doe', count: 45 },
        { key: 'jane.smith', label: 'Jane Smith', count: 32 },
      ]);
    });
  });
});
