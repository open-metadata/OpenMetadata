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
import { Form, InputNumber, Modal, Select } from 'antd';
import React, { useState } from 'react';
import {
  LineageConfig,
  LineageConfigModalProps,
} from './EntityLineage.interface';

const SELECT_OPTIONS = [1, 2, 3].map((value) => (
  <Select.Option key={value} value={value}>
    {value}
  </Select.Option>
));

const LineageConfigModal: React.FC<LineageConfigModalProps> = ({
  visible,
  config,
  onCancel,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [upstreamDepth, setUpstreamDepth] = useState<number>(
    config.upstreamDepth || 1
  );
  const [downstreamDepth, setDownstreamDepth] = useState<number>(
    config.downstreamDepth || 1
  );
  const [nodesPerLayer, setNodesPerLayer] = useState<number>(
    config.nodesPerLayer || 1
  );

  const handleSave = () => {
    const updatedConfig: LineageConfig = {
      upstreamDepth,
      downstreamDepth,
      nodesPerLayer,
    };
    onSave(updatedConfig);
  };

  return (
    <Modal
      title="Lineage Config"
      visible={visible}
      onCancel={onCancel}
      onOk={form.submit}>
      <Form
        form={form}
        initialValues={config}
        layout="vertical"
        onFinish={handleSave}>
        <Form.Item
          label="Upstream Depth"
          name="upstreamDepth"
          rules={[
            {
              required: true,
              message: 'Please select a value for upstream depth',
            },
          ]}
          tooltip="Display up to 3 nodes of upstream lineage to identify the source (parent levels).">
          <Select
            data-testid="field-upstream"
            onChange={(value) => setUpstreamDepth(value as number)}>
            {SELECT_OPTIONS}
          </Select>
        </Form.Item>

        <Form.Item
          label="Downstream Depth"
          name="downstreamDepth"
          rules={[
            {
              required: true,
              message: 'Please select a value for downstream depth',
            },
          ]}
          tooltip="Display up to 3 nodes of downstream lineage to identify the target (child levels).">
          <Select
            data-testid="field-downstream"
            onChange={(value) => setDownstreamDepth(value as number)}>
            {SELECT_OPTIONS}
          </Select>
        </Form.Item>

        <Form.Item
          label="Nodes per Layer"
          name="nodesPerLayer"
          rules={[
            {
              required: true,
              message: 'Please enter a value for nodes per layer',
            },
          ]}
          tooltip="Choose to display ‘n’ number of nodes per layer. If the existing nodes exceed the defined number of nodes, then pagination will be shown.">
          <InputNumber
            className="w-full"
            data-testid="field-nodes-per-layer"
            min={5}
            onChange={(value) => setNodesPerLayer(value as number)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LineageConfigModal;
