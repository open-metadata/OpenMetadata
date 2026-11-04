/*
 *  Copyright 2026 Collate.
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
import { InternalAxiosRequestConfig } from 'axios';
import {
  DEFAULT_DOMAIN_VALUE,
  SKIP_DOMAIN_FILTER_HEADER,
} from '../constants/constants';
import { SearchIndex } from '../enums/search.enum';
import type { DataQualityReportBatchRequest } from '../generated/tests/dataQualityReportBatchRequest';
import { isProductTourRunning } from '../hooks/product-tour/useProductTourStore';
import { useDomainStore } from '../hooks/useDomainStore';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { getPathNameFromWindowLocation } from '../utils/LocationUtils';

const parseExistingFilter = (queryFilter?: string): QueryFilterInterface => {
  if (!queryFilter) {
    return { query: { bool: {} } };
  }

  try {
    const parsed = JSON.parse(queryFilter);

    return parsed?.query ? parsed : { query: { bool: {} } };
  } catch {
    return { query: { bool: {} } };
  }
};

const collectMustClauses = (
  filter: QueryFilterInterface
): QueryFieldInterface[] => {
  let mustArray: QueryFieldInterface[] = [];
  const existingMust = filter.query?.bool?.must;
  if (Array.isArray(existingMust)) {
    mustArray = [...existingMust];
  } else if (existingMust) {
    mustArray = [existingMust];
  }

  const { bool: _existingBool, ...nonBoolClauses } = filter.query ?? {};
  for (const [key, value] of Object.entries(nonBoolClauses)) {
    mustArray.push({ [key]: value } as QueryFieldInterface);
  }

  return mustArray;
};

// Reference data searched by pickers (tags, owners, team members) is never narrowed to the
// selected domain, or a pick would hide the people and tags an asset can be given.
const UNSCOPED_SEARCH_INDEXES = new Set<string>([
  SearchIndex.TAG,
  SearchIndex.USER,
  SearchIndex.TEAM,
]);

// A search may name several indexes, as a comma-joined string or an array (e.g. owner pickers
// search "team,user"); it stays unscoped only when every index it names is unscoped.
const isUnscopedSearch = (index?: string | string[]) => {
  const indexes = (Array.isArray(index) ? index : (index ?? '').split(','))
    .map((name) => name.trim())
    .filter(Boolean);

  return (
    indexes.length > 0 &&
    indexes.every((name) => UNSCOPED_SEARCH_INDEXES.has(name))
  );
};

/**
 * The navbar domain a request should be scoped to, or `undefined` when none is
 * selected or scoping is off (product tour, domain pages, auth calls).
 */
const getRequestDomain = (): string | undefined => {
  const { activeDomain } = useDomainStore.getState();
  const currentPath = getPathNameFromWindowLocation();
  // A product tour shows every user the same recorded pages, whatever domain
  // they have selected. Off while the tour is recorded too, so the recorded
  // requests are the ones the tour sends.
  const isUnscopedPage =
    isProductTourRunning() ||
    ['/domain', '/auth/logout', '/auth/refresh'].some((path) =>
      currentPath.startsWith(path)
    );

  return activeDomain === DEFAULT_DOMAIN_VALUE || isUnscopedPage
    ? undefined
    : activeDomain;
};

// The Data Quality dashboard batches its reports into one POST, so each item
// is scoped here the way a GET would be, unless the page scoped it itself.
const DQ_REPORT_BATCH_PATH = '/dataQualityReport/batch';

const withDomainOnReportBatch = (
  config: InternalAxiosRequestConfig,
  activeDomain: string
): InternalAxiosRequestConfig => {
  const body = config.data as DataQualityReportBatchRequest | undefined;
  if (body?.requests) {
    config.data = {
      ...body,
      requests: body.requests.map((request) => ({
        ...request,
        domain: request.domain || activeDomain,
      })),
    };
  }

  return config;
};

export const withDomainFilter = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  if (config.headers?.[SKIP_DOMAIN_FILTER_HEADER]) {
    delete config.headers[SKIP_DOMAIN_FILTER_HEADER];

    return config;
  }

  const activeDomain = getRequestDomain();

  if (
    activeDomain &&
    config.method === 'post' &&
    config.url?.includes(DQ_REPORT_BATCH_PATH)
  ) {
    return withDomainOnReportBatch(config, activeDomain);
  }

  if (config.method === 'get' && activeDomain) {
    if (config.url?.includes('/search/query')) {
      if (isUnscopedSearch(config.params?.index)) {
        return config;
      }

      const domainFilterField =
        config.params?.index === SearchIndex.DOMAIN
          ? 'fullyQualifiedName'
          : 'domains.fullyQualifiedName';
      const filter = parseExistingFilter(
        config.params?.query_filter as string | undefined
      );

      const mustArray = collectMustClauses(filter);
      const existingBool = filter.query?.bool;

      filter.query = {
        bool: {
          ...existingBool,
          must: [
            ...mustArray,
            {
              bool: {
                should: [
                  {
                    term: {
                      [domainFilterField]: activeDomain,
                    },
                  },
                  {
                    prefix: {
                      [domainFilterField]: `${activeDomain}.`,
                    },
                  },
                ],
              },
            } as QueryFieldInterface,
          ],
        },
      };

      config.params = {
        ...config.params,
        query_filter: JSON.stringify(filter),
      };
    } else {
      config.params = {
        ...config.params,
        domain: activeDomain,
      };
    }
  }

  return config;
};
