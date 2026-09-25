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
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { isArray } from 'lodash';
import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Config } from '../../../../../generated/type/customProperty';
import { CollapsibleChipList } from '../CollapsibleChipList';
import { ENUM_VISIBLE_COUNT } from '../CustomPropertyCard.constants';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.types';
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
    visibleCount={ENUM_VISIBLE_COUNT}
  />
);

const EnumPropertyEdit = ({
  property,
  value,
  isSaving,
  onSave,
  formId,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const config = property.customPropertyConfig?.config as Config | undefined;
  const isMultiSelect = Boolean(config?.multiSelect);
  const options = useMemo<SelectItemType[]>(
    () =>
      (config?.values ?? []).map((option) => ({ id: option, label: option })),
    [config?.values]
  );
  const [selected, setSelected] = useState<string[]>(() => toValueList(value));
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(selected);
  };

  return (
    <form noValidate id={formId} onSubmit={handleSubmit}>
      <Box direction="col" gap={2}>
        <div data-testid="enum-select">
          <Autocomplete
            aria-label={property.displayName || property.name}
            isDisabled={isSaving}
            items={options}
            multiple={isMultiSelect}
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
        </div>
        <span className="tw:text-xs tw:text-tertiary">
          {t('message.count-of-total-selected', {
            count: selected.length,
            total: options.length,
          })}
        </span>
      </Box>
    </form>
  );
};

export const enumPropertyRenderer: CustomPropertyRenderer = {
  View: EnumPropertyView,
  Edit: EnumPropertyEdit,
};
