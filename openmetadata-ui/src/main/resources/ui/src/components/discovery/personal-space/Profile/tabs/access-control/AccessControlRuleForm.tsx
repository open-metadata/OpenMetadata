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
    Input,
    Select,
    SelectItemType,
    Typography
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { capitalize, startCase, uniq, uniqBy } from 'lodash';
import React, {
    FC,
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
    Effect,
    Operation,
    Rule
} from '../../../../../../generated/api/policies/createPolicy';
import { ResourceDescriptor } from '../../../../../../generated/entity/policies/accessControl/resourceDescriptor';
import { Function } from '../../../../../../generated/type/function';
import {
    getPolicyFunctions,
    getPolicyResources,
    validateRuleCondition
} from '../../../../../../rest/rolesAPIV1';
import { ALL_TYPE_RESOURCE_LIST } from '../../../../../../utils/PermissionsUtils';
import { getErrorText } from '../../../../../../utils/StringUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';

export interface AccessControlRuleFormProps {
  ruleData: Rule;
  setRuleData: (value: React.SetStateAction<Rule>) => void;
  description?: string;
}

const EFFECT_ITEMS: SelectItemType[] = [
  { id: Effect.Allow, label: capitalize(Effect.Allow) },
  { id: Effect.Deny, label: capitalize(Effect.Deny) },
];

