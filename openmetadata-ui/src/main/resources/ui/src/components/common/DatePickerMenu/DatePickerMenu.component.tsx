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
import { Button, Dropdown, MenuProps, Space } from 'antd';
import { SizeType } from 'antd/lib/config-provider/SizeContext';
import classNames from 'classnames';
import { isUndefined, pick } from 'lodash';
import { DateTime } from 'luxon';
import { DateFilterType, DateRangeObject } from 'Models';
import { MenuInfo } from 'rc-menu/lib/interface';
import { useEffect, useMemo, useState } from 'react';
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
import { getPopupContainer } from '../../../utils/formPureUtils';
import { translateWithNestedKeys } from '../../../utils/i18next/LocalUtil';
import MyDatePicker from '../DatePicker/DatePicker';
import './date-picker-menu.less';
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
      setIsMenuOpen(false);
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

  const handleOptionClick = ({ key }: MenuInfo) => {
    const filterRange = menuOptions[key];
    if (isUndefined(filterRange)) {
      return;
    }

    const selectedNumberOfDays = filterRange.days;
    const startTs = getEpochMillisForPastDays(selectedNumberOfDays);

    const endTs = getCurrentMillis();

    setSelectedTimeRange(menuOptions[key].title);
    setSelectedTimeRangeKey(key);
    setIsMenuOpen(false);

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

  const getMenuItems = () => {
    const items: MenuProps['items'] = Object.entries(menuOptions).map(
      ([key, value]) => ({
        label: value.title,
        key,
      })
    );

    allowCustomRange &&
      items.push({
        label: t('label.custom-range'),
        key: CUSTOM_DATE_RANGE_KEY,
        children: [
          {
            label: (
              <MyDatePicker.RangePicker
                allowClear
                bordered={false}
                clearIcon={<CloseCircleOutlined />}
                format={(value) => value.toFormat('yyyy-MM-dd')}
                open={isMenuOpen}
                placement="bottomRight"
                suffixIcon={null}
                onChange={handleCustomDateChange}
              />
            ),
            key: 'datePicker',
          },
        ],
        popupClassName: 'date-picker-sub-menu-popup',
      });

    return items;
  };

  const items: MenuProps['items'] = getMenuItems();

  const datePickerMenu = (
    <Dropdown
      destroyPopupOnHide
      getPopupContainer={getPopupContainer}
      menu={{
        items,
        triggerSubMenuAction: 'click',
        onClick: handleOptionClick,
        selectedKeys: [selectedTimeRangeKey],
      }}
      open={isMenuOpen}
      trigger={['click']}
      onOpenChange={(value) => setIsMenuOpen(value)}>
      <Button
        className={classNames(
          size === 'small' &&
            'tw:inline-flex tw:h-8 tw:min-w-0 tw:items-center tw:justify-center tw:overflow-hidden',
          size === 'small' &&
            (isCustomRangeSelected ? 'tw:max-w-none' : 'tw:max-w-72')
        )}
        data-testid="date-picker-menu"
        size={size}>
        <Space align="center" size={8}>
          <span
            className={classNames(
              'tw:min-w-0',
              isCustomRangeSelected ? 'tw:whitespace-nowrap' : 'tw:truncate',
              !selectedTimeRangeKey && 'tw:text-disabled'
            )}>
            {selectedTimeRange}
          </span>
          <DropdownIcon className="align-middle" height={14} width={14} />
        </Space>
      </Button>
    </Dropdown>
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
          'tw:[&_[data-testid=date-picker-menu]_.ant-space-item:first-child]:pr-6'
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
