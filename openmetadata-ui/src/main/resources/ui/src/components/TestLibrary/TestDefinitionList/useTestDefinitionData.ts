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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EntityType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import { Paging } from '../../../generated/type/paging';
import { UsePagingInterface } from '../../../hooks/paging/usePaging';
import {
  getListTestDefinitions,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

export interface UseTestDefinitionDataProps {
  pageSize: number;
  handlePagingChange: UsePagingInterface['handlePagingChange'];
  pagingCursor: UsePagingInterface['pagingCursor'];
  urlFilters: Record<string, string[]>;
  urlParams: { entityType?: string; testPlatforms?: string; q?: string };
  /** Already validated against the sortable columns by useTestDefinitionFilters. */
  sortField: string;
  sortOrder: 'asc' | 'desc';
  fetchTestDefinitionPermissions: (
    definitions: TestDefinition[]
  ) => Promise<void>;
}

/**
 * Owns the DATA concern: the test-definition rows, their loading flag and the
 * cursor-based fetch pipeline. The driving effect stays co-located with
 * {@link fetchTestDefinitions} so the fetch is issued from a single place (no
 * double-fetch), and the fetch fans out per-row permissions through the
 * injected {@link fetchTestDefinitionPermissions}. Filter values, the paging
 * bag and the permission fetcher are injected.
 */
export const useTestDefinitionData = ({
  pageSize,
  handlePagingChange,
  pagingCursor,
  urlFilters,
  urlParams,
  sortField,
  sortOrder,
  fetchTestDefinitionPermissions,
}: UseTestDefinitionDataProps) => {
  const { t } = useTranslation();

  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Whether a page has ever been rendered. Re-sorting, filtering and searching
  // all refetch, and blanking the table to skeletons each time reads as the
  // whole page reloading. Only the first load has nothing to show, so only the
  // first load gets skeletons; a refetch keeps the previous rows on screen.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // Sequence number of the newest fetch. Typing in the search box issues one
  // request per debounced term, and a slow response for an earlier term can
  // land after a later one - leaving the list showing rows for a search the
  // user has already moved on from. Only the newest request may write state.
  const latestRequestRef = useRef(0);

  const fetchTestDefinitions = useCallback(
    async (pagingOffset?: Partial<Paging>) => {
      const requestId = ++latestRequestRef.current;
      setIsLoading(true);
      try {
        const entityTypeFilter = urlFilters.entityType?.[0] as
          | EntityType
          | undefined;
        const testPlatformFilter = urlFilters.testPlatforms?.[0] as
          | TestPlatform
          | undefined;
        // The listing is cursor-paged, so the search has to run server side -
        // filtering the current page would only ever search the rows already on
        // screen.
        const searchQuery = urlParams.q?.trim();

        const { data, paging: responsePaging } = await getListTestDefinitions({
          after: pagingOffset?.after,
          before: pagingOffset?.before,
          limit: pageSize,
          entityType: entityTypeFilter,
          testPlatform: testPlatformFilter,
          q: searchQuery || undefined,
          sortField,
          sortOrder,
        });
        if (requestId !== latestRequestRef.current) {
          return;
        }

        // Rendered in the order the server returned them. The keyset cursor
        // walks the server's display-name collation, so re-sorting a page here
        // would only reshuffle it against a sequence the next page continues.
        setTestDefinitions(data);
        handlePagingChange(responsePaging);
        fetchTestDefinitionPermissions(data);
      } catch (error) {
        if (requestId === latestRequestRef.current) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        // A superseded request leaves the flag alone: the request that replaced
        // it is still in flight and owns the spinner.
        if (requestId === latestRequestRef.current) {
          setIsLoading(false);
          setHasLoadedOnce(true);
        }
      }
    },
    [
      pageSize,
      handlePagingChange,
      fetchTestDefinitionPermissions,
      urlFilters,
      urlParams.q,
      sortField,
      sortOrder,
    ]
  );

  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchTestDefinitions({ [cursorType]: cursorValue });
    } else {
      fetchTestDefinitions();
    }
  }, [
    pageSize,
    pagingCursor,
    urlParams.entityType,
    urlParams.testPlatforms,
    urlParams.q,
    sortField,
    sortOrder,
  ]);

  const handleEnableToggle = async (
    record: TestDefinition,
    checked: boolean
  ) => {
    try {
      const updatedData = { ...record, enabled: checked };
      const patch = compare(record, updatedData);

      await patchTestDefinition(record.id ?? '', patch);
      showSuccessToast(
        t('server.entity-updated-success', {
          entity: t('label.test-definition'),
        })
      );
      setTestDefinitions((prev) =>
        prev.map((item) =>
          item.id === record.id
            ? {
                ...item,
                enabled: checked,
              }
            : item
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  return {
    testDefinitions,
    setTestDefinitions,
    isLoading,
    // The first load only. A later refetch reports through isLoading, which
    // drives the pager and a dimmed table rather than replacing the rows.
    isInitialLoading: isLoading && !hasLoadedOnce,
    fetchTestDefinitions,
    handleEnableToggle,
  };
};
