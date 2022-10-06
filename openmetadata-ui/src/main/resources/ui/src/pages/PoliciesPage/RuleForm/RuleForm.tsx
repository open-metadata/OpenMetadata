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

import { AutoComplete, Form, Input, Select, TreeSelect } from 'antd';
import { BaseOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { capitalize, startCase, uniq, uniqBy } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import {
  getPolicyFunctions,
  getPolicyResources,
  validateRuleCondition,
} from '../../../axiosAPIs/rolesAPIV1';
import RichTextEditor from '../../../components/common/rich-text-editor/RichTextEditor';
import {
  Effect,
  Operation,
  Rule,
} from '../../../generated/api/policies/createPolicy';
import { ResourceDescriptor } from '../../../generated/entity/policies/accessControl/resourceDescriptor';
import { Function } from '../../../generated/type/function';
import { getErrorText } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const { Option } = Select;

export interface RuleFormProps {
  ruleData: Rule;
  setRuleData: (value: React.SetStateAction<Rule>) => void;
}

const RuleForm: FC<RuleFormProps> = ({ ruleData, setRuleData }) => {
  const [policyResources, setPolicyResources] = useState<ResourceDescriptor[]>(
    []
  );

  const [policyFunctions, setPolicyFunctions] = useState<Function[]>([]);

  const [conditionOptions, setConditionOptions] = useState<BaseOptionType[]>(
    []
  );

  const [validationError, setValidationError] = useState<string>('');
  const [isValidatingCondition, setIsvalidating] = useState<boolean>(false);
  const [isValidCondition, setIsvalidCondition] = useState<boolean>(false);

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

  const getConditionOptions = (funtions: Function[]) => {
    return funtions.reduce((prev: BaseOptionType[], curr: Function) => {
      const currentValues = (curr.examples || []).map((example: string) => ({
        label: example,
        value: example,
      }));

      return uniqBy([...prev, ...currentValues], 'value');
    }, []);
  };

  const handleConditionSearch = (value: string) => {
    if (value) {
      setConditionOptions((prev) =>
        prev.filter((condition) => condition.value.includes(value))
      );
    } else {
      setConditionOptions(getConditionOptions(policyFunctions));
    }
  };

  const fetchPolicyResources = async () => {
    try {
      const data = await getPolicyResources();
      setPolicyResources(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchPolicyFuntions = async () => {
    try {
      const data = await getPolicyFunctions();
      setPolicyFunctions(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleConditionValidation = async (condition: string) => {
    const defaultErrorText = 'Condition is invalid';
    if (condition) {
      setIsvalidating(true);
      try {
        const response = await validateRuleCondition(condition);

        /**
         * If request is successful then we will only get response as success without any data
         * So, here we have to check the response status code
         */
        const check = [200, 204].includes(response.status);
        if (check) {
          setValidationError('');
          setIsvalidCondition(true);
        } else {
          setValidationError(defaultErrorText);
        }
      } catch (error) {
        setValidationError(getErrorText(error as AxiosError, defaultErrorText));
        setIsvalidCondition(false);
      } finally {
        setIsvalidating(false);
      }
    }
  };

  useEffect(() => {
    fetchPolicyResources();
    fetchPolicyFuntions();
  }, []);

  useEffect(() => {
    setConditionOptions(getConditionOptions(policyFunctions));
  }, [policyFunctions]);

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
          data-testid="rule-name"
          placeholder="Rule Name"
          type="text"
          value={ruleData.name}
          onChange={(e) =>
            setRuleData((prev: Rule) => ({ ...prev, name: e.target.value }))
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
            setRuleData((prev: Rule) => ({ ...prev, description: value }))
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
          data-testid="resuorces"
          placeholder="Select Resources"
          showCheckedStrategy={TreeSelect.SHOW_PARENT}
          treeData={resourcesOptions}
          onChange={(values) => {
            setRuleData((prev: Rule) => ({
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
          data-testid="operations"
          placeholder="Select Operations"
          showCheckedStrategy={TreeSelect.SHOW_PARENT}
          treeData={operationOptions}
          onChange={(values) => {
            setRuleData((prev: Rule) => ({
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
          data-testid="effect"
          placeholder="Select Rule Effect"
          value={ruleData.effect}
          onChange={(value) =>
            setRuleData((prev: Rule) => ({ ...prev, effect: value }))
          }>
          <Option key={Effect.Allow}>{capitalize(Effect.Allow)}</Option>
          <Option key={Effect.Deny}>{capitalize(Effect.Deny)}</Option>
        </Select>
      </Form.Item>
      <Form.Item label="Condition:" name="condition">
        <>
          <AutoComplete
            data-testid="condition"
            options={conditionOptions}
            placeholder="Condition"
            value={ruleData.condition}
            onChange={(value) => {
              setRuleData((prev: Rule) => ({ ...prev, condition: value }));
              !value && setValidationError('');
              handleConditionValidation(value);
            }}
            onSearch={handleConditionSearch}
          />
          {validationError && (
            <div className="tw-mt-1" data-testid="condition-error" role="alert">
              {`❌ Invalid condition : ${validationError}`}
            </div>
          )}
          {isValidatingCondition && (
            <div className="tw-mt-1" role="alert">
              Validating the condition...
            </div>
          )}
          {isValidCondition && !isValidatingCondition && !validationError && (
            <div
              className="tw-mt-1"
              data-testid="condition-success"
              role="alert">
              ✅ Valid condition
            </div>
          )}
        </>
      </Form.Item>
    </>
  );
};

export default RuleForm;
