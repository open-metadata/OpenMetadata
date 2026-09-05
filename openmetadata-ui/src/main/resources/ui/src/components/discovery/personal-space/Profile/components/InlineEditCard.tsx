/*
 *  Copyright 2025 Collate.
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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { Edit02, Lock01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import FieldRow from './FieldRow';

export interface InlineEditCardRenderApi {
  cancel: () => void;
  save: () => Promise<void>;
}

interface InlineEditCardProps {
  /** Field label — pinned on the left in both view and edit modes. */
  title: string;
  /** Field sub-text under the title. */
  description?: string;
  /** Right-column value shown in view mode. */
  view: React.ReactNode;
  canEdit: boolean;
  onEnterEdit?: () => void;
  onCancel?: () => void;
  onSave: () => Promise<void>;
  /** Right-column edit control shown in edit mode. */
  renderEdit: (api: InlineEditCardRenderApi) => React.ReactNode;
  // Anchors the card + its edit/cancel/save controls for E2E tests.
  testId?: string;
  /**
   * When the row is not editable, show this lock label instead of nothing
   * (e.g. "Admin-managed"). Omit to leave the row silently read-only.
   */
  lockedLabel?: string;
}

const InlineEditCard: React.FC<InlineEditCardProps> = ({
  title,
  description,
  view,
  canEdit,
  onEnterEdit,
  onCancel,
  onSave,
  renderEdit,
  testId,
  lockedLabel,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const enterEdit = () => {
    onEnterEdit?.();
    setIsEditing(true);
  };

  const cancel = () => {
    onCancel?.();
    setIsEditing(false);
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave();
      setIsEditing(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  const showLock = !isEditing && !canEdit && Boolean(lockedLabel);
  // Reserve space on the right so the value never sits under the pencil
  // (narrow) or the "Admin-managed" lock (wider).
  let rightPadding = 'tw:w-full';
  if (!isEditing) {
    if (canEdit) {
      rightPadding = 'tw:w-full tw:pr-8';
    } else if (showLock) {
      rightPadding = 'tw:w-full tw:pr-32';
    }
  }

  return (
    <Box
      className="ai-profile-page__edit-card tw:relative tw:box-border tw:w-full tw:px-5 tw:py-4"
      data-testid={testId}
      direction="col">
      <Box className={rightPadding} direction="col">
        <FieldRow description={description} title={title}>
          {isEditing ? (
            <div className="tw:w-2/5 tw:min-w-[500px]">
              {renderEdit({ cancel, save })}
            </div>
          ) : (
            view
          )}
        </FieldRow>
        {!isEditing && canEdit && (
          <button
            aria-label={t('label.edit')}
            className="tw:absolute tw:top-1/2 tw:right-4 tw:-translate-y-1/2 tw:cursor-pointer tw:border-none tw:bg-transparent tw:text-quaternary tw:hover:text-secondary"
            data-testid={testId ? `${testId}-edit` : undefined}
            type="button"
            onClick={enterEdit}>
            <Edit02 height={14} width={14} />
          </button>
        )}
        {showLock && (
          <Box
            align="center"
            className="tw:absolute tw:top-1/2 tw:right-4 tw:-translate-y-1/2 tw:shrink-0 tw:gap-1 tw:text-quaternary"
            data-testid={testId ? `${testId}-locked` : undefined}>
            <Lock01 height={13} width={13} />
            <Typography
              className="tw:text-quaternary"
              size="text-xs"
              weight="regular">
              {lockedLabel}
            </Typography>
          </Box>
        )}
      </Box>
      {isEditing && (
        <Box align="center" className="tw:mt-5 tw:pr-2" gap={2} justify="end">
          <Button
            color="secondary"
            data-testid={testId ? `${testId}-cancel` : undefined}
            size="sm"
            onClick={cancel}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            data-testid={testId ? `${testId}-save` : undefined}
            isLoading={isSaving}
            size="sm"
            onClick={save}>
            {t('label.save-changes')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default InlineEditCard;
