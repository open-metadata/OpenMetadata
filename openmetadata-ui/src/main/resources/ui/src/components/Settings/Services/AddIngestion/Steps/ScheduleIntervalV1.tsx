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
  Select,
  TimePicker,
  TimePickerValue,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClockIcon } from '../../../../../assets/svg/calender-v1.svg';
import { ReactComponent as PlayIcon } from '../../../../../assets/svg/trigger.svg';
import {
  DAY_IN_MONTH_OPTIONS,
  DAY_OPTIONS,
  PERIOD_OPTIONS,
} from '../../../../../constants/Schedular.constants';
import { SchedularOptions } from '../../../../../enums/Schedular.enum';
import { getCurrentLocaleForConstrue } from '../../../../../utils/i18next/i18nextUtil';
import {
  getCron,
  getDefaultScheduleValue,
  getStateValue,
  getUpdatedStateFromFormState,
} from '../../../../../utils/SchedularUtils';
import SelectionCardGroup from '../../../../common/SelectionCardGroup/SelectionCardGroup';
import { SelectionOption } from '../../../../common/SelectionCardGroup/SelectionCardGroup.interface';
import './schedule-interval-v1.less';
import { StateValue } from './ScheduleInterval.interface';

export interface ScheduleIntervalV1Props {
  value?: string;
  onChange?: (value: string | undefined) => void;
  disabled?: boolean;
  includePeriodOptions?: string[];
  defaultSchedule?: string;
  entity?: string;
}

const PERIOD_CUSTOM = 'custom';

const FREQUENCY_LABEL_KEYS: Record<string, string> = {
  hour: 'label.hourly',
  day: 'label.daily',
  week: 'label.weekly',
  month: 'label.monthly',
};

const SELECTED_FREQUENCY_CLASS =
  'tw:bg-utility-brand-50 tw:text-brand-secondary tw:ring-brand tw:hover:bg-utility-brand-50 tw:hover:text-brand-secondary';

const ScheduleIntervalV1: React.FC<ScheduleIntervalV1Props> = ({
  value,
  onChange,
  disabled,
  includePeriodOptions,
  defaultSchedule,
  entity,
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

  const { showTimePicker, showMinuteOnly, showWeekSelect, showMonthSelect } =
    useMemo(() => {
      const isHourSelected = selectedPeriod === 'hour';
      const isDaySelected = selectedPeriod === 'day';
      const isWeekSelected = selectedPeriod === 'week';
      const isMonthSelected = selectedPeriod === 'month';

      return {
        showTimePicker: isDaySelected || isWeekSelected || isMonthSelected,
        showMinuteOnly: isHourSelected,
        showWeekSelect: isWeekSelected,
        showMonthSelect: isMonthSelected,
      };
    }, [selectedPeriod]);

  const handleSelectedSchedular = useCallback(
    (schedularValue: SchedularOptions) => {
      setSelectedSchedular(schedularValue);

      if (schedularValue === SchedularOptions.ON_DEMAND) {
        setState((prev) => ({ ...prev, cron: undefined }));
        onChange?.(undefined);
      } else {
        // When switching to schedule, use default schedule
        const nonEmptyScheduleValue = getDefaultScheduleValue({
          includePeriodOptions,
          defaultSchedule,
        });
        const newState = getStateValue(nonEmptyScheduleValue);
        setState(newState);
        onChange?.(newState.cron);
      }
    },
    [includePeriodOptions, defaultSchedule, onChange]
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
      onChange?.(cronExp);
    },
    [state, onChange]
  );

  const frequencyOptions = useMemo(() => {
    const options = includePeriodOptions
      ? PERIOD_OPTIONS.filter((option) =>
          includePeriodOptions.includes(option.value)
        )
      : PERIOD_OPTIONS;

    return options
      .filter((option) => option.value !== PERIOD_CUSTOM)
      .map((option) => ({
        id: option.value,
        label: t(FREQUENCY_LABEL_KEYS[option.value] ?? option.label),
      }));
  }, [includePeriodOptions]);

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
      <Card className="cron-expression-card" size="sm">
        <div className="cron-expression-card-icon">
          <span className="cron-expression-card-icon-inner">
            <Clock />
          </span>
        </div>
        <Typography className="expression-text" size="text-sm">
          {cronStringValue}
        </Typography>
      </Card>
    );
  }, [cronString, cronHumanText, entity, t]);

  // Update internal state when external value changes
  useEffect(() => {
    if (value !== cronString) {
      if (isEmpty(value)) {
        setSelectedSchedular(SchedularOptions.ON_DEMAND);
        setState((prev) => ({ ...prev, cron: undefined }));
      } else {
        setSelectedSchedular(SchedularOptions.SCHEDULE);
        const newState = getStateValue(value, initialDefaultSchedule);
        setState(newState);
      }
    }
  }, [value, cronString, initialDefaultSchedule]);

  return (
    <div className="schedule-interval-v1">
      <Grid gap="4">
        <Grid.Item span={24}>
          <SelectionCardGroup
            options={SCHEDULE_OPTIONS}
            value={selectedSchedular}
            onChange={(value) =>
              !disabled && handleSelectedSchedular(value as SchedularOptions)
            }
          />
        </Grid.Item>
        {selectedSchedular === SchedularOptions.SCHEDULE && (
          <Grid.Item span={24}>
            <div
              className="schedule-interval-v1-fields"
              data-testid="cron-container">
              <div
                className="frequency-field"
                data-testid="frequency-container">
                <label>{t('label.frequency')}</label>
                <div className="frequency-button-group m-t-xs">
                  {frequencyOptions.map((option) => (
                    <Button
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
                    <label>{t('label.day')}</label>
                    <Select
                      aria-label={t('label.day')}
                      className="w-full m-t-xs"
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
                    <label>{t('label.date')}</label>
                    <Select
                      aria-label={t('label.date')}
                      className="w-full m-t-xs"
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
                    <label>{t('label.time')}</label>
                    <TimePicker
                      aria-label={t('label.time')}
                      className="m-t-xs"
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
                    <label>{t('label.minute')}</label>
                    <Select
                      aria-label={t('label.minute')}
                      className="w-full m-t-xs"
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
              </Grid>
            </div>
          </Grid.Item>
        )}

        <Grid.Item span={24}>{cronExpressionCard}</Grid.Item>
      </Grid>
    </div>
  );
};

export default ScheduleIntervalV1;
