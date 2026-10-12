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

import {
  Box,
  ComboBox,
  FormField,
  FormItemLabel,
  HintText,
  Select as CoreSelect,
  TreeSelect,
} from '@openmetadata/ui-core-components';
import { Input, Select } from 'antd';
import { AxiosError } from 'axios';
import { capitalize, startCase, uniq, uniqBy } from 'lodash';
import { FC, useEffect, useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityAttachmentProvider } from '../../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import { NAME_FIELD_VALIDATION } from '../../../constants/Form.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  Effect,
  Operation,
  Rule,
} from '../../../generated/api/policies/createPolicy';
import { ResourceDescriptor } from '../../../generated/entity/policies/accessControl/resourceDescriptor';
import { Function } from '../../../generated/type/function';
import {
  getPolicyFunctions,
  getPolicyResources,
  validateRuleCondition,
} from '../../../rest/rolesAPIV1';
import { ALL_TYPE_RESOURCE_LIST } from '../../../utils/PermissionsUtils';
import { getErrorText } from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  getTreeSelectValue,
  getTreeSelectValues,
  toTreeSelectNodes,
} from '../../../utils/TreeSelect.utils';

const { Option } = Select;

export interface PolicyRuleFormValues {
  ruleName: string;
  resources: string[];
  operations: Operation[];
  ruleEffect: Effect;
  condition?: string;
  name?: string;
}

export interface RuleFormProps {
  form: UseFormReturn<PolicyRuleFormValues>;
  ruleData: Rule;
  setRuleData: (value: React.SetStateAction<Rule>) => void;
  description?: string;
}

