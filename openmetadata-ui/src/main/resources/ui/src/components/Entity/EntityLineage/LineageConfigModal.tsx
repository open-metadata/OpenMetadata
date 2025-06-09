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
import { Form, InputNumber, Modal } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import { LineageConfigModalProps } from './EntityLineage.interface';

const LineageConfigModal: React.FC<LineageConfigModalProps> = ({
  visible,
  config,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  return (
    <Modal
      maskClosable={false}
      open={visible}
      title={t('label.lineage-config')}
      onCancel={onCancel}
      onOk={form.submit}>
      <Form
        form={form}
        initialValues={config}
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={onSave}>
        <Form.Item
          label={t('label.upstream-depth')}
          name="upstreamDepth"
          rules={[
            {
              required: true,
            },
            {
              type: 'number',
              min: 0,
            },
          ]}
          tooltip={t('message.upstream-depth-tooltip')}>
          <InputNumber className="w-full" data-testid="field-upstream" />
        </Form.Item>

        <Form.Item
          label={t('label.downstream-depth')}
          name="downstreamDepth"
          rules={[
            {
              required: true,
            },
            {
              type: 'number',
              min: 0,
            },
          ]}
          tooltip={t('message.downstream-depth-tooltip')}>
          <InputNumber className="w-full" data-testid="field-downstream" />
        </Form.Item>

        <Form.Item
          label={t('label.nodes-per-layer')}
          name="nodesPerLayer"
          rules={[
            {
              required: true,
            },
            {
              type: 'number',
              min: 5,
            },
          ]}
          tooltip={t('message.nodes-per-layer-tooltip')}>
          <InputNumber className="w-full" data-testid="field-nodes-per-layer" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LineageConfigModal;
