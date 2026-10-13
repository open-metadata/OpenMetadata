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
  MultiSelect,
  type SelectItemType,
} from '@openmetadata/ui-core-components';
import { FieldProps, RJSFSchema } from '@rjsf/utils';
import { isEqual, startCase } from 'lodash';
import { Key, useCallback, useEffect, useMemo } from 'react';
import { useListData } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { getFormDisplayLabel } from '../formBuilderV1LabelUtils';

export const ALL_VALUE = 'all';

/**
 * Core-ui replacement for the legacy antd `TreeSelectWidget` used by
 * `uiFieldType: "treeSelect"` arrays: a synthetic "All" option plus every enum
 * value. "All" and specific values are mutually exclusive, matching the legacy
 * tree's SHOW_PARENT behaviour.
 */
export const getNextEnumSelection = (
  current: string[],
  inserted: string
): string[] =>
  inserted === ALL_VALUE
    ? [ALL_VALUE]
    : [...current.filter((value) => value !== ALL_VALUE), inserted];

const CoreEnumMultiSelectField = ({
  schema,
  formData,
  idSchema,
  name,
  disabled,
  readonly,
  required,
  rawErrors,
  onChange,
}: FieldProps) => {
  const { t } = useTranslation();

  const enumValues = useMemo(
    () =>
      (((schema.items as RJSFSchema | undefined)?.enum ?? []) as string[])
        .map(String)
        .filter((value) => value !== ALL_VALUE),
    [schema.items]
  );

  const items = useMemo<SelectItemType[]>(
    () => [
      { id: ALL_VALUE, label: t('label.all') },
      ...enumValues.map((value) => ({ id: value, label: startCase(value) })),
    ],
    [enumValues, t]
  );

  // With `expandAllValue` the backend enum has no "all", so selecting it
  // persists every enum value; show those back as the single "All" chip.
  const expandAll = Boolean(schema.expandAllValue);
  const toDisplayIds = useCallback(
    (value: unknown): string[] => {
      const ids = ((value ?? []) as unknown[]).map(String);
      const isEverything =
        expandAll &&
        enumValues.length > 0 &&
        enumValues.every((option) => ids.includes(option));

      return isEverything ? [ALL_VALUE] : ids;
    },
    [enumValues, expandAll]
  );
  const toItem = useCallback(
    (id: string): SelectItemType =>
      items.find((item) => item.id === id) ?? { id, label: startCase(id) },
    [items]
  );

  const selected = useListData<SelectItemType>({
    initialItems: toDisplayIds(formData).map(toItem),
  });

  // Keep the chips controlled: when the value changes from outside (a form
  // reset, a oneOf branch switch), replace the list to match it. Re-runs after
  // the user's own edits are no-ops because the ids already match.
  useEffect(() => {
    const incoming = toDisplayIds(formData);
    const current = selected.items.map((item) => item.id);
    if (isEqual(incoming, current)) {
      return;
    }
    if (current.length) {
      selected.remove(...current);
    }
    if (incoming.length) {
      selected.append(...incoming.map(toItem));
    }
  }, [formData, selected, toDisplayIds, toItem]);

  const emit = (next: string[]) =>
    onChange(expandAll && next.includes(ALL_VALUE) ? enumValues : next);

  const currentIds = () => selected.items.map((item) => item.id);

  const handleInserted = (key: Key) => {
    const current = currentIds();
    const next = getNextEnumSelection(current, String(key));
    const dropped = current.filter((id) => !next.includes(id));
    if (dropped.length) {
      selected.remove(...dropped);
    }
    emit(next);
  };

  const handleCleared = (key: Key) =>
    emit(currentIds().filter((id) => id !== String(key)));

  return (
    <MultiSelect
      data-testid={`enum-multi-select-${idSchema.$id}`}
      hint={rawErrors?.[0]}
      isDisabled={disabled || readonly}
      isInvalid={Boolean(rawErrors?.length)}
      isRequired={required}
      items={items}
      label={schema.title ?? getFormDisplayLabel(name)}
      placeholder={t('label.select-field', { field: schema.title ?? name })}
      selectedItems={selected}
      onItemCleared={handleCleared}
      onItemInserted={handleInserted}>
      {(item) => (
        <MultiSelect.Item id={item.id} key={item.id} textValue={item.label}>
          {item.label}
        </MultiSelect.Item>
      )}
    </MultiSelect>
  );
};

export default CoreEnumMultiSelectField;
