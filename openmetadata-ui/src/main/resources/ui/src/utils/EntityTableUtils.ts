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

import { isEmpty } from 'lodash';
import { SearchIndex } from '../enums/search.enum';
import { EntitySearchFilters } from '../hooks/useDynamicEntitySearch';

/**
 * Creates a filter to exclude subdomains (domains with a parent)
 */
export function buildExcludeSubdomainsFilter(): Record<string, unknown> {
  return {
    bool: {
      must_not: [
        {
          exists: {
            field: 'parent',
          },
        },
      ],
    },
  };
}

/**
 * Builds an Elasticsearch query filter from entity table filters
 */
export function buildEntityTableQueryFilter(
  filters: EntitySearchFilters,
  searchIndex?: SearchIndex
): Record<string, unknown> | undefined {
  const mustClauses: Array<Record<string, unknown>> = [];

  if (searchIndex === SearchIndex.DOMAIN) {
    mustClauses.push(buildExcludeSubdomainsFilter());
  }

  if (!isEmpty(filters.owners)) {
    mustClauses.push({
      bool: {
        should: filters.owners.map((owner) => ({
          term: {
            'owners.name.keyword': owner,
          },
        })),
      },
    });
  }

  if (!isEmpty(filters.glossaryTerms)) {
    mustClauses.push({
      bool: {
        should: filters.glossaryTerms.map((term) => ({
          term: {
            'tags.tagFQN': term,
          },
        })),
        must: [
          {
            term: {
              'tags.source': 'Glossary',
            },
          },
        ],
      },
    });
  }

  if (!isEmpty(filters.domainTypes)) {
    mustClauses.push({
      bool: {
        should: filters.domainTypes.map((domainType) => ({
          term: {
            'domainType.keyword': domainType,
          },
        })),
      },
    });
  }

  if (!isEmpty(filters.tags)) {
    mustClauses.push({
      bool: {
        should: filters.tags.map((tag) => ({
          term: {
            'tags.tagFQN': tag,
          },
        })),
        must_not: [
          {
            term: {
              'tags.source': 'Glossary',
            },
          },
        ],
      },
    });
  }

  if (isEmpty(mustClauses)) {
    return undefined;
  }

  return {
    query: {
      bool: {
        must: mustClauses,
      },
    },
  };
}

/**
 * Builds search query parameters for entity table search
 */
export function buildEntitySearchQuery(
  searchTerm: string,
  baseQuery = ''
): string {
  if (!searchTerm?.trim()) {
    return baseQuery || '*';
  }

  const escapedTerm = searchTerm.trim();
  const wildcardTerm = `*${escapedTerm}*`;

  if (baseQuery) {
    return `${baseQuery} AND (displayName:${wildcardTerm} OR name:${wildcardTerm} OR description:${wildcardTerm})`;
  }

  return `(displayName:${wildcardTerm} OR name:${wildcardTerm} OR description:${wildcardTerm})`;
}
