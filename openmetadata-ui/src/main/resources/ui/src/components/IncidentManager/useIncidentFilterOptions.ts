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
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import {
  AGGREGATE_PAGE_SIZE_LARGE,
  DEFAULT_DOMAIN_VALUE,
  PAGE_SIZE_BASE,
} from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { useDomainStore } from '../../hooks/useDomainStore';
import {
  SearchHitBody,
  TestCaseSearchSource,
} from '../../interface/search.interface';
import { Option } from '../../pages/TasksPage/TasksPage.interface';
import { TestCaseIncidentStatusParams } from '../../rest/incidentManagerAPI';
import {
  getUserAndTeamSearch,
  postAggregateFieldOptions,
} from '../../rest/miscAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getQueryFilterForDataProducts } from '../../utils/DomainFilterUtils';
import { getEntityName } from '../../utils/EntityNameUtils';

const ASSIGNEE_ID_FIELD = 'testCaseResolutionStatusDetails.assignee.id';
const NO_ASSIGNEE_IDS: string[] = [];

const fetchIncidentAssigneeIds = async (domain?: string) => {
  const { data } = await postAggregateFieldOptions({
    index: 'testCaseResolutionStatus',
    fieldName: ASSIGNEE_ID_FIELD,
    fieldValue: '',
    // ponytail: a terms aggregation cannot page, so read the whole set up to
    // this cap. Composite aggregation in /search/aggregate if catalogs ever
    // exceed it.
    size: AGGREGATE_PAGE_SIZE_LARGE,
    // Incident documents carry no top-level `deleted`, so the default
    // `deleted: false` term would match none of them.
    deleted: null as unknown as boolean,
    query: domain
      ? JSON.stringify(getQueryFilterForDataProducts(domain))
      : undefined,
  });

  return (
    (data.aggregations[`sterms#${ASSIGNEE_ID_FIELD}`]?.buckets ?? []) as {
      key: string;
    }[]
  ).map((bucket) => bucket.key);
};

/**
 * Ids of the users and teams assigned to at least one incident in the active
 * domain, read as a terms aggregation over the incident index so they never
 * depend on the page of incidents on screen. Empty while they load and when
 * the read fails, so the assignee picker offers no one rather than everyone.
 */
export const useIncidentAssigneeIds = () => {
  const { activeDomain } = useDomainStore();
  const domain =
    activeDomain === DEFAULT_DOMAIN_VALUE ? undefined : activeDomain;
  const { data = NO_ASSIGNEE_IDS } = useQuery({
    queryKey: ['incident-assignee-ids', domain],
    queryFn: () => fetchIncidentAssigneeIds(domain),
  });

  return data;
};

export interface UseIncidentFilterOptionsProps {
  filters: TestCaseIncidentStatusParams;
}

/**
 * Owns the assignee/test-case filter OPTIONS: the shared users state, the
 * derived assignee option lists, the async user/test-case searches and the
 * test-case FQN option cache. The active {@link filters} are injected so the
 * selected assignee can be surfaced as an option even before it is searched.
 * The list-fetch derives assignee options from its own response and writes them
 * through {@link setUsers}; that derivation stays in the list concern.
 */
export const useIncidentFilterOptions = ({
  filters,
}: UseIncidentFilterOptionsProps) => {
  const [users, setUsers] = useState<{
    options: Option[];
  }>({
    options: [],
  });

  const assigneeOptionsWithSelected = useMemo(() => {
    const options = [...users.options];
    if (filters.assignee) {
      const exists = options.some(
        (opt) => opt.name === filters.assignee || opt.value === filters.assignee
      );
      if (!exists) {
        options.push({
          label: filters.assignee,
          value: filters.assignee,
          name: filters.assignee,
          type: 'user',
        });
      }
    }

    return options;
  }, [filters.assignee, users.options]);

  const selectedAssignees = useMemo(() => {
    if (!filters.assignee) {
      return [];
    }
    const option = assigneeOptionsWithSelected.find(
      (opt) => opt.name === filters.assignee || opt.value === filters.assignee
    );

    return option ? [option] : [];
  }, [filters.assignee, assigneeOptionsWithSelected]);

  const fetchUserFilterOptions = async (query: string) => {
    if (!query) {
      return;
    }
    try {
      const res = await getUserAndTeamSearch(query, true);
      const hits = res.data.hits.hits;
      const suggestOptions = hits.map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._source.name,
        type: hit._source.entityType,
        name: hit._source.name,
      }));

      setUsers((pre) => ({ ...pre, options: suggestOptions }));
    } catch {
      setUsers((pre) => ({ ...pre, options: [] }));
    }
  };

  const searchTestCases = useCallback(async (searchValue = WILD_CARD_CHAR) => {
    // Encode the search value to handle special characters like #, %, $, etc.
    // Preserve wildcard character to maintain default search behavior
    const encodedSearchValue: string =
      searchValue === WILD_CARD_CHAR
        ? searchValue
        : encodeURIComponent(searchValue);
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex: SearchIndex.TEST_CASE,
        query: encodedSearchValue,
        fetchSource: true,
        includeFields: ['name', 'displayName', 'fullyQualifiedName'],
      });

      return (
        response.hits.hits as SearchHitBody<
          SearchIndex.TEST_CASE,
          TestCaseSearchSource
        >[]
      ).map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._source.fullyQualifiedName,
      }));
    } catch {
      return [];
    }
  }, []);

  return {
    users,
    setUsers,
    assigneeOptionsWithSelected,
    selectedAssignees,
    fetchUserFilterOptions,
    searchTestCases,
  };
};
