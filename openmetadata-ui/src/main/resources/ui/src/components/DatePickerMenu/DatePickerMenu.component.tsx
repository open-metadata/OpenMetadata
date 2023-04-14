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
import { DateRangeObject } from 'components/ProfilerDashboard/component/TestSummary';
import {
  DEFAULT_SELECTED_RANGE,
  PROFILER_FILTER_RANGE,
} from 'constants/profiler.constant';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDaysCount, getTimestampLabel } from 'utils/DatePickerMenuUtils';
import {
  getCurrentDateTimeStamp,
  getPastDatesTimeStampFromCurrentDate,
} from 'utils/TimeUtils';
import { ReactComponent as DropdownIcon } from '../../assets/svg/DropDown.svg';
import './DatePickerMenu.style.less';

interface DatePickerMenuProps {
  showSelectedCustomRange?: boolean;
  handleDateRangeChange: (value: DateRangeObject, days?: number) => void;
}

function DatePickerMenu({
  showSelectedCustomRange,
  handleDateRangeChange,
}: DatePickerMenuProps) {
  const { t } = useTranslation();
  // State to display the label for selected range value
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(
    DEFAULT_SELECTED_RANGE.title
  );
  // state to determine the selected value to highlight in the dropdown
  const [selectedTimeRangeKey, setSelectedTimeRangeKey] = useState<
    keyof typeof PROFILER_FILTER_RANGE
  >(DEFAULT_SELECTED_RANGE.key as keyof typeof PROFILER_FILTER_RANGE);

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const handleCustomDateChange: RangePickerProps['onChange'] = (
    values,
    dateStrings
  ) => {
    if (values) {
      const startTs = Date.parse(dateStrings[0]) / 1000;

      const endTs = Date.parse(dateStrings[1]) / 1000;

      const daysCount = getDaysCount(dateStrings[0], dateStrings[1]);

      const selectedRangeLabel = getTimestampLabel(
        dateStrings[0],
        dateStrings[1],
        showSelectedCustomRange
      );

      setSelectedTimeRange(selectedRangeLabel);
      setSelectedTimeRangeKey(
        'customRange' as keyof typeof PROFILER_FILTER_RANGE
      );
      setIsMenuOpen(false);
      handleDateRangeChange({ startTs, endTs }, daysCount);
    }
  };

  const handleOptionClick = ({ key }: MenuInfo) => {
    const selectedNumberOfDays =
      PROFILER_FILTER_RANGE[key as keyof typeof PROFILER_FILTER_RANGE].days;
    const keyString = key as keyof typeof PROFILER_FILTER_RANGE;
    const startTs = getPastDatesTimeStampFromCurrentDate(selectedNumberOfDays);

    const endTs = getCurrentDateTimeStamp();

    setSelectedTimeRange(PROFILER_FILTER_RANGE[keyString].title);
    setSelectedTimeRangeKey(keyString);
    setIsMenuOpen(false);

    handleDateRangeChange({ startTs, endTs }, selectedNumberOfDays);
  };

  const getMenuItems = () => {
    const items: MenuProps['items'] = Object.entries(PROFILER_FILTER_RANGE).map(
      ([key, value]) => ({
        label: value.title,
        key,
      })
    );
    items.push({
      label: t('label.custom-range'),
      key: 'customRange',
      children: [
        {
          label: (
            <DatePicker.RangePicker
              bordered={false}
              clearIcon={<CloseCircleOutlined />}
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
