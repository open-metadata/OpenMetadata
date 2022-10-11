/*
 *  Copyright 2021 Collate
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

import { isArray, isNil } from 'lodash';
import { SearchIndex } from '../enums/search.enum';
import {
  Aggregations,
  KeysOfUnion,
  SearchIndexSearchSourceMapping,
  SearchRequest,
  SearchResponse,
  SuggestRequest,
  SuggestResponse,
} from '../interface/search.interface';
import { omitDeep } from '../utils/APIUtils';
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

export const searchQuery = <
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

  return (
    APIClient.get<
      SearchResponse<
        SI extends Array<SearchIndex> ? SI[number] : SI,
        TIncludeFields
      >
    >('/search/query', {
      params: {
        q: query,
        index: getSearchIndexParam(searchIndex),
        from: (pageNumber - 1) * pageSize,
        size: pageSize,
        deleted: includeDeleted,
        /* eslint-disable @typescript-eslint/camelcase */
        query_filter: JSON.stringify(queryFilter),
        post_filter: JSON.stringify(postFilter),
        sort_field: sortField,
        sort_order: sortOrder,
        track_total_hits: trackTotalHits,
        fetch_source: fetchSource,
        include_source_fields: req.fetchSource ? req.includeFields : undefined,
        /* eslint-enable @typescript-eslint/camelcase */
      },
    })
      .then(({ data }) => data)
      // Elasticsearch responses use 'null' for missing values, we want undefined
      // omitDeep is untyped, so this will return unknown, which is not necessarily bad
      // since we need to do some more transformations to the response
      .then((data) => omitDeep(data, isNil))
      /* Elasticsearch objects use `entityType` to track their type, but the EntityReference interface uses `type`
      This copies `entityType` into `type` (if `entityType` exists) so responses implement EntityReference */
      .then((data) => ({
        ...data,
        hits: {
          ...data.hits,
          hits: isArray(data.hits.hits)
            ? data.hits.hits.map((hit: { _source: Record<string, unknown> }) =>
                '_source' in hit
                  ? 'entityType' in hit._source
                    ? {
                        ...hit,
                        _source: {
                          ...hit._source,
                          type: hit._source.entityType,
                        },
                      }
                    : hit
                  : hit
              )
            : [],
        },
      }))
      /* Aggregation key start with 'sterms#' - this is caused by the serialization of the ElasticsearchResponse
      Java object. For usability this prefix is removed from keys.  */
      .then((data) => ({
        ...data,
        aggregations:
          data.aggregations &&
          (Object.fromEntries(
            Object.entries(data.aggregations).map(([key, value]) => [
              key.replace('sterms#', ''),
              value,
            ])
          ) as Aggregations),
      }))
  );
};

export const suggestQuery = <
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
  const { query, searchIndex, field, fetchSource } = req;

  return (
    APIClient.get<{
      suggest: {
        'metadata-suggest': Array<{
          options: SuggestResponse<
            SI extends Array<SearchIndex> ? SI[number] : SI,
            TIncludeFields
          >;
        }>;
      };
    }>('/search/suggest', {
      params: {
        q: query,
        field,
        index: getSearchIndexParam(searchIndex),
        /* eslint-disable @typescript-eslint/camelcase */
        fetch_source: fetchSource,
        include_source_fields: req.fetchSource ? req.includeFields : undefined,
        /* eslint-enable @typescript-eslint/camelcase */
      },
      // Elasticsearch responses use 'null' for missing values, we want undefined
    })
      .then(({ data }) =>
        omitDeep(data.suggest['metadata-suggest'][0].options, isNil)
      )
      /* Elasticsearch objects use `entityType` to track their type, but the EntityReference interface uses `type`
      This copies `entityType` into `type` (if `entityType` exists) so responses implement EntityReference */
      .then((data) =>
        data.map((datum: { _source: Record<string, unknown> }) =>
          '_source' in datum
            ? 'entityType' in datum._source
              ? {
                  ...datum,
                  _source: { ...datum._source, type: datum._source.entityType },
                }
              : datum
            : datum
        )
      )
  );
};
