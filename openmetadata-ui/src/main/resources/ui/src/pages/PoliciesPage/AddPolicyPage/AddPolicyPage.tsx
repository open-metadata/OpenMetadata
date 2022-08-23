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

import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Space,
  TreeSelect,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { capitalize, startCase, uniq } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { addPolicy, getPolicyResources } from '../../../axiosAPIs/rolesAPIV1';
import RichTextEditor from '../../../components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import { GlobalSettingOptions } from '../../../constants/globalSettings.constants';
import {
  CreatePolicy,
  Effect,
  Operation,
  PolicyType,
  Rule,
} from '../../../generated/api/policies/createPolicy';
import { ResourceDescriptor } from '../../../generated/entity/policies/accessControl/resourceDescriptor';
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
  const [policyResources, setPolicyResources] = useState<ResourceDescriptor[]>(
    []
  );
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [ruleData, setRuleData] = useState<Rule>({
    name: '',
    description: '',
    resources: [],
    operations: [],
    effect: Effect.Allow,
  });

  /**
   * Derive the resources from policy resources
   */
  const resourcesOptions = useMemo(() => {
    const resources = policyResources.filter(
      (resource) => resource.name !== 'all'
    );
    const option = [
      {
        title: 'All',
        value: 'all',
        key: 'all',
        children: resources.map((resource) => ({
          title: startCase(resource.name),
          value: resource.name,
          key: resource.name,
        })),
      },
    ];

    return option;
  }, [policyResources]);

  /**
   * Derive the operations from selected resources
   */
  const operationOptions = useMemo(() => {
    const selectedResources = policyResources.filter((resource) =>
      ruleData.resources?.includes(resource.name || '')
    );
    const operations = selectedResources
      .reduce(
        (prev: Operation[], curr: ResourceDescriptor) =>
          uniq([...prev, ...(curr.operations || [])]),
        []
      )
      .filter((operation) => operation !== Operation.All);

    const option = [
      {
        title: 'All',
        value: Operation.All,
        key: 'All',
        children: operations.map((operation) => ({
          title: operation,
          value: operation,
          key: operation,
        })),
      },
    ];

    return option;
  }, [ruleData.resources, policyResources]);

  const fetchPolicyResources = async () => {
    try {
      const data = await getPolicyResources();
      setPolicyResources(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleCancel = () => {
    history.push(policiesPath);
  };

  const handleSumbit = async () => {
    const data: CreatePolicy = {
      name,
      description,
      policyType: PolicyType.AccessControl,
      rules: [ruleData],
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

  useEffect(() => {
    fetchPolicyResources();
  }, []);

  return (
    <Row className="tw-bg-body-main tw-h-auto" gutter={[16, 16]}>
      <Col offset={5} span={14}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
        <Card>
          <Typography.Paragraph className="tw-text-base">
            Add New Policy
          </Typography.Paragraph>
          <Form
            data-testid="policy-form"
            id="policy-form"
            initialValues={{
              ruleEffect: ruleData.effect,
            }}
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

            <Form.Item label="Description:" name="description">
              <RichTextEditor
                height="200px"
                initialValue={description}
                placeHolder="Write your description"
                style={{ margin: 0 }}
                onTextChange={(value) => setDescription(value)}
              />
            </Form.Item>

            <Divider>Add Rule</Divider>
            <Form.Item
              label="Rule Name:"
              name="ruleName"
              rules={[
                {
                  required: true,
                  max: 128,
                  min: 1,
                },
              ]}>
              <Input
                placeholder="Rule Name"
                type="text"
                value={ruleData.name}
                onChange={(e) =>
                  setRuleData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </Form.Item>
            <Form.Item label="Description:" name="ruleDescription">
              <RichTextEditor
                height="200px"
                initialValue={ruleData.description || ''}
                placeHolder="Write your description"
                style={{ margin: 0 }}
                onTextChange={(value) =>
                  setRuleData((prev) => ({ ...prev, description: value }))
                }
              />
            </Form.Item>
            <Form.Item
              label="Resources:"
              name="resources"
              rules={[
                {
                  required: true,
                },
              ]}>
              <TreeSelect
                treeCheckable
                className="tw-w-full"
                placeholder="Select Resources"
                showCheckedStrategy={TreeSelect.SHOW_PARENT}
                treeData={resourcesOptions}
                onChange={(values) => {
                  setRuleData((prev) => ({
                    ...prev,
                    resources: values,
                  }));
                }}
              />
            </Form.Item>
            <Form.Item
              label="Operations:"
              name="operations"
              rules={[
                {
                  required: true,
                },
              ]}>
              <TreeSelect
                treeCheckable
                className="tw-w-full"
                placeholder="Select Operations"
                showCheckedStrategy={TreeSelect.SHOW_PARENT}
                treeData={operationOptions}
                onChange={(values) => {
                  setRuleData((prev) => ({
                    ...prev,
                    operations: values,
                  }));
                }}
              />
            </Form.Item>
            <Form.Item
              label="Effect:"
              name="ruleEffect"
              rules={[
                {
                  required: true,
                },
              ]}>
              <Select
                placeholder="Select Rule Effect"
                value={ruleData.effect}
                onChange={(value) =>
                  setRuleData((prev) => ({ ...prev, effect: value }))
                }>
                <Option key={Effect.Allow}>{capitalize(Effect.Allow)}</Option>
                <Option key={Effect.Deny}>{capitalize(Effect.Deny)}</Option>
              </Select>
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
