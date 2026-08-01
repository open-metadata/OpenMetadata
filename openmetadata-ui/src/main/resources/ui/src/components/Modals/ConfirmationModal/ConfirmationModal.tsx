/*
 *  Copyright 2022 Collate.
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

import { Typography, Button } from '@openmetadata/ui-core-components';
import Modal from 'antd/lib/modal/Modal';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ConfirmationModalProps } from './ConfirmationModal.interface';

/**
 * Modal to show confirmation on varios page
 * @param param0
 * @returns
 */
const ConfirmationModal = ({
  isLoading,
  cancelText,
  confirmText,
  header,
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  confirmButtonCss = '',
  cancelButtonCss = '',
  onConfirm,
  onCancel,
  bodyText,
  className,
  visible,
}: ConfirmationModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      centered
      destroyOnClose
      className={className}
      closable={false}
      closeIcon={null}
      data-testid="confirmation-modal"
      footer={
        <div className={classNames('justify-end', footerClassName)}>
          <Button
            className={classNames('mr-2', cancelButtonCss)}
            color="tertiary"
            data-testid="cancel"
            key="remove-edge-btn"
            onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            className={confirmButtonCss}
            color={
              confirmText === t('label.delete')
                ? 'primary-destructive'
                : 'primary'
            }
            data-testid={isLoading ? 'loading-button' : 'save-button'}
            isLoading={isLoading}
            key="save-btn"
            onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      }
      maskClosable={false}
      open={visible}
      title={
        <Typography
          className={headerClassName}
          data-testid="modal-header"
          weight="bold">
          {header}
        </Typography>
      }
      onCancel={onCancel}>
      <div className={classNames('h-20', bodyClassName)}>
        <Typography data-testid="body-text">{bodyText}</Typography>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
