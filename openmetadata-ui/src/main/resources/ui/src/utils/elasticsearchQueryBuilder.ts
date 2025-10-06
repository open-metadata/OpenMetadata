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

/**
 * Interface for domain filter options
 */
export interface DomainFilterOptions {
  fieldName?: string;
  minimumShouldMatch?: number;
  boost?: number;
}

/**
 * Builds an Elasticsearch query filter for multiple domain FQNs
 *
 * @example
 * ```typescript
 * // Basic usage
 * const filter = buildDomainFilter(['domain1', 'domain2']);
 *
 * // With options
 * const filter = buildDomainFilter(['domain1', 'domain2'], {
 *   minimumShouldMatch: 2, // Must match at least 2 domains
 *   boost: 2.0 // Boost the relevance score
 * });
 * ```
 *
 * @param domainFQNs - Array of domain fully qualified names
 * @param options - Optional configuration for the filter
 * @returns Elasticsearch query filter object
 */
export const buildDomainFilter = (
  domainFQNs: string[],
  options: DomainFilterOptions = {}
): Record<string, unknown> | undefined => {
  const { fieldName = 'domains.fullyQualifiedName' } = options;

  if (!domainFQNs || domainFQNs.length === 0) {
    return undefined;
  }

  return {
    query: {
      bool: {
        should: domainFQNs.map((domainFQN) => ({
          term: {
            [fieldName]: {
              value: domainFQN,
            },
          },
        })),
      },
    },
  };
};

/**
 * Interface for term filter configuration
 */
interface TermFilter {
  field: string;
  value: string;
  negate?: boolean;
}

/**
 * Builds an Elasticsearch query filter for term conditions
 *
 * @example
 * ```typescript
 * // Single term filter
 * const filter = buildTermQuery({ field: 'classification.name.keyword', value: 'tier' });
 *
 * // Multiple must filters
 * const filter = buildTermQuery([
 *   { field: 'classification.name.keyword', value: 'tier' }
 * ]);
 *
 * // With negation (must_not)
 * const filter = buildTermQuery([
 *   { field: 'classification.name.keyword', value: 'tier', negate: true },
 *   { field: 'classification.name.keyword', value: 'certification', negate: true }
 * ]);
 * ```
 *
 * @param filters - Single filter or array of term filters
 * @param returnAsString - If true, returns stringified JSON; otherwise returns object
 * @returns Elasticsearch query filter as object or JSON string
 */
export const buildTermQuery = (
  filters: TermFilter | TermFilter[],
  returnAsString = true
): string | Record<string, unknown> => {
  const filterArray = Array.isArray(filters) ? filters : [filters];

  const must = filterArray
    .filter((f) => !f.negate)
    .map((f) => ({ term: { [f.field]: f.value } }));

  const mustNot = filterArray
    .filter((f) => f.negate)
    .map((f) => ({ term: { [f.field]: f.value } }));

  const boolQuery: Record<string, unknown> = {};

  if (must.length === 1 && mustNot.length === 0) {
    boolQuery.must = must[0];
  } else if (must.length > 1 || mustNot.length > 0) {
    if (must.length > 0) {
      boolQuery.must = must.length === 1 ? must[0] : must;
    }
    if (mustNot.length > 0) {
      boolQuery.must_not = mustNot.length === 1 ? mustNot[0] : mustNot;
    }
  }

  const queryObject = {
    query: {
      bool: boolQuery,
    },
  };

  return returnAsString ? JSON.stringify(queryObject) : queryObject;
};
