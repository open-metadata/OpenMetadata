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
  Button,
  Card,
  Grid,
  Input,
  Select,
  TimePicker,
  TimePickerValue,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClockIcon } from '../../../../../assets/svg/calender-v1.svg';
import { ReactComponent as PlayIcon } from '../../../../../assets/svg/trigger.svg';
import {
  DAY_IN_MONTH_OPTIONS,
  DAY_OPTIONS,
  PERIOD_OPTIONS,
} from '../../../../../constants/Schedular.constants';
import { SchedularOptions } from '../../../../../enums/Schedular.enum';
import {
  getCron,
  getDefaultScheduleValue,
  getStateValue,
  getUpdatedStateFromFormState,
} from '../../../../../utils/CronExpressionUtils';
import { getCurrentLocaleForConstrue } from '../../../../../utils/i18next/i18nextUtil';
import { SelectionOption } from '../../../../common/SelectionCardGroup/SelectionCardGroup.interface';
import {
  FREQUENCY_LABEL_KEYS,
  PERIOD_CUSTOM,
  SELECTED_FREQUENCY_CLASS,
} from './ScheduleInterval.constants';
import { ScheduleIntervalProps, StateValue } from './ScheduleInterval.types';
import { validateCronExpression } from './ScheduleInterval.utils';
import ScheduleSelectionCards from './ScheduleSelectionCards';

