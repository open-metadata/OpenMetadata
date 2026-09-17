/*
 *  Copyright 2026 Collate.
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
  Autocomplete,
  Box,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  getField,
  HintText,
  HookForm,
  Select,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce, startCase, uniq } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Key } from 'react-aria-components';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Effect,
  Operation,
  Rule,
} from '../../../../../../generated/api/policies/createPolicy';
import { ResourceDescriptor } from '../../../../../../generated/entity/policies/accessControl/resourceDescriptor';
import { Function } from '../../../../../../generated/type/function';
import {
  getPolicyFunctions,
  getPolicyResources,
  validateRuleCondition,
} from '../../../../../../rest/rolesAPIV1';
import { ALL_TYPE_RESOURCE_LIST } from '../../../../../../utils/PermissionsUtils';
import { getErrorText } from '../../../../../../utils/StringUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EFFECT_ITEMS } from './AccessControl.constants';
import { buildConditionOptions } from './AccessControl.utils';

export interface AccessControlRuleFormProps {
  form: UseFormReturn<Rule>;
  takenNames?: string[];
}

const AccessControlRuleForm: FC<AccessControlRuleFormProps> = ({
  form,
  takenNames,
}) => {
  const { t } = useTranslation();

  const nameField: FieldProp = {
    name: 'name',
    label: t('label.rule-name'),
    type: FieldTypes.TEXT,
    required: true,
    placeholder: t('label.rule-name'),
    props: { 'data-testid': 'rule-name' },
    rules: {
      required: t('label.field-required', { field: t('label.rule-name') }),
      validate: (name: string) =>
        !takenNames?.includes(name.trim()) ||
        t('message.entity-with-name-already-exists', {
          entity: t('label.rule-name'),
        }),
    },
  };

  const [policyResources, setPolicyResources] = useState<ResourceDescriptor[]>(
    []
  );
  const [policyFunctions, setPolicyFunctions] = useState<Function[]>([]);
  const [conditionOptions, setConditionOptions] = useState<SelectItemType[]>(
    []
  );
  const [validationError, setValidationError] = useState('');
  const [isValidatingCondition, setIsValidating] = useState(false);
  const [isValidCondition, setIsValidCondition] = useState(false);
  const currentConditionRef = useRef<string>('');

  const selectedResources = useWatch({
    control: form.control,
    name: 'resources',
    defaultValue: [],
  });
  const selectedOperations = useWatch({
    control: form.control,
    name: 'operations',
    defaultValue: [],
  });

  const resourceItems = useMemo<SelectItemType[]>(() => {
    const resources = policyResources.filter(
      (r) => !ALL_TYPE_RESOURCE_LIST.includes(r.name || '')
    );
    const allItem: SelectItemType = { id: 'All', label: t('label.all') };
    const childItems: SelectItemType[] = resources.map((r) => ({
      id: r.name ?? '',
      label: startCase(r.name),
    }));

    return [allItem, ...childItems];
  }, [policyResources, t]);

  const operationItems = useMemo<SelectItemType[]>(() => {
    const filtered = policyResources.filter((r) => {
      if (ALL_TYPE_RESOURCE_LIST.includes(r.name || '')) {
        return ALL_TYPE_RESOURCE_LIST.some((v) =>
          selectedResources.includes(v)
        );
      }

      return selectedResources.includes(r.name || '');
    });
    const ops = filtered
      .reduce(
        (prev: Operation[], curr: ResourceDescriptor) =>
          uniq([...prev, ...(curr.operations || [])]),
        []
      )
      .filter((op) => op !== Operation.All);

    const allItem: SelectItemType = {
      id: Operation.All,
      label: t('label.all'),
    };
    const childItems: SelectItemType[] = ops.map((op) => ({
      id: op,
      label: op,
    }));

    return [allItem, ...childItems];
  }, [selectedResources, policyResources, t]);

  const selectedResourceItems = useMemo<SelectItemType[]>(
    () =>
      selectedResources.map((r) => ({
        id: r,
        label: r === 'All' ? t('label.all') : startCase(r),
      })),
    [selectedResources, t]
  );

  const selectedOperationItems = useMemo<SelectItemType[]>(
    () => selectedOperations.map((op) => ({ id: op, label: op })),
    [selectedOperations]
  );

  const handleConditionSearch = (value: string) => {
    const allOptions = buildConditionOptions(policyFunctions);
    setConditionOptions(
      value
        ? allOptions.filter((opt) => opt.label?.includes(value))
        : allOptions
    );
  };

  const debouncedConditionValidation = useMemo(
    () =>
      debounce(async (condition: string) => {
        const defaultErrorText = t('message.field-text-is-invalid', {
          fieldText: t('label.condition'),
        });

        if (condition !== currentConditionRef.current) {
          return;
        }

        if (condition) {
          setIsValidating(true);
          try {
            const response = await validateRuleCondition(condition);
            if (condition !== currentConditionRef.current) {
              return;
            }
            const isOk = [200, 204].includes(response.status);
            if (isOk) {
              setValidationError('');
              setIsValidCondition(true);
            } else {
              setValidationError(defaultErrorText);
            }
          } catch (error) {
            if (condition !== currentConditionRef.current) {
              return;
            }
            setValidationError(
              getErrorText(error as AxiosError, defaultErrorText)
            );
            setIsValidCondition(false);
          } finally {
            if (condition === currentConditionRef.current) {
              setIsValidating(false);
            }
          }
        } else {
          setValidationError('');
          setIsValidCondition(false);
        }
      }, 300),
    [t]
  );

  useEffect(() => {
    return () => debouncedConditionValidation.cancel();
  }, [debouncedConditionValidation]);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const data = await getPolicyResources();
        setPolicyResources(data.data || []);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    };

    const fetchFunctions = async () => {
      try {
        const data = await getPolicyFunctions();
        setPolicyFunctions(data.data || []);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    };

    fetchResources();
    fetchFunctions();
  }, []);

  useEffect(() => {
    setConditionOptions(buildConditionOptions(policyFunctions));
  }, [policyFunctions]);

  const handleResourceInserted = useCallback(
    (key: Key, currentValue: string[], onChange: (v: string[]) => void) => {
      const val = String(key);
      const newResources =
        val === 'All'
          ? ['All']
          : uniq([...currentValue.filter((r) => r !== 'All'), val]);
      onChange(newResources);
      form.setValue('operations', [], { shouldValidate: false });
    },
    [form]
  );

  const handleResourceCleared = useCallback(
    (key: Key, currentValue: string[], onChange: (v: string[]) => void) => {
      const val = String(key);
      const newResources =
        val === 'All'
          ? []
          : currentValue.filter((r) => r !== val && r !== 'All');
      onChange(newResources);
      form.setValue('operations', [], { shouldValidate: false });
    },
    [form]
  );

  const handleOperationInserted = useCallback(
    (
      key: Key,
      currentValue: Operation[],
      onChange: (v: Operation[]) => void
    ) => {
      const val = String(key) as Operation;
      const newOps =
        val === Operation.All
          ? [Operation.All]
          : uniq([...currentValue.filter((op) => op !== Operation.All), val]);
      onChange(newOps);
    },
    []
  );

  const handleOperationCleared = useCallback(
    (
      key: Key,
      currentValue: Operation[],
      onChange: (v: Operation[]) => void
    ) => {
      const val = String(key) as Operation;
      const newOps =
        val === Operation.All
          ? []
          : currentValue.filter((op) => op !== val && op !== Operation.All);
      onChange(newOps);
    },
    []
  );

  return (
    <HookForm form={form}>
      <Box direction="col" gap={4}>
        {/* Rule name */}
        {getField(nameField)}

        {/* Description */}
        <Box direction="col" gap={1}>
          <Typography
            className="tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.description')}
          </Typography>
          <RichTextEditor
            className="new-form-style"
            data-testid="rule-description"
            initialValue={form.getValues('description') ?? ''}
            onTextChange={(value) => form.setValue('description', value)}
          />
        </Box>

        {/* Resources */}
        <FormField
          control={form.control}
          name="resources"
          rules={{
            validate: (v: string[] | undefined) =>
              (v?.length ?? 0) > 0 ||
              t('label.field-required-plural', {
                field: t('label.resource-plural'),
              }),
          }}>
          {({ field, fieldState }) => (
            <Box direction="col" gap={1}>
              <FormItemLabel required label={t('label.resource-plural')} />
              <Autocomplete
                data-testid="resources"
                items={resourceItems}
                placeholder={t('label.select-field', {
                  field: t('label.resource-plural'),
                })}
                selectedItems={selectedResourceItems}
                onItemCleared={(key) =>
                  handleResourceCleared(
                    key,
                    (field.value as string[]) ?? [],
                    field.onChange
                  )
                }
                onItemInserted={(key) =>
                  handleResourceInserted(
                    key,
                    (field.value as string[]) ?? [],
                    field.onChange
                  )
                }>
                {(item) => (
                  <Autocomplete.Item id={item.id} key={item.id}>
                    {item.label}
                  </Autocomplete.Item>
                )}
              </Autocomplete>
              {fieldState.error?.message && (
                <HintText isInvalid>{fieldState.error.message}</HintText>
              )}
            </Box>
          )}
        </FormField>

        {/* Operations */}
        <FormField
          control={form.control}
          name="operations"
          rules={{
            validate: (v: Operation[] | undefined) =>
              (v?.length ?? 0) > 0 ||
              t('label.field-required-plural', {
                field: t('label.operation-plural'),
              }),
          }}>
          {({ field, fieldState }) => (
            <Box direction="col" gap={1}>
              <FormItemLabel required label={t('label.operation-plural')} />
              <Autocomplete
                data-testid="operations"
                items={operationItems}
                placeholder={t('label.select-field', {
                  field: t('label.operation-plural'),
                })}
                selectedItems={selectedOperationItems}
                onItemCleared={(key) =>
                  handleOperationCleared(
                    key,
                    (field.value as Operation[]) ?? [],
                    field.onChange
                  )
                }
                onItemInserted={(key) =>
                  handleOperationInserted(
                    key,
                    (field.value as Operation[]) ?? [],
                    field.onChange
                  )
                }>
                {(item) => (
                  <Autocomplete.Item id={item.id} key={item.id}>
                    {item.label}
                  </Autocomplete.Item>
                )}
              </Autocomplete>
              {fieldState.error?.message && (
                <HintText isInvalid>{fieldState.error.message}</HintText>
              )}
            </Box>
          )}
        </FormField>

        {/* Effect */}
        <FormField control={form.control} name="effect">
          {({ field, fieldState }) => (
            <Box direction="col" gap={1}>
              <FormItemLabel required label={t('label.effect')} />
              <Select
                data-testid="effect"
                items={EFFECT_ITEMS}
                placeholder={t('label.select-field', {
                  field: t('label.rule-effect'),
                })}
                selectedKey={field.value ?? null}
                onSelectionChange={(key) =>
                  key && field.onChange(key as Effect)
                }>
                {(item) => (
                  <Select.Item id={item.id} key={item.id}>
                    {item.label}
                  </Select.Item>
                )}
              </Select>
              {fieldState.error?.message && (
                <HintText isInvalid>{fieldState.error.message}</HintText>
              )}
            </Box>
          )}
        </FormField>

        {/* Condition */}
        <Box direction="col" gap={1}>
          <Typography
            className="tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.condition')}
          </Typography>
          <Select.ComboBox
            allowsEmptyCollection
            data-testid="condition"
            inputValue={form.watch('condition') ?? ''}
            items={conditionOptions}
            placeholder={t('label.condition')}
            onInputChange={(value) => {
              form.setValue('condition', value);
              if (!value) {
                setValidationError('');
                setIsValidCondition(false);
              }
              handleConditionSearch(value);
              currentConditionRef.current = value;
              debouncedConditionValidation(value);
            }}
            onSelectionChange={(key) => {
              if (key) {
                const val = String(key);
                form.setValue('condition', val);
                currentConditionRef.current = val;
                debouncedConditionValidation(val);
              }
            }}>
            {(item) => (
              <Select.Item id={item.id} key={item.id}>
                {item.label}
              </Select.Item>
            )}
          </Select.ComboBox>
          {validationError && (
            <Typography
              className="tw:text-error-primary"
              data-testid="condition-error"
              size="text-xs">
              {`❌ ${t('label.invalid-condition')}: ${validationError}`}
            </Typography>
          )}
          {isValidatingCondition && (
            <Typography className="tw:text-secondary" size="text-xs">
              {t('label.validating-condition')}
            </Typography>
          )}
          {isValidCondition && !isValidatingCondition && !validationError && (
            <Typography
              className="tw:text-success-primary"
              data-testid="condition-success"
              size="text-xs">
              {`✅ ${t('label.valid-condition')}`}
            </Typography>
          )}
        </Box>
      </Box>
    </HookForm>
  );
};

export default AccessControlRuleForm;
