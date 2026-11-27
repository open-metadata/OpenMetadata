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
import { useDomainStore } from '../hooks/useDomainStore';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { getPathNameFromWindowLocation } from '../utils/LocationUtils';

// Tasks follow the pick like any other list, except a list about given assets (e.g. an asset's
// Tasks tab): an opened asset shows all its tasks, as the rest of its page does.
const TASKS_PATH = '/tasks';
const ABOUT_ASSET_TASK_PARAMS = ['aboutEntity', 'aboutEntityIds', 'dataset'];

const isTaskListAboutAssets = (config: InternalAxiosRequestConfig) =>
  (config.url === TASKS_PATH ||
    Boolean(config.url?.startsWith(`${TASKS_PATH}/`))) &&
  ABOUT_ASSET_TASK_PARAMS.some((param) => Boolean(config.params?.[param]));

// An asset's own activity (its Activity tab) is not narrowed either; the activity feed is.
const ASSET_ACTIVITY_PATH = '/activity/entity/';

const isAboutOneAsset = (config: InternalAxiosRequestConfig) =>
  config.method === 'get' &&
  (isTaskListAboutAssets(config) ||
    Boolean(config.url?.startsWith(ASSET_ACTIVITY_PATH)));

// A request about one asset never carries the pick, even when its caller passed one.
const withoutDomain = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  const { domain: _domain, ...params } = config.params ?? {};
  config.params = params;

  return config;
};

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

// Mostly global content (e.g. Context Center articles) keeps items with no domain under a pick,
// as its list endpoint does, so a search or sort does not change what the list shows.
const KEEPS_UNASSIGNED_SEARCH_INDEXES = new Set<string>([
  SearchIndex.KNOWLEDGE_PAGE_INDEX,
]);

const keepsUnassignedSearch = (index?: string | string[]) =>
  (Array.isArray(index) ? index : (index ?? '').split(','))
    .map((name) => name.trim())
    .some((name) => KEEPS_UNASSIGNED_SEARCH_INDEXES.has(name));

/**
 * The navbar domain a request should be scoped to, or `undefined` when none is
 * selected or scoping is off (domain pages, auth calls).
 */
const getRequestDomain = (): string | undefined => {
  const { activeDomain } = useDomainStore.getState();
  const currentPath = getPathNameFromWindowLocation();
  const isUnscopedPage = ['/domain', '/auth/logout', '/auth/refresh'].some(
    (path) => currentPath.startsWith(path)
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

// A domain clause matches the picked domain and its sub-domains, plus items with no domain on
// indexes that keep them.
const domainClause = (
  field: string,
  activeDomain: string,
  keepUnassigned: boolean
): QueryFieldInterface =>
  ({
    bool: {
      should: [
        { term: { [field]: activeDomain } },
        { prefix: { [field]: `${activeDomain}.` } },
        ...(keepUnassigned
          ? [{ bool: { must_not: { exists: { field } } } }]
          : []),
      ],
    },
  } as QueryFieldInterface);

const scopeSearchFilter = (
  index: string | string[] | undefined,
  queryFilter: string | undefined,
  activeDomain: string
): string | undefined => {
  if (isUnscopedSearch(index)) {
    return queryFilter;
  }

  const field =
    index === SearchIndex.DOMAIN
      ? 'fullyQualifiedName'
      : 'domains.fullyQualifiedName';
  const filter = parseExistingFilter(queryFilter);
  filter.query = {
    bool: {
      ...filter.query?.bool,
      must: [
        ...collectMustClauses(filter),
        domainClause(field, activeDomain, keepsUnassignedSearch(index)),
      ],
    },
  };

  return JSON.stringify(filter);
};

const withDomainOnSearch = (
  config: InternalAxiosRequestConfig,
  activeDomain: string
): InternalAxiosRequestConfig => {
  config.params = {
    ...config.params,
    query_filter: scopeSearchFilter(
      config.params?.index,
      config.params?.query_filter as string | undefined,
      activeDomain
    ),
  };

  return config;
};

// Searches whose filter is too large for a URL (e.g. a metric's linked asset ids) are POSTed
// with the same inputs in the body; they follow the pick exactly as the GET does.
const withDomainOnSearchBody = (
  config: InternalAxiosRequestConfig,
  activeDomain: string
): InternalAxiosRequestConfig => {
  // A request replayed after a token refresh carries the body axios already serialized.
  const body = (
    typeof config.data === 'string' ? JSON.parse(config.data) : config.data
  ) as { index?: string | string[]; queryFilter?: string } | undefined;
  config.data = {
    ...body,
    queryFilter: scopeSearchFilter(
      body?.index,
      body?.queryFilter,
      activeDomain
    ),
  };

  return config;
};

const withDomainOnPostBody = (
  config: InternalAxiosRequestConfig,
  activeDomain: string
): InternalAxiosRequestConfig => {
  if (config.url?.includes(DQ_REPORT_BATCH_PATH)) {
    return withDomainOnReportBatch(config, activeDomain);
  }
  if (config.url?.includes('/search/query')) {
    return withDomainOnSearchBody(config, activeDomain);
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

  if (activeDomain && config.method === 'post') {
    return withDomainOnPostBody(config, activeDomain);
  }

  if (isAboutOneAsset(config)) {
    return withoutDomain(config);
  }

  if (!activeDomain || config.method !== 'get') {
    return config;
  }

  if (config.url?.includes('/search/query')) {
    return withDomainOnSearch(config, activeDomain);
  }
  config.params = { ...config.params, domain: activeDomain };

  return config;
};