const ScheduleInterval: React.FC<ScheduleIntervalProps> = ({
  value,
  onChange,
  disabled,
  includePeriodOptions,
  defaultSchedule,
  entity,
  onValidityChange,
}) => {
  const { t } = useTranslation();
  // Schedule options for SelectionCardGroup
  const SCHEDULE_OPTIONS: SelectionOption[] = [
    {
      value: SchedularOptions.SCHEDULE,
      label: t('label.schedule'),
      description: t('message.schedule-entity-description', {
        entity: entity ?? t('label.ingestion'),
      }),
      icon: <ClockIcon />,
    },
    {
      value: SchedularOptions.ON_DEMAND,
      label: t('label.on-demand'),
      description: t('message.on-demand-entity-description', {
        entity: entity ?? t('label.ingestion'),
      }),
      icon: <PlayIcon />,
    },
  ];

  // Determine initial state based on value
  const initialSelectedSchedular = isEmpty(value)
    ? SchedularOptions.ON_DEMAND
    : SchedularOptions.SCHEDULE;

  const initialDefaultSchedule = getDefaultScheduleValue({
    defaultSchedule,
    includePeriodOptions,
    allowNoSchedule: true,
  });

  const initialCron = value ?? initialDefaultSchedule;
  const initialStateValue = getStateValue(initialCron, initialDefaultSchedule);

  const [selectedSchedular, setSelectedSchedular] = useState<SchedularOptions>(
    initialSelectedSchedular
  );
  const [state, setState] = useState<StateValue>(initialStateValue);

  const { cron: cronString, selectedPeriod, dow, dom } = state;

  // Holds the cron this component last emitted, so the sync effect below can
  // tell an external value change from an echo of its own onChange. Without it,
  // a partially typed custom cron (not emitted while invalid) or a typed cron
  // matching a known period would re-derive the state and pull the user out of
  // the custom field. Normalized because consumers store a cleared cron as an
  // empty string but hand it back as undefined.
  const lastEmittedValueRef = useRef(value || undefined);

  const emitChange = useCallback(
    (cron?: string) => {
      lastEmittedValueRef.current = cron || undefined;
      onChange?.(cron);
    },
    [onChange]
  );

  const {
    showTimePicker,
    showMinuteOnly,
    showWeekSelect,
    showMonthSelect,
    showCustomInput,
  } = useMemo(() => {
    const isHourSelected = selectedPeriod === 'hour';
    const isDaySelected = selectedPeriod === 'day';
    const isWeekSelected = selectedPeriod === 'week';
    const isMonthSelected = selectedPeriod === 'month';
    const isCustomSelected = selectedPeriod === PERIOD_CUSTOM;

    return {
      showTimePicker: isDaySelected || isWeekSelected || isMonthSelected,
      showMinuteOnly: isHourSelected,
      showWeekSelect: isWeekSelected,
      showMonthSelect: isMonthSelected,
      showCustomInput: isCustomSelected,
    };
  }, [selectedPeriod]);

  const [customCronError, setCustomCronError] = useState<string>('');

  const handleSelectedSchedular = useCallback(
    (schedularValue: SchedularOptions) => {
      setSelectedSchedular(schedularValue);
      setCustomCronError('');

      if (schedularValue === SchedularOptions.ON_DEMAND) {
        setState((prev) => ({ ...prev, cron: undefined }));
        emitChange(undefined);
      } else {
        // When switching to schedule, use default schedule
        const nonEmptyScheduleValue = getDefaultScheduleValue({
          includePeriodOptions,
          defaultSchedule,
        });
        const newState = getStateValue(nonEmptyScheduleValue);
        setState(newState);
        emitChange(newState.cron);
      }
    },
    [includePeriodOptions, defaultSchedule, emitChange]
  );

  const handleStateChange = useCallback(
    (newStatePartial: Partial<StateValue>) => {
      const newState = getUpdatedStateFromFormState(
        state,
        newStatePartial as StateValue
      );
      const cronExp = getCron(newState);
      const updatedState = { ...newState, cron: cronExp };
      setState(updatedState);
      // A stale error from a previous custom expression must not survive a
      // frequency switch - the new frequency always produces a valid cron.
      setCustomCronError('');
      emitChange(cronExp);
    },
    [state, emitChange]
  );

  const handleCustomCronChange = useCallback(
    (cronValue: string) => {
      setState((prev) => ({ ...prev, cron: cronValue }));

      // An empty custom expression is not a schedule. Clearing the field is a
      // validation error rather than a silent fallback to on demand, which is
      // reachable only through the On Demand card.
      if (!cronValue) {
        setCustomCronError(
          t('label.field-required', { field: t('label.cron') })
        );
        emitChange('');

        return;
      }

      const errorKey = validateCronExpression(cronValue);
      setCustomCronError(errorKey ? t(errorKey) : '');

      if (!errorKey) {
        emitChange(cronValue);
      }
    },
    [emitChange, t]
  );

  // Only the custom expression can be left in an unusable state; every other
  // frequency derives a valid cron on its own.
  const isCustomCronInvalid = showCustomInput && Boolean(customCronError);

  useEffect(() => {
    onValidityChange?.(!isCustomCronInvalid);
  }, [isCustomCronInvalid, onValidityChange]);

  const frequencyOptions = useMemo(() => {
    const options = includePeriodOptions
      ? PERIOD_OPTIONS.filter((option) =>
          includePeriodOptions.includes(option.value)
        )
      : PERIOD_OPTIONS;

    return options.map((option) => ({
      id: option.value,
      label: t(FREQUENCY_LABEL_KEYS[option.value] ?? option.label),
    }));
  }, [includePeriodOptions, t]);

  const dayOptions = useMemo(
    () =>
      DAY_OPTIONS.map((option) => ({
        id: option.value,
        label: option.label,
      })),
    []
  );

  const dateOptions = useMemo(
    () =>
      DAY_IN_MONTH_OPTIONS.map((option) => ({
        id: option.value,
        label: option.label,
      })),
    []
  );

  const minuteOptions = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i.toString(),
        label: i.toString().padStart(2, '0'),
      })),
    []
  );

  const timeValue = useMemo<TimePickerValue>(() => {
    const hour = Number(state.hour);
    const minute = Number(state.min);

    return {
      hour: isNaN(hour) ? 0 : hour,
      minute: isNaN(minute) ? 0 : minute,
    };
  }, [state.hour, state.min]);

  const [cronHumanText, setCronHumanText] = useState<string>('');

  useEffect(() => {
    if (!cronString) {
      setCronHumanText('');

      return;
    }
    let cancelled = false;
    import('cronstrue/i18n').then((m) => {
      if (!cancelled) {
        setCronHumanText(
          m.default.toString(cronString, {
            use24HourTimeFormat: false,
            verbose: true,
            locale: getCurrentLocaleForConstrue(),
            throwExceptionOnParseError: false,
          })
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cronString]);

  const cronExpressionCard = useMemo(() => {
    const cronStringValue = cronString
      ? t('label.entity-scheduled-to-run-value', {
          entity: entity ?? t('label.ingestion'),
          value: cronHumanText,
        })
      : t('message.pipeline-will-trigger-manually');

    return (
      <Card
        className="tw:flex tw:items-center tw:gap-3 tw:bg-secondary tw:px-4 tw:py-3"
        size="sm">
        <Clock className="tw:size-5 tw:shrink-0 tw:text-utility-gray-600" />
        <Typography size="text-sm">{cronStringValue}</Typography>
      </Card>
    );
  }, [cronString, cronHumanText, entity, t]);

  // Update internal state when the value changes outside of this component.
  // Comparing against the last emitted cron rather than the current state keeps
  // the user's in-progress edits (typed custom crons above all) intact.
  useEffect(() => {
    const normalizedValue = value || undefined;

    if (normalizedValue === lastEmittedValueRef.current) {
      return;
    }

    lastEmittedValueRef.current = normalizedValue;

    if (isEmpty(value)) {
      setSelectedSchedular(SchedularOptions.ON_DEMAND);
      setState((prev) => ({ ...prev, cron: undefined }));
    } else {
      setSelectedSchedular(SchedularOptions.SCHEDULE);
      setState(getStateValue(value, initialDefaultSchedule));
    }
  }, [value, initialDefaultSchedule]);

  return (
    <div>
      <Grid gap="4">
        <Grid.Item span={24}>
          <ScheduleSelectionCards
            disabled={disabled}
            options={SCHEDULE_OPTIONS}
            value={selectedSchedular}
            onChange={(value) =>
              handleSelectedSchedular(value as SchedularOptions)
            }
          />
        </Grid.Item>
        {selectedSchedular === SchedularOptions.SCHEDULE && (
          <Grid.Item span={24}>
            <div
              className="tw:flex tw:flex-col tw:gap-4"
              data-testid="cron-container">
              <div data-testid="frequency-container">
                {/* eslint-disable-next-line jsx-a11y/label-has-for -- button group, not a single control */}
                <label className="tw:font-medium">{t('label.frequency')}</label>
                <div className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-3">
                  {frequencyOptions.map((option) => (
                    <Button
                      aria-pressed={selectedPeriod === option.id}
                      className={
                        selectedPeriod === option.id
                          ? SELECTED_FREQUENCY_CLASS
                          : undefined
                      }
                      color="secondary"
                      data-testid={`frequency-${option.id}`}
                      isDisabled={disabled}
                      key={option.id}
                      size="sm"
                      onPress={() =>
                        handleStateChange({ selectedPeriod: option.id })
                      }>
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Grid gap="4">
                {showWeekSelect && (
                  <Grid.Item span={8}>
                    {/* eslint-disable-next-line jsx-a11y/label-has-for -- Select below has its own aria-label */}
                    <label className="tw:font-medium">{t('label.day')}</label>
                    <Select
                      aria-label={t('label.day')}
                      className="tw:mt-2 tw:w-full"
                      data-testid="day-options"
                      isDisabled={disabled}
                      items={dayOptions}
                      selectedKey={dow ?? null}
                      onSelectionChange={(key: Key | null) =>
                        key !== null && handleStateChange({ dow: String(key) })
                      }>
                      {(item) => (
                        <Select.Item
                          id={item.id}
                          key={item.id}
                          textValue={item.label}>
                          {item.label}
                        </Select.Item>
                      )}
                    </Select>
                  </Grid.Item>
                )}

                {showMonthSelect && (
                  <Grid.Item span={8}>
                    {/* eslint-disable-next-line jsx-a11y/label-has-for -- Select below has its own aria-label */}
                    <label className="tw:font-medium">{t('label.date')}</label>
                    <Select
                      aria-label={t('label.date')}
                      className="tw:mt-2 tw:w-full"
                      data-testid="date-options"
                      isDisabled={disabled}
                      items={dateOptions}
                      selectedKey={dom ?? null}
                      onSelectionChange={(key: Key | null) =>
                        key !== null && handleStateChange({ dom: String(key) })
                      }>
                      {(item) => (
                        <Select.Item
                          id={item.id}
                          key={item.id}
                          textValue={item.label}>
                          {item.label}
                        </Select.Item>
                      )}
                    </Select>
                  </Grid.Item>
                )}

                {showTimePicker && (
                  <Grid.Item span={8}>
                    {/* eslint-disable-next-line jsx-a11y/label-has-for -- TimePicker below has its own aria-label */}
                    <label className="tw:font-medium">{t('label.time')}</label>
                    <TimePicker
                      aria-label={t('label.time')}
                      className="tw:mt-2"
                      data-testid="time-picker"
                      isDisabled={disabled}
                      value={timeValue}
                      onChange={(time: TimePickerValue | null) => {
                        if (time !== null) {
                          handleStateChange({
                            hour: String(time.hour),
                            min: String(time.minute),
                          });
                        }
                      }}
                    />
                  </Grid.Item>
                )}

                {showMinuteOnly && (
                  <Grid.Item span={8}>
                    {/* eslint-disable-next-line jsx-a11y/label-has-for -- Select below has its own aria-label */}
                    <label className="tw:font-medium">
                      {t('label.minute')}
                    </label>
                    <Select
                      aria-label={t('label.minute')}
                      className="tw:mt-2 tw:w-full"
                      data-testid="minute-options"
                      isDisabled={disabled}
                      items={minuteOptions}
                      selectedKey={
                        state.min === undefined ? null : String(state.min)
                      }
                      onSelectionChange={(key: Key | null) =>
                        key !== null && handleStateChange({ min: String(key) })
                      }>
                      {(item) => (
                        <Select.Item
                          id={item.id}
                          key={item.id}
                          textValue={item.label}>
                          {item.label}
                        </Select.Item>
                      )}
                    </Select>
                  </Grid.Item>
                )}

                {showCustomInput && (
                  <Grid.Item span={24}>
                    {/* eslint-disable-next-line jsx-a11y/label-has-for -- Input below has its own aria-label */}
                    <label className="tw:font-medium">{t('label.cron')}</label>
                    <Input
                      aria-label={t('label.cron')}
                      className="tw:mt-2"
                      data-testid="custom-cron-input"
                      isDisabled={disabled}
                      placeholder="0 0 * * *"
                      value={cronString ?? ''}
                      onChange={handleCustomCronChange}
                    />
                    {customCronError && (
                      <Typography
                        className="tw:text-fg-error-primary tw:mt-1"
                        data-testid="custom-cron-error"
                        size="text-xs">
                        {customCronError}
                      </Typography>
                    )}
                  </Grid.Item>
                )}
              </Grid>
            </div>
          </Grid.Item>
        )}

        <Grid.Item span={24}>{cronExpressionCard}</Grid.Item>
      </Grid>
    </div>
  );
};

export default ScheduleInterval;
