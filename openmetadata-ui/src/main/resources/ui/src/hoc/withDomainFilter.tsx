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
import { DEFAULT_DOMAIN_VALUE } from '../constants/constants';
import { SearchIndex } from '../enums/search.enum';
import { useDomainStore } from '../hooks/useDomainStore';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { getPathNameFromWindowLocation } from '../utils/LocationUtils';

// Global domain sent to the server so it can scope every REST list centrally (read in the auth
// filters, applied in EntityUtil.addDomainQueryParam) -- mirrors the active-persona header. Carries
// the domain id so the backend can intersect it with the user's accessible domains.
export const ACTIVE_DOMAIN_HEADER = 'X-OpenMetadata-Domain';

export const withDomainFilter = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  const isGetRequest = config.method === 'get';
  const { activeDomain, activeDomainEntityRef } = useDomainStore.getState();
  const hasActiveDomain = activeDomain !== DEFAULT_DOMAIN_VALUE;
  const currentPath = getPathNameFromWindowLocation();

  const shouldNotIntercept = [
    '/domain',
    '/auth/logout',
    '/auth/refresh',
  ].reduce((prev, curr) => {
    return prev || currentPath.startsWith(curr);
  }, false);

  if (shouldNotIntercept) {
    return config;
  }

  if (isGetRequest && hasActiveDomain) {
    if (config.url?.includes('/search/query')) {
      if (config.params?.index === SearchIndex.TAG) {
        return config;
      }

      const domainFilterField =
        config.params?.index === SearchIndex.DOMAIN
          ? 'fullyQualifiedName'
          : 'domains.fullyQualifiedName';
      let filter: QueryFilterInterface = { query: { bool: {} } };
      if (config.params?.query_filter) {
        try {
          const parsed = JSON.parse(config.params.query_filter as string);
          filter = parsed?.query ? parsed : { query: { bool: {} } };
        } catch {
          filter = { query: { bool: {} } };
        }
      }

      let mustArray: QueryFieldInterface[] = [];
      const existingMust = filter.query?.bool?.must;
      if (Array.isArray(existingMust)) {
        mustArray = [...existingMust];
      } else if (existingMust) {
        mustArray = [existingMust];
      }

      const { bool: existingBool, ...nonBoolClauses } = filter.query ?? {};
      for (const [key, value] of Object.entries(nonBoolClauses)) {
        mustArray.push({ [key]: value } as QueryFieldInterface);
      }

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
    } else if (activeDomainEntityRef?.id) {
      // REST list endpoints: scope centrally on the server via the header (no per-API ?domain param).
      config.headers[ACTIVE_DOMAIN_HEADER] = activeDomainEntityRef.id;
    }
  }

  return config;
};
