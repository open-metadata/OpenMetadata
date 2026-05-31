/*
 *  Copyright 2025 Collate.
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
  Button,
  Card,
  Input,
  Select,
  SelectItemType,
  Toggle,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@untitledui/icons';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useListData } from 'react-stately';
import { useWorkflowModeContext } from '../../../../../contexts/WorkflowModeContext';
import { CONDITION_BUILDER_WORKFLOW_TRIGGER_FIELDS } from './ConditionBuilder.constants';
import type {
  ConditionBuilderOption,
  ConditionBuilderProps,
  ConditionFieldDefinition,
  ConditionRow,
  ConditionType,
} from './ConditionBuilder.interface';
import {
  buildConditionBuilderPayload,
  generateRowId,
  parseConditionBuilderPayload,
} from './conditionBuilderTransformer';

interface ConditionBuilderValueControlProps {
  readonly dataTestId: string;
  readonly disabled?: boolean;
  readonly fieldDef: ConditionFieldDefinition | undefined;
  readonly placeholder: string;
  readonly t: (key: string) => string;
  readonly values: string[];
  onChange: (values: string[]) => void;
}

function ConditionBuilderValueControl(
  props: Readonly<ConditionBuilderValueControlProps>
) {
  const { fieldDef, values, onChange, disabled, placeholder, dataTestId, t } =
    props;
  const [asyncOptions, setAsyncOptions] = useState<ConditionBuilderOption[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const fetchRef = useRef<number>(0);

  const isBoolean = fieldDef?.valueType === 'boolean';
  const isText = !fieldDef || fieldDef.valueType === 'text';
  const hasFetchOptions = Boolean(fieldDef?.fetchOptions);
  const staticOptions = useMemo(() => {
    if (!fieldDef) {
      return [];
    }

    return fieldDef.values.map((opt) => ({
      value: opt.value,
      label: t(opt.label),
    }));
  }, [fieldDef, t]);

  const loadAsyncOptions = useCallback(
    async (search: string) => {
      if (!fieldDef?.fetchOptions) {
        return;
      }
      const id = ++fetchRef.current;
      setLoading(true);
      try {
        const options = await fieldDef.fetchOptions(search || '');

        if (id === fetchRef.current) {
          setAsyncOptions(options);
        }
      } finally {
        if (id === fetchRef.current) {
          setLoading(false);
        }
      }
    },
    [fieldDef]
  );

  useEffect(() => {
    if (hasFetchOptions && asyncOptions.length === 0) {
      loadAsyncOptions('');
    }
  }, [hasFetchOptions, asyncOptions.length, loadAsyncOptions]);

  // useListData for the multi-select controls
  const selectedItems = useListData<SelectItemType>({ initialItems: [] });
  const prevValuesRef = useRef<string[]>([]);
  useEffect(() => {
    const prev = prevValuesRef.current;
    const same =
      prev.length === values.length && values.every((v, i) => v === prev[i]);
    if (!same) {
      // Replace entire list (clear then set) to avoid duplicates when parent state catches up after selection
      const currentIds = selectedItems.items.map((item) => item.id);
      currentIds.forEach((id) => selectedItems.remove(id));
      values.forEach((v) => {
        const label = hasFetchOptions
          ? asyncOptions.find((o) => o.value === v)?.label ?? v
          : staticOptions.find((o) => o.value === v)?.label ?? v;
        selectedItems.append({ id: v, label });
      });
      prevValuesRef.current = values;
    }
  }, [values, asyncOptions, staticOptions]);

  if (isBoolean) {
    const isChecked = values[0] === 'true';

    return (
      <div
        className="tw:flex tw:items-center tw:min-h-10"
        data-testid={dataTestId}>
        <Toggle
          data-testid={`${dataTestId}-switch`}
          isDisabled={disabled}
          isSelected={isChecked}
          onChange={(checked) => onChange([checked ? 'true' : 'false'])}
        />
      </div>
    );
  }

  if (isText) {
    const textValue = values.join(', ');

    return (
      <Input
        data-testid={dataTestId}
        isDisabled={disabled}
        placeholder={placeholder}
        value={textValue}
        onChange={(value) => {
          const next = value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(next);
        }}
      />
    );
  }

  const options = hasFetchOptions ? asyncOptions : staticOptions;
  const items: SelectItemType[] = (
    hasFetchOptions ? (loading ? [] : asyncOptions) : staticOptions
  ).map((o) => ({ id: o.value, label: o.label }));

  return (
    <Autocomplete
      className="tw:w-full"
      data-testid={dataTestId}
      isDisabled={disabled ?? false}
      items={items}
      maxVisibleItems={1}
      placeholder={placeholder}
      selectedItems={selectedItems}
      onItemCleared={(key) => {
        selectedItems.remove(key);
        onChange(
          selectedItems.items.filter((i) => i.id !== key).map((i) => i.id)
        );
      }}
      onItemInserted={(key) => {
        const opt = options.find((o) => o.value === String(key));
        selectedItems.append({
          id: String(key),
          label: opt?.label ?? String(key),
        });
        onChange([...selectedItems.items.map((i) => i.id), String(key)]);
      }}>
      {(item) => (
        <Autocomplete.Item
          id={item.id}
          isDisabled={item.isDisabled}
          key={item.id}
          label={item.label}
        />
      )}
    </Autocomplete>
  );
}

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  showCondition = false,
  value,
  onChange,
  fieldDefinitions = CONDITION_BUILDER_WORKFLOW_TRIGGER_FIELDS,
  disabled = false,
  'data-testid': dataTestId = 'condition-builder',
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const isDisabled = disabled || isFormDisabled;

  const { rows: initialRowsFromPayload, condition: initialCondition } = useMemo(
    () => parseConditionBuilderPayload(value),
    [value]
  );

  const initialRows = useMemo(() => {
    const r = initialRowsFromPayload;

    return r.length > 0 ? r : [{ id: generateRowId(), field: '', values: [] }];
  }, [initialRowsFromPayload]);

  const [condition, setCondition] = useState<ConditionType>(initialCondition);
  const [rows, setRows] = useState<ConditionRow[]>(initialRows);
  const lastEmittedRef = useRef<string | null>(null);

  useEffect(() => {
    // Compare using same serialization as emit: payload is always JSON string when present
    const valueSerialized =
      value !== null && value !== undefined
        ? JSON.stringify(value)
        : (null as string | null);
    const refSet = lastEmittedRef.current;
    if (refSet && valueSerialized === refSet) {
      lastEmittedRef.current = null;

      return;
    }
    // Clear stale ref when parent passes null so future updates are not skipped
    if (value === null || value === undefined) {
      lastEmittedRef.current = null;
    }
    const parsed = parseConditionBuilderPayload(value);

    setCondition(parsed.condition);

    const nextRows = parsed.rows;

    setRows(
      nextRows.length > 0
        ? nextRows
        : [{ id: generateRowId(), field: '', values: [] }]
    );
  }, [value]);

  const emitChange = useCallback(
    (newRows: ConditionRow[], newCondition: ConditionType) => {
      const payload = buildConditionBuilderPayload(newCondition, newRows);
      lastEmittedRef.current = JSON.stringify(payload);
      onChange(payload);
    },
    [onChange]
  );

  const fieldOptions = useMemo(
    () =>
      fieldDefinitions.map((def) => ({
        value: def.value,
        label: t(def.label),
      })),
    [fieldDefinitions, t]
  );

  const getFieldDef = useCallback(
    (field: string): ConditionFieldDefinition | undefined =>
      fieldDefinitions.find((d) => d.value === field),
    [fieldDefinitions]
  );

  const handleAddRow = useCallback(() => {
    const newRow: ConditionRow = {
      id: generateRowId(),
      field: '',
      values: [],
    };
    const newRows = [...rows, newRow];
    setRows(newRows);
    emitChange(newRows, condition);
  }, [rows, condition, emitChange]);

  const handleRemoveRow = useCallback(
    (id: string) => {
      const newRows = rows.filter((r) => r.id !== id);
      setRows(newRows);
      emitChange(newRows, condition);
    },
    [rows, condition, emitChange]
  );

  const handleRowFieldChange = useCallback(
    (rowId: string, field: string) => {
      const newRows = rows.map((r) =>
        r.id === rowId ? { ...r, field, values: [] } : r
      );
      setRows(newRows);
      emitChange(newRows, condition);
    },
    [rows, condition, emitChange]
  );

  const handleRowValuesChange = useCallback(
    (rowId: string, newValues: string[]) => {
      const newRows = rows.map((r) =>
        r.id === rowId ? { ...r, values: newValues } : r
      );
      setRows(newRows);
      emitChange(newRows, condition);
    },
    [rows, condition, emitChange]
  );

  const fieldSelectOptions = useMemo(
    () => [
      { label: t('label.condition-builder-select-field'), value: '' },
      ...fieldOptions,
    ],
    [fieldOptions, t]
  );

  return (
    <Card
      className="tw:flex tw:flex-col tw:gap-4 tw:p-4"
      data-testid={dataTestId}>
      {showCondition && (
        <div
          className="tw:flex tw:justify-center tw:mb-1"
          data-testid={`${dataTestId}-condition-radio`}>
          <div className="tw:flex tw:border tw:border-border-secondary tw:rounded-lg tw:overflow-hidden">
            <Button
              color={condition === 'AND' ? 'primary' : 'tertiary'}
              data-testid={`${dataTestId}-condition-and`}
              isDisabled={isDisabled}
              size="sm"
              onPress={() => {
                if (condition !== 'AND') {
                  setCondition('AND');
                  emitChange(rows, 'AND');
                }
              }}>
              {t('label.condition-and')}
            </Button>
            <Button
              color={condition === 'OR' ? 'primary' : 'tertiary'}
              data-testid={`${dataTestId}-condition-or`}
              isDisabled={isDisabled}
              size="sm"
              onPress={() => {
                if (condition !== 'OR') {
                  setCondition('OR');
                  emitChange(rows, 'OR');
                }
              }}>
              {t('label.condition-or')}
            </Button>
          </div>
        </div>
      )}

      <div className="tw:flex tw:flex-col tw:gap-4">
        {rows.map((row, index) => (
          <div
            className="tw:flex tw:items-center tw:gap-4 tw:flex-nowrap"
            data-testid="advanced-search-field-select"
            key={row.id}>
            <div className="tw:flex-1 tw:min-w-0">
              <Select
                data-testid={`${dataTestId}-row-${index}-field`}
                isDisabled={isDisabled}
                value={row.field}
                onChange={(key) =>
                  handleRowFieldChange(row.id, String(key ?? ''))
                }>
                {fieldSelectOptions.map((opt) => (
                  <Select.Item
                    id={opt.value}
                    key={opt.value}
                    label={opt.label}
                  />
                ))}
              </Select>
            </div>

            <div className="tw:flex-1 tw:min-w-0 tw:overflow-hidden">
              {row.field ? (
                <ConditionBuilderValueControl
                  dataTestId={`${dataTestId}-row-${index}-value`}
                  disabled={isDisabled}
                  fieldDef={getFieldDef(row.field)}
                  placeholder={t('label.condition-builder-select-value')}
                  t={t}
                  values={row.values}
                  onChange={(v) => handleRowValuesChange(row.id, v)}
                />
              ) : null}
            </div>

            <div className="tw:flex tw:items-center tw:shrink-0 tw:gap-1">
              <Button
                color="tertiary"
                data-testid={`${dataTestId}-add-row`}
                iconLeading={Plus}
                isDisabled={isDisabled}
                size="sm"
                onPress={handleAddRow}
              />
              {rows.length > 1 && (
                <Button
                  color="tertiary-destructive"
                  data-testid={`${dataTestId}-remove-row-${index}`}
                  iconLeading={Trash01}
                  isDisabled={isDisabled}
                  size="sm"
                  onPress={() => handleRemoveRow(row.id)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
