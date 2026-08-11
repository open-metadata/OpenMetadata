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

import { Select, Typography } from '@openmetadata/ui-core-components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';

interface CronExpressionBuilderProps {
  value?: string;
  onChange?: (cronExpression: string) => void;
  forceDisabled?: boolean;
}

interface CronConfig {
  every: string;
  hour: string;
  minute: string;
}

const DEFAULT_CONFIG: CronConfig = { every: 'Day', hour: '00', minute: '00' };

const DAY_MAP: Record<string, string> = {
  '0': 'Sunday',
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
};

const resolveEvery = (
  hour: string,
  dayOfMonth: string,
  dayOfWeek: string
): string => {
  if (hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
    return 'Hour';
  }
  if (dayOfWeek !== '*' && dayOfMonth === '*') {
    return DAY_MAP[dayOfWeek] || 'Day';
  }
  if (dayOfMonth === '1' && dayOfWeek === '*') {
    return 'Month';
  }
  if (dayOfMonth === '*' && dayOfWeek === '0') {
    return 'Week';
  }

  return 'Day';
};

const parseCronExpression = (cronExpression: string): CronConfig => {
  if (!cronExpression || cronExpression.trim() === '') {
    return DEFAULT_CONFIG;
  }
  try {
    const parts = cronExpression.trim().split(' ');
    if (parts.length !== 5) {
      return DEFAULT_CONFIG;
    }
    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

    return {
      every: resolveEvery(hour, dayOfMonth, dayOfWeek),
      hour: hour === '*' ? '00' : hour.padStart(2, '0'),
      minute: minute === '*' ? '00' : minute.padStart(2, '0'),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
};

const DAY_NUMBERS: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const generateCronExpression = (cronConfig: CronConfig): string => {
  const { every, hour, minute } = cronConfig;

  if (every === 'Hour') {
    return `${minute} * * * *`;
  }
  if (every === 'Week') {
    return `${minute} ${hour} * * 0`;
  }
  if (every === 'Month') {
    return `${minute} ${hour} 1 * *`;
  }
  if (every in DAY_NUMBERS) {
    return `${minute} ${hour} * * ${DAY_NUMBERS[every]}`;
  }

  return `${minute} ${hour} * * *`;
};

const generateDescription = (cronConfig: CronConfig): string => {
  const { every, hour, minute } = cronConfig;
  const hourNum = parseInt(hour);
  const minuteNum = parseInt(minute);
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const displayHour =
    hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
  const timeStr = `${displayHour}:${minute} ${ampm}`;

  if (every === 'Hour') {
    return `At ${minuteNum} minutes past every hour`;
  }
  if (['Day', 'Week', 'Month'].includes(every)) {
    return `At ${timeStr}, every ${every.toLowerCase()}`;
  }

  return `At ${timeStr}, every ${every}`;
};

export const CronExpressionBuilder: React.FC<CronExpressionBuilderProps> = ({
  value = '',
  onChange,
  forceDisabled = false,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const controlsDisabled = isFormDisabled || forceDisabled;

  const [config, setConfig] = useState<CronConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (value) {
      setConfig(parseCronExpression(value));
    }
  }, [value]);

  const handleConfigChange = (field: keyof CronConfig, newValue: string) => {
    const newConfig = { ...config, [field]: newValue };
    setConfig(newConfig);
    onChange?.(generateCronExpression(newConfig));
  };

  const everyOptions = [
    'Hour',
    'Day',
    'Week',
    'Month',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ].map((o) => ({ label: o, value: o }));

  const hourOptions = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, '0')
  ).map((h) => ({ label: h, value: h }));

  const minuteOptions = Array.from({ length: 60 }, (_, i) =>
    i.toString().padStart(2, '0')
  ).map((m) => ({ label: m, value: m }));

  return (
    <>
      <div className="tw:flex tw:gap-4 tw:items-start tw:flex-nowrap">
        <div className="tw:flex-1 tw:min-w-30">
          <Typography
            className="tw:m-0 tw:mb-1 tw:text-tertiary"
            size="text-sm">
            {t('every')}
          </Typography>
          <Select
            isDisabled={controlsDisabled}
            value={config.every}
            onChange={(key) => handleConfigChange('every', String(key ?? ''))}>
            {everyOptions.map((opt) => (
              <Select.Item id={opt.value} key={opt.value} label={opt.label} />
            ))}
          </Select>
        </div>

        {config.every !== 'Hour' && (
          <div className="tw:flex-1 tw:min-w-30">
            <Typography
              className="tw:m-0 tw:mb-1 tw:text-secondary"
              size="text-sm">
              {t('hour')}
            </Typography>
            <Select
              isDisabled={controlsDisabled}
              value={config.hour}
              onChange={(key) => handleConfigChange('hour', String(key ?? ''))}>
              {hourOptions.map((opt) => (
                <Select.Item id={opt.value} key={opt.value} label={opt.label} />
              ))}
            </Select>
          </div>
        )}

        <div className="tw:flex-1 tw:min-w-30">
          <Typography
            className="tw:m-0 tw:mb-1 tw:text-secondary"
            size="text-sm">
            {t('minute')}
          </Typography>
          <Select
            isDisabled={controlsDisabled}
            value={config.minute}
            onChange={(key) => handleConfigChange('minute', String(key ?? ''))}>
            {minuteOptions.map((opt) => (
              <Select.Item id={opt.value} key={opt.value} label={opt.label} />
            ))}
          </Select>
        </div>
      </div>

      <Typography className="tw:m-0 tw:mt-3  tw:text-secondary" size="text-xs">
        {generateDescription(config)}
      </Typography>
    </>
  );
};
