/*
 *  Copyright 2021 Collate
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

import { Button, Card, Col, Form, Input, Row, Select, Space } from 'antd';
import { AxiosError } from 'axios';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { addPolicy } from '../../../axiosAPIs/rolesAPIV1';
import RichTextEditor from '../../../components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import { GlobalSettingOptions } from '../../../constants/globalSettings.constants';
import {
  CreatePolicy,
  PolicyType,
} from '../../../generated/api/policies/createPolicy';
import {
  getPath,
  getPolicyWithFqnPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const { Option } = Select;

const policiesPath = getPath(GlobalSettingOptions.POLICIES);

const breadcrumb = [
  {
    name: 'Settings',
    url: getSettingPath(),
  },
  {
    name: 'Policies',
    url: policiesPath,
  },
  {
    name: 'Add New Policy',
    url: '',
  },
];

const AddPolicyPage = () => {
  const history = useHistory();
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [policyType, setPolicyType] = useState<PolicyType>(
    PolicyType.AccessControl
  );

  const handleCancel = () => {
    history.push(policiesPath);
  };

  const handleSumbit = async () => {
    const data: CreatePolicy = {
      name,
      description,
      policyType,
      rules: [],
    };

    try {
      const dataResponse = await addPolicy(data);
      if (dataResponse) {
        history.push(
          getPolicyWithFqnPath(dataResponse.fullyQualifiedName || '')
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col offset={5} span={14}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
        <Card title="Add New Policy">
          <Form
            data-testid="policy-form"
            id="policy-form"
            initialValues={{ policyType }}
            layout="vertical"
            onFinish={handleSumbit}>
            <Form.Item
              label="Name:"
              name="name"
              rules={[
                {
                  required: true,
                  max: 128,
                  min: 1,
                },
              ]}>
              <Input
                placeholder="Policy name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Form.Item>
            <Form.Item
              label="Policy type:"
              name="policyType"
              rules={[
                {
                  required: true,
                },
              ]}>
              <Select
                placeholder="Select PolicyType"
                value={policyType}
                onChange={(value) => setPolicyType(value)}>
                <Option key={PolicyType.AccessControl}>
                  {PolicyType.AccessControl}
                </Option>
                <Option key={PolicyType.Lifecycle}>
                  {PolicyType.Lifecycle}
                </Option>
              </Select>
            </Form.Item>
            <Form.Item label="Description:" name="description">
              <RichTextEditor
                height="200px"
                initialValue={description}
                placeHolder="write your description"
                style={{ margin: 0 }}
                onTextChange={(value) => setDescription(value)}
              />
            </Form.Item>

            <Space align="center" className="tw-w-full tw-justify-end">
              <Button type="link" onClick={handleCancel}>
                Cancel
              </Button>
              <Button form="policy-form" htmlType="submit" type="primary">
                Submit
              </Button>
            </Space>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default AddPolicyPage;
