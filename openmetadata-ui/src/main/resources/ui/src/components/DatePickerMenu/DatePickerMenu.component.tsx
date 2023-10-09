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

import { CloseCircleOutlined } from '@ant-design/icons';
import { Button, DatePicker, Dropdown, MenuProps, Space } from 'antd';
import { RangePickerProps } from 'antd/lib/date-picker';
import { isUndefined } from 'lodash';
import { DateFilterType } from 'Models';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ReactComponent as DropdownIcon } from '../../assets/svg/DropDown.svg';
import { DateRangeObject } from '../../components/ProfilerDashboard/component/TestSummary';
import {
  DEFAULT_SELECTED_RANGE,
  PROFILER_FILTER_RANGE,
} from '../../constants/profiler.constant';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../utils/date-time/DateTimeUtils';
import {
  getDaysCount,
  getTimestampLabel,
} from '../../utils/DatePickerMenuUtils';
import './DatePickerMenu.style.less';

interface DatePickerMenuProps {
  showSelectedCustomRange?: boolean;
  handleDateRangeChange: (value: DateRangeObject, days?: number) => void;
  options?: DateFilterType;
  defaultValue?: string;
  allowCustomRange?: boolean;
}

function DatePickerMenu({
  showSelectedCustomRange,
  handleDateRangeChange,
  options,
  defaultValue,
  allowCustomRange = true,
}: DatePickerMenuProps) {
  const { menuOptions, defaultOptions } = useMemo(() => {
    let defaultOptions = DEFAULT_SELECTED_RANGE;

    if (defaultValue) {
      if (options && !isUndefined(options[defaultValue]?.title)) {
        defaultOptions = {
          title: options[defaultValue].title,
          key: defaultValue,
          days: options[defaultValue].days,
        };
      } else if (
        !isUndefined(
          PROFILER_FILTER_RANGE[defaultValue as keyof DateFilterType]?.title
        )
      ) {
        defaultOptions = {
          title: PROFILER_FILTER_RANGE[defaultValue].title,
          key: defaultValue,
          days: PROFILER_FILTER_RANGE[defaultValue].days,
        };
      }
    }

    return {
      menuOptions: options ?? PROFILER_FILTER_RANGE,
      defaultOptions,
    };
  }, [options]);

  const { t } = useTranslation();
  // State to display the label for selected range value
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(
    defaultOptions.title
  );
  // state to determine the selected value to highlight in the dropdown
  const [selectedTimeRangeKey, setSelectedTimeRangeKey] = useState<string>(
    defaultOptions.key
  );

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const handleCustomDateChange: RangePickerProps['onChange'] = (
    values,
    dateStrings
  ) => {
    if (values) {
      const startTs = (values[0]?.set({ h: 0, m: 0 }).utc().unix() ?? 0) * 1000;

      const endTs = (values[1]?.set({ h: 23, m: 59 }).utc().unix() ?? 0) * 1000;

      const daysCount = getDaysCount(dateStrings[0], dateStrings[1]);

      const selectedRangeLabel = getTimestampLabel(
        dateStrings[0],
        dateStrings[1],
        showSelectedCustomRange
      );

      setSelectedTimeRange(selectedRangeLabel);
      setSelectedTimeRangeKey('customRange');
      setIsMenuOpen(false);
      handleDateRangeChange({ startTs, endTs }, daysCount);
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

    handleDateRangeChange({ startTs, endTs }, selectedNumberOfDays);
  };

  const getMenuItems = () => {
    const items: MenuProps['items'] = Object.entries(menuOptions).map(
      ([key, value]) => ({
        label: value.title,
        key,
      })
    );
    {
      allowCustomRange &&
        items.push({
          label: t('label.custom-range'),
          key: 'customRange',
          children: [
            {
              label: (
                <DatePicker.RangePicker
                  bordered={false}
                  clearIcon={<CloseCircleOutlined />}
                  format={(value) => value.utc().format('YYYY-MM-DD')}
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
    }

    return items;
  };

  const items: MenuProps['items'] = getMenuItems();

  return (
    <>
      <Dropdown
        destroyPopupOnHide
        menu={{
          items,
          triggerSubMenuAction: 'click',
          onClick: handleOptionClick,
          selectedKeys: [selectedTimeRangeKey],
        }}
        open={isMenuOpen}
        trigger={['click']}
        onOpenChange={(value) => setIsMenuOpen(value)}>
        <Button>
          <Space align="center" size={8}>
            {selectedTimeRange}
            <DropdownIcon height={14} width={14} />
          </Space>
        </Button>
      </Dropdown>
    </>
  );
}

export default DatePickerMenu;
