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

import { InfoCircleOutlined } from '@ant-design/icons';
import { Card, Col, Input, Radio, Row, Typography } from 'antd';
import { Select } from '../../../../common/AntdCompat';;
import cronstrue from 'cronstrue/i18n';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClockIcon } from '../../../../../assets/svg/calender-v1.svg';
import { ReactComponent as PlayIcon } from '../../../../../assets/svg/trigger.svg';
import {
  DAY_IN_MONTH_OPTIONS,
  DAY_OPTIONS,
  PERIOD_OPTIONS,
} from '../../../../../constants/Schedular.constants';
import { SchedularOptions } from '../../../../../enums/Schedular.enum';
import { getPopupContainer } from '../../../../../utils/formUtils';
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

  const {
    showMinuteSelect,
    showHourSelect,
    showWeekSelect,
    showMonthSelect,
    minuteCol,
    hourCol,
    weekCol,
    monthCol,
  } = useMemo(() => {
    const isHourSelected = selectedPeriod === 'hour';
    const isDaySelected = selectedPeriod === 'day';
    const isWeekSelected = selectedPeriod === 'week';
    const isMonthSelected = selectedPeriod === 'month';
    const showMinuteSelect =
      isHourSelected || isDaySelected || isWeekSelected || isMonthSelected;
    const showHourSelect = isDaySelected || isWeekSelected || isMonthSelected;
    const showWeekSelect = isWeekSelected;
    const showMonthSelect = isMonthSelected;
    const minuteCol = isHourSelected ? 12 : 6;

    return {
      showMinuteSelect,
      showHourSelect,
      showWeekSelect,
      showMonthSelect,
      minuteCol: showMinuteSelect ? minuteCol : 0,
      hourCol: showHourSelect ? 6 : 0,
      weekCol: showWeekSelect ? 24 : 0,
      monthCol: showMonthSelect ? 24 : 0,
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

  const filteredPeriodOptions = useMemo(() => {
    if (includePeriodOptions) {
      return PERIOD_OPTIONS.filter((option) =>
        includePeriodOptions.includes(option.value)
      );
    } else {
      return PERIOD_OPTIONS;
    }
  }, [includePeriodOptions]);

  const cronExpressionCard = useMemo(() => {
    const cronStringValue = cronString
      ? t('label.entity-scheduled-to-run-value', {
          entity: entity ?? t('label.ingestion'),
          value: cronstrue.toString(cronString, {
            use24HourTimeFormat: false,
            verbose: true,
            locale: getCurrentLocaleForConstrue(),
            throwExceptionOnParseError: false,
          }),
        })
      : t('message.pipeline-will-trigger-manually');

    return (
      <Card className="cron-expression-card">
        <div className="cron-expression-card-icon">
          <InfoCircleOutlined />
        </div>
        <Typography.Text className="expression-text">
          {cronStringValue}
        </Typography.Text>
      </Card>
    );
  }, [cronString, entity]);

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
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <SelectionCardGroup
            options={SCHEDULE_OPTIONS}
            value={selectedSchedular}
            onChange={(value) =>
              !disabled && handleSelectedSchedular(value as SchedularOptions)
            }
          />
        </Col>
        {selectedSchedular === SchedularOptions.SCHEDULE && (
          <Col span={24}>
            <Row data-testid="cron-container" gutter={[16, 16]}>
              <Col data-testid="time-dropdown-container" span={12}>
                <label>{t('label.every')}</label>
                <Select
                  className="w-full m-t-xs"
                  data-testid="cron-type"
                  disabled={disabled}
                  getPopupContainer={getPopupContainer}
                  options={filteredPeriodOptions.map(
                    ({ label, value: optionValue }) => ({
                      label,
                      value: optionValue,
                    })
                  )}
                  value={selectedPeriod}
                  onChange={(selectedPeriodValue) =>
                    handleStateChange({ selectedPeriod: selectedPeriodValue })
                  }
                />
              </Col>

              {selectedPeriod === 'custom' && (
                <Col span={12}>
                  <label>{t('label.cron')}</label>
                  <Input
                    className="m-t-xs"
                    disabled={disabled}
                    placeholder={t('label.please-enter-value', {
                      name: t('label.cron'),
                    })}
                    value={state.cron}
                    onChange={(e) => {
                      const cronValue = e.target.value;
                      setState((prev) => ({ ...prev, cron: cronValue }));
                      onChange?.(cronValue);
                    }}
                  />
                </Col>
              )}

              {showHourSelect && (
                <Col span={hourCol}>
                  <label>{t('label.hour')}</label>
                  <Select
                    className="w-full m-t-xs"
                    disabled={disabled}
                    getPopupContainer={getPopupContainer}
                    options={Array.from({ length: 24 }, (_, i) => ({
                      label: i.toString().padStart(2, '0'),
                      value: i,
                    }))}
                    value={state.hour}
                    onChange={(hour) => handleStateChange({ hour })}
                  />
                </Col>
              )}

              {showMinuteSelect && (
                <Col span={minuteCol}>
                  <label>{t('label.minute')}</label>
                  <Select
                    className="w-full m-t-xs"
                    disabled={disabled}
                    getPopupContainer={getPopupContainer}
                    options={Array.from({ length: 60 }, (_, i) => ({
                      label: i.toString().padStart(2, '0'),
                      value: i,
                    }))}
                    value={state.min}
                    onChange={(min) => handleStateChange({ min })}
                  />
                </Col>
              )}

              {showWeekSelect && (
                <Col span={weekCol}>
                  <label>{t('label.day')}</label>
                  <Radio.Group
                    buttonStyle="solid"
                    className="d-flex gap-2 m-t-xs"
                    disabled={disabled}
                    value={dow}
                    onChange={(e) =>
                      handleStateChange({ dow: e.target.value })
                    }>
                    {DAY_OPTIONS.map(({ label, value: optionValue }) => (
                      <Radio.Button
                        className="week-selector-buttons"
                        disabled={disabled}
                        key={`${label}-${optionValue}`}
                        value={optionValue}>
                        {label[0]}
                      </Radio.Button>
                    ))}
                  </Radio.Group>
                </Col>
              )}

              {showMonthSelect && (
                <Col span={monthCol}>
                  <label>{t('label.date')}</label>
                  <Radio.Group
                    buttonStyle="solid"
                    className="d-flex flex-wrap gap-2 m-t-xs"
                    disabled={disabled}
                    value={dom}
                    onChange={(e) =>
                      handleStateChange({ dom: e.target.value })
                    }>
                    {DAY_IN_MONTH_OPTIONS.map(
                      ({ label, value: optionValue }) => (
                        <Radio.Button
                          className="week-selector-buttons"
                          disabled={disabled}
                          key={`day-${label}-${optionValue}`}
                          value={optionValue}>
                          {label}
                        </Radio.Button>
                      )
                    )}
                  </Radio.Group>
                </Col>
              )}
            </Row>
          </Col>
        )}

        <Col span={24}>{cronExpressionCard}</Col>
      </Row>
    </div>
  );
};

export default ScheduleIntervalV1;
