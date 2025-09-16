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

import { Button, Input, InputRef, Modal, Typography } from 'antd';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Transi18next } from '../../../utils/CommonUtils';
import { EntityDeleteModalProp } from './EntityDeleteModal.interface';

const EntityDeleteModal = ({
  className,
  entityName,
  onCancel,
  onConfirm,
  softDelete = false,
  visible,
  bodyText,
}: EntityDeleteModalProp) => {
  const deleteTextInputRef = useRef<InputRef>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();
  const handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const isNameMatching = useMemo(() => name === 'DELETE', [name]);

  const handleSave = async () => {
    setSaving(true);
    await onConfirm();
    setSaving(false);
  };

  // To remove the entered text in the modal input after modal closed
  useEffect(() => {
    setName('');

    // Using this method to autoFocus Input element since directly calling focus() doesn't work
    // for the inputs inside modal. Ref - https://github.com/ant-design/ant-design/issues/8668
    let timeout: number;

    if (visible) {
      timeout = window.setTimeout(() => {
        deleteTextInputRef.current?.focus();
      }, 1);
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [visible]);

  return (
    <Modal
      centered
      destroyOnClose
      className={className}
      closable={false}
      data-testid="delete-confirmation-modal"
      footer={
        <div data-testid="delete-confirmation-modal-footer">
          <Button
            className="mr-2"
            data-testid="discard-button"
            disabled={saving}
            type="text"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid={saving ? 'loading-button' : 'confirm-button'}
            disabled={!isNameMatching}
            loading={saving}
            type="primary"
            onClick={handleSave}>
            {t('label.confirm')}
          </Button>
        </div>
      }
      maskClosable={false}
      open={visible}
      title={
        <Typography.Text data-testid="modal-header">
          {softDelete ? (
            <span>
              {t('label.soft-delete')} <strong>{entityName}</strong>
            </span>
          ) : (
            <span>
              {t('label.delete')} <strong>{entityName}</strong>
            </span>
          )}
        </Typography.Text>
      }
      width={600}>
      <div data-testid="body-text">
        <div className="mb-2">
          {bodyText || (
            <Transi18next
              i18nKey="message.permanently-delete-metadata"
              renderElement={
                <span data-testid="entityName" style={{ fontWeight: 500 }} />
              }
              values={{
                entityName: entityName,
              }}
            />
          )}
        </div>
        <Typography className="mb-2">
          <Trans
            i18nKey="label.type-to-confirm"
            values={{ text: t('label.delete-uppercase') }}>
            <strong />
          </Trans>
        </Typography>
        <Input
          autoComplete="off"
          data-testid="confirmation-text-input"
          disabled={saving}
          name="entityName"
          placeholder={t('label.delete-uppercase')}
          ref={deleteTextInputRef}
          type="text"
          value={name}
          onChange={handleOnChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isNameMatching) {
              handleSave();
            }
          }}
        />
      </div>
    </Modal>
  );
};

export default EntityDeleteModal;
