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
import { useMemo } from 'react';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
} from '../../../constants/constants';
import { usePaging } from '../../../hooks/paging/usePaging';
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
  } = usePaging(PAGE_SIZE_BASE);

  const {
    urlParams,
    urlFilters,
    parsedFilters,
    handleFilterChange,
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
    fetchTestDefinitions,
    handleEnableToggle,
  } = useTestDefinitionData({
    pageSize,
    handlePagingChange,
    pagingCursor,
    urlFilters,
    urlParams,
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
    definitionToDelete,
    openCreateForm,
    handleEdit,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleFormSuccess,
    handleFormCancel,
  } = useTestDefinitionModals({ setTestDefinitions, resetPagingAndRefetch });

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
