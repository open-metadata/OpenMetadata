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
import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { deleteTestDefinitionByFqn } from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

export interface UseTestDefinitionModalsProps {
  setTestDefinitions: Dispatch<SetStateAction<TestDefinition[]>>;
  resetPagingAndRefetch: () => void;
}

/**
 * Owns the create/edit form and the delete-confirm modal state and handlers.
 * The edit-success path patches the row in place through the injected
 * {@link setTestDefinitions}; the create-success and delete-success paths reset
 * paging and refetch through the injected {@link resetPagingAndRefetch} so the
 * data/paging knowledge stays owned by those concerns and is not reimplemented
 * here.
 */
export const useTestDefinitionModals = ({
  setTestDefinitions,
  resetPagingAndRefetch,
}: UseTestDefinitionModalsProps) => {
  const { t } = useTranslation();

  const [selectedDefinition, setSelectedDefinition] = useState<
    TestDefinition | undefined
  >();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [definitionToDelete, setDefinitionToDelete] = useState<
    TestDefinition | undefined
  >();

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
      resetPagingAndRefetch();
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
      resetPagingAndRefetch();
    }
    setSelectedDefinition(undefined);
  };

  const handleFormCancel = useCallback(() => {
    setIsFormVisible(false);
    setSelectedDefinition(undefined);
  }, []);

  return {
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
  };
};
