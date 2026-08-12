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

import { Button, Dropdown, Typography } from '@openmetadata/ui-core-components';
import { DateTime } from 'luxon';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Calendar } from '../../../assets/svg/calendar.svg';
import { ReactComponent as DropdownIcon } from '../../../assets/svg/drop-down.svg';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../utils/date-time/DateTimeUtils';
import MyDatePicker from '../../common/DatePicker/DatePicker';
import {
  LineageTimeFilterProps,
  LineageTimePresetKey,
} from './LineageTimeFilter.interface';

const PRESET_DAYS: Record<
  Exclude<
    LineageTimePresetKey,
    | LineageTimePresetKey.AllTime
    | LineageTimePresetKey.CustomRange
    | LineageTimePresetKey.PointInTime
  >,
  number
> = {
  [LineageTimePresetKey.Last7Days]: 7,
  [LineageTimePresetKey.Last14Days]: 14,
  [LineageTimePresetKey.Last28Days]: 28,
};

const LineageTimeFilter: FC<LineageTimeFilterProps> = ({
  endTime,
  startTime,
  onChange,
}) => {
  const { i18n, t } = useTranslation();
  const [showCustomRange, setShowCustomRange] = useState<boolean>(false);
  const [showPointInTime, setShowPointInTime] = useState<boolean>(false);

  const matchedPresetDays = useMemo<number | null>(() => {
    if (startTime === undefined || endTime === undefined) {
      return null;
    }
    const now = getCurrentMillis();
    if (Math.abs(endTime - now) > 24 * 60 * 60 * 1000) {
      return null;
    }
    const presetValues = Object.values(PRESET_DAYS);
    const span = endTime - startTime;
    const matchTolerance = 60 * 60 * 1000;
    const match = presetValues.find(
      (days) => Math.abs(span - days * 24 * 60 * 60 * 1000) <= matchTolerance
    );

    return match ?? null;
  }, [startTime, endTime]);

  const isPointInTime = useMemo<boolean>(
    () => startTime === undefined && endTime !== undefined,
    [startTime, endTime]
  );

  const triggerLabel = useMemo<string>(() => {
    if (startTime === undefined && endTime === undefined) {
      return t('label.all-time');
    }
    if (matchedPresetDays !== null) {
      return t('label.last-n-days', { count: matchedPresetDays });
    }
    if (isPointInTime && endTime !== undefined) {
      return t('label.as-of-date', {
        date: DateTime.fromMillis(endTime)
          .setLocale(i18n.language)
          .toFormat('LLL d, yyyy'),
      });
    }
    const formatPart = (ts?: number) =>
      ts === undefined
        ? ''
        : DateTime.fromMillis(ts)
            .setLocale(i18n.language)
            .toFormat('LLL d, yyyy');
    const startLabel = formatPart(startTime);
    const endLabel = formatPart(endTime);

    return `${startLabel} – ${endLabel}`.trim();
  }, [startTime, endTime, matchedPresetDays, isPointInTime, i18n.language, t]);

  const handlePresetSelect = useCallback(
    (key: string) => {
      if (key === LineageTimePresetKey.AllTime) {
        onChange({ startTime: undefined, endTime: undefined });

        return;
      }
      if (key === LineageTimePresetKey.CustomRange) {
        setShowCustomRange(true);

        return;
      }
      if (key === LineageTimePresetKey.PointInTime) {
        setShowPointInTime(true);

        return;
      }
      const days = PRESET_DAYS[key as keyof typeof PRESET_DAYS];
      if (days !== undefined) {
        onChange({
          startTime: getEpochMillisForPastDays(days),
          endTime: getCurrentMillis(),
        });
      }
    },
    [onChange]
  );

  const handleCustomChange = useCallback(
    (values: [DateTime | null, DateTime | null] | null) => {
      if (!values) {
        onChange({ startTime: undefined, endTime: undefined });
        setShowCustomRange(false);

        return;
      }
      const start = values[0]?.startOf('day').toMillis();
      const end = values[1]?.endOf('day').toMillis();
      onChange({ startTime: start, endTime: end });
      setShowCustomRange(false);
    },
    [onChange]
  );

  const handlePointInTimeChange = useCallback(
    (value: DateTime | null) => {
      if (!value) {
        onChange({ startTime: undefined, endTime: undefined });
        setShowPointInTime(false);

        return;
      }
      onChange({
        startTime: undefined,
        endTime: value.endOf('day').toMillis(),
      });
      setShowPointInTime(false);
    },
    [onChange]
  );

  const presetItems = useMemo(
    () => [
      {
        key: LineageTimePresetKey.AllTime,
        label: t('label.all-time'),
      },
      {
        key: LineageTimePresetKey.Last7Days,
        label: t('label.last-n-days', { count: 7 }),
      },
      {
        key: LineageTimePresetKey.Last14Days,
        label: t('label.last-n-days', { count: 14 }),
      },
      {
        key: LineageTimePresetKey.Last28Days,
        label: t('label.last-n-days', { count: 28 }),
      },
      {
        key: LineageTimePresetKey.CustomRange,
        label: t('label.custom-range'),
      },
      {
        key: LineageTimePresetKey.PointInTime,
        label: t('label.point-in-time'),
      },
    ],
    [t]
  );

  const activeKey = useMemo<string>(() => {
    if (startTime === undefined && endTime === undefined) {
      return LineageTimePresetKey.AllTime;
    }
    if (matchedPresetDays === 7) {
      return LineageTimePresetKey.Last7Days;
    }
    if (matchedPresetDays === 14) {
      return LineageTimePresetKey.Last14Days;
    }
    if (matchedPresetDays === 28) {
      return LineageTimePresetKey.Last28Days;
    }
    if (isPointInTime) {
      return LineageTimePresetKey.PointInTime;
    }

    return LineageTimePresetKey.CustomRange;
  }, [startTime, endTime, matchedPresetDays, isPointInTime]);

  return (
    <div className="tw:flex tw:items-center tw:gap-2">
      <Dropdown.Root>
        <Button
          aria-label={t('label.lineage-time-filter')}
          className="tw:px-3.5 tw:py-2.5"
          color="tertiary"
          data-testid="lineage-time-filter">
          <div className="tw:flex tw:items-center tw:gap-1">
            <Calendar height={16} width={16} />
            <Typography as="span" className="tw:font-normal">
              {triggerLabel}
            </Typography>
            <DropdownIcon height={12} width={12} />
          </div>
        </Button>
        <Dropdown.Popover className="tw:min-w-44">
          <Dropdown.Menu
            aria-label={t('label.lineage-time-filter')}
            onAction={(key) => handlePresetSelect(String(key))}>
            {presetItems.map((item) => (
              <Dropdown.Item
                className={
                  activeKey === item.key ? 'tw:text-brand-600' : undefined
                }
                id={item.key}
                key={item.key}>
                {item.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      {showCustomRange && (
        <MyDatePicker.RangePicker
          allowClear
          data-testid="lineage-time-filter-range"
          format={(value) => value.toFormat('yyyy-LL-dd')}
          open={showCustomRange}
          placement="bottomRight"
          value={
            startTime !== undefined && endTime !== undefined
              ? [DateTime.fromMillis(startTime), DateTime.fromMillis(endTime)]
              : null
          }
          onChange={handleCustomChange}
          onOpenChange={(open) => setShowCustomRange(open)}
        />
      )}
      {showPointInTime && (
        <MyDatePicker
          allowClear
          data-testid="lineage-time-filter-point"
          format={(value) => value.toFormat('yyyy-LL-dd')}
          open={showPointInTime}
          placement="bottomRight"
          value={
            isPointInTime && endTime !== undefined
              ? DateTime.fromMillis(endTime)
              : null
          }
          onChange={handlePointInTimeChange}
          onOpenChange={(open) => setShowPointInTime(open)}
        />
      )}
    </div>
  );
};

export default LineageTimeFilter;
