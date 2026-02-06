/*
 *  Copyright 2024 Collate.
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

import { Modal } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deleteLearningResource,
  LearningResource,
} from '../../../rest/learningResourceAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

interface UseLearningResourceActionsParams {
  onRefetch: () => Promise<void>;
}

interface UseLearningResourceActionsReturn {
  isFormOpen: boolean;
  isPlayerOpen: boolean;
  selectedResource: LearningResource | null;
  editingResource: LearningResource | null;
  handleCreate: () => void;
  handleEdit: (resource: LearningResource) => void;
  handleDelete: (resource: LearningResource) => void;
  handlePreview: (resource: LearningResource) => void;
  handleFormClose: () => void;
  handlePlayerClose: () => void;
}

export const useLearningResourceActions = ({
  onRefetch,
}: UseLearningResourceActionsParams): UseLearningResourceActionsReturn => {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<LearningResource | null>(null);
  const [editingResource, setEditingResource] =
    useState<LearningResource | null>(null);

  const handleCreate = useCallback(() => {
    setEditingResource(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((resource: LearningResource) => {
    setEditingResource(resource);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback(
    (resource: LearningResource) => {
      Modal.confirm({
        centered: true,
        content: t('message.are-you-sure-delete-entity', {
          entity: resource.displayName || resource.name,
        }),
        okText: t('label.delete'),
        okType: 'danger',
        title: t('label.delete-entity', {
          entity: t('label.learning-resource'),
        }),
        onOk: async () => {
          try {
            await deleteLearningResource(resource.id);
            showSuccessToast(
              t('server.entity-deleted-successfully', {
                entity: t('label.learning-resource'),
              })
            );
            await onRefetch();
          } catch (error) {
            showErrorToast(error as AxiosError);
          }
        },
      });
    },
    [t, onRefetch]
  );

  const handlePreview = useCallback((resource: LearningResource) => {
    setSelectedResource(resource);
    setIsPlayerOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setEditingResource(null);
    onRefetch();
  }, [onRefetch]);

  const handlePlayerClose = useCallback(() => {
    setIsPlayerOpen(false);
    setSelectedResource(null);
  }, []);

  return {
    isFormOpen,
    isPlayerOpen,
    selectedResource,
    editingResource,
    handleCreate,
    handleEdit,
    handleDelete,
    handlePreview,
    handleFormClose,
    handlePlayerClose,
  };
};
