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
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { Form, Select } from 'antd';
import { isString } from 'lodash';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropDownIcon } from '../../assets/svg/bottom-arrow.svg';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../constants/TestSuite.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { TestCaseResolutionStatusTypes } from '../../generated/tests/testCaseResolutionStatus';
import Assignees from '../../pages/TasksPage/shared/Assignees';
import { AsyncSelect } from '../common/AsyncSelect/AsyncSelect';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import MuiDatePickerMenu from '../common/MuiDatePickerMenu/MuiDatePickerMenu';
import { IncidentManagerProps } from './IncidentManager.interface';
import IncidentManagerTable from './IncidentManagerTable.component';
import { useIncidentManagerListPage } from './useIncidentManagerListPage';

const IncidentManager = ({
  isIncidentPage = true,
  tableDetails,
  isDateRangePickerVisible = true,
}: IncidentManagerProps) => {
  const { t } = useTranslation();
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
              <MuiDatePickerMenu
                allowClear
                showSelectedCustomRange
                defaultDateRange={dateRangeKey}
                handleDateRangeChange={handleDateRangeChange}
                size="small"
                onClear={handleDateRangeClear}
              />
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
