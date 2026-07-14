/*
 *  Copyright 2024 Collate.
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
  DateRangePicker,
  Dropdown,
} from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { Form, Select } from 'antd';
import { isString, isUndefined } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropDownIcon } from '../../assets/svg/bottom-arrow.svg';
import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../constants/TestSuite.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { TestCaseResolutionStatusTypes } from '../../generated/tests/testCaseResolutionStatus';
import Assignees from '../../pages/TasksPage/shared/Assignees';
import {
  getCoreDateRangeValue,
  getDateRangeObjectFromCorePicker,
  getDateRangeObjectFromDateRangePreset,
} from '../../utils/DatePickerMenuUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import { AsyncSelect } from '../common/AsyncSelect/AsyncSelect';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { IncidentManagerProps } from './IncidentManager.interface';
import IncidentManagerTable from './IncidentManagerTable.component';
import { useIncidentManagerListPage } from './useIncidentManagerListPage';

const IncidentManager = ({
  isIncidentPage = true,
  tableDetails,
  isDateRangePickerVisible = true,
}: IncidentManagerProps) => {
  const { t } = useTranslation();
  const menuOptions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(PROFILER_FILTER_RANGE).map(([key, value]) => [
          key,
          {
            ...value,
            title: translateWithNestedKeys(value.title, value.titleData),
          },
        ])
      ),
    [t]
  );
  const {
    commonTestCasePermission,
    filters,
    dateRangeKey,
    testCaseListData,
    isDateFilterOpen,
    setIsDateFilterOpen,
    assigneeOptionsWithSelected,
    selectedAssignees,
    isPermissionLoading,
    testCasePermissions,
    dateFilterOptions,
    selectedDateFilterKey,
    selectedDateFilterOption,
    showPagination,
    pagingData,
    handleSeveritySubmit,
    handleAssigneeUpdate,
    fetchUserFilterOptions,
    updateFilters,
    handleAssigneeChange,
    handleDateRangeChange,
    handleDateFieldChange,
    handleDateRangeClear,
    handleStatusSubmit,
    searchTestCases,
  } = useIncidentManagerListPage({ isIncidentPage, tableDetails });
  const [isDateRangeMenuOpen, setIsDateRangeMenuOpen] = useState(false);
  const selectedDateRangeLabel = useMemo(
    () =>
      dateRangeKey?.key === 'customRange' && dateRangeKey.title
        ? dateRangeKey.title
        : dateRangeKey?.key
        ? menuOptions[dateRangeKey.key]?.title ?? dateRangeKey.title
        : t('label.select-entity', { entity: t('label.date') }),
    [dateRangeKey, menuOptions, t]
  );
  const dateRangePickerValue = useMemo(
    () => getCoreDateRangeValue(dateRangeKey),
    [dateRangeKey]
  );
  const dateRangeMenuItems = useMemo(
    () =>
      Object.entries(menuOptions).map(([id, value]) => ({
        id,
        label: value.title,
      })),
    [menuOptions]
  );

  const handleDateRangeApply = (
    value:
      | Parameters<typeof getDateRangeObjectFromCorePicker>[0]['value']
      | null,
    presetKey?: string
  ) => {
    if (isUndefined(value) || value === null) {
      return;
    }

    const { range } = getDateRangeObjectFromCorePicker({
      menuOptions,
      presetKey,
      showSelectedCustomRange: true,
      value,
    });

    handleDateRangeChange(range);
    setIsDateRangeMenuOpen(false);
  };

  const handleDateRangePresetSelect = (key: string) => {
    const selectedPreset = getDateRangeObjectFromDateRangePreset({
      menuOptions,
      presetKey: key,
    });
    if (isUndefined(selectedPreset)) {
      return;
    }

    handleDateRangeChange(selectedPreset.range);
    setIsDateRangeMenuOpen(false);
  };

  if (
    !commonTestCasePermission?.ViewAll &&
    !commonTestCasePermission?.ViewBasic
  ) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.test-case'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <div className="tw:border tw:border-border-secondary tw:rounded-[10px] tw:bg-primary">
      <div className="new-form-style tw:flex tw:justify-between tw:items-center tw:p-4 tw:gap-5.5 tw:w-full">
        <AsyncSelect
          allowClear
          showArrow
          showSearch
          api={searchTestCases}
          className="w-min-20"
          data-testid="test-case-select"
          placeholder={t('label.test-case')}
          suffixIcon={undefined}
          value={filters.testCaseFQN}
          onChange={(value) => updateFilters({ testCaseFQN: value })}
        />
        <div className="tw:flex tw:gap-5.5">
          <Form.Item className="m-b-0" label={t('label.assignee')}>
            <Assignees
              allowClear
              isSingleSelect
              showArrow
              className="w-min-10"
              options={assigneeOptionsWithSelected}
              placeholder={t('label.assignee')}
              value={selectedAssignees}
              onChange={handleAssigneeChange}
              onSearch={(query) => fetchUserFilterOptions(query)}
            />
          </Form.Item>
          <Form.Item className="m-b-0" label={t('label.status')}>
            <Select
              allowClear
              className="w-min-10"
              data-testid="status-select"
              placeholder={t('label.status')}
              value={filters.testCaseResolutionStatusType}
              onChange={(value) =>
                updateFilters({ testCaseResolutionStatusType: value })
              }>
              {Object.values(TestCaseResolutionStatusTypes).map((value) => (
                <Select.Option key={value}>
                  {TEST_CASE_RESOLUTION_STATUS_LABELS[value]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {isDateRangePickerVisible && (
            <div className="tw:flex tw:gap-2">
              <Dropdown.Root
                isOpen={isDateFilterOpen}
                onOpenChange={setIsDateFilterOpen}>
                <Button
                  className="tw:border-0 tw:bg-transparent tw:self-center m-r-xs sorting-dropdown tw:hover:*:data-text:decoration-transparent! tw:hover:*:data-text:no-underline!"
                  color="link-gray"
                  data-testid="sort-field-dropdown-trigger"
                  iconTrailing={
                    <DropDownIcon
                      className="align-middle"
                      height={16}
                      width={16}
                    />
                  }>
                  <span className="tw:text-sm">
                    {selectedDateFilterOption.name}
                  </span>
                </Button>
                <Dropdown.Popover className="tw:w-max">
                  <Dropdown.Menu
                    items={dateFilterOptions}
                    selectedKeys={[selectedDateFilterKey]}
                    selectionMode="single"
                    onAction={(key) => {
                      if (isString(key)) {
                        handleDateFieldChange(key);
                        setIsDateFilterOpen(false);
                      }
                    }}>
                    {(field) => (
                      <Dropdown.Item
                        data-testid={`date-field-item-${field.value}`}
                        id={field.value}
                        key={field.value}
                        label={field.name}
                      />
                    )}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
              <Dropdown.Root
                isOpen={isDateRangeMenuOpen}
                onOpenChange={setIsDateRangeMenuOpen}>
                <Button
                  noTextPadding
                  className="tw:h-8 tw:max-w-64 tw:items-center"
                  color="secondary"
                  data-testid="date-range-picker"
                  iconTrailing={
                    <DropDownIcon
                      className="align-middle"
                      height={16}
                      width={16}
                    />
                  }
                  size="sm">
                  <span className="tw:min-w-0 tw:truncate tw:px-0.5">
                    {selectedDateRangeLabel}
                  </span>
                  {dateRangeKey && (
                    <span
                      className="tw:inline-flex tw:size-4 tw:shrink-0 tw:items-center tw:justify-center"
                      data-testid="clear-date-picker"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDateRangeClear();
                        setIsDateRangeMenuOpen(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          handleDateRangeClear();
                          setIsDateRangeMenuOpen(false);
                        }
                      }}>
                      <XClose className="tw:size-4" />
                    </span>
                  )}
                </Button>
                <Dropdown.Popover className="tw:w-56">
                  <Dropdown.Menu
                    items={dateRangeMenuItems}
                    selectedKeys={dateRangeKey?.key ? [dateRangeKey.key] : []}
                    selectionMode="single"
                    onAction={(key) => {
                      if (isString(key)) {
                        handleDateRangePresetSelect(key);
                      }
                    }}>
                    {(item) => (
                      <Dropdown.Item
                        data-testid={`date-range-option-${item.id}`}
                        id={item.id}
                        key={item.id}
                        label={item.label}
                      />
                    )}
                  </Dropdown.Menu>
                  <Dropdown.Separator />
                  <div className="tw:p-1.5">
                    <DateRangePicker
                      buttonProps={{
                        'data-testid': 'custom-date-range-picker',
                        size: 'sm',
                      }}
                      placeholder={t('label.custom-range')}
                      triggerLabel={t('label.custom-range')}
                      value={dateRangePickerValue}
                      onApply={handleDateRangeApply}
                    />
                  </div>
                </Dropdown.Popover>
              </Dropdown.Root>
            </div>
          )}
        </div>
      </div>

      <IncidentManagerTable
        handleAssigneeUpdate={handleAssigneeUpdate}
        handleSeveritySubmit={handleSeveritySubmit}
        handleStatusSubmit={handleStatusSubmit}
        isIncidentPage={isIncidentPage}
        isPermissionLoading={isPermissionLoading}
        pagingData={pagingData}
        showPagination={showPagination}
        tableDetails={tableDetails}
        testCaseListData={testCaseListData}
        testCasePermissions={testCasePermissions}
      />
    </div>
  );
};

export default IncidentManager;