const AccessControlRuleForm: FC<AccessControlRuleFormProps> = ({
  ruleData,
  setRuleData,
}) => {
  const { t } = useTranslation();
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
    const selectedResources = policyResources.filter((r) => {
      if (ALL_TYPE_RESOURCE_LIST.includes(r.name || '')) {
        return ALL_TYPE_RESOURCE_LIST.some((v) =>
          ruleData.resources?.includes(v)
        );
      }

      return ruleData.resources?.includes(r.name || '');
    });
    const ops = selectedResources
      .reduce(
        (prev: Operation[], curr: ResourceDescriptor) =>
          uniq([...prev, ...(curr.operations || [])]),
        []
      )
      .filter((op) => op !== Operation.All);

    const allItem: SelectItemType = { id: Operation.All, label: t('label.all') };
    const childItems: SelectItemType[] = ops.map((op) => ({
      id: op,
      label: op,
    }));

    return [allItem, ...childItems];
  }, [ruleData.resources, policyResources, t]);

  const selectedResourceItems = useMemo<SelectItemType[]>(
    () =>
      (ruleData.resources ?? []).map((r) => ({
        id: r,
        label: r === 'All' ? t('label.all') : startCase(r),
      })),
    [ruleData.resources, t]
  );

  const selectedOperationItems = useMemo<SelectItemType[]>(
    () =>
      (ruleData.operations ?? []).map((op) => ({
        id: op,
        label: op,
      })),
    [ruleData.operations]
  );

  const handleResourceInserted = useCallback(
    (key: Key) => {
      const val = String(key);
      // Selecting "All" fills in all non-All resources
      if (val === 'All') {
        const allValues = policyResources
          .filter((r) => !ALL_TYPE_RESOURCE_LIST.includes(r.name || ''))
          .map((r) => r.name ?? '');
        setRuleData((prev: Rule) => ({
          ...prev,
          resources: uniq([...(prev.resources ?? []), 'All', ...allValues]),
          operations: [],
        }));
      } else {
        setRuleData((prev: Rule) => ({
          ...prev,
          resources: uniq([...(prev.resources ?? []), val]),
          operations: [],
        }));
      }
    },
    [policyResources, setRuleData]
  );

  const handleResourceCleared = useCallback(
    (key: Key) => {
      const val = String(key);
      setRuleData((prev: Rule) => ({
        ...prev,
        resources:
          val === 'All'
            ? []
            : (prev.resources ?? []).filter((r) => r !== val && r !== 'All'),
        operations: [],
      }));
    },
    [setRuleData]
  );

  const handleOperationInserted = useCallback(
    (key: Key) => {
      const val = String(key) as Operation;
      if (val === Operation.All) {
        const allOps = operationItems
          .filter((op) => op.id !== Operation.All)
          .map((op) => op.id as Operation);
        setRuleData((prev: Rule) => ({
          ...prev,
          operations: uniq([
            ...(prev.operations ?? []),
            Operation.All,
            ...allOps,
          ]),
        }));
      } else {
        setRuleData((prev: Rule) => ({
          ...prev,
          operations: uniq([...(prev.operations ?? []), val]),
        }));
      }
    },
    [operationItems, setRuleData]
  );

  const handleOperationCleared = useCallback(
    (key: Key) => {
      const val = String(key) as Operation;
      setRuleData((prev: Rule) => ({
        ...prev,
        operations:
          val === Operation.All
            ? []
            : (prev.operations ?? []).filter(
                (op) => op !== val && op !== Operation.All
              ),
      }));
    },
    [setRuleData]
  );

  const buildConditionOptions = (fns: Function[]): SelectItemType[] =>
    uniqBy(
      fns.flatMap((fn) =>
        (fn.examples ?? []).map((ex: string) => ({ id: ex, label: ex }))
      ),
      'id'
    );

  const handleConditionSearch = (value: string) => {
    if (value) {
      setConditionOptions((prev) =>
        prev.filter((opt) => opt.label?.includes(value))
      );
    } else {
      setConditionOptions(buildConditionOptions(policyFunctions));
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
        const isOk = [200, 204].includes(response.status);
        if (isOk) {
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
    } else {
      setValidationError('');
      setIsValidCondition(false);
    }
  };

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

  return (
    <Box className="tw:flex tw:flex-col tw:gap-4">
      {/* Rule name */}
      <Box className="tw:flex tw:flex-col tw:gap-1">
        <Typography
          className="tw:text-sm tw:font-medium tw:text-secondary"
          size="text-sm"
          weight="medium">
          {`${t('label.rule-name')} *`}
        </Typography>
        <Input
          data-testid="rule-name"
          placeholder={t('label.rule-name')}
          value={ruleData.name ?? ''}
          onChange={(value) =>
            setRuleData((prev: Rule) => ({ ...prev, name: value }))
          }
        />
      </Box>

      {/* Description */}
      <Box className="tw:flex tw:flex-col tw:gap-1">
        <Typography
          className="tw:text-sm tw:font-medium tw:text-secondary"
          size="text-sm"
          weight="medium">
          {t('label.description')}
        </Typography>
        <RichTextEditor
          className="tw:[&_.ProseMirror]:min-h-[4rem] tw:[&_.ProseMirror]:max-h-[4rem] tw:[&_.ProseMirror]:overflow-y-auto"
          data-testid="rule-description"
          initialValue={ruleData.description ?? ''}
          onTextChange={(value) =>
            setRuleData((prev: Rule) => ({ ...prev, description: value }))
          }
        />
      </Box>

      {/* Resources */}
      <Box className="tw:flex tw:flex-col tw:gap-1">
        <Typography
          className="tw:text-sm tw:font-medium tw:text-secondary"
          size="text-sm"
          weight="medium">
          {`${t('label.resource-plural')} *`}
        </Typography>
        <Autocomplete
          data-testid="resources"
          items={resourceItems}
          placeholder={t('label.select-field', {
            field: t('label.resource-plural'),
          })}
          selectedItems={selectedResourceItems}
          onItemCleared={handleResourceCleared}
          onItemInserted={handleResourceInserted}>
          {(item) => (
            <Autocomplete.Item id={item.id} key={item.id}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </Box>

      {/* Operations */}
      <Box className="tw:flex tw:flex-col tw:gap-1">
        <Typography
          className="tw:text-sm tw:font-medium tw:text-secondary"
          size="text-sm"
          weight="medium">
          {`${t('label.operation-plural')} *`}
        </Typography>
        <Autocomplete
          data-testid="operations"
          items={operationItems}
          placeholder={t('label.select-field', {
            field: t('label.operation-plural'),
          })}
          selectedItems={selectedOperationItems}
          onItemCleared={handleOperationCleared}
          onItemInserted={handleOperationInserted}>
          {(item) => (
            <Autocomplete.Item id={item.id} key={item.id}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </Box>

      {/* Effect */}
      <Box className="tw:flex tw:flex-col tw:gap-1">
        <Typography
          className="tw:text-sm tw:font-medium tw:text-secondary"
          size="text-sm"
          weight="medium">
          {`${t('label.effect')} *`}
        </Typography>
        <Select
          data-testid="effect"
          items={EFFECT_ITEMS}
          placeholder={t('label.select-field', {
            field: t('label.rule-effect'),
          })}
          selectedKey={ruleData.effect ?? null}
          onSelectionChange={(key) =>
            key &&
            setRuleData((prev: Rule) => ({
              ...prev,
              effect: key as Effect,
            }))
          }>
          {(item) => (
            <Select.Item id={item.id} key={item.id}>
              {item.label}
            </Select.Item>
          )}
        </Select>
      </Box>

      {/* Condition */}
      <Box className="tw:flex tw:flex-col tw:gap-1">
        <Typography
          className="tw:text-sm tw:font-medium tw:text-secondary"
          size="text-sm"
          weight="medium">
          {t('label.condition')}
        </Typography>
        <Select.ComboBox
          allowsEmptyCollection
          data-testid="condition"
          items={conditionOptions}
          placeholder={t('label.condition')}
          onInputChange={(value) => {
            setRuleData((prev: Rule) => ({ ...prev, condition: value }));
            if (!value) {
              setValidationError('');
              setIsValidCondition(false);
            }
            handleConditionSearch(value);
            handleConditionValidation(value);
          }}
          onSelectionChange={(key) => {
            if (key) {
              const val = String(key);
              setRuleData((prev: Rule) => ({ ...prev, condition: val }));
              handleConditionValidation(val);
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
            className="tw:text-xs tw:text-red-500"
            data-testid="condition-error">
            {`❌ ${t('label.invalid-condition')}: ${validationError}`}
          </Typography>
        )}
        {isValidatingCondition && (
          <Typography className="tw:text-xs tw:text-secondary">
            {t('label.validating-condition')}
          </Typography>
        )}
        {isValidCondition && !isValidatingCondition && !validationError && (
          <Typography
            className="tw:text-xs tw:text-green-600"
            data-testid="condition-success">
            {`✅ ${t('label.valid-condition')}`}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default AccessControlRuleForm;
