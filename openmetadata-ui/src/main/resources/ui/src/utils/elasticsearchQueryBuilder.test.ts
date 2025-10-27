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
import { buildDomainFilter, buildTermQuery } from './elasticsearchQueryBuilder';

describe('elasticsearchQueryBuilder', () => {
  describe('buildDomainFilter', () => {
    it('should return undefined for empty domain array', () => {
      expect(buildDomainFilter([])).toBeUndefined();
    });

    it('should build filter for single domain', () => {
      const result = buildDomainFilter(['domain1']);

      expect(result).toEqual({
        query: {
          bool: {
            should: [
              {
                term: {
                  'domains.fullyQualifiedName': {
                    value: 'domain1',
                  },
                },
              },
            ],
          },
        },
      });
    });

    it('should build filter for multiple domains', () => {
      const result = buildDomainFilter(['domain1', 'domain2']);

      expect(result).toEqual({
        query: {
          bool: {
            should: [
              {
                term: {
                  'domains.fullyQualifiedName': {
                    value: 'domain1',
                  },
                },
              },
              {
                term: {
                  'domains.fullyQualifiedName': {
                    value: 'domain2',
                  },
                },
              },
            ],
          },
        },
      });
    });

    it('should use custom field name when provided', () => {
      const result = buildDomainFilter(['domain1'], {
        fieldName: 'custom.field',
      });

      expect(result).toEqual({
        query: {
          bool: {
            should: [
              {
                term: {
                  'custom.field': {
                    value: 'domain1',
                  },
                },
              },
            ],
          },
        },
      });
    });
  });

  describe('buildTermQuery', () => {
    it('should build simple term query for single filter', () => {
      const result = buildTermQuery(
        { field: 'classification.name.keyword', value: 'tier' },
        false
      );

      expect(result).toEqual({
        query: {
          bool: {
            must: {
              term: {
                'classification.name.keyword': 'tier',
              },
            },
          },
        },
      });
    });

    it('should build simple term query as string by default', () => {
      const result = buildTermQuery({
        field: 'classification.name.keyword',
        value: 'tier',
      });

      expect(result).toBe(
        '{"query":{"bool":{"must":{"term":{"classification.name.keyword":"tier"}}}}}'
      );
    });

    it('should build term query with negation (must_not)', () => {
      const result = buildTermQuery(
        {
          field: 'classification.name.keyword',
          value: 'tier',
          negate: true,
        },
        false
      );

      expect(result).toEqual({
        query: {
          bool: {
            must_not: {
              term: {
                'classification.name.keyword': 'tier',
              },
            },
          },
        },
      });
    });

    it('should build term query with multiple negations', () => {
      const result = buildTermQuery(
        [
          {
            field: 'classification.name.keyword',
            value: 'tier',
            negate: true,
          },
          {
            field: 'classification.name.keyword',
            value: 'certification',
            negate: true,
          },
        ],
        false
      );

      expect(result).toEqual({
        query: {
          bool: {
            must_not: [
              {
                term: {
                  'classification.name.keyword': 'tier',
                },
              },
              {
                term: {
                  'classification.name.keyword': 'certification',
                },
              },
            ],
          },
        },
      });
    });

    it('should build term query with mixed must and must_not', () => {
      const result = buildTermQuery(
        [
          {
            field: 'status',
            value: 'active',
          },
          {
            field: 'classification.name.keyword',
            value: 'tier',
            negate: true,
          },
        ],
        false
      );

      expect(result).toEqual({
        query: {
          bool: {
            must: {
              term: {
                status: 'active',
              },
            },
            must_not: {
              term: {
                'classification.name.keyword': 'tier',
              },
            },
          },
        },
      });
    });

    it('should build term query with multiple must filters', () => {
      const result = buildTermQuery(
        [
          {
            field: 'status',
            value: 'active',
          },
          {
            field: 'type',
            value: 'table',
          },
        ],
        false
      );

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              {
                term: {
                  status: 'active',
                },
              },
              {
                term: {
                  type: 'table',
                },
              },
            ],
          },
        },
      });
    });

    it('should return string when returnAsString is true', () => {
      const result = buildTermQuery({
        field: 'classification.name.keyword',
        value: 'certification',
      });

      expect(typeof result).toBe('string');
      expect(result).toBe(
        '{"query":{"bool":{"must":{"term":{"classification.name.keyword":"certification"}}}}}'
      );
    });

    it('should match the exact output for TAG field query', () => {
      const result = buildTermQuery([
        {
          field: 'classification.name.keyword',
          value: 'tier',
          negate: true,
        },
        {
          field: 'classification.name.keyword',
          value: 'certification',
          negate: true,
        },
      ]);

      expect(result).toBe(
        '{"query":{"bool":{"must_not":[{"term":{"classification.name.keyword":"tier"}},{"term":{"classification.name.keyword":"certification"}}]}}}'
      );
    });

    it('should match the exact output for CERTIFICATION field query', () => {
      const result = buildTermQuery({
        field: 'classification.name.keyword',
        value: 'certification',
      });

      expect(result).toBe(
        '{"query":{"bool":{"must":{"term":{"classification.name.keyword":"certification"}}}}}'
      );
    });

    it('should match the exact output for TIER field query', () => {
      const result = buildTermQuery({
        field: 'classification.name.keyword',
        value: 'tier',
      });

      expect(result).toBe(
        '{"query":{"bool":{"must":{"term":{"classification.name.keyword":"tier"}}}}}'
      );
    });
  });
});
