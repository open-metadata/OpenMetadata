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
import { Form, Input, Modal } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineageConfig,
  LineageConfigModalProps,
} from './EntityLineage.interface';

type LineageConfigFormFields = {
  upstreamDepth: number;
  downstreamDepth: number;
  nodesPerLayer: number;
};

const LineageConfigModal: React.FC<LineageConfigModalProps> = ({
  visible,
  config,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const handleSave = (values: LineageConfigFormFields) => {
    const updatedConfig: LineageConfig = {
      upstreamDepth: Number(values.upstreamDepth),
      downstreamDepth: Number(values.downstreamDepth),
      nodesPerLayer: Number(values.nodesPerLayer),
    };
    onSave(updatedConfig);
  };

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
        onFinish={handleSave}>
        <Form.Item
          label={t('label.upstream-depth')}
          name="upstreamDepth"
          rules={[
            {
              required: true,
              message: t('message.upstream-depth-message'),
            },
          ]}
          tooltip={t('message.upstream-depth-tooltip')}>
          <Input data-testid="field-upstream" type="number" />
        </Form.Item>

        <Form.Item
          label={t('label.downstream-depth')}
          name="downstreamDepth"
          rules={[
            {
              required: true,
              message: t('message.downstream-depth-message'),
            },
          ]}
          tooltip={t('message.downstream-depth-tooltip')}>
          <Input data-testid="field-downstream" type="number" />
        </Form.Item>

        <Form.Item
          label={t('label.nodes-per-layer')}
          name="nodesPerLayer"
          rules={[
            {
              required: true,
              message: t('message.nodes-per-layer-message'),
            },
          ]}
          tooltip={t('message.nodes-per-layer-tooltip')}>
          <Input
            className="w-full"
            data-testid="field-nodes-per-layer"
            min={5}
            type="number"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LineageConfigModal;
