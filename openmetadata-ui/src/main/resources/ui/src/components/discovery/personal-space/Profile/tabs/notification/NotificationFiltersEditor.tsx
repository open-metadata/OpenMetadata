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
  Box,
  Button,
  Card,
  Select,
  SelectItemType,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { isEmpty, isNil } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Effect } from '../../../../../../generated/events/api/createEventSubscription';
import {
  EventFilterRule,
  InputType,
} from '../../../../../../generated/events/eventSubscription';
import { EventType } from '../../../../../../generated/type/changeEvent';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getControlledArgumentFieldCoreUI } from './NotificationAlertArgFields';

// Stored filter arguments are { name: string; input: string[] }[] at runtime,
// despite EventFilterRule.arguments being typed as string[] (generated type mismatch).
type StoredArg = { name?: string; input?: string[] };

interface ControlledFilterArgsFieldProps {
  filter: EventFilterRule;
  isViewMode?: boolean;
  selectedTrigger: string;
  supportedFilters?: EventFilterRule[];
  containerEntities?: string[];
  supportedEventTypes?: EventType[];
  onArgumentsChange: (args: NonNullable<EventFilterRule['arguments']>) => void;
}

function ControlledFilterArgsField({
  containerEntities,
  filter,
  isViewMode = false,
  onArgumentsChange,
  selectedTrigger,
  supportedEventTypes,
  supportedFilters,
}: ControlledFilterArgsFieldProps) {
  const selectedFilterDef = useMemo(
    () => supportedFilters?.find((f) => f.name === filter.name),
    [filter.name, supportedFilters]
  );

  const requiresInput = useMemo(
    () =>
      selectedFilterDef?.inputType === InputType.Runtime &&
      (selectedFilterDef?.arguments?.length ?? 0) > 0,
    [selectedFilterDef]
  );

  const storedArgs = useMemo(
    () => (filter.arguments as unknown as StoredArg[]) ?? [],
    [filter.arguments]
  );

  const handleArgChange = useCallback(
    (argName: string, val: string[]) => {
      const updated = (selectedFilterDef?.arguments ?? []).map((name) => ({
        name,
        input:
          name === argName
            ? val
            : storedArgs.find((a) => a.name === name)?.input ?? [],
      }));
      onArgumentsChange(updated as unknown as string[]);
    },
    [selectedFilterDef?.arguments, storedArgs, onArgumentsChange]
  );

  if (!requiresInput || !filter.name) {
    return null;
  }

  return (
    <>
      {(selectedFilterDef?.arguments ?? []).map((argument) => {
        const argValue =
          storedArgs.find((a) => a.name === argument)?.input ?? [];

        return (
          <Box className="tw:flex-1" key={argument}>
            {getControlledArgumentFieldCoreUI(
              argument,
              argValue,
              (val: string[]) => handleArgChange(argument, val),
              selectedTrigger,
              containerEntities ?? [],
              supportedEventTypes ?? [],
              isViewMode
            )}
          </Box>
        );
      })}
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export interface NotificationFiltersEditorProps {
  supportedFilters?: EventFilterRule[];
  containerEntities?: string[];
  supportedEventTypes?: EventType[];
  selectedResources?: string[];
  value: EventFilterRule[];
  onChange: (filters: EventFilterRule[]) => void;
  isViewMode?: boolean;
}

function NotificationFiltersEditor({
  containerEntities,
  isViewMode = false,
  onChange,
  selectedResources,
  supportedEventTypes,
  supportedFilters,
  value,
}: Readonly<NotificationFiltersEditorProps>) {
  const { t } = useTranslation();
  const filters = useMemo(() => value ?? [], [value]);

  const selectedTrigger = selectedResources?.[0];

  const controlledFilterSelectItems = useMemo<SelectItemType[]>(() => {
    const selectedNames = new Set(filters.map((f) => f.name));

    return (supportedFilters ?? []).map((func) => ({
      id: func.name ?? '',
      label: getEntityName(func),
      isDisabled: selectedNames.has(func.name),
    }));
  }, [supportedFilters, filters]);

  const handleControlledAdd = () => {
    onChange([...filters, { effect: Effect.Include } as EventFilterRule]);
  };

  const handleControlledRemove = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const handleControlledFieldChange = (
    index: number,
    field: keyof EventFilterRule,
    fieldValue: EventFilterRule[keyof EventFilterRule]
  ) => {
    onChange(
      filters.map((f, i) => (i === index ? { ...f, [field]: fieldValue } : f))
    );
  };

  const showAddFilterButton =
    filters.length < (supportedFilters?.length ?? 1) && !isViewMode;

  return (
    <Card className="tw:w-full" size="md">
      <Card.Content>
        <Box direction="col" gap={3}>
          <Box direction="col" gap={1}>
            <Typography size="text-sm" weight="medium">
              {t('label.filter-plural')}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('message.alerts-filter-description')}
            </Typography>
          </Box>

          <Box data-testid="filters-list" direction="col" gap={3}>
            {filters.map((filter, index) => {
              const effect = filter.effect ?? Effect.Include;

              return (
                <Box
                  data-testid={`filter-${index}`}
                  direction="col"
                  gap={2}
                  key={filter.name || `new-filter-${index}`}>
                  <Box align="start" direction="row" gap={2}>
                    <Box className="tw:flex-1">
                      <Select
                        className="tw:w-full"
                        data-testid={`filter-select-${index}`}
                        isDisabled={isViewMode}
                        items={controlledFilterSelectItems}
                        placeholder={t('label.select-field', {
                          field: t('label.filter'),
                        })}
                        selectedKey={filter.name ?? null}
                        onSelectionChange={(val) => {
                          onChange(
                            filters.map((f, i) =>
                              i === index
                                ? { ...f, name: String(val), arguments: [] }
                                : f
                            )
                          );
                        }}>
                        {(item) => (
                          <Select.Item id={item.id} key={item.id}>
                            {item.label}
                          </Select.Item>
                        )}
                      </Select>
                    </Box>

                    {filter.name && (
                      <ControlledFilterArgsField
                        containerEntities={containerEntities}
                        filter={filter}
                        isViewMode={isViewMode}
                        key={`args-${filter.name}`}
                        selectedTrigger={selectedTrigger ?? ''}
                        supportedEventTypes={supportedEventTypes}
                        supportedFilters={supportedFilters}
                        onArgumentsChange={(args) =>
                          handleControlledFieldChange(index, 'arguments', args)
                        }
                      />
                    )}

                    {!isViewMode && (
                      <Button
                        color="tertiary"
                        data-testid={`remove-filter-${index}`}
                        size="sm"
                        onPress={() => handleControlledRemove(index)}>
                        <XClose className="tw:size-4" />
                      </Button>
                    )}
                  </Box>

                  <Box align="center" direction="row" gap={2}>
                    <Typography size="text-sm">{t('label.include')}</Typography>
                    <Toggle
                      data-testid={`filter-switch-${index}`}
                      isDisabled={isViewMode}
                      isSelected={effect === Effect.Include}
                      onChange={(checked) =>
                        handleControlledFieldChange(
                          index,
                          'effect',
                          checked ? Effect.Include : Effect.Exclude
                        )
                      }
                    />
                  </Box>
                </Box>
              );
            })}

            {showAddFilterButton ? (
              <Box className="tw:self-start">
                <Button
                  color="primary"
                  data-testid="add-filters"
                  isDisabled={
                    isEmpty(selectedTrigger) || isNil(selectedTrigger)
                  }
                  size="sm"
                  onPress={handleControlledAdd}>
                  {t('label.add-entity', {
                    entity: t('label.filter'),
                  })}
                </Button>
              </Box>
            ) : null}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
}

export default NotificationFiltersEditor;
