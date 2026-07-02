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

import { EntityType } from '../enums/entity.enum';
import type { Domain } from '../generated/entity/domains/domain';
import type { EntityReference } from '../generated/entity/type';
import type {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { getEntityReferenceFromEntity } from './EntityReferenceUtils';

export const getQueryFilterToIncludeDomain = (
  domainFqn: string,
  dataProductFqn: string
) => ({
  query: {
    bool: {
      must: [
        {
          term: {
            'domains.fullyQualifiedName': domainFqn,
          },
        },
        {
          bool: {
            must_not: [
              {
                term: {
                  'dataProducts.fullyQualifiedName': dataProductFqn,
                },
              },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                terms: {
                  entityType: [
                    EntityType.DATA_PRODUCT,
                    EntityType.TEST_SUITE,
                    EntityType.QUERY,
                    EntityType.TEST_CASE,
                    EntityType.TABLE_COLUMN,
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
});

export const getQueryFilterToExcludeDomainTerms = (
  fqn: string,
  parentFqn?: string
): QueryFilterInterface => {
  const mustTerm: QueryFieldInterface[] = parentFqn
    ? [
        {
          term: {
            'domains.fullyQualifiedName': parentFqn,
          },
        },
      ]
    : [];

  return {
    query: {
      bool: {
        must: mustTerm.concat([
          {
            bool: {
              must_not: [
                {
                  term: {
                    'domains.fullyQualifiedName': fqn,
                  },
                },
              ],
            },
          },
          {
            bool: {
              must_not: [
                {
                  terms: {
                    entityType: [EntityType.TABLE_COLUMN],
                  },
                },
              ],
            },
          },
        ]),
      },
    },
  };
};

/**
 * Returns an Elasticsearch query filter for fetching assets belonging to a domain,
 * excluding DataProduct entities. Use this for general domain asset listings.
 * @param domainFqn - The fully qualified name of the domain
 */
export const getQueryFilterForDomain = (domainFqn: string) => {
  if (!domainFqn) {
    return { query: { match_none: {} } };
  }

  return {
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                {
                  term: {
                    'domains.fullyQualifiedName': domainFqn,
                  },
                },
                {
                  prefix: {
                    'domains.fullyQualifiedName': `${domainFqn}.`,
                  },
                },
              ],
            },
          },
        ],
        must_not: [
          {
            terms: {
              entityType: [EntityType.DATA_PRODUCT, EntityType.TABLE_COLUMN],
            },
          },
        ],
      },
    },
  };
};

/**
 * Returns an Elasticsearch query filter for fetching DataProduct entities within a domain.
 * Unlike getQueryFilterForDomain, this does not exclude any entity types.
 * @param domainFqn - The fully qualified name of the domain
 */
export const getQueryFilterForDataProducts = (domainFqn: string) => {
  if (!domainFqn) {
    return { query: { match_none: {} } };
  }

  return {
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                {
                  term: {
                    'domains.fullyQualifiedName': domainFqn,
                  },
                },
                {
                  prefix: {
                    'domains.fullyQualifiedName': `${domainFqn}.`,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };
};

/**
 * Recursively checks if a domain exists in the hierarchy
 * @param domain The domain to search in
 * @param searchDomain The domain to search for
 * @returns boolean indicating if the domain exists
 */
export const isDomainExist = (
  domain: Domain,
  searchDomainFqn: string
): boolean => {
  if (domain.fullyQualifiedName === searchDomainFqn) {
    return true;
  }

  if (domain.children?.length) {
    return domain.children.some((child) =>
      isDomainExist(child as unknown as Domain, searchDomainFqn)
    );
  }

  return false;
};

export const initializeDomainEntityRef = (
  domains: EntityReference[],
  activeDomainKey: string
) => {
  const domain = domains.find((item) => {
    return item.fullyQualifiedName === activeDomainKey;
  });
  if (domain) {
    return getEntityReferenceFromEntity(domain, EntityType.DOMAIN);
  }

  return undefined;
};

export const domainBuildESQuery = (
  filters: Record<string, string[]>,
  baseFilter?: string
): Record<string, unknown> => {
  let query = baseFilter ? JSON.parse(baseFilter) : null;

  if (!query) {
    query = {
      query: {
        bool: {
          must: [],
        },
      },
    };
  }

  if (!query.query) {
    query.query = { bool: { must: [] } };
  }
  if (!query.query.bool) {
    query.query.bool = { must: [] };
  }
  if (!query.query.bool.must) {
    query.query.bool.must = [];
  }

  for (const [filterKey, values] of Object.entries(filters)) {
    if (!values || values.length === 0) {
      continue;
    }

    if (values.length === 1) {
      query.query.bool.must.push({
        term: {
          [filterKey]: values[0],
        },
      });
    } else {
      query.query.bool.must.push({
        terms: {
          [filterKey]: values,
        },
      });
    }
  }

  return query;
};
