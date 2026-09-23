/*
 *  Copyright 2024 Collate.
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
  Alert,
  Autocomplete,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getSourceOptions } from '../../../utils/Alerts/AlertSelectionUtil';
import { EntityIconSize } from '../../../utils/EntityIconUtils';
import { getEntityNameLabel } from '../../../utils/EntityNameUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { AlertSourcePickerProps } from './AlertSourcePicker.interface';

/**
 * Several sources for one alert. A source that would break a rule is shown disabled with the
 * reason beside it, rather than failing on save. A selected source that can never produce a match
 * with what has been chosen so far gets a warning, and the alert can still be saved.
 */
function AlertSourcePicker({
  sources,
  value = [],
  onChange,
  selection,
  isDisabled = false,
}: Readonly<AlertSourcePickerProps>) {
  const { t } = useTranslation();

  const sourceOptions = useMemo(
    () => getSourceOptions(sources, value, selection),
    [sources, value, selection]
  );

  const items = useMemo<SelectItemType[]>(
    () =>
      sourceOptions.map((option) => ({
        id: option.name,
        label: getEntityNameLabel(option.name),
        isDisabled: option.disabled,
        supportingText: option.reason,
        icon: searchClassBase.getEntityIconWithBg(
          option.name,
          EntityIconSize.Size14
        ),
      })),
    [sourceOptions]
  );

  // A saved source the list does not offer is still shown, by the name the list would give it.
  const selectedItems = useMemo(
    () =>
      value.map(
        (name) =>
          items.find((item) => item.id === name) ?? {
            id: name,
            label: getEntityNameLabel(name),
          }
      ),
    [items, value]
  );

  const warnings = useMemo(
    () => sourceOptions.filter((option) => option.warning),
    [sourceOptions]
  );

  return (
    <div className="tw:flex tw:w-full tw:flex-col tw:gap-2">
      <Autocomplete
        multiple
        data-testid="source-select"
        isDisabled={isDisabled}
        items={items}
        placeholder={t('label.select-field', {
          field: t('label.data-asset-plural'),
        })}
        selectedItems={selectedItems}
        onItemCleared={(key) =>
          onChange?.(
            value.filter((name) => name !== String(key)),
            value
          )
        }
        onItemInserted={(key) => onChange?.([...value, String(key)], value)}>
        {(item) => (
          <Autocomplete.Item
            data-testid={`${item.id}-option`}
            icon={item.icon}
            id={item.id}
            isDisabled={item.isDisabled}
            key={item.id}
            label={item.label}
            supportingText={item.supportingText}
          />
        )}
      </Autocomplete>
      {warnings.map((option) => (
        <Alert
          data-testid={`${option.name}-warning`}
          key={option.name}
          variant="warning">
          {`${getEntityNameLabel(option.name)}: ${option.warning}`}
        </Alert>
      ))}
    </div>
  );
}

export default AlertSourcePicker;
