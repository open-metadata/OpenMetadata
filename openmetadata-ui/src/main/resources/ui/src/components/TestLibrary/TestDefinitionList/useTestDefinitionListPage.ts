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
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { TEST_DEFINITION_COLUMN_BY_SORT_FIELD } from '../../../constants/TestDefinition.constants';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import { useTestDefinitionData } from './useTestDefinitionData';
import { useTestDefinitionFilters } from './useTestDefinitionFilters';
import { useTestDefinitionModals } from './useTestDefinitionModals';
import { useTestDefinitionRowPermissions } from './useTestDefinitionRowPermissions';

/**
 * Encapsulates all the data, paging, permission, filter and create/edit/delete
 * state for the Test Definition (Test Library) listing. Both the OSS classic
 * page and the AI-mode page compose this hook so the logic lives once; each
 * surface only supplies its own header, filter UI and renders the shared table.
 */
export const useTestDefinitionListPage = () => {
  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
    pagingCursor,
  } = usePaging();

  const {
    urlParams,
    urlFilters,
    parsedFilters,
    searchQuery,
    sortField,
    sortOrder,
    handleSortChange,
    handleFilterChange,
    handleSearchChange,
    setSingleFilter,
    clearAllFilters,
    hasActiveFilters,
  } = useTestDefinitionFilters({ handlePageChange });

  const {
    createPermission,
    viewPermission,
    testDefinitionPermissions,
    permissionLoading,
    fetchTestDefinitionPermissions,
  } = useTestDefinitionRowPermissions();

  const {
    testDefinitions,
    setTestDefinitions,
    isLoading,
    isInitialLoading,
    fetchTestDefinitions,
    handleEnableToggle,
  } = useTestDefinitionData({
    pageSize,
    handlePagingChange,
    pagingCursor,
    urlFilters,
    urlParams,
    sortField,
    sortOrder,
    fetchTestDefinitionPermissions,
  });

  const resetPagingAndRefetch = () => {
    handlePageChange(INITIAL_PAGING_VALUE, {
      cursorType: null,
      cursorValue: undefined,
    });
    fetchTestDefinitions();
  };

  const {
    selectedDefinition,
    isFormVisible,
    isDeleteModalVisible,
    isDeleting,
    definitionToDelete,
    openCreateForm,
    handleEdit,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleFormSuccess,
    handleFormCancel,
  } = useTestDefinitionModals({ setTestDefinitions, resetPagingAndRefetch });

  // Kept as an id and read back from the list, so an edit saved from the panel
  // (which updates the row in place) shows up in the panel too.
  const [viewedDefinitionId, setViewedDefinitionId] = useState<string>();
  const viewedDefinition = useMemo(
    () => testDefinitions.find(({ id }) => id === viewedDefinitionId),
    [testDefinitions, viewedDefinitionId]
  );
  const canEditViewedDefinition = viewedDefinition
    ? getDerivedPermissionFlags(
        testDefinitionPermissions[viewedDefinition.name] ??
          DEFAULT_ENTITY_PERMISSION
      ).canEditAll
    : false;
  const openDetails = useCallback(
    (record: TestDefinition) => setViewedDefinitionId(record.id),
    []
  );
  const closeDetails = useCallback(() => setViewedDefinitionId(undefined), []);
  const editFromDetails = useCallback(
    (record: TestDefinition) => {
      setViewedDefinitionId(undefined);
      handleEdit(record);
    },
    [handleEdit]
  );

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

  /**
   * The table talks in column ids and react-aria's ascending/descending; the
   * URL and the API talk in sort fields and asc/desc. Translated once here so
   * neither side has to know the other's vocabulary.
   */
  const sortDescriptor = useMemo(
    () => ({
      column: TEST_DEFINITION_COLUMN_BY_SORT_FIELD[sortField],
      direction:
        sortOrder === 'desc' ? ('descending' as const) : ('ascending' as const),
    }),
    [sortField, sortOrder]
  );

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
    isInitialLoading,
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
    searchQuery,
    sortDescriptor,
    handleSortChange,
    handleFilterChange,
    handleSearchChange,
    setSingleFilter,
    clearAllFilters,
    hasActiveFilters,
    isFormVisible,
    selectedDefinition,
    isDeleteModalVisible,
    isDeleting,
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
    viewedDefinition,
    canEditViewedDefinition,
    openDetails,
    closeDetails,
    editFromDetails,
  };
};
