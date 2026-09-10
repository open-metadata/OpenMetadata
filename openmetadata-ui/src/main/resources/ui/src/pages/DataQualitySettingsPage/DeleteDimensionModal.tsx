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
import { Modal, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataQualityDimension } from '../../generated/tests/dataQualityDimension';

export interface DeleteDimensionModalProps {
  /** The dimension pending deletion; `undefined` keeps the modal closed. */
  dimension?: DataQualityDimension;
  /** Test cases that reference it — they fall back to their test definition's dimension. */
  testCaseCount: number;
  /** Test definitions classified with it — these break outright, so they are called out. */
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
  const title = dimension?.displayName ?? dimension?.name ?? '';
  const hasReferences = testCaseCount > 0 || testDefinitionCount > 0;

  return (
    <Modal
      cancelText={t('label.cancel')}
      confirmLoading={isDeleting}
      data-testid="delete-dimension-modal"
      okButtonProps={{ danger: true }}
      okText={t('label.delete-entity', { entity: t('label.dimension') })}
      open={Boolean(dimension)}
      title={t('label.delete-entity', { entity: title })}
      onCancel={onCancel}
      onOk={onConfirm}>
      <Typography.Paragraph>
        {t('message.delete-dimension-confirmation')}
      </Typography.Paragraph>
      {hasReferences && (
        <div className="dimension-delete-warning">
          {testCaseCount > 0 && (
            <>
              <Typography.Text strong>
                {t('message.dimension-in-use-count', { count: testCaseCount })}
              </Typography.Text>
              <Typography.Paragraph className="m-b-0">
                {t('message.dimension-delete-fallback')}
              </Typography.Paragraph>
            </>
          )}
          {testDefinitionCount > 0 && (
            <>
              <Typography.Text strong>
                {t('message.dimension-in-use-test-definition-count', {
                  count: testDefinitionCount,
                })}
              </Typography.Text>
              <Typography.Paragraph className="m-b-0">
                {t('message.dimension-delete-test-definition-fallback')}
              </Typography.Paragraph>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};

export default DeleteDimensionModal;
