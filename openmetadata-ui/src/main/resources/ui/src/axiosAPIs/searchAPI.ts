import { AxiosResponse } from 'axios';
import APIClient from './index';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SearchIndex } from '../enums/search.enum';
import {
  SearchRequest,
  SearchResponse,
  SearchSource,
  SuggestOption,
  SuggestRequest,
} from '../interface/search.interface';
import { FormattedTeamsData, FormattedUsersData } from 'Models';

const buildQuery = (
  queryString: string | undefined,
  filters: string | undefined
) => {
  let query: string | undefined;

  if (!queryString) {
    query = WILD_CARD_CHAR;
  } else if (queryString.includes(':')) {
    query = queryString;
  } else {
    query = queryString;
  }

  if (filters) {
    query = `${query} AND ${filters}`;
  }

  return query;
};

export const searchQuery: (
  request: SearchRequest
) => Promise<SearchResponse<SearchSource>> = ({
  query,
  from,
  size,
  filters,
  sortField,
  sortOrder,
  searchIndex,
  includeDeleted,
  trackTotalHits,
  elasticsearchFilter,
}) =>
  APIClient.get<SearchResponse<SearchSource>>('/search/query', {
    params: {
      q: buildQuery(query, filters),
      index: searchIndex,
      from: (from - 1) * size,
      size,
      deleted: includeDeleted,
      /* eslint-disable @typescript-eslint/camelcase */
      query_filter: JSON.stringify(elasticsearchFilter),
      sort_field: sortField,
      sort_order: sortOrder,
      track_total_hits: trackTotalHits,
      /* eslint-enable @typescript-eslint/camelcase */
    },
  }).then((res) => res.data);

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
    }).then((res) => res.data.suggest['metadata-suggest'][0].options);

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
