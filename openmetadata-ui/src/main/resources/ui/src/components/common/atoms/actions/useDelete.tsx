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

import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { Trash01 } from '@untitledui/icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteEntity } from '../../../../rest/miscAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';

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
 * Generic delete hook for handling entity deletion with MUI components
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
  const theme = useTheme();
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

  const getDeleteMessage = useCallback(() => {
    if (selectedEntities.length === 0) {
      return '';
    }

    if (selectedEntities.length === 1) {
      const name = getEntityName(selectedEntities[0]);

      return name ? `"${name}"` : `this ${entityLabel || 'item'}`;
    }

    // For multiple, show count with entity type
    return `these ${selectedEntities.length} ${entityLabel || 'item'}${
      selectedEntities.length > 1 ? 's' : ''
    }`;
  }, [selectedEntities, entityLabel]);

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
  }, [selectedEntities, entityType, entityLabel, onDeleteComplete]);

  const deleteIconButton = useMemo(
    () =>
      selectedEntities.length > 1 ? (
        <Badge
          badgeContent={selectedEntities.length}
          color="error"
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: theme.palette.allShades?.error?.[600],
            },
          }}>
          <IconButton
            color="primary"
            disabled={selectedEntities.length === 0}
            size="small"
            sx={{
              color: theme.palette.allShades?.gray?.[600],
            }}
            onClick={openModal}>
            <Trash01 size={20} />
          </IconButton>
        </Badge>
      ) : (
        <IconButton
          color="primary"
          disabled={selectedEntities.length === 0}
          size="small"
          sx={{
            color: theme.palette.allShades?.gray?.[600],
          }}
          onClick={openModal}>
          <Trash01 size={20} />
        </IconButton>
      ),
    [selectedEntities.length, openModal, theme.palette.allShades]
  );

  const deleteModal = useMemo(
    () => (
      <Dialog
        open={isOpen}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              width: 400,
              maxWidth: '100%',
            },
          },
        }}
        onClose={handleCancel}>
        <Box sx={{ p: 6 }}>
          <Box
            sx={{
              alignItems: 'center',
              backgroundColor: theme.palette.allShades?.error?.[50],
              borderRadius: '50%',
              display: 'flex',
              height: 48,
              justifyContent: 'center',
              mb: 4,
              width: 48,
            }}>
            <Trash01 color={theme.palette.allShades?.error?.[600]} size={24} />
          </Box>

          <DialogTitle
            sx={{
              mb: 0.5,
              p: 0,
              fontWeight: 600,
              fontSize: '16px',
              lineHeight: 1.5,
              '&.MuiDialogTitle-root': {
                padding: 0,
                fontWeight: 600,
                fontSize: '16px',
                lineHeight: 1.5,
              },
            }}>
            {t('label.delete')} {getEntityTitle()}
          </DialogTitle>

          <DialogContent
            sx={{
              mb: 8,
              p: 0,
              '&.MuiDialogContent-root': { padding: 0 },
            }}>
            <Typography
              color="text.secondary"
              sx={{
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: 1.43,
              }}>
              {selectedEntities.length > 1
                ? t('message.are-you-sure-you-want-to-delete-these-entities', {
                    count: selectedEntities.length,
                    entity: entityLabel?.toLowerCase() || 'items',
                  })
                : selectedEntities.length === 1
                ? t('message.are-you-sure-you-want-to-delete-this-entity', {
                    entity: entityLabel?.toLowerCase() || 'item',
                  })
                : ''}
            </Typography>
          </DialogContent>

          <DialogActions
            sx={{
              display: 'flex',
              gap: 1,
              p: 0,
              '&.MuiDialogActions-root': {
                padding: 0,
              },
            }}>
            <Button
              disabled={isDeleting}
              size="large"
              sx={{
                flex: 1,
                textTransform: 'none',
              }}
              variant="outlined"
              onClick={handleCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="error"
              disabled={isDeleting}
              size="large"
              sx={{
                flex: 1,
                textTransform: 'none',
              }}
              variant="contained"
              onClick={handleDelete}>
              {isDeleting ? (
                <CircularProgress color="inherit" size={20} />
              ) : (
                t('label.delete')
              )}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    ),
    [
      getDeleteMessage,
      getEntityTitle,
      handleCancel,
      handleDelete,
      isDeleting,
      isOpen,
      selectedEntities.length,
      theme.palette.allShades,
    ]
  );

  return {
    deleteIconButton,
    deleteModal,
  };
};
