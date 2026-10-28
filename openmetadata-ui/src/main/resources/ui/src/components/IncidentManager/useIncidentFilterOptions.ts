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
import { useCallback, useMemo, useState } from 'react';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/entity/type';
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

const ASSIGNEE_FIELD = 'testCaseResolutionStatusDetails.assignee';

type AssigneeBucket = {
  key: string;
  'top_hits#top'?: {
    hits?: {
      hits?: {
        _source?: {
          testCaseResolutionStatusDetails?: { assignee?: EntityReference };
        };
      }[];
    };
  };
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

  /**
   * Users and teams assigned to at least one incident, read as a terms
   * aggregation over the incident index so they never depend on the page of
   * incidents on screen.
   */
  const searchAssignees = useCallback(
    async (searchValue: string, domain?: string) => {
      try {
        const { data } = await postAggregateFieldOptions({
          index: 'testCaseResolutionStatus',
          fieldName: `${ASSIGNEE_FIELD}.name`,
          fieldValue: searchValue,
          size: PAGE_SIZE_BASE,
          // Incident documents carry no top-level `deleted`, so the default
          // `deleted: false` term would match none of them.
          deleted: null as unknown as boolean,
          query: domain
            ? JSON.stringify(getQueryFilterForDataProducts(domain))
            : undefined,
          sourceFields: [ASSIGNEE_FIELD],
          topHits: { size: 1 },
        });
        const buckets = (data.aggregations[`sterms#${ASSIGNEE_FIELD}.name`]
          ?.buckets ?? []) as AssigneeBucket[];

        return buckets.map((bucket) => {
          const assignee =
            bucket['top_hits#top']?.hits?.hits?.[0]?._source
              ?.testCaseResolutionStatusDetails?.assignee;

          return {
            label: assignee ? getEntityName(assignee) : bucket.key,
            value: assignee?.name ?? bucket.key,
          };
        });
      } catch {
        return [];
      }
    },
    []
  );

  return {
    users,
    setUsers,
    assigneeOptionsWithSelected,
    selectedAssignees,
    fetchUserFilterOptions,
    searchTestCases,
    searchAssignees,
  };
};
