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
  Alert,
  Button,
  Form,
  FormProps,
  Input,
  Modal,
  Space,
  Tooltip,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
  VALIDATION_MESSAGES,
} from '../../../constants/constants';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ExtraInfoLabel } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { RetentionPeriodProps } from './RetentionPeriod.interface';

const RetentionPeriod = ({
  retentionPeriod,
  onUpdate,
  permissions,
}: RetentionPeriodProps) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const onCancel = useCallback(() => setIsEdit(false), []);

  const handleSubmit: FormProps['onFinish'] = async ({ retentionPeriod }) => {
    setIsLoading(true);
    try {
      await onUpdate(retentionPeriod);
      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    form.setFieldsValue({ retentionPeriod });
  }, [retentionPeriod]);

  return (
    <div>
      <Space data-testid="retention-period-container">
        <ExtraInfoLabel
          label={t('label.retention-period')}
          value={retentionPeriod ?? NO_DATA_PLACEHOLDER}
        />

        {permissions?.EditAll && (
          <Tooltip
            title={t('label.edit-entity', {
              entity: t('label.retention-period'),
            })}>
            <Button
              className="flex-center p-0"
              data-testid="edit-retention-period-button"
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
              size="small"
              type="text"
              onClick={() => setIsEdit(true)}
            />
          </Tooltip>
        )}
      </Space>

      <Modal
        centered
        destroyOnClose
        closable={false}
        confirmLoading={isLoading}
        data-testid="retention-period-modal"
        maskClosable={false}
        okButtonProps={{
          form: 'retention-period-form',
          type: 'primary',
          htmlType: 'submit',
        }}
        okText={t('label.save')}
        open={isEdit}
        title={t('label.edit-entity', {
          entity: t('label.retention-period'),
        })}
        onCancel={onCancel}>
        <Alert
          className="m-b-sm"
          description={t('message.retention-period-description')}
          type="info"
        />
        <Form
          data-testid="retention-period-form"
          form={form}
          id="retention-period-form"
          layout="vertical"
          validateMessages={VALIDATION_MESSAGES}
          onFinish={handleSubmit}>
          <Form.Item label={t('label.retention-period')} name="retentionPeriod">
            <Input data-testid="retention-period-input" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RetentionPeriod;
