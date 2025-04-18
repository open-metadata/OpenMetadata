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

import { Button, Typography } from 'antd';
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
            data-testid="cancel"
            key="remove-edge-btn"
            type="text"
            onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            className={confirmButtonCss}
            danger={confirmText === t('label.delete')}
            data-testid={isLoading ? 'loading-button' : 'save-button'}
            key="save-btn"
            loading={isLoading}
            type="primary"
            onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      }
      maskClosable={false}
      open={visible}
      title={
        <Typography.Text
          strong
          className={headerClassName}
          data-testid="modal-header">
          {header}
        </Typography.Text>
      }
      onCancel={onCancel}>
      <div className={classNames('h-20', bodyClassName)}>
        <Typography.Text data-testid="body-text">{bodyText}</Typography.Text>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
