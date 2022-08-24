/*
 *  Copyright 2022 Collate
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

import { Form, Input, Select, TreeSelect } from 'antd';
import { AxiosError } from 'axios';
import { capitalize, startCase, uniq } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { getPolicyResources } from '../../../axiosAPIs/rolesAPIV1';
import RichTextEditor from '../../../components/common/rich-text-editor/RichTextEditor';
import {
  Effect,
  Operation,
  Rule,
} from '../../../generated/api/policies/createPolicy';
import { ResourceDescriptor } from '../../../generated/entity/policies/accessControl/resourceDescriptor';
import { showErrorToast } from '../../../utils/ToastUtils';

const { Option } = Select;

interface RuleFormProps {
  ruleData: Rule;
  setRuleData: (value: React.SetStateAction<Rule>) => void;
}

const RuleForm: FC<RuleFormProps> = ({ ruleData, setRuleData }) => {
  const [policyResources, setPolicyResources] = useState<ResourceDescriptor[]>(
    []
  );

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

  useEffect(() => {
    fetchPolicyResources();
  }, []);

  return (
    <>
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
    </>
  );
};

export default RuleForm;
