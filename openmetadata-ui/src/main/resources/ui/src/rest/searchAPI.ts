/*
 *  Copyright 2022 Collate.
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

import { AxiosResponse } from 'axios';
import { isArray, isNil } from 'lodash';
import { SearchIndex } from '../enums/search.enum';
import {
  Aggregations,
  KeysOfUnion,
  RawSuggestResponse,
  SearchIndexSearchSourceMapping,
  SearchRequest,
  SearchResponse,
  SuggestRequest,
  SuggestResponse,
} from '../interface/search.interface';
import { omitDeep } from '../utils/APIUtils';
import { getQueryWithSlash } from '../utils/SearchUtils';
import APIClient from './index';

const getSearchIndexParam: (
  si: SearchIndex | SearchIndex[] | undefined
) => string | undefined = (si) => {
  if (isNil(si)) {
    return undefined;
  }

  if (isArray(si)) {
    return si.join(',');
  }

  return si;
};

/**
 * Formats a response from {@link rawSearchQuery}
 *
 * Warning: avoid this pattern unless applying custom transformation to the raw response!
 * ```ts
 * const response = await rawSearchQuery(req);
 * const data = formatSearchQueryResponse(response.data);
 * ```
 *
 * Instead use the shorthand {@link searchQuery}
 * ```ts
 * const data = searchQuery(req);
 * ```
 *
 * @param data
 */
export const formatSearchQueryResponse = <
  SI extends SearchIndex | SearchIndex[],
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
      ? SI[number]
      : SI]
  >
>(
  data: SearchResponse<
    SI extends Array<SearchIndex> ? SI[number] : SI,
    TIncludeFields
  >
): SearchResponse<
  SI extends Array<SearchIndex> ? SI[number] : SI,
  TIncludeFields
> => {
  let _data = {} as SearchResponse<
    SI extends Array<SearchIndex> ? SI[number] : SI,
    TIncludeFields
  >;

  _data = data;

  /* Elasticsearch responses use 'null' for missing values, we want undefined
       omitDeep is untyped, so this will return unknown, which is not necessarily bad
       since we need to do some more transformations to the response */
  _data = omitDeep<
    SearchResponse<
      SI extends Array<SearchIndex> ? SI[number] : SI,
      TIncludeFields
    >
  >(_data, isNil);

  /* Elasticsearch objects use `entityType` to track their type, but the EntityReference interface uses `type`
      This copies `entityType` into `type` (if `entityType` exists) so responses implement EntityReference */
  _data = {
    ..._data,
    hits: {
      ..._data.hits,
      hits: isArray(_data.hits.hits)
        ? _data.hits.hits.map((hit) =>
            '_source' in hit
              ? 'entityType' in hit._source
                ? {
                    ...hit,
                    _source: {
                      ...(hit._source as SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
                        ? SI[number]
                        : SI]),
                      type: (
                        hit._source as SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
                          ? SI[number]
                          : SI]
                      ).entityType,
                    },
                  }
                : hit
              : hit
          )
        : [],
    },
  };

  /* Aggregation key start with 'sterms#' - this is caused by the serialization of the ElasticsearchResponse
      Java object. For usability this prefix is removed from keys.  */
  _data = {
    ..._data,
    aggregations:
      _data.aggregations &&
      (Object.fromEntries(
        Object.entries(_data.aggregations).map(([key, value]) => [
          key.replace('sterms#', ''),
          value,
        ])
      ) as Aggregations),
  };

  return _data;
};

/**
 * Executes a request to /search/query, returning the raw response.
 * Warning: Only call this function directly in special cases. Otherwise use {@link searchQuery}
 *
 * @param req Request object
 */
export const rawSearchQuery = <
  SI extends SearchIndex | SearchIndex[],
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
      ? SI[number]
      : SI]
  >
>(
  req: SearchRequest<SI, TIncludeFields>
): Promise<
  AxiosResponse<
    SearchResponse<
      SI extends Array<SearchIndex> ? SI[number] : SI,
      TIncludeFields
    >
  >
