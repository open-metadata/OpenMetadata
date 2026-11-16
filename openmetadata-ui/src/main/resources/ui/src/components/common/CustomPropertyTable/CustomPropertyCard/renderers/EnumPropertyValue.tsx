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
  Select,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { isArray, isNil } from 'lodash';
import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Config } from '../../../../../generated/type/customProperty';
import { useReportDirty } from '../../../../../hooks/common/useReportDirty';
import { CollapsibleChipList } from '../CollapsibleChipList';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.interface';
import { PropertyValueChip } from '../PropertyValueChip';

const toValueList = (value: unknown): string[] =>
  (isArray(value) ? value : [value]).filter(
    (item): item is string => typeof item === 'string' && item !== ''
  );

const EnumPropertyView = ({ value }: PropertyViewProps) => (
  <CollapsibleChipList
    data-testid="enum-value"
    getKey={(option) => option}
    items={toValueList(value)}
    renderItem={(option) => (
      <PropertyValueChip data-testid={`enum-option-${option}`}>
        {option}
      </PropertyValueChip>
    )}
  />
);

const EnumPropertyEdit = ({
  property,
  value,
  isSaving,
  onSave,
  formId,
  onDirtyChange,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const config = property.customPropertyConfig?.config as Config | undefined;
  const isMultiSelect = Boolean(config?.multiSelect);
  const options = useMemo<SelectItemType[]>(
    () =>
      (config?.values ?? []).map((option) => ({ id: option, label: option })),
    [config?.values]
  );
  const label = property.displayName || property.name;
  const [selected, setSelected] = useState<string[]>(() => toValueList(value));
  const [search, setSearch] = useState('');
  const selectedItems = useMemo(
    () =>
      selected.map(
        (option) =>
          options.find((item) => item.id === option) ?? {
            id: option,
            label: option,
          }
      ),
    [selected, options]
  );

  useReportDirty(selected, onDirtyChange);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(selected);
  };

  const visibleOptions = options.filter((option) =>
    String(option.label)
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase())
  );

  return (
    <form noValidate id={formId} onSubmit={handleSubmit}>
      <Box direction="col" gap={2}>
        <div data-testid="enum-select">
          {isMultiSelect ? (
            <Autocomplete
              multiple
              aria-label={label}
              isDisabled={isSaving}
              items={options}
              placeholder={
                selected.length
                  ? t('label.add-more')
                  : t('label.select-field', { field: t('label.value') })
              }
              selectedItems={selectedItems}
              onItemCleared={(key) =>
                setSelected((prev) => prev.filter((item) => item !== key))
              }
              onItemInserted={(key) =>
                setSelected((prev) => [...prev, String(key)])
              }>
              {(item) => (
                <Autocomplete.Item
                  id={String(item.id)}
                  key={item.id}
                  label={item.label}
                />
              )}
            </Autocomplete>
          ) : (
            // Controlled `items` skip react-aria's own filtering, so filter here.
            <Select.ComboBox
              allowClear
              allowsEmptyCollection
              aria-label={label}
              isDisabled={isSaving}
              items={visibleOptions}
              placeholder={t('label.select-field', { field: t('label.value') })}
              shortcut={false}
              showSearchIcon={false}
              value={selected[0] ?? null}
              onChange={(key) => setSelected(isNil(key) ? [] : [String(key)])}
              onInputChange={setSearch}
              onOpenChange={(isOpen) => isOpen && setSearch('')}>
              {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select.ComboBox>
          )}
        </div>
        {isMultiSelect && (
          <span className="tw:text-xs tw:text-tertiary">
            {t('message.count-of-total-selected', {
              count: selected.length,
              total: options.length,
            })}
          </span>
        )}
      </Box>
    </form>
  );
};

export const enumPropertyRenderer: CustomPropertyRenderer = {
  View: EnumPropertyView,
  Edit: EnumPropertyEdit,
};
