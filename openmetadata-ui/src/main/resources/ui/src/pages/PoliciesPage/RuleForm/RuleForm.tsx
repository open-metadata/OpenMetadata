/* eslint-disable @typescript-eslint/ban-types */
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

import { AutoComplete, Form, Input, Select, TreeSelect } from 'antd';
import { BaseOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import { capitalize, startCase, uniq, uniqBy } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPolicyFunctions,
  getPolicyResources,
  validateRuleCondition,
} from 'rest/rolesAPIV1';
import { allowedNameRegEx } from '../../../constants/regex.constants';
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
  const { t } = useTranslation();
  const [policyResources, setPolicyResources] = useState<ResourceDescriptor[]>(
    []
  );

  const [policyFunctions, setPolicyFunctions] = useState<Function[]>([]);

  const [conditionOptions, setConditionOptions] = useState<BaseOptionType[]>(
    []
  );

  const [validationError, setValidationError] = useState<string>('');
  const [isValidatingCondition, setIsValidating] = useState<boolean>(false);
  const [isValidCondition, setIsValidCondition] = useState<boolean>(false);

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

  const getConditionOptions = (conditionFunctions: Function[]) => {
    return conditionFunctions.reduce((prev: BaseOptionType[], curr) => {
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

  const fetchPolicyFunctions = async () => {
    try {
      const data = await getPolicyFunctions();
      setPolicyFunctions(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleConditionValidation = async (condition: string) => {
    const defaultErrorText = t('message.field-text-is-invalid', {
      fieldText: t('label.condition'),
    });

    if (condition) {
      setIsValidating(true);
      try {
        const response = await validateRuleCondition(condition);

        /**
         * If request is successful then we will only get response as success without any data
         * So, here we have to check the response status code
         */
        const check = [200, 204].includes(response.status);
        if (check) {
          setValidationError('');
          setIsValidCondition(true);
        } else {
          setValidationError(defaultErrorText);
        }
      } catch (error) {
        setValidationError(getErrorText(error as AxiosError, defaultErrorText));
        setIsValidCondition(false);
      } finally {
        setIsValidating(false);
      }
    }
  };

  useEffect(() => {
    fetchPolicyResources();
    fetchPolicyFunctions();
  }, []);

  useEffect(() => {
    setConditionOptions(getConditionOptions(policyFunctions));
  }, [policyFunctions]);

  return (
    <>
      <Form.Item
        label={`${t('label.rule-name')}:`}
        name="ruleName"
        rules={[
          {
            required: true,
            max: 128,
            min: 1,
            message: t('label.field-required', { field: t('label.rule-name') }),
          },
          {
            validator: (_, value) => {
              if (allowedNameRegEx.test(value)) {
                return Promise.reject(
                  t('message.field-text-is-invalid', {
                    fieldText: t('label.rule-name'),
                  })
                );
              }

              return Promise.resolve();
            },
          },
        ]}>
        <Input
          data-testid="rule-name"
          placeholder={t('label.rule-name')}
          type="text"
          value={ruleData.name}
          onChange={(e) =>
            setRuleData((prev: Rule) => ({ ...prev, name: e.target.value }))
          }
        />
      </Form.Item>
      <Form.Item label={t('label.description')} name="ruleDescription">
        <RichTextEditor
          height="200px"
          initialValue={ruleData.description || ''}
          placeHolder={t('message.write-your-description')}
          style={{ margin: 0 }}
          onTextChange={(value: string) =>
            setRuleData((prev: Rule) => ({ ...prev, description: value }))
          }
        />
      </Form.Item>
      <Form.Item
        label={`${t('label.resource-plural')}:`}
        name="resources"
        rules={[
          {
            required: true,
            message: t('label.field-required-plural', {
              field: t('label.resource-plural'),
            }),
          },
        ]}>
        <TreeSelect
          treeCheckable
          className="w-full"
          data-testid="resources"
          placeholder={t('label.select-field', {
            field: t('label.resource-plural'),
          })}
          showCheckedStrategy={TreeSelect.SHOW_PARENT}
          treeData={resourcesOptions}
          onChange={(values: string[]) => {
            setRuleData((prev: Rule) => ({
              ...prev,
              resources: values,
            }));
          }}
        />
      </Form.Item>
      <Form.Item
        label={`${t('label.operation-plural')}:`}
        name="operations"
        rules={[
          {
            required: true,
            message: t('label.field-required-plural', {
              field: t('label.operation-plural'),
            }),
          },
        ]}>
        <TreeSelect
          treeCheckable
          className="w-full"
          data-testid="operations"
          placeholder="Select Operations"
          showCheckedStrategy={TreeSelect.SHOW_PARENT}
          treeData={operationOptions}
          onChange={(values: Operation[]) => {
            setRuleData((prev: Rule) => ({
              ...prev,
              operations: values,
            }));
          }}
        />
      </Form.Item>
      <Form.Item
        label={`${t('label.effect')}:`}
        name="ruleEffect"
        rules={[
          {
            required: true,
            message: t('label.field-required', { field: t('label.effect') }),
          },
        ]}>
        <Select
          data-testid="effect"
          placeholder={t('label.select-field', {
            field: t('label.rule-effect'),
          })}
          value={ruleData.effect}
          onChange={(value) =>
            setRuleData((prev: Rule) => ({ ...prev, effect: value }))
          }>
          <Option key={Effect.Allow}>{capitalize(Effect.Allow)}</Option>
          <Option key={Effect.Deny}>{capitalize(Effect.Deny)}</Option>
        </Select>
      </Form.Item>
      <Form.Item label={`${t('label.condition')}:`} name="condition">
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
            <div className="m-t-xss" data-testid="condition-error" role="alert">
              {`❌ ${t('label.invalid-condition')} : ${validationError}`}
            </div>
          )}
          {isValidatingCondition && (
            <div className="m-t-xss" role="alert">
              {t('label.validating-condition')}
            </div>
          )}
          {isValidCondition && !isValidatingCondition && !validationError && (
            <div
              className="m-t-xss"
              data-testid="condition-success"
              role="alert">
              {`✅ ${t('label.valid-condition')}`}
            </div>
          )}
        </>
      </Form.Item>
    </>
  );
};

export default RuleForm;