const RuleForm: FC<RuleFormProps> = ({
  form,
  ruleData,
  setRuleData,
  description,
}) => {
  const { t } = useTranslation();
  const [policyResources, setPolicyResources] = useState<ResourceDescriptor[]>(
    []
  );

  const [policyFunctions, setPolicyFunctions] = useState<Function[]>([]);

  const [conditionOptions, setConditionOptions] = useState<
    { value: string; label: string }[]
  >([]);

  const [validationError, setValidationError] = useState<string>('');
  const [isValidatingCondition, setIsValidating] = useState<boolean>(false);
  const [isValidCondition, setIsValidCondition] = useState<boolean>(false);

  /**
   * Derive the resources from policy resources
   */
  const resourcesOptions = useMemo(() => {
    const resources = policyResources.filter(
      (resource) => !ALL_TYPE_RESOURCE_LIST.includes(resource.name || '')
    );
    const option = [
      {
        title: 'All',
        value: 'All',
        key: 'all',
        children: resources.map((resource) => ({
          title: startCase(resource.name),
          value: resource.name ?? '',
          key: resource.name,
        })),
      },
    ];

    return toTreeSelectNodes(option);
  }, [policyResources]);

  /**
   * Derive the operations from selected resources
   */
  const operationOptions = useMemo(() => {
    const selectedResources = policyResources.filter((resource) => {
      // if resource is all then check for both case lower and upper
      if (ALL_TYPE_RESOURCE_LIST.includes(resource.name || '')) {
        return ALL_TYPE_RESOURCE_LIST.some((val) =>
          ruleData.resources?.includes(val)
        );
      }

      return ruleData.resources?.includes(resource.name || '');
    });
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

    return toTreeSelectNodes(option);
  }, [ruleData.resources, policyResources]);

  const fetchResources = useMemo(
    () => async () => ({ nodes: resourcesOptions }),
    [resourcesOptions]
  );
  const fetchOperations = useMemo(
    () => async () => ({ nodes: operationOptions }),
    [operationOptions]
  );

  const getConditionOptions = (conditionFunctions: Function[]) => {
    return conditionFunctions.reduce(
      (prev: { value: string; label: string }[], curr) => {
        const currentValues = (curr.examples || []).map((example: string) => ({
          label: example,
          value: example,
        }));

        return uniqBy([...prev, ...currentValues], 'value');
      },
      []
    );
  };

  const handleConditionSearch = (value: string) => {
    if (value) {
      setConditionOptions(
        getConditionOptions(policyFunctions).filter((condition) =>
          condition.value.includes(value)
        )
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
      <FormField
        control={form.control}
        name="ruleName"
        rules={NAME_FIELD_VALIDATION}>
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel required label={`${t('label.rule-name')}:`} />
            <Input
              {...field}
              aria-label={`${t('label.rule-name')}:`}
              data-testid="rule-name"
              placeholder={t('label.rule-name')}
              type="text"
              onChange={(e) => {
                field.onChange(e);
                setRuleData((prev) => ({ ...prev, name: e.target.value }));
              }}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      <EntityAttachmentProvider
        entityFqn={ruleData.name}
        entityType={EntityType.POLICY}>
        <Box direction="col" gap={2}>
          <FormItemLabel label={t('label.description')} />
          <RichTextEditor
            data-testid="description"
            initialValue={description}
            placeHolder={t('message.write-your-description')}
            onTextChange={(value) =>
              setRuleData((prev) => ({ ...prev, description: value }))
            }
          />
        </Box>
      </EntityAttachmentProvider>
      <FormField
        control={form.control}
        name="resources"
        rules={{
          required: t('label.field-required', {
            field: `${t('label.resource-plural')}:`,
          }),
        }}>
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <TreeSelect
              cascadeSelection
              multiple
              required
              searchable
              data-testid="resources"
              fetchData={fetchResources}
              isInvalid={fieldState.invalid}
              label={`${t('label.resource-plural')}:`}
              selectedDisplayStrategy="parent"
              value={getTreeSelectValue(resourcesOptions, field.value)}
              onBlur={field.onBlur}
              onChange={(selection) => {
                const values = getTreeSelectValues(selection);
                field.onChange(values);
                setRuleData((prev) => ({
                  ...prev,
                  resources: values as string[],
                }));
              }}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      <FormField
        control={form.control}
        name="operations"
        rules={{
          required: t('label.field-required', {
            field: `${t('label.operation-plural')}:`,
          }),
        }}>
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <TreeSelect
              cascadeSelection
              multiple
              required
              searchable
              data-testid="operations"
              fetchData={fetchOperations}
              isInvalid={fieldState.invalid}
              label={`${t('label.operation-plural')}:`}
              selectedDisplayStrategy="parent"
              value={getTreeSelectValue(operationOptions, field.value)}
              onBlur={field.onBlur}
              onChange={(selection) => {
                const values = getTreeSelectValues(selection);
                field.onChange(values);
                setRuleData((prev) => ({
                  ...prev,
                  operations: values as Operation[],
                }));
              }}
            />
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      <FormField
        control={form.control}
        name="ruleEffect"
        rules={{
          required: t('label.field-required', {
            field: `${t('label.effect')}:`,
          }),
        }}>
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel required label={`${t('label.effect')}:`} />
            <Select
              {...field}
              aria-label={`${t('label.effect')}:`}
              data-testid="effect"
              placeholder={t('label.select-field', {
                field: t('label.rule-effect'),
              })}
              onChange={(value) => {
                field.onChange(value);
                setRuleData((prev) => ({ ...prev, effect: value }));
              }}>
              <Option key={Effect.Allow}>{capitalize(Effect.Allow)}</Option>
              <Option key={Effect.Deny}>{capitalize(Effect.Deny)}</Option>
            </Select>
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
      <FormField control={form.control} name="condition">
        {({ field, fieldState }) => (
          <Box direction="col" gap={2}>
            <FormItemLabel
              label={`${t('label.condition')}:`}
              required={false}
            />
            <>
              <ComboBox
                allowsCustomValue
                aria-label={`${t('label.condition')}:`}
                data-testid="condition"
                inputValue={ruleData.condition ?? ''}
                items={conditionOptions.map((option) => ({
                  id: option.value,
                  label: option.label,
                }))}
                placeholder={t('label.condition')}
                shortcut={false}
                showSearchIcon={false}
                onBlur={field.onBlur}
                onInputChange={(value) => {
                  field.onChange(value);
                  setRuleData((prev) => ({ ...prev, condition: value }));
                  if (!value) {
                    setValidationError('');
                    setIsValidCondition(false);
                  }
                  handleConditionSearch(value);
                  handleConditionValidation(value);
                }}>
                {(item) => (
                  <CoreSelect.Item id={item.id}>{item.label}</CoreSelect.Item>
                )}
              </ComboBox>
              {validationError && (
                <div
                  className="m-t-xss"
                  data-testid="condition-error"
                  role="alert">
                  {`❌ ${t('label.invalid-condition')} : ${validationError}`}
                </div>
              )}
              {isValidatingCondition && (
                <div className="m-t-xss" role="alert">
                  {t('label.validating-condition')}
                </div>
              )}
              {isValidCondition &&
                !isValidatingCondition &&
                !validationError && (
                  <div
                    className="m-t-xss"
                    data-testid="condition-success"
                    role="alert">
                    {`✅ ${t('label.valid-condition')}`}
                  </div>
                )}
            </>
            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}
          </Box>
        )}
      </FormField>
    </>
  );
};

export default RuleForm;
