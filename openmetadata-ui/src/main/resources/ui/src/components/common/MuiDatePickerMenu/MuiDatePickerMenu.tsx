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
import { CloseCircleOutlined } from '@ant-design/icons';
import { KeyboardArrowDown } from '@mui/icons-material';
import { Box, Button, Divider, Menu, MenuItem, useTheme } from '@mui/material';
import { isUndefined, pick } from 'lodash';
import { DateTime } from 'luxon';
import { DateFilterType, DateRangeObject } from 'Models';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_SELECTED_RANGE,
  PROFILER_FILTER_RANGE,
} from '../../../constants/profiler.constant';
import {
  getCurrentDayEndGMTinMillis,
  getDayAgoStartGMTinMillis,
} from '../../../utils/date-time/DateTimeUtils';
import {
  getDaysCount,
  getTimestampLabel,
} from '../../../utils/DatePickerMenuUtils';
import MyDatePicker from '../DatePicker/DatePicker';

interface MuiDatePickerMenuProps {
  defaultDateRange?: Partial<DateRangeObject>;
  showSelectedCustomRange?: boolean;
  handleDateRangeChange?: (value: DateRangeObject, days?: number) => void;
  options?: DateFilterType;
  allowCustomRange?: boolean;
  handleSelectedTimeRange?: (value: string) => void;
  size?: 'small' | 'medium' | 'large';
}

const BUTTON_HEIGHTS = {
  small: '32px',
  medium: '36px',
  large: '40px',
} as const;

const MuiDatePickerMenu = ({
  defaultDateRange,
  showSelectedCustomRange,
  handleDateRangeChange,
  handleSelectedTimeRange,
  options,
  allowCustomRange = true,
  size = 'medium',
}: MuiDatePickerMenuProps) => {
  const theme = useTheme();

  const { menuOptions, defaultOptions } = useMemo(() => {
    const defaultOpts = pick(DEFAULT_SELECTED_RANGE, ['title', 'key']);

    if (defaultDateRange?.key) {
      defaultOpts.key = defaultDateRange.key;
      if (defaultDateRange.key === 'customRange' && defaultDateRange.title) {
        defaultOpts.title = defaultDateRange.title;
      } else if (
        options &&
        !isUndefined(options[defaultDateRange.key]?.title)
      ) {
        defaultOpts.title = options[defaultDateRange.key].title;
      } else if (
        !isUndefined(PROFILER_FILTER_RANGE[defaultDateRange.key]?.title)
      ) {
        defaultOpts.title = PROFILER_FILTER_RANGE[defaultDateRange.key].title;
      }
    }

    return {
      menuOptions: options ?? PROFILER_FILTER_RANGE,
      defaultOptions: defaultOpts,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(
    defaultOptions.title
  );
  const [selectedTimeRangeKey, setSelectedTimeRangeKey] = useState<string>(
    defaultOptions.key
  );
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const menuItemStyles = useMemo(
    () => ({
      '&.Mui-selected': {
        '&:hover': {
          backgroundColor: theme.palette.primary.dark,
        },
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
      },
    }),
    [theme.palette.primary]
  );

  const customRangeMenuItemStyles = useMemo(
    () => ({
      ...menuItemStyles,
      '&.Mui-selected': {
        ...menuItemStyles['&.Mui-selected'],
        '& .ant-picker-input > input': {
          color: theme.palette.primary.contrastText,
        },
      },
      p: 0,
    }),
    [menuItemStyles, theme.palette.primary.contrastText]
  );

  const handleMenuClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget);
    },
    []
  );

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handlePresetRangeClick = useCallback(
    (key: string) => {
      const filterRange = menuOptions[key];
      if (isUndefined(filterRange)) {
        return;
      }

      const selectedNumberOfDays = filterRange.days;
      const startTs = getDayAgoStartGMTinMillis(selectedNumberOfDays);
      const endTs = getCurrentDayEndGMTinMillis();

      setSelectedTimeRange(filterRange.title);
      setSelectedTimeRangeKey(key);
      setAnchorEl(null);

      handleDateRangeChange?.(
        { startTs, endTs, key, title: filterRange.title },
        selectedNumberOfDays
      );
      handleSelectedTimeRange?.(filterRange.title);
    },
    [menuOptions, handleDateRangeChange, handleSelectedTimeRange]
  );

  const handleCustomDateChange = useCallback(
    (
      values: [start: DateTime | null, end: DateTime | null] | null,
      dateStrings: [string, string]
    ) => {
      if (!values) {
        return;
      }

      const startTs = values[0]?.startOf('day').valueOf() ?? 0;
      const endTs = values[1]?.endOf('day').valueOf() ?? 0;
      const daysCount = getDaysCount(dateStrings[0], dateStrings[1]);
      const selectedRangeLabel = getTimestampLabel(
        dateStrings[0],
        dateStrings[1],
        showSelectedCustomRange
      );

      setSelectedTimeRange(selectedRangeLabel);
      setSelectedTimeRangeKey('customRange');
      setAnchorEl(null);

      handleDateRangeChange?.(
        {
          startTs,
          endTs,
          key: 'customRange',
          title: selectedRangeLabel,
        },
        daysCount
      );
      handleSelectedTimeRange?.(selectedRangeLabel);
    },
    [handleDateRangeChange, handleSelectedTimeRange, showSelectedCustomRange]
  );

  return (
    <>
      <Button
        data-testid="mui-date-picker-menu"
        endIcon={<KeyboardArrowDown />}
        size={size}
        sx={{
          height: BUTTON_HEIGHTS[size],
          textTransform: 'none',
          color: theme.palette.grey[900],
          fontWeight: 600,
          fontSize: theme.typography.pxToRem(12),
          boxShadow: 'none',
          border: `1px solid ${theme.palette.grey[200]}`,
          '&:hover': {
            border: `1px solid ${theme.palette.grey[200]}`,
            boxShadow: 'none',
          },
        }}
        variant="outlined"
        onClick={handleMenuClick}>
        {selectedTimeRange}
      </Button>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          horizontal: 'right',
          vertical: 'bottom',
        }}
        open={Boolean(anchorEl)}
        sx={{
          '.MuiPaper-root': {
            maxHeight: '500px',
            minWidth: '280px',
          },
        }}
        transformOrigin={{
          horizontal: 'right',
          vertical: 'top',
        }}
        onClose={handleMenuClose}>
        {Object.entries(menuOptions).map(([key, value]) => (
          <MenuItem
            data-testid={`date-range-option-${key}`}
            key={key}
            selected={selectedTimeRangeKey === key}
            sx={menuItemStyles}
            onClick={() => handlePresetRangeClick(key)}>
            {value.title}
          </MenuItem>
        ))}

        {allowCustomRange && (
          <>
            <Divider sx={{ my: 1 }} />
            <MenuItem
              data-testid="custom-range-option"
              selected={selectedTimeRangeKey === 'customRange'}
              sx={customRangeMenuItemStyles}>
              <Box sx={{ width: '100%' }}>
                <MyDatePicker.RangePicker
                  allowClear
                  bordered={false}
                  clearIcon={<CloseCircleOutlined />}
                  format={(value) => value.toUTC().toFormat('yyyy-MM-dd')}
                  placement="bottomRight"
                  style={{ width: '100%', padding: '8px 16px' }}
                  suffixIcon={null}
                  onChange={handleCustomDateChange}
                />
              </Box>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};

export default memo(MuiDatePickerMenu);
