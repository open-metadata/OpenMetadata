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
  Box,
  Input,
  Select,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useListData } from 'react-stately';
import {
  SchedularOptions,
  WorkflowType,
} from '../../../../constants/WorkflowBuilder.constants';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { TriggerConfigSectionProps } from '../../../../interface/workflow-builder-components.interface';
import { FormField } from '../common/FormField';
import { CronExpressionBuilder } from './CronExpressionBuilder';

const getFieldLabel = (v: string): string => {
  if (v.startsWith('extension.')) {
    return v.slice('extension.'.length);
  }

  return v;
};

/** Sync a useListData instance with an external string[] value. Replaces list content to avoid duplicates. */
const useSyncedListData = (
  values: string[],
  getLabel?: (v: string) => string
) => {
  const listData = useListData<SelectItemType>({ initialItems: [] });
  const prevRef = useRef<string[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    const same =
      prev.length === values.length && values.every((v, i) => v === prev[i]);
    if (!same) {
      const currentIds = listData.items.map((item) => item.id);
      currentIds.forEach((id) => listData.remove(id));
      values.forEach((v) =>
        listData.append({ id: v, label: getLabel ? getLabel(v) : v })
      );
      prevRef.current = values;
    }
  }, [values, getLabel]);

  return listData;
};

