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
  Box,
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { DataQualityDimension } from '../../generated/tests/dataQualityDimension';

export interface DeleteDimensionModalProps {
  /** The dimension pending deletion; `undefined` keeps the modal closed. */
  dimension?: DataQualityDimension;
  /** Test cases that reference it — they lose the dimension when it goes. */
  testCaseCount: number;
  /** Test definitions classified with it — these are cleared too, so they are called out. */
  testDefinitionCount: number;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteDimensionModal = ({
  dimension,
  testCaseCount,
  testDefinitionCount,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteDimensionModalProps) => {
  const { t } = useTranslation();

  if (!dimension) {
    return null;
  }

  const title = t('label.delete-entity', {
    entity: dimension.displayName ?? dimension.name,
  });
  const hasReferences = testCaseCount > 0 || testDefinitionCount > 0;

  return (
    <ModalOverlay isOpen>
      <Modal>
        <Dialog
          aria-label={title}
          data-testid="delete-dimension-modal"
          width={480}
          onClose={onCancel}>
          <Dialog.Header>
            <Typography as="h3" size="text-lg" weight="semibold">
              {title}
            </Typography>
          </Dialog.Header>
          <Dialog.Content>
            <Box direction="col" gap={3}>
              <Typography size="text-sm">
                {t('message.delete-dimension-confirmation')}
              </Typography>
              {hasReferences && (
                <Box
                  className="dimension-delete-warning"
                  direction="col"
                  gap={2}>
                  {testCaseCount > 0 && (
                    <Box direction="col" gap={1}>
                      <Typography size="text-sm" weight="semibold">
                        {t('message.dimension-in-use-count', {
                          count: testCaseCount,
                        })}
                      </Typography>
                      <Typography size="text-sm">
                        {t('message.dimension-delete-fallback')}
                      </Typography>
                    </Box>
                  )}
                  {testDefinitionCount > 0 && (
                    <Box direction="col" gap={1}>
                      <Typography size="text-sm" weight="semibold">
                        {t('message.dimension-in-use-test-definition-count', {
                          count: testDefinitionCount,
                        })}
                      </Typography>
                      <Typography size="text-sm">
                        {t('message.dimension-delete-test-definition-fallback')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" size="lg" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              data-testid="confirm-delete-dimension"
              isDisabled={isDeleting}
              isLoading={isDeleting}
              size="lg"
              onClick={onConfirm}>
              {t('label.delete-entity', { entity: t('label.dimension') })}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default DeleteDimensionModal;
