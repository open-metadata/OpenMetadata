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
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getStageActionLabel } from './EntityStageBadge.utils';

const MODAL_WIDTH = 480;

export interface StatusRequestModalProps {
  /** Stages the asset's lifecycle offers on request. */
  stages: EntityStatus[];
  initialStage: EntityStatus;
  onCancel: () => void;
  /** Resolves true once the request exists, which closes the dialog. */
  onSubmit: (stage: EntityStatus, reason: string) => Promise<boolean>;
}

/** Asks the asset's lifecycle approvers to move it to a stage they offer on request. */
export const StatusRequestModal = ({
  stages,
  initialStage,
  onCancel,
  onSubmit,
}: StatusRequestModalProps) => {
  const { t } = useTranslation();
  const [stage, setStage] = useState<EntityStatus>(initialStage);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setIsSubmitting(true);
    const raised = await onSubmit(stage, reason.trim());
    setIsSubmitting(false);
    if (raised) {
      onCancel();
    }
  };

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isSubmitting}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          data-testid="status-request-modal"
          width={MODAL_WIDTH}
          onClose={onCancel}>
          <Dialog.Header
            title={t('label.change-entity', { entity: t('label.status') })}
          />
          <Dialog.Content>
            <Select
              data-testid="status-request-stage"
              items={stages.map((option) => ({
                id: option,
                label: getStageActionLabel(t, option),
              }))}
              label={t('label.status')}
              selectedKey={stage}
              onSelectionChange={(key) => key && setStage(key as EntityStatus)}>
              {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
            <TextArea
              isRequired
              data-testid="status-request-reason"
              label={t('label.reason')}
              placeholder={t('message.status-request-reason-placeholder')}
              rows={4}
              value={reason}
              onChange={setReason}
            />
            <Typography
              as="p"
              className="tw:m-0 tw:text-tertiary"
              size="text-xs">
              {t('message.status-request-approval-hint')}
            </Typography>
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="status-request-cancel"
              isDisabled={isSubmitting}
              size="md"
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="status-request-submit"
              isDisabled={reason.trim() === ''}
              isLoading={isSubmitting}
              size="md"
              onPress={submit}>
              {t('label.submit')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
