/*
 *  Copyright 2023 Collate.
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
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import { DataQualityDimension } from '../../../../../../generated/tests/dataQualityDimension';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';

interface DimensionDeleteDialogProps {
  dimension?: DataQualityDimension;
  /** `undefined` means the count could not be fetched: reported as unknown, not none. */
  testCaseCount?: number;
  testDefinitionCount?: number;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DimensionDeleteDialog = ({
  dimension,
  testCaseCount,
  testDefinitionCount,
  isDeleting,
  onCancel,
  onConfirm,
}: DimensionDeleteDialogProps) => {
  const { t } = useTranslation();
  const isImpactUnknown =
    isUndefined(testCaseCount) || isUndefined(testDefinitionCount);

  return (
    <ModalOverlay
      isDismissable={!isDeleting}
      isOpen={Boolean(dimension)}
      onOpenChange={(open) => !open && onCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="delete-dimension-dialog"
          dividers="scroll"
          title={t('label.delete-entity', {
            entity: getEntityName(dimension),
          })}
          width={520}
          onClose={onCancel}>
          <Dialog.Content>
            <Box direction="col" gap={3}>
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('message.delete-dimension-confirmation')}
              </Typography>
              {isImpactUnknown && (
                <Typography className="tw:text-warning-primary" size="text-sm">
                  {t('message.dimension-impact-unknown')}
                </Typography>
              )}
              {Boolean(testCaseCount) && (
                <Typography size="text-sm">
                  <strong>
                    {t('message.dimension-in-use-count', {
                      count: testCaseCount,
                    })}
                  </strong>{' '}
                  {t('message.dimension-delete-fallback')}
                </Typography>
              )}
              {Boolean(testDefinitionCount) && (
                <Typography size="text-sm">
                  <strong>
                    {t('message.dimension-in-use-test-definition-count', {
                      count: testDefinitionCount,
                    })}
                  </strong>{' '}
                  {t('message.dimension-delete-test-definition-fallback')}
                </Typography>
              )}
            </Box>
          </Dialog.Content>
          <Dialog.Footer>
            <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
              <Button
                color="tertiary"
                isDisabled={isDeleting}
                size="sm"
                onPress={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary-destructive"
                data-testid="confirm-delete-dimension"
                isLoading={isDeleting}
                size="sm"
                onPress={onConfirm}>
                {t('label.delete')}
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default DimensionDeleteDialog;
