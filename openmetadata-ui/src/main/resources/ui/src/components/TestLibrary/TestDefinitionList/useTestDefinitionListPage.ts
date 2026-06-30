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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
} from '../../../constants/constants';
import {
  TEST_DEFINITION_DEFAULT_QUICK_FILTERS,
  TEST_DEFINITION_FILTERS,
} from '../../../constants/TestDefinition.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import {
  EntityType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useTableFilters } from '../../../hooks/useTableFilters';
import {
  deleteTestDefinitionByFqn,
  getListTestDefinitions,
  patchTestDefinition,
} from '../../../rest/testAPI';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../../utils/PermissionsUtils';
import { mapUrlValueToOption } from '../../../utils/TestDefinitionUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';

/**
 * Encapsulates all the data, paging, permission, filter and create/edit/delete
 * state for the Test Definition (Test Library) listing. Both the OSS classic
 * page and the AI-mode page compose this hook so the logic lives once; each
 * surface only supplies its own header, filter UI and renders the shared table.
 */
export const useTestDefinitionListPage = () => {
  const { t } = useTranslation();
  const { permissions, getEntityPermissionByFqn } = usePermissionProvider();

  const { filters: urlParams, setFilters: updateUrlParams } = useTableFilters({
    entityType: undefined,
    testPlatforms: undefined,
  });

  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
    pagingCursor,
  } = usePaging(PAGE_SIZE_BASE);

  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDefinition, setSelectedDefinition] = useState<
    TestDefinition | undefined
  >();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [definitionToDelete, setDefinitionToDelete] = useState<
    TestDefinition | undefined
  >();
  const [testDefinitionPermissions, setTestDefinitionPermissions] = useState<
    Record<string, OperationPermission>
  >({});
  const [permissionLoading, setPermissionLoading] = useState(true);

  const urlFilters = useMemo(() => {
    const filters: Record<string, string[]> = {};

    TEST_DEFINITION_DEFAULT_QUICK_FILTERS.forEach((key) => {
      const paramValue = urlParams[key as keyof typeof urlParams];
      if (paramValue) {
        const values = String(paramValue).split(',').filter(Boolean);
        filters[key] = values.length > 0 ? [values[0]] : [];
      }
    });

    return filters;
  }, [urlParams]);

  const parsedFilters = useMemo<ExploreQuickFilterField[]>(() => {
    return TEST_DEFINITION_FILTERS.map((filter) => ({
      ...filter,
      value:
        urlFilters[filter.key]?.map((v) =>
          mapUrlValueToOption(v, filter.options)
        ) || [],
    }));
  }, [urlFilters]);

  const handleFilterChange = useCallback(
    (filters: ExploreQuickFilterField[]) => {
      const filterUpdates: Record<string, string | null> = {};

      TEST_DEFINITION_DEFAULT_QUICK_FILTERS.forEach((key) => {
        filterUpdates[key] = null;
      });

      filters.forEach((filter) => {
        const values = filter.value?.map((v) => v.key) || [];
        if (values.length > 0) {
          filterUpdates[filter.key] = values.join(',');
        }
      });

      updateUrlParams(filterUpdates);

      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
    },
    [updateUrlParams, handlePageChange]
  );

  const setSingleFilter = useCallback(
    (key: string, value?: string) => {
      updateUrlParams({ [key]: value || null });
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
    },
    [updateUrlParams, handlePageChange]
  );

  const clearAllFilters = useCallback(() => {
    handleFilterChange([]);
  }, [handleFilterChange]);

  const hasActiveFilters = useMemo(
    () => Object.values(urlFilters).some((value) => value.length > 0),
    [urlFilters]
  );

  const createPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.TEST_DEFINITION,
        permissions
      ),
    [permissions]
  );

  const viewPermission = useMemo(
    () =>
      checkPermission(
        Operation.ViewBasic,
        ResourceEntity.TEST_DEFINITION,
        permissions
      ) ||
      checkPermission(
        Operation.ViewAll,
        ResourceEntity.TEST_DEFINITION,
        permissions
      ),
    [permissions]
  );

  const fetchTestDefinitionPermissions = useCallback(
    async (definitions: TestDefinition[]) => {
      try {
        setPermissionLoading(true);

        if (!definitions.length) {
          setTestDefinitionPermissions({});

          return;
        }

        const permissionPromises: Promise<OperationPermission>[] =
          definitions.map((def) =>
            getEntityPermissionByFqn(
              ResourceEntity.TEST_DEFINITION,
              def.fullyQualifiedName ?? ''
            )
          );

        const permissionResponses = await Promise.allSettled(
          permissionPromises
        );

        const permissionsMap = definitions.reduce((acc, def, idx) => {
          const response = permissionResponses[idx];

          return {
            ...acc,
            [def.name]:
              response?.status === 'fulfilled'
                ? response.value
                : DEFAULT_ENTITY_PERMISSION,
          };
        }, {} as Record<string, OperationPermission>);

        setTestDefinitionPermissions(permissionsMap);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setPermissionLoading(false);
      }
    },
    [getEntityPermissionByFqn]
  );

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

  const openCreateForm = useCallback(() => {
    setSelectedDefinition(undefined);
    setIsFormVisible(true);
  }, []);

  const handleEdit = useCallback((record: TestDefinition) => {
    setSelectedDefinition(record);
    setIsFormVisible(true);
  }, []);

  const handleDeleteClick = useCallback((record: TestDefinition) => {
    setDefinitionToDelete(record);
    setIsDeleteModalVisible(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!definitionToDelete) {
      return;
    }

    try {
      await deleteTestDefinitionByFqn(
        definitionToDelete.fullyQualifiedName ?? ''
      );
      showSuccessToast(
        t('server.entity-deleted-success', {
          entity: t('label.test-definition'),
        })
      );
      setIsDeleteModalVisible(false);
      setDefinitionToDelete(undefined);
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
      fetchTestDefinitions();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteModalVisible(false);
    setDefinitionToDelete(undefined);
  }, []);

  const handleFormSuccess = (data?: TestDefinition) => {
    setIsFormVisible(false);
    if (selectedDefinition && data) {
      setTestDefinitions((prev) =>
        prev.map((item) => (item.id === data.id ? data : item))
      );
    } else {
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
      fetchTestDefinitions();
    }
    setSelectedDefinition(undefined);
  };

  const handleFormCancel = useCallback(() => {
    setIsFormVisible(false);
    setSelectedDefinition(undefined);
  }, []);

  const handlePageChangeCallback = ({
    cursorType,
    currentPage: page,
  }: PagingHandlerParams) => {
    if (cursorType && paging) {
      handlePageChange(
        page,
        { cursorType, cursorValue: paging[cursorType] },
        pageSize
      );
    }
  };

  const pagingData = useMemo(
    () => ({
      currentPage,
      pageSize,
      paging,
      pagingHandler: handlePageChangeCallback,
      onShowSizeChange: handlePageSizeChange,
      isLoading,
    }),
    [currentPage, pageSize, paging, handlePageSizeChange, isLoading]
  );

  return {
    testDefinitions,
    isLoading,
    createPermission,
    viewPermission,
    testDefinitionPermissions,
    permissionLoading,
    currentPage,
    pageSize,
    pagingData,
    showPagination,
    urlFilters,
    parsedFilters,
    handleFilterChange,
    setSingleFilter,
    clearAllFilters,
    hasActiveFilters,
    isFormVisible,
    selectedDefinition,
    isDeleteModalVisible,
    definitionToDelete,
    openCreateForm,
    handleEnableToggle,
    handleEdit,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleFormSuccess,
    handleFormCancel,
    fetchTestDefinitions,
  };
};
