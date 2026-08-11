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

import { Button, Divider } from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';

interface FormActionButtonsProps {
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  showDelete?: boolean;
  /** When false, hides the save button (e.g. OSS read-only periodic start node). */
  showSave?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  deleteLabel?: string;
}

export const FormActionButtons: React.FC<FormActionButtonsProps> = ({
  onCancel,
  onSave,
  onDelete,
  showDelete = false,
  showSave = true,
  isDisabled = false,
  isLoading = false,
  saveLabel,
  cancelLabel,
  deleteLabel,
}) => {
  const { t } = useTranslation();
  const { allowStructuralGraphEdits, canSave } = useWorkflowModeContext();
  const shouldShowDelete =
    showDelete && onDelete && canSave && allowStructuralGraphEdits;

  const effectiveSaveLabel = saveLabel ?? t('label.save');
  const effectiveCancelLabel = cancelLabel ?? t('label.cancel');
  const effectiveDeleteLabel = deleteLabel ?? t('label.delete-node');

  return (
    <div>
      <Divider orientation="horizontal" />
      <div className="tw:flex tw:justify-between tw:items-center tw:mr-4 tw:my-4">
        {shouldShowDelete ? (
          <Button
            color="tertiary-destructive"
            data-testid="delete-node-button"
            size="sm"
            onPress={onDelete}>
            {effectiveDeleteLabel}
          </Button>
        ) : (
          <div />
        )}
        <div className="tw:flex tw:gap-3">
          <Button
            color="secondary"
            data-testid="cancel-workflow-button"
            size="sm"
            onPress={onCancel}>
            {effectiveCancelLabel}
          </Button>
          {showSave && canSave && (
            <Button
              color="primary"
              data-testid="save-node-configuration-button"
              isDisabled={isDisabled || isLoading || !canSave}
              size="sm"
              onPress={onSave}>
              {isLoading ? `${t('label.saving')}...` : effectiveSaveLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
