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
import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  RadioButton,
  RadioGroup,
} from '@openmetadata/ui-core-components';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type MetricDeleteMode = 'hard-delete' | 'soft-delete';

interface MetricDeleteDialogProps {
  isDeleting: boolean;
  isOpen: boolean;
  metricName: string;
  onCancel: () => void;
  onConfirm: (mode: MetricDeleteMode) => Promise<void>;
}

const MetricDeleteDialog = ({
  isDeleting,
  isOpen,
  metricName,
  onCancel,
  onConfirm,
}: MetricDeleteDialogProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<MetricDeleteMode>('soft-delete');

  useEffect(() => {
    if (isOpen) {
      setMode('soft-delete');
    }
  }, [isOpen]);

  const deleteLabel = t('label.delete');
  const metricLabel = t('label.metric').toLowerCase();

  return (
    <ModalOverlay
      isDismissable={!isDeleting}
      isOpen={isOpen}
      onOpenChange={(open) => !open && !isDeleting && onCancel()}>
      <Modal>
        <Dialog
          data-testid="delete-modal"
          showCloseButton={!isDeleting}
          title={`${deleteLabel} "${metricName}" ${t('label.metric')}`}
          width={480}
          onClose={() => !isDeleting && onCancel()}>
          <Dialog.Content>
            <RadioGroup
              aria-label={deleteLabel}
              className="tw:gap-3"
              size="md"
              value={mode}
              onChange={(value) => setMode(value as MetricDeleteMode)}>
              <RadioButton
                className="tw:cursor-pointer tw:rounded-xl tw:border tw:border-secondary tw:p-4"
                data-testid="soft-delete"
                hint={t('message.soft-delete-common-message', {
                  entity: metricLabel,
                })}
                label={t('label.soft-delete')}
                size="md"
                value="soft-delete"
              />
              <RadioButton
                className="tw:cursor-pointer tw:rounded-xl tw:border tw:border-secondary tw:p-4"
                data-testid="hard-delete"
                hint={t('message.permanently-delete-common-message', {
                  entity: metricLabel,
                })}
                label={t('label.permanently-delete')}
                size="md"
                value="hard-delete"
              />
            </RadioGroup>
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="discard-button"
              isDisabled={isDeleting}
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              data-testid="confirm-button"
              isDisabled={isDeleting}
              isLoading={isDeleting}
              onPress={() => onConfirm(mode)}>
              {deleteLabel}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default MetricDeleteDialog;
