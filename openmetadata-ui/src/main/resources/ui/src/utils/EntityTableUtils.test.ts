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

import { SearchIndex } from '../enums/search.enum';
import { EntitySearchFilters } from '../hooks/useDynamicEntitySearch';
import {
  buildEntitySearchQuery,
  buildEntityTableQueryFilter,
  buildExcludeSubdomainsFilter,
} from './EntityTableUtils';

describe('EntityTableUtils', () => {
  describe('buildExcludeSubdomainsFilter', () => {
    it('should create a filter to exclude domains with a parent field', () => {
      const filter = buildExcludeSubdomainsFilter();

      expect(filter).toEqual({
        bool: {
          must_not: [
            {
              exists: {
                field: 'parent',
              },
            },
          ],
        },
      });
    });
  });

  describe('buildEntityTableQueryFilter', () => {
    const mockFilters: EntitySearchFilters = {
      owners: [],
      glossaryTerms: [],
      domainTypes: [],
      tags: [],
    };

    it('should return undefined when no filters are applied', () => {
      const result = buildEntityTableQueryFilter(mockFilters);

      expect(result).toBeUndefined();
    });

    it('should exclude subdomains when searchIndex is DOMAIN', () => {
      const result = buildEntityTableQueryFilter(
        mockFilters,
        SearchIndex.DOMAIN
      );

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              {
                bool: {
                  must_not: [
                    {
                      exists: {
                        field: 'parent',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    });

    it('should not exclude subdomains when searchIndex is not DOMAIN', () => {
      const result = buildEntityTableQueryFilter(
        mockFilters,
        SearchIndex.DATA_PRODUCT
      );

      expect(result).toBeUndefined();
    });

    it('should include owner filters when owners are specified', () => {
      const filtersWithOwners: EntitySearchFilters = {
        ...mockFilters,
        owners: ['owner1', 'owner2'],
      };

      const result = buildEntityTableQueryFilter(
        filtersWithOwners,
        SearchIndex.DOMAIN
      );

      expect(result?.query?.bool?.must).toContainEqual({
        bool: {
          should: [
            { term: { 'owners.name.keyword': 'owner1' } },
            { term: { 'owners.name.keyword': 'owner2' } },
          ],
        },
      });
    });

    it('should include domain type filters when domainTypes are specified', () => {
      const filtersWithDomainTypes: EntitySearchFilters = {
        ...mockFilters,
        domainTypes: ['Aggregate', 'Consumer-aligned'],
      };

      const result = buildEntityTableQueryFilter(
        filtersWithDomainTypes,
        SearchIndex.DOMAIN
      );

      expect(result?.query?.bool?.must).toContainEqual({
        bool: {
          should: [
            { term: { 'domainType.keyword': 'Aggregate' } },
            { term: { 'domainType.keyword': 'Consumer-aligned' } },
          ],
        },
      });
    });

    it('should include glossary term filters', () => {
      const filtersWithGlossary: EntitySearchFilters = {
        ...mockFilters,
        glossaryTerms: ['term1', 'term2'],
      };

      const result = buildEntityTableQueryFilter(
        filtersWithGlossary,
        SearchIndex.DOMAIN
      );

      expect(result?.query?.bool?.must).toContainEqual({
        bool: {
          should: [
            { term: { 'tags.tagFQN': 'term1' } },
            { term: { 'tags.tagFQN': 'term2' } },
          ],
          must: [{ term: { 'tags.source': 'Glossary' } }],
        },
      });
    });

    it('should include tag filters excluding glossary terms', () => {
      const filtersWithTags: EntitySearchFilters = {
        ...mockFilters,
        tags: ['tag1', 'tag2'],
      };

      const result = buildEntityTableQueryFilter(
        filtersWithTags,
        SearchIndex.DOMAIN
      );

      expect(result?.query?.bool?.must).toContainEqual({
        bool: {
          should: [
            { term: { 'tags.tagFQN': 'tag1' } },
            { term: { 'tags.tagFQN': 'tag2' } },
          ],
          must_not: [{ term: { 'tags.source': 'Glossary' } }],
        },
      });
    });
  });

  describe('buildEntitySearchQuery', () => {
    it('should return wildcard query when no search term', () => {
      const result = buildEntitySearchQuery('');

      expect(result).toBe('*');
    });

    it('should return base query when no search term but base query provided', () => {
      const result = buildEntitySearchQuery('', 'domainType:Aggregate');

      expect(result).toBe('domainType:Aggregate');
    });

    it('should build search query with wildcards', () => {
      const result = buildEntitySearchQuery('test');

      expect(result).toBe(
        '(displayName:*test* OR name:*test* OR description:*test*)'
      );
    });

    it('should combine base query with search term', () => {
      const result = buildEntitySearchQuery('test', 'domainType:Aggregate');

      expect(result).toBe(
        'domainType:Aggregate AND (displayName:*test* OR name:*test* OR description:*test*)'
      );
    });
  });
});
