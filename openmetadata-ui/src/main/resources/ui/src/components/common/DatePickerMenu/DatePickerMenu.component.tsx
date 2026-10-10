/*
 *  Copyright 2023 Collate.
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
  Dropdown,
  Popover,
  RangeCalendar,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronRight,
  XCircle,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isUndefined, pick } from 'lodash';
import { DateFilterType, DateRangeObject } from 'Models';
import {
  ComponentProps,
  Key,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_SELECTED_RANGE,
  PROFILER_FILTER_RANGE,
} from '../../../constants/profiler.constant';
import { dateValueToMillis } from '../../../utils/date-time/calendarDate.utils';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../utils/date-time/DateTimeUtils';
import {
  CUSTOM_DATE_RANGE_KEY,
  getDaysCount,
  getTimestampLabel,
} from '../../../utils/DatePickerMenuUtils';
import { translateWithNestedKeys } from '../../../utils/i18next/LocalUtil';

type DatePickerMenuSize = 'small' | 'middle' | 'large';

const getTriggerClassName = (
  size: DatePickerMenuSize | undefined,
  isCustomRangeSelected: boolean
) => {
  if (size !== 'small') {
    return undefined;
  }

  return classNames(
    'tw:inline-flex tw:h-8 tw:min-w-0 tw:items-center tw:justify-center tw:overflow-hidden',
    isCustomRangeSelected ? 'tw:max-w-none' : 'tw:max-w-72'
  );
};

const getActiveItemClassName = (isActive: boolean) =>
  isActive ? 'tw:[&>div]:bg-active' : undefined;

interface DatePickerMenuProps {
  allowClear?: boolean;
  defaultDateRange?: Partial<DateRangeObject>;
  showSelectedCustomRange?: boolean;
  handleDateRangeChange?: (value: DateRangeObject, days?: number) => void;
  options?: DateFilterType;
  allowCustomRange?: boolean;
  handleSelectedTimeRange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  size?: DatePickerMenuSize;
}

const DatePickerMenu = ({
  allowClear = false,
  defaultDateRange,
  showSelectedCustomRange,
  handleDateRangeChange,
  handleSelectedTimeRange,
  options,
  allowCustomRange = true,
  onClear,
  placeholder,
  size,
}: DatePickerMenuProps) => {
  const { t } = useTranslation();
  const translatedProfileFilterRange = useMemo(() => {
    return Object.fromEntries(
      Object.entries(PROFILER_FILTER_RANGE).map(([key, value]) => [
        key,
        {
          ...value,
          title: translateWithNestedKeys(value.title, value.titleData),
        },
      ])
    );
  }, [t]);

  const translatedDefaultRange = useMemo(() => {
    return {
      ...DEFAULT_SELECTED_RANGE,
      title: translateWithNestedKeys(
        DEFAULT_SELECTED_RANGE.title,
        DEFAULT_SELECTED_RANGE.titleData
      ),
    };
  }, [t]);
  const { menuOptions, defaultOptions } = useMemo(() => {
    const defaultOptions = placeholder
      ? { key: '', title: placeholder }
      : pick(translatedDefaultRange, ['title', 'key']);

    if (defaultDateRange?.key) {
      defaultOptions.key = defaultDateRange.key;
      if (
        defaultDateRange.key === CUSTOM_DATE_RANGE_KEY &&
        defaultDateRange.title
      ) {
        defaultOptions.title = defaultDateRange.title;
      } else if (
        options &&
        !isUndefined(options[defaultDateRange.key]?.title)
      ) {
        defaultOptions.title = options[defaultDateRange.key].title;
      } else if (
        !isUndefined(translatedProfileFilterRange[defaultDateRange.key]?.title)
      ) {
        defaultOptions.title =
          translatedProfileFilterRange[defaultDateRange.key].title;
      }
    }

    return {
      menuOptions: options ?? translatedProfileFilterRange,
      defaultOptions,
    };
  }, [
    defaultDateRange,
    options,
    placeholder,
    translatedDefaultRange,
    translatedProfileFilterRange,
  ]);
  const { key: defaultTimeRangeKey, title: defaultTimeRangeTitle } =
    defaultOptions;

  // State to display the label for selected range value
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(
    defaultTimeRangeTitle
  );
  // state to determine the selected value to highlight in the dropdown
  const [selectedTimeRangeKey, setSelectedTimeRangeKey] =
    useState<string>(defaultTimeRangeKey);
  const isCustomRangeSelected = selectedTimeRangeKey === CUSTOM_DATE_RANGE_KEY;

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isCustomRangeOpen, setIsCustomRangeOpen] = useState<boolean>(false);
  const customRangeTriggerRef = useRef<HTMLDivElement>(null);

  const handleMenuOpenChange = (open: boolean) => {
    setIsMenuOpen(open);
    if (!open) {
      setIsCustomRangeOpen(false);
    }
  };

  useEffect(() => {
    setSelectedTimeRange(defaultTimeRangeTitle);
    setSelectedTimeRangeKey(defaultTimeRangeKey);
  }, [defaultTimeRangeKey, defaultTimeRangeTitle]);

  const handleCustomDateChange: NonNullable<
    ComponentProps<typeof RangeCalendar>['onChange']
  > = (values) => {
    if (!values) {
      return;
    }
    const startDate = values.start.toString();
    const endDate = values.end.toString();
    const selectedRangeLabel = getTimestampLabel(
      startDate,
      endDate,
      showSelectedCustomRange
    );
    setSelectedTimeRange(selectedRangeLabel);
    setSelectedTimeRangeKey(CUSTOM_DATE_RANGE_KEY);
    handleMenuOpenChange(false);
    handleDateRangeChange?.(
      {
        startTs: dateValueToMillis(values.start),
        endTs: dateValueToMillis(values.end.add({ days: 1 })) - 1,
        key: CUSTOM_DATE_RANGE_KEY,
        title: selectedRangeLabel,
      },
      getDaysCount(startDate, endDate)
    );
    handleSelectedTimeRange?.(selectedRangeLabel);
  };

  const handleOptionClick = (menuKey: Key) => {
    const key = String(menuKey);
    if (key === CUSTOM_DATE_RANGE_KEY) {
      setIsCustomRangeOpen(true);

      return;
    }

    const filterRange = menuOptions[key];
    if (isUndefined(filterRange)) {
      return;
    }

    const selectedNumberOfDays = filterRange.days;
    const startTs = getEpochMillisForPastDays(selectedNumberOfDays);

    const endTs = getCurrentMillis();

    setSelectedTimeRange(menuOptions[key].title);
    setSelectedTimeRangeKey(key);
    handleMenuOpenChange(false);

    handleDateRangeChange?.(
      { startTs, endTs, key, title: filterRange.title },
      selectedNumberOfDays
    );
    handleSelectedTimeRange?.(menuOptions[key].title);
  };

  const handleClear = () => {
    setSelectedTimeRange(
      placeholder ?? t('label.select-entity', { entity: t('label.date') })
    );
    setSelectedTimeRangeKey('');
    setIsMenuOpen(false);
    onClear?.();
  };

  const datePickerMenu = (
    <Dropdown.Root isOpen={isMenuOpen} onOpenChange={handleMenuOpenChange}>
      <Button
        className={getTriggerClassName(size, isCustomRangeSelected)}
        color="secondary"
        data-testid="date-picker-menu"
        iconTrailing={<ChevronDown size={14} />}
        size={size === 'small' ? 'sm' : 'md'}>
        <span
          className={classNames(
            'tw:min-w-0',
            isCustomRangeSelected ? 'tw:whitespace-nowrap' : 'tw:truncate',
            !selectedTimeRangeKey && 'tw:text-disabled'
          )}>
          {selectedTimeRange}
        </span>
      </Button>
      <Dropdown.Popover
        className="tw:w-auto tw:min-w-44 tw:overflow-visible"
        placement="bottom start">
        <Dropdown.Menu
          aria-label={selectedTimeRange}
          selectionMode="none"
          onAction={handleOptionClick}>
          {Object.entries(menuOptions).map(([key, value]) => (
            <Dropdown.Item
              className={getActiveItemClassName(key === selectedTimeRangeKey)}
              id={key}
              key={key}
              label={value.title}
            />
          ))}
          {allowCustomRange && (
            <Dropdown.Item
              className={getActiveItemClassName(isCustomRangeSelected)}
              id={CUSTOM_DATE_RANGE_KEY}
              shouldCloseOnSelect={false}
              textValue={t('label.custom-range')}>
              <Box
                align="center"
                gap={2}
                justify="between"
                ref={customRangeTriggerRef}>
                {t('label.custom-range')}
                <ChevronRight className="tw:text-fg-quaternary" size={14} />
              </Box>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
        {isCustomRangeOpen && (
          <Popover
            isOpen
            aria-label={t('label.custom-range')}
            placement="left bottom"
            triggerRef={customRangeTriggerRef}
            onOpenChange={setIsCustomRangeOpen}>
            <RangeCalendar
              aria-label={t('label.custom-range')}
              firstDayOfWeek="mon"
              onChange={handleCustomDateChange}
            />
          </Popover>
        )}
      </Dropdown.Popover>
    </Dropdown.Root>
  );

  if (!allowClear) {
    return datePickerMenu;
  }

  return (
    <Box
      align="center"
      className={classNames(
        'tw:relative tw:inline-flex tw:h-8 tw:items-center',
        isCustomRangeSelected ? 'tw:max-w-none' : 'tw:max-w-80',
        selectedTimeRangeKey &&
          'tw:[&_[data-testid=date-picker-menu]>span:first-of-type]:pr-6'
      )}
      data-testid="date-picker-container">
      {datePickerMenu}
      {selectedTimeRangeKey && (
        <Button
          aria-label={t('label.clear')}
          className="tw:absolute tw:right-8 tw:top-1/2 tw:z-10 tw:-translate-y-1/2"
          color="tertiary"
          data-testid="clear-date-picker"
          iconLeading={XCircle}
          size="xxs"
          onPress={handleClear}
        />
      )}
    </Box>
  );
};

export default DatePickerMenu;
