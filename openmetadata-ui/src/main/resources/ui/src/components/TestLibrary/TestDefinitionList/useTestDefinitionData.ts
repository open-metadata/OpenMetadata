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
import { useCallback, useEffect, useState } from 'react';
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
  urlParams: { entityType?: string; testPlatforms?: string };
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
  fetchTestDefinitionPermissions,
}: UseTestDefinitionDataProps) => {
  const { t } = useTranslation();

  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTestDefinitions = useCallback(
    async (pagingOffset?: Partial<Paging>) => {
      setIsLoading(true);
      try {
        const entityTypeFilter = urlFilters.entityType?.[0] as
          | EntityType
          | undefined;
        const testPlatformFilter = urlFilters.testPlatforms?.[0] as
          | TestPlatform
          | undefined;

        const { data, paging: responsePaging } = await getListTestDefinitions({
          after: pagingOffset?.after,
          before: pagingOffset?.before,
          limit: pageSize,
          entityType: entityTypeFilter,
          testPlatform: testPlatformFilter,
        });
        setTestDefinitions(data);
        handlePagingChange(responsePaging);
        fetchTestDefinitionPermissions(data);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, handlePagingChange, fetchTestDefinitionPermissions, urlFilters]
  );

  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchTestDefinitions({ [cursorType]: cursorValue });
    } else {
      fetchTestDefinitions();
    }
  }, [pageSize, pagingCursor, urlParams.entityType, urlParams.testPlatforms]);

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
    fetchTestDefinitions,
    handleEnableToggle,
  };
};
