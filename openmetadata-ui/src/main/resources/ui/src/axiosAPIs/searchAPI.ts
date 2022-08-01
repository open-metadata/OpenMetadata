import { AxiosResponse } from 'axios';
import APIClient from './index';
import { SearchIndex } from '../enums/search.enum';
import {
  SearchRequest,
  SearchResponse,
  SearchSource,
  SuggestOption,
  SuggestRequest,
} from '../interface/search.interface';
import { FilterObject, FormattedTeamsData, FormattedUsersData } from 'Models';
import { omitDeep } from '../utils/APIUtils';
import { isNil } from 'lodash';

export const getElasticsearchFilter: (
  f: FilterObject
) => Record<string, unknown> | undefined = (f) =>
  Object.entries(f).length
    ? {
        query: {
          bool: {
            must: Object.entries(f).map(([key, values]) => ({
              bool: {
                should: values.map((value) => ({ term: { [key]: value } })),
              },
            })),
          },
        },
      }
    : undefined;

export const searchQuery: (
  request: SearchRequest
) => Promise<SearchResponse<SearchSource>> = ({
  query,
  from,
  size,
  queryFilter,
  sortField,
  sortOrder,
  searchIndex,
  includeDeleted,
  trackTotalHits,
  postFilter,
}) =>
  APIClient.get<SearchResponse<SearchSource>>('/search/query', {
    params: {
      q: query,
      index: searchIndex,
      from: (from - 1) * size,
      size,
      deleted: includeDeleted,
      /* eslint-disable @typescript-eslint/camelcase */
      query_filter: JSON.stringify(queryFilter),
      post_filter: JSON.stringify(postFilter),
      sort_field: sortField,
      sort_order: sortOrder,
      track_total_hits: trackTotalHits,
      /* eslint-enable @typescript-eslint/camelcase */
    },
    // Elasticsearch responses use 'null' for missing values, we want undefined
  })
    .then((res) => omitDeep(res.data, isNil))
    // Aggregations start with 'sterms#' - this is from the Java library not Elasticsearch
    .then((data) => ({
      ...data,
      aggregations: Object.fromEntries(
        Object.entries(data.aggregations).map(([key, value]) => [
          key.replace('sterms#', ''),
          value,
        ])
      ),
    }));

export const getSearchedUsers = (
  query: string,
  from: number,
  size = 10
): Promise<SearchResponse<FormattedUsersData>> => {
  return searchQuery({
    query,
    from,
    size,
    searchIndex: SearchIndex.USER,
  }) as Promise<SearchResponse<FormattedUsersData>>;
};

export const getSearchedTeams = (
  query: string,
  from: number,
  size = 10
): Promise<SearchResponse<FormattedTeamsData>> => {
  return searchQuery({
    query,
    from,
    size,
    searchIndex: SearchIndex.TEAM,
  }) as Promise<SearchResponse<FormattedTeamsData>>;
};

export const suggestQuery: (query: SuggestRequest) => Promise<SuggestOption[]> =
  ({
    query,
    searchIndex,
    field,
    fetchSource,
    includeSourceFields,
    excludeSourceFields,
  }) =>
    APIClient.get('/search/suggest', {
      params: {
        q: query,
        field,
        index: searchIndex,
        /* eslint-disable @typescript-eslint/camelcase */
        fetch_source: fetchSource,
        include_source_fields: includeSourceFields,
        exclude_source_fields: excludeSourceFields,
        /* eslint-enable @typescript-eslint/camelcase */
      },
      // Elasticsearch responses use 'null' for missing values, we want undefined
    }).then((res) =>
      omitDeep(res.data.suggest['metadata-suggest'][0].options, isNil)
    );

export const getTagSuggestions: Function = (
  term: string
): Promise<AxiosResponse> => {
  const params = {
    q: term,
    index: `${SearchIndex.TAG},${SearchIndex.GLOSSARY}`,
  };

  return APIClient.get(`/search/suggest`, { params });
};

export const getSuggestions: Function = (
  queryString: string,
  searchIndex?: string
): Promise<AxiosResponse> => {
  const params = {
    q: queryString,
    index: searchIndex,
  };

  return APIClient.get(`/search/suggest`, { params });
};

export const getSuggestedUsers = (term: string): Promise<AxiosResponse> => {
  return APIClient.get(`/search/suggest?q=${term}&index=${SearchIndex.USER}`);
};

export const getSuggestedTeams = (term: string): Promise<AxiosResponse> => {
  return APIClient.get(`/search/suggest?q=${term}&index=${SearchIndex.TEAM}`);
};

export const getUserSuggestions: Function = (
  term: string
): Promise<AxiosResponse> => {
  const params = {
    q: term,
    index: `${SearchIndex.USER},${SearchIndex.TEAM}`,
  };

  return APIClient.get(`/search/suggest`, { params });
};
