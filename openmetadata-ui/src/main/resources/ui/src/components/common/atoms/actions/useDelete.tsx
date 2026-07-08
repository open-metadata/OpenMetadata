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

import { Badge, ButtonUtility } from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteEntity } from '../../../../rest/miscAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { DeleteModal } from '../../DeleteModal/DeleteModal';

interface UseDeleteConfig<
  T extends { id: string; name?: string; displayName?: string }
> {
  entityType: string;
  entityLabel: string;
  selectedEntities: T[];
  onDeleteComplete: () => void;
  onCancel?: () => void;
}

/**
 * Generic delete hook for handling entity deletion with core-components
 *
 * @description
 * Provides a reusable delete functionality for any entity type with:
 * - Delete icon button for triggering deletion
 * - Confirmation modal with progress tracking
 * - Bulk delete support with sequential processing
 * - Error handling and toast notifications
 *
 * @example
 * ```typescript
 * const { deleteIconButton, deleteModal } = useDelete({
 *   entityType: 'domains',
 *   entityLabel: 'Domain',
 *   selectedEntities: selectedDomains,
 *   onDeleteComplete: () => {
 *     clearSelection();
 *     refetch();
 *   }
 * });
 * ```
 *
 * @stability Stable - Generic implementation for all entity types
 * @complexity Medium - Handles bulk operations with progress tracking
 */
export const useDelete = <
  T extends { id: string; name?: string; displayName?: string }
>({
  entityType,
  entityLabel,
  selectedEntities,
  onDeleteComplete,
  onCancel,
}: UseDeleteConfig<T>) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    if (!isDeleting) {
      setIsOpen(false);
      onCancel?.();
    }
  }, [isDeleting, onCancel]);

  const getEntityTitle = useCallback(() => {
    if (!entityLabel) {
      return 'item'; // Fallback if no label provided
    }

    if (selectedEntities.length === 0) {
      return entityLabel;
    }

    if (selectedEntities.length === 1) {
      const entityName = getEntityName(selectedEntities[0]);

      // If entity has a name, show it; otherwise just show the label
      return entityName || entityLabel;
    }

    // For multiple entities, show count with label
    return `${selectedEntities.length} ${entityLabel}${
      selectedEntities.length > 1 ? 's' : ''
    }`;
  }, [selectedEntities, entityLabel]);

  const deleteConfirmationMessage = useMemo(() => {
    if (selectedEntities.length > 1) {
      return t('message.are-you-sure-you-want-to-delete-these-entities', {
        count: selectedEntities.length,
        entity: entityLabel?.toLowerCase() || 'items',
      });
    }

    if (selectedEntities.length === 1) {
      return t('message.are-you-sure-you-want-to-delete-this-entity', {
        entity: entityLabel?.toLowerCase() || 'item',
      });
    }

    return '';
  }, [selectedEntities.length, entityLabel, t]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    const errors: string[] = [];

    for (let i = 0; i < selectedEntities.length; i++) {
      try {
        await deleteEntity(
          entityType,
          selectedEntities[i].id,
          false, // recursive: false (safe default)
          true // hardDelete: true (permanent)
        );
      } catch (error) {
        errors.push(getEntityName(selectedEntities[i]));
      }
    }

    if (errors.length === 0) {
      showSuccessToast(
        selectedEntities.length > 1
          ? t('server.entities-deleted-successfully', {
              count: selectedEntities.length,
              entity: entityLabel?.toLowerCase() || 'items',
            })
          : t('server.entity-deleted-successfully', {
              entity: getEntityName(selectedEntities[0]) || entityLabel,
            })
      );
      onDeleteComplete();
    } else {
      showErrorToast(
        t('server.failed-to-delete-entities', {
          entities: errors.join(', '),
        })
      );
    }

    setIsDeleting(false);
    setIsOpen(false);
  }, [selectedEntities, entityType, entityLabel, onDeleteComplete, t]);

  const deleteIconButton = useMemo(
    () => (
      <div className="tw:relative tw:inline-flex">
        <ButtonUtility
          color="tertiary"
          data-testid="delete-selected"
          icon={Trash01}
          isDisabled={selectedEntities.length === 0}
          size="sm"
          tooltip={t('label.delete')}
          onClick={openModal}
        />
        {selectedEntities.length > 1 && (
          <Badge
            className="tw:pointer-events-none tw:absolute tw:-right-1 tw:-top-1"
            color="error"
            size="xs"
            type="pill-color">
            {selectedEntities.length}
          </Badge>
        )}
      </div>
    ),
    [selectedEntities.length, openModal, t]
  );

  const deleteModal = useMemo(
    () => (
      <DeleteModal
        entityTitle={getEntityTitle()}
        isDeleting={isDeleting}
        message={deleteConfirmationMessage}
        open={isOpen}
        onCancel={handleCancel}
        onDelete={handleDelete}
      />
    ),
    [
      getEntityTitle,
      deleteConfirmationMessage,
      handleCancel,
      handleDelete,
      isDeleting,
      isOpen,
    ]
  );

  return {
    deleteIconButton,
    deleteModal,
  };
};
