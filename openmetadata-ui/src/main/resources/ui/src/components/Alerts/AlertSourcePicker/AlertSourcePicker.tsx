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
  Button,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getSourceKindLabel,
  getSourceOptions,
  groupSourcesByKind,
  SourceOption,
} from '../../../utils/Alerts/AlertSelectionUtil';
import { EntityIconSize } from '../../../utils/EntityIconUtils';
import { getEntityNameLabel } from '../../../utils/EntityNameUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { AlertSourcePickerProps } from './AlertSourcePicker.interface';

const HEADER_CLASS =
  'tw:cursor-default tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wider tw:text-secondary tw:opacity-50';

const withoutAccents = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

const toItem = (option: SourceOption): SelectItemType => ({
  id: option.name,
  label: getEntityNameLabel(option.name),
  isDisabled: option.disabled,
  supportingText: option.reason,
  icon: searchClassBase.getEntityIconWithBg(option.name, EntityIconSize.Size14),
});

/**
 * Several sources for one alert, grouped by kind. The server lists them. A source that would break
 * a rule is shown disabled with the reason beside it, rather than failing on save. A selected
 * source that can never produce a match with what has been chosen so far gets a warning, and the
 * alert can still be saved. When the server could not answer, it says so and offers to ask again.
 */
function AlertSourcePicker({
  value = [],
  onChange,
  capabilities,
  isDisabled = false,
  isRequired,
  isInvalid,
  hint,
}: Readonly<AlertSourcePickerProps>) {
  const { t } = useTranslation();

  const { selection, knownSources, loading, settled, retry } = capabilities;
  const sourceOptions = useMemo(
    () => getSourceOptions(value, selection, knownSources),
    [value, selection, knownSources]
  );
  const hasFailed = settled && !loading && !selection;

  const groups = useMemo(
    () => groupSourcesByKind(sourceOptions),
    [sourceOptions]
  );

  // A group's header comes first.
  const items = useMemo<SelectItemType[]>(
    () =>
      groups.flatMap(({ kind, sources: members }) => [
        {
          id: `header-${kind}`,
          label: getSourceKindLabel(kind),
          isDisabled: true,
        },
        ...members.map(toItem),
      ]),
    [groups]
  );

  const membersOfHeader = useMemo(
    () =>
      new Map(
        groups.map(({ kind, sources: members }) => [
          `header-${kind}`,
          members.map((member) => member.name),
        ])
      ),
    [groups]
  );

  // A header stays only while one of its sources can still be picked and matches the search.
  const isShown = useCallback(
    (item: SelectItemType, search: string) => {
      const matches = (name: string) =>
        !value.includes(name) &&
        withoutAccents(getEntityNameLabel(name)).includes(
          withoutAccents(search.trim())
        );
      const members = membersOfHeader.get(item.id);

      return members ? members.some(matches) : matches(item.id);
    },
    [membersOfHeader, value]
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

  // Once a source is chosen the empty input invites another, so the picker reads as one that takes several.
  const placeholder = useMemo(() => {
    if (isEmpty(value)) {
      return t('label.select-field', { field: t('label.source-plural') });
    }

    return isDisabled ? '' : t('label.add-another');
  }, [isDisabled, t, value]);

  return (
    <div className="tw:flex tw:w-full tw:flex-col tw:gap-2">
      <Autocomplete
        multiple
        aria-label={t('label.source-plural')}
        data-testid="source-select"
        filterOption={isShown}
        hint={hint}
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        isRequired={isRequired}
        items={items}
        placeholder={placeholder}
        selectedItems={selectedItems}
        validationBehavior="aria"
        onItemCleared={(key) =>
          onChange?.(
            value.filter((name) => name !== String(key)),
            value
          )
        }
        onItemInserted={(key) => onChange?.([...value, String(key)], value)}>
        {(item) => (
          <Autocomplete.Item
            className={membersOfHeader.has(item.id) ? HEADER_CLASS : undefined}
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
      {hasFailed && (
        <Alert
          data-testid="source-select-error"
          rightContent={
            <Button
              color="link-color"
              data-testid="source-select-retry"
              size="sm"
              onPress={retry}>
              {t('label.retry')}
            </Button>
          }
          title={t('server.entity-fetch-error', {
            entity: t('label.source-plural'),
          })}
          variant="error"
        />
      )}
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
