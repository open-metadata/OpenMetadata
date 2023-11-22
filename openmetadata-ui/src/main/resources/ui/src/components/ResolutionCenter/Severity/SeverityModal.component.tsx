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

import { Form, Modal, Select } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { severityOptions } from '../../../utils/SeverityUtils';
import { SeverityModalProps } from './Severity.interface';

const SeverityModal = ({
  initialSeverity,
  isLoading,
  onCancel,
  onSave,
}: SeverityModalProps) => {
  const [form] = useForm();
  const { t } = useTranslation();

  return (
    <Modal
      centered
      destroyOnClose
      open
      cancelText={t('label.cancel')}
      closable={false}
      confirmLoading={isLoading}
      maskClosable={false}
      okText={t('label.submit')}
      title={`${t('label.edit-entity', {
        entity: t('label.severity'),
      })}`}
      width={600}
      onCancel={onCancel}
      onOk={() => form.submit()}>
      <Form
        data-testid="severity-form"
        form={form}
        initialValues={{ severity: initialSeverity }}
        layout="vertical"
        name="severity"
        onFinish={onSave}>
        <Form.Item label={t('label.severity')} name="severity">
          <Select options={severityOptions()} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SeverityModal;
