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

import { CloseCircleFilled, CloseCircleOutlined } from '@ant-design/icons';
import {
  Button as CoreButton,
  Dropdown,
} from '@openmetadata/ui-core-components';
import { ChevronRight } from '@openmetadata/ui-core-components/icons';
import { Button } from 'antd';
import { SizeType } from 'antd/lib/config-provider/SizeContext';
import classNames from 'classnames';
import { isUndefined, pick } from 'lodash';
import { DateTime } from 'luxon';
import { DateFilterType, DateRangeObject } from 'Models';
import { Key, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropdownIcon } from '../../../assets/svg/drop-down.svg';
import {
  DEFAULT_SELECTED_RANGE,
  PROFILER_FILTER_RANGE,
} from '../../../constants/profiler.constant';
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
import MyDatePicker from '../DatePicker/DatePicker';

const getTriggerClassName = (
  size: SizeType,
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
  size?: SizeType;
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
  // The range picker's panel renders inside the menu popover, so picking dates
  // is not treated as an interaction outside the menu.
  const customRangeContainerRef = useRef<HTMLDivElement>(null);

  const getCustomRangeContainer = () =>
    customRangeContainerRef.current ?? document.body;

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

  const handleCustomDateChange = (
    values: [start: DateTime | null, end: DateTime | null] | null,
    dateStrings: [string, string]
  ) => {
    if (values) {
      const startTs = values[0]?.startOf('day').valueOf() ?? 0;

      const endTs = values[1]?.endOf('day').valueOf() ?? 0;

      const daysCount = getDaysCount(dateStrings[0], dateStrings[1]);

      const selectedRangeLabel = getTimestampLabel(
        dateStrings[0],
        dateStrings[1],
        showSelectedCustomRange
      );

      setSelectedTimeRange(selectedRangeLabel);
      setSelectedTimeRangeKey(CUSTOM_DATE_RANGE_KEY);
      handleMenuOpenChange(false);
      handleDateRangeChange?.(
        {
          startTs,
          endTs,
          key: CUSTOM_DATE_RANGE_KEY,
          title: selectedRangeLabel,
        },
        daysCount
      );
      handleSelectedTimeRange?.(selectedRangeLabel);
    }
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
      <CoreButton
        className={getTriggerClassName(size, isCustomRangeSelected)}
        color="secondary"
        data-testid="date-picker-menu"
        iconTrailing={<DropdownIcon height={14} width={14} />}
        size={size === 'small' ? 'sm' : 'md'}>
        <span
          className={classNames(
            'tw:min-w-0',
            isCustomRangeSelected ? 'tw:whitespace-nowrap' : 'tw:truncate',
            !selectedTimeRangeKey && 'tw:text-disabled'
          )}>
          {selectedTimeRange}
        </span>
      </CoreButton>
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
              <span className="tw:flex tw:items-center tw:justify-between tw:gap-2">
                {t('label.custom-range')}
                <ChevronRight className="tw:text-fg-quaternary" size={14} />
              </span>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
        {isCustomRangeOpen && (
          // Zero-size anchor beside the Custom Range row: the picker's input stays
          // hidden and only its calendar panel shows, opening to the menu's left
          // the way the antd submenu did.
          <div
            className="tw:absolute tw:right-full tw:bottom-10 tw:mr-1 tw:size-0"
            ref={customRangeContainerRef}>
            <MyDatePicker.RangePicker
              allowClear
              open
              bordered={false}
              className="tw:pointer-events-none tw:size-0 tw:overflow-hidden tw:p-0 tw:opacity-0"
              clearIcon={<CloseCircleOutlined />}
              format={(value) => value.toFormat('yyyy-MM-dd')}
              getPopupContainer={getCustomRangeContainer}
              placement="bottomRight"
              suffixIcon={null}
              onChange={handleCustomDateChange}
            />
          </div>
        )}
      </Dropdown.Popover>
    </Dropdown.Root>
  );

  if (!allowClear) {
    return datePickerMenu;
  }

  return (
    <div
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
          className={classNames(
            'tw:absolute! tw:right-8 tw:top-1/2 tw:z-10 tw:inline-flex! tw:size-4!',
            'tw:min-w-0 tw:-translate-y-1/2 tw:items-center tw:justify-center',
            'tw:border-0 tw:bg-transparent tw:p-0! tw:text-disabled tw:shadow-none',
            'tw:hover:bg-transparent tw:hover:text-secondary'
          )}
          data-testid="clear-date-picker"
          icon={<CloseCircleFilled />}
          size="small"
          type="text"
          onClick={(event) => {
            event.stopPropagation();
            handleClear();
          }}
        />
      )}
    </div>
  );
};

export default DatePickerMenu;