> => {
  const {
    query,
    pageNumber = 1,
    pageSize = 10,
    queryFilter,
    sortField,
    sortOrder,
    searchIndex,
    includeDeleted,
    trackTotalHits,
    postFilter,
    fetchSource,
  } = req;

  return APIClient.get<
    SearchResponse<
      SI extends Array<SearchIndex> ? SI[number] : SI,
      TIncludeFields
    >
  >('/search/query', {
    params: {
      q: getQueryWithSlash(query || ''),
      index: getSearchIndexParam(searchIndex),
      from: (pageNumber - 1) * pageSize,
      size: pageSize,
      deleted: includeDeleted,
      query_filter: JSON.stringify(queryFilter),
      post_filter: JSON.stringify(postFilter),
      sort_field: sortField,
      sort_order: sortOrder,
      track_total_hits: trackTotalHits,
      fetch_source: fetchSource,
      include_source_fields: req.fetchSource ? req.includeFields : undefined,
    },
  });
};

/**
 * Access point for the Search API.
 * Executes a request to /search/query, returning a formatted response.
 *
 * @param req Request object
 */
export const searchQuery = async <
  SI extends SearchIndex | SearchIndex[],
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
      ? SI[number]
      : SI]
  >
>(
  req: SearchRequest<SI, TIncludeFields>
): Promise<
  SearchResponse<
    SI extends Array<SearchIndex> ? SI[number] : SI,
    TIncludeFields
  >
> => {
  const res = await rawSearchQuery(req);

  return formatSearchQueryResponse(res.data);
};

/**
 * Formats a response from {@link rawSuggestQuery}
 *
 * Warning: avoid this pattern unless applying custom transformation to the raw response!
 * ```ts
 * const response = await rawSuggestQuery(req);
 * const data = formatSuggestQueryResponse(response.data);
 * ```
 *
 * Instead use the shorthand {@link suggestQuery}
 * ```ts
 * const data = suggestQuery(req);
 * ```
 *
 * @param data
 */
export const formatSuggestQueryResponse = <
  SI extends SearchIndex | SearchIndex[],
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
      ? SI[number]
      : SI]
  >
>(
  data: RawSuggestResponse<
    SI extends Array<SearchIndex> ? SI[number] : SI,
    TIncludeFields
  >
): SuggestResponse<
  SI extends Array<SearchIndex> ? SI[number] : SI,
  TIncludeFields
> => {
  let _data;

  _data = data;

  // Elasticsearch responses use 'null' for missing values, we want undefined
  _data = omitDeep<
    SuggestResponse<
      SI extends Array<SearchIndex> ? SI[number] : SI,
      TIncludeFields
    >
  >(_data.suggest['metadata-suggest'][0].options, isNil);

  /* Elasticsearch objects use `entityType` to track their type, but the EntityReference interface uses `type`
      This copies `entityType` into `type` (if `entityType` exists) so responses implement EntityReference */
  _data = _data.map((datum) =>
    '_source' in datum
      ? 'entityType' in datum._source
        ? {
            ...datum,
            _source: {
              ...(datum._source as SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
                ? SI[number]
                : SI]),
              type: (
                datum._source as SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
                  ? SI[number]
                  : SI]
              ).entityType,
            },
          }
        : datum
      : datum
  );

  return _data;
};

/**
 * Executes a request to /search/suggest, returning the raw response.
 * Warning: Only call this function directly in special cases. Otherwise use {@link suggestQuery}
 *
 * @param req Request object
 */
export const rawSuggestQuery = <
  SI extends SearchIndex | SearchIndex[],
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
      ? SI[number]
      : SI]
  >
>(
  req: SuggestRequest<SI, TIncludeFields>
): Promise<
  AxiosResponse<
    RawSuggestResponse<
      SI extends Array<SearchIndex> ? SI[number] : SI,
      TIncludeFields
    >
  >
> => {
  const { query, searchIndex, field, fetchSource } = req;

  return APIClient.get<
    RawSuggestResponse<
      SI extends Array<SearchIndex> ? SI[number] : SI,
      TIncludeFields
    >
  >('/search/suggest', {
    params: {
      q: query,
      field,
      index: getSearchIndexParam(searchIndex),
      fetch_source: fetchSource,
      include_source_fields: req.fetchSource ? req.includeFields : undefined,
    },
  });
};

/**
 * Access point for the Suggestion API.
 * Executes a request to /search/suggest, returning a formatted response.
 *
 * @param req Request object
 */
export const suggestQuery = async <
  SI extends SearchIndex | SearchIndex[],
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
      ? SI[number]
      : SI]
  >
>(
  req: SuggestRequest<SI, TIncludeFields>
): Promise<
  SuggestResponse<
    SI extends Array<SearchIndex> ? SI[number] : SI,
    TIncludeFields
  >
> => {
  const res = await rawSuggestQuery(req);

  return formatSuggestQueryResponse(res.data);
};