export const TriggerConfigSection: React.FC<TriggerConfigSectionProps> = ({
  triggerType,
  eventType,
  availableEventTypes,
  onTriggerTypeChange,
  onEventTypeChange,
  onRemoveEventType,
  excludeFields = [],
  availableExcludeFields = [],
  onExcludeFieldsChange,
  onRemoveExcludeField,
  include = [],
  onIncludeChange,
  onRemoveInclude,
  scheduleType = '',
  cronExpression = '',
  batchSize = 100,
  onScheduleTypeChange,
  onCronExpressionChange,
  onBatchSizeChange,
  lockNonIncludeExcludeFields = false,
  lockPeriodicBatchFields,
  lockScheduleTypeField,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const nonIncludeExcludeDisabled =
    isFormDisabled || lockNonIncludeExcludeFields;
  const periodicBatchDisabled =
    isFormDisabled || (lockPeriodicBatchFields ?? lockNonIncludeExcludeFields);
  const scheduleTypeDisabled =
    isFormDisabled ||
    (lockScheduleTypeField ??
      lockPeriodicBatchFields ??
      lockNonIncludeExcludeFields);
  const includeExcludeDisabled = isFormDisabled;

  const triggerTypeOptions = [
    { label: t('label.event-based'), value: 'Event Based' },
    { label: t('label.periodic-batch'), value: 'Periodic Batch' },
  ];

  const scheduleTypeOptions = [
    {
      label: t('label.on-demand'),
      value: 'OnDemand',
      testId: 'schedule-type-on-demand',
    },
    {
      label: t('label.scheduled'),
      value: 'Scheduled',
      testId: 'schedule-type-scheduled',
    },
  ];

  const selectedEventTypes = useSyncedListData(eventType);
  const selectedExcludeFields = useSyncedListData(excludeFields, getFieldLabel);
  const selectedIncludeFields = useSyncedListData(include, getFieldLabel);

  const renderFieldItem = (
    item: SelectItemType & { supportingText?: string }
  ) => (
    <Autocomplete.Item
      id={item.id}
      isDisabled={item.isDisabled}
      key={item.id}
      label={item.label}>
      <Box
        align="center"
        className="tw:w-full"
        direction="row"
        gap={2}
        justify="between">
        <Typography ellipsis as="span">
          {item.label}
        </Typography>
        {item.supportingText && (
          <Typography
            as="span"
            className="tw:text-tertiary tw:shrink-0"
            size="text-xs">
            {item.supportingText}
          </Typography>
        )}
      </Box>
    </Autocomplete.Item>
  );

  const fieldItems = useMemo(
    () =>
      availableExcludeFields.map((v) => {
        if (v.startsWith('extension.')) {
          return {
            id: v,
            label: v.slice('extension.'.length),
            supportingText: t('label.custom-property'),
          };
        }

        return { id: v, label: v };
      }),
    [availableExcludeFields, t]
  );

  return (
    <div className="tw:mb-6" data-testid="trigger-config-section">
      <div
        className="tw:flex tw:items-center tw:gap-1"
        data-testid="trigger-header">
        <Typography
          as="span"
          className="tw:text-secondary"
          size="text-sm"
          weight="medium">
          {t('label.trigger')}
        </Typography>
      </div>
      <Typography
        as="p"
        className="tw:m-0 tw:text-tertiary tw:mb-6"
        size="text-xs"
        weight="medium">
        {t('message.select-when-execute-workflow')}
      </Typography>

      <div className="tw:mt-2">
        <Select
          isRequired
          data-testid="trigger-type-select"
          isDisabled={nonIncludeExcludeDisabled}
          label={t('message.trigger-type')}
          value={triggerType}
          onChange={(key) => onTriggerTypeChange(String(key ?? ''))}>
          {triggerTypeOptions.map((opt) => (
            <Select.Item id={opt.value} key={opt.value} label={opt.label} />
          ))}
        </Select>
      </div>

      {triggerType === WorkflowType.EVENT_BASED && (
        <>
          <div className="tw:mt-6">
            <Autocomplete
              isRequired
              data-testid="event-type-select"
              isDisabled={nonIncludeExcludeDisabled}
              items={availableEventTypes.map((v) => ({ id: v, label: v }))}
              label={t('label.event-type')}
              placeholder={t('message.select-event-types')}
              selectedItems={selectedEventTypes}
              onItemCleared={(key) => {
                selectedEventTypes.remove(key);
                onRemoveEventType(String(key));
              }}
              onItemInserted={(key) => {
                selectedEventTypes.append({
                  id: String(key),
                  label: String(key),
                });
                onEventTypeChange({
                  target: {
                    value: [
                      ...selectedEventTypes.items.map((i) => i.id),
                      String(key),
                    ],
                  },
                });
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
          </div>

          <div className="tw:mt-6">
            <Autocomplete
              data-testid="exclude-fields-select"
              isDisabled={includeExcludeDisabled}
              items={fieldItems}
              label={t('label.exclude-fields')}
              maxVisibleItems={2}
              placeholder={t('message.select-fields-to-exclude')}
              selectedItems={selectedExcludeFields}
              onItemCleared={(key) => {
                selectedExcludeFields.remove(key);
                onRemoveExcludeField?.(String(key));
              }}
              onItemInserted={(key) => {
                selectedExcludeFields.append({
                  id: String(key),
                  label: getFieldLabel(String(key)),
                });
                onExcludeFieldsChange?.([
                  ...selectedExcludeFields.items.map((i) => i.id),
                  String(key),
                ]);
              }}>
              {renderFieldItem}
            </Autocomplete>
          </div>

          <div className="tw:mt-6">
            <Autocomplete
              data-testid="include-fields-select"
              isDisabled={includeExcludeDisabled}
              items={fieldItems}
              label={t('label.include-fields')}
              maxVisibleItems={2}
              placeholder={t('message.select-fields-to-include')}
              selectedItems={selectedIncludeFields}
              onItemCleared={(key) => {
                selectedIncludeFields.remove(key);
                onRemoveInclude?.(String(key));
              }}
              onItemInserted={(key) => {
                selectedIncludeFields.append({
                  id: String(key),
                  label: getFieldLabel(String(key)),
                });
                onIncludeChange?.([
                  ...selectedIncludeFields.items.map((i) => i.id),
                  String(key),
                ]);
              }}>
              {renderFieldItem}
            </Autocomplete>
          </div>
        </>
      )}

      {triggerType === WorkflowType.PERIODIC_BATCH && (
        <div className="tw:mt-6">
          <Select
            isRequired
            data-testid="schedule-type-select"
            hint={t('message.choose-how-the-workflow-should-be-triggered')}
            isDisabled={scheduleTypeDisabled}
            label={t('label.schedule-type')}
            value={scheduleType}
            onChange={(key) => onScheduleTypeChange?.(String(key ?? ''))}>
            {scheduleTypeOptions.map((opt) => (
              <Select.Item
                data-testid={opt.testId}
                id={opt.value}
                key={opt.value}
                label={opt.label}
              />
            ))}
          </Select>

          {scheduleType === SchedularOptions.SCHEDULE && (
            <FormField
              className="tw:mt-6"
              description={t('message.define-when-the-workflow-should-run')}
              label={t('label.schedule')}
              showInfoIcon={false}>
              <div className="tw:mb-6">
                <CronExpressionBuilder
                  forceDisabled={periodicBatchDisabled}
                  value={cronExpression}
                  onChange={onCronExpressionChange}
                />
              </div>
            </FormField>
          )}

          <Input
            className="tw:mt-6"
            data-testid="batch-size-input"
            hint={t('message.number-of-entities-to-process-in-each-batch')}
            isDisabled={periodicBatchDisabled}
            label={t('label.batch-size')}
            placeholder="100"
            type="number"
            value={batchSize === 0 ? '' : String(batchSize)}
            onChange={(value) =>
              onBatchSizeChange?.(value === '' ? 0 : parseInt(value) || 100)
            }
          />
        </div>
      )}
    </div>
  );
};
