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
  Dropdown,
  Skeleton,
  Table,
} from '@openmetadata/ui-core-components';
import { Form, Select } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEqual, isString, isUndefined, omit, parseInt, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as DropDownIcon } from '../../assets/svg/bottom-arrow.svg';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import {
  DEFAULT_DOMAIN_VALUE,
  PAGE_SIZE_BASE,
} from '../../constants/constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../constants/TestSuite.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType, FqnPart } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/tests/testCase';
import {
  Assigned,
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../generated/tests/testCaseResolutionStatus';
import { Include } from '../../generated/type/include';
import { usePaging } from '../../hooks/paging/usePaging';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useDomainStore } from '../../hooks/useDomainStore';
import {
  SearchHitBody,
  TestCaseSearchSource,
} from '../../interface/search.interface';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import Assignees from '../../pages/TasksPage/shared/Assignees';
import { Option } from '../../pages/TasksPage/TasksPage.interface';
import {
  getListTestCaseIncidentByStateId,
  getListTestCaseIncidentStatusFromSearch,
  TestCaseIncidentStatusParams,
  transitionIncident,
  updateTestCaseIncidentById,
} from '../../rest/incidentManagerAPI';
import { getUserAndTeamSearch } from '../../rest/miscAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  getNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../utils/FqnUtils';
import observabilityRouterClassBase from '../../utils/ObservabilityRouterClassBase';
import { getEntityDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { AsyncSelect } from '../common/AsyncSelect/AsyncSelect';
import DateTimeDisplay from '../common/DateTimeDisplay/DateTimeDisplay';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import MuiDatePickerMenu from '../common/MuiDatePickerMenu/MuiDatePickerMenu';
import NextPrevious from '../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../common/OwnerLabel/OwnerLabel.component';
import {
  ProfilerTabPath,
  TestCasePermission,
} from '../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import Severity from '../DataQuality/IncidentManager/Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component';
import { IncidentManagerProps } from './IncidentManager.interface';

const IncidentManager = ({
  isIncidentPage = true,
  tableDetails,
  isDateRangePickerVisible = true,
}: IncidentManagerProps) => {
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { activeDomain } = useDomainStore();
  const allParams = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return isUndefined(searchData) ? {} : searchData;
  }, [location.search]);

  const filters = useMemo(() => {
    const urlParams = omit(allParams, ['key', 'title']);

    const params: TestCaseIncidentStatusParams = {
      ...urlParams,
    };

    // Only use date params if they exist in the URL
    if (urlParams.startTs || urlParams.endTs) {
      if (urlParams.startTs && isString(urlParams.startTs)) {
        params.startTs = parseInt(urlParams.startTs, 10);
      }
      if (urlParams.endTs && isString(urlParams.endTs)) {
        params.endTs = parseInt(urlParams.endTs, 10);
      }
    }

    return params;
  }, [allParams]);

  const dateRangeKey = useMemo(() => {
    // Only return date range if URL has explicit date params
    if (allParams.key && filters.startTs && filters.endTs) {
      return {
        key: allParams.key as string,
        title: allParams.title as string,
        startTs: filters.startTs,
        endTs: filters.endTs,
      };
    }

    // No date range selected - show placeholder
    return undefined;
  }, [allParams.key, allParams.title, filters.startTs, filters.endTs]);

  const [testCaseListData, setTestCaseListData] =
    useState<TestCaseIncidentStatusData>({
      data: [],
      isLoading: true,
    });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [users, setUsers] = useState<{
    options: Option[];
  }>({
    options: [],
  });

  const assigneeOptionsWithSelected = useMemo(() => {
    const options = [...users.options];
    if (filters.assignee) {
      const exists = options.some(
        (opt) => opt.name === filters.assignee || opt.value === filters.assignee
      );
      if (!exists) {
        options.push({
          label: filters.assignee,
          value: filters.assignee,
          name: filters.assignee,
          type: 'user',
        });
      }
    }

    return options;
  }, [filters.assignee, users.options]);

  const selectedAssignees = useMemo(() => {
    if (!filters.assignee) {
      return [];
    }
    const option = assigneeOptionsWithSelected.find(
      (opt) => opt.name === filters.assignee || opt.value === filters.assignee
    );

    return option ? [option] : [];
  }, [filters.assignee, assigneeOptionsWithSelected]);

  const { getEntityPermissionByFqn, permissions } = usePermissionProvider();
  const { testCase: commonTestCasePermission } = permissions;

  const [isPermissionLoading, setIsPermissionLoading] = useState(true);
  const [testCasePermissions, setTestCasePermissions] = useState<
    TestCasePermission[]
  >([]);

  const { t } = useTranslation();

  const dateFilterOptions = useMemo(
    () => [
      { name: t('label.created-at'), value: 'timestamp' },
      { name: t('label.updated-at'), value: 'updatedAt' },
    ],
    [t]
  );

  const selectedDateFilterKey = (filters.dateField as string) ?? 'timestamp';
  const selectedDateFilterOption =
    dateFilterOptions.find((o) => o.value === selectedDateFilterKey) ??
    dateFilterOptions[0];

  const {
    paging,
    pageSize,
    currentPage,
    showPagination,
    handlePageChange,
    handlePagingChange,
    handlePageSizeChange,
  } = usePaging();

  const fetchTestCaseIncidents = useCallback(
    async (params: TestCaseIncidentStatusParams) => {
      setTestCaseListData((prev) => ({ ...prev, isLoading: true }));
      try {
        const { data, paging } = await getListTestCaseIncidentStatusFromSearch({
          limit: pageSize,
          offset: params.offset ?? 0,
          latest: true,
          include: tableDetails?.deleted ? Include.Deleted : Include.NonDeleted,
          originEntityFQN: tableDetails?.fullyQualifiedName,
          domain:
            activeDomain === DEFAULT_DOMAIN_VALUE ? undefined : activeDomain,
          ...params,
        });
        const assigneeOptions = data.reduce((acc, curr) => {
          const assignee = curr.testCaseResolutionStatusDetails?.assignee;
          const isExist = acc.some((item) => item.value === assignee?.name);

          if (assignee && !isExist) {
            acc.push({
              label: getEntityName(assignee),
              value: assignee.name ?? assignee.fullyQualifiedName ?? '',
              type: assignee.type,
              name: assignee.name,
            });
          }

          return acc;
        }, [] as Option[]);

        setUsers((pre) => ({
          ...pre,
          options: assigneeOptions,
        }));
        setTestCaseListData((prev) => ({ ...prev, data: data }));
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [pageSize, setTestCaseListData, activeDomain]
  );

  const fetchTestCasePermissions = async () => {
    const { data: incident } = testCaseListData;
    try {
      setIsPermissionLoading(true);
      const promises = incident.map((testCase) => {
        return getEntityPermissionByFqn(
          ResourceEntity.TEST_CASE,
          testCase.testCaseReference?.fullyQualifiedName ?? ''
        );
      });
      const testCasePermission = await Promise.allSettled(promises);
      const data = testCasePermission.reduce((acc, status, i) => {
        if (status.status === 'fulfilled') {
          return [
            ...acc,
            {
              ...status.value,
              fullyQualifiedName:
                incident[i].testCaseReference?.fullyQualifiedName ?? '',
            },
          ];
        }

        return acc;
      }, [] as TestCasePermission[]);

      setTestCasePermissions(data);
    } catch {
      // do nothing
    } finally {
      setIsPermissionLoading(false);
    }
  };

  const handlePagingClick = ({ currentPage }: PagingHandlerParams) => {
    fetchTestCaseIncidents({
      ...filters,
      offset: (currentPage - 1) * pageSize,
    });
    handlePageChange(currentPage);
  };

  const pagingData = useMemo(
    () => ({
      paging,
      currentPage,
      pagingHandler: handlePagingClick,
      pageSize,
      onShowSizeChange: handlePageSizeChange,
      isNumberBased: true,
    }),
    [paging, currentPage, handlePagingClick, pageSize, handlePageSizeChange]
  );

  const handleSeveritySubmit = async (
    record: TestCaseResolutionStatus,
    severity?: Severities
  ) => {
    const updatedData = { ...record, severity };
    const patch = compare(record, updatedData);
    try {
      await updateTestCaseIncidentById(record.id ?? '', patch);

      setTestCaseListData((prev) => {
        const testCaseList = prev.data.map((item) => {
          if (item.id === updatedData.id) {
            return updatedData;
          }

          return item;
        });

        return {
          ...prev,
          data: testCaseList,
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleAssigneeUpdate = useCallback(
    async (record: TestCaseResolutionStatus, assignee?: EntityReference[]) => {
      const taskId = record.stateId;
      if (!taskId) {
        return;
      }

      const assigneeData = assignee?.[0];
      const transitionId =
        record.testCaseResolutionStatusType ===
        TestCaseResolutionStatusTypes.Assigned
          ? 'reassign'
          : 'assign';

      try {
        await transitionIncident(taskId, {
          transitionId,
          payload: assigneeData
            ? {
                assignees: [
                  {
                    id: assigneeData.id,
                    type: assigneeData.type ?? 'user',
                    name: assigneeData.name,
                    fullyQualifiedName:
                      assigneeData.fullyQualifiedName ?? assigneeData.name,
                    displayName: assigneeData.displayName,
                  },
                ],
              }
            : undefined,
        });

        const refreshed = await getListTestCaseIncidentByStateId(taskId);
        const latest = refreshed?.data?.[0];
        if (!latest) {
          return;
        }

        setTestCaseListData((prev) => {
          const testCaseList = prev.data.map((item) => {
            if (item.stateId === latest.stateId) {
              return latest;
            }

            return item;
          });

          return {
            ...prev,
            data: testCaseList,
          };
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [setTestCaseListData]
  );

  const fetchUserFilterOptions = async (query: string) => {
    if (!query) {
      return;
    }
    try {
      const res = await getUserAndTeamSearch(query, true);
      const hits = res.data.hits.hits;
      const suggestOptions = hits.map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._source.name,
        type: hit._source.entityType,
        name: hit._source.name,
      }));

      setUsers((pre) => ({ ...pre, options: suggestOptions }));
    } catch {
      setUsers((pre) => ({ ...pre, options: [] }));
    }
  };

  const updateFilters = useCallback(
    (
      newFilters: Partial<TestCaseIncidentStatusParams>,
      dateRangeParams?: { key: string; title: string }
    ) => {
      const updatedFilters = { ...filters, ...newFilters };
      const allUpdatedParams = dateRangeParams
        ? { ...updatedFilters, ...dateRangeParams }
        : { ...allParams, ...updatedFilters };

      navigate(
        {
          search: QueryString.stringify(allUpdatedParams),
        },
        {
          replace: true,
        }
      );
    },
    [filters, allParams, navigate]
  );

  const handleAssigneeChange = (value?: Option[]) => {
    updateFilters({ assignee: value ? value[0]?.name : value });
  };

  const handleDateRangeChange = (value: DateRangeObject) => {
    const updatedFilter = pick(value, ['startTs', 'endTs']);
    const existingFilters = pick(filters, ['startTs', 'endTs']);
    const dateRangeParams = pick(value, ['key', 'title']) as {
      key: string;
      title: string;
    };

    if (!isEqual(existingFilters, updatedFilter)) {
      updateFilters(updatedFilter, dateRangeParams);
    }
  };

  const handleDateFieldChange = useCallback(
    (value: string) => {
      updateFilters({ dateField: value as 'timestamp' | 'updatedAt' });
    },
    [updateFilters]
  );

  const handleDateRangeClear = useCallback(() => {
    const updatedFilters = omit(allParams, [
      'startTs',
      'endTs',
      'key',
      'title',
      'dateField',
    ]);
    navigate(
      {
        search: QueryString.stringify(updatedFilters),
      },
      {
        replace: true,
      }
    );
  }, [allParams, navigate]);

  const handleStatusSubmit = useCallback(
    (value: TestCaseResolutionStatus) => {
      setTestCaseListData((prev) => {
        const testCaseList = prev.data.map((item) => {
          if (
            item.testCaseReference?.fullyQualifiedName ===
            value.testCaseReference?.fullyQualifiedName
          ) {
            return value;
          }

          return item;
        });

        return {
          ...prev,
          data: testCaseList,
        };
      });
    },
    [setTestCaseListData]
  );

  const searchTestCases = async (searchValue = WILD_CARD_CHAR) => {
    // Encode the search value to handle special characters like #, %, $, etc.
    // Preserve wildcard character to maintain default search behavior
    const encodedSearchValue: string =
      searchValue === WILD_CARD_CHAR
        ? searchValue
        : encodeURIComponent(searchValue);
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex: SearchIndex.TEST_CASE,
        query: encodedSearchValue,
        fetchSource: true,
        includeFields: ['name', 'displayName', 'fullyQualifiedName'],
      });

      return (
        response.hits.hits as SearchHitBody<
          SearchIndex.TEST_CASE,
          TestCaseSearchSource
        >[]
      ).map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._source.fullyQualifiedName,
      }));
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (
      commonTestCasePermission?.ViewAll ||
      commonTestCasePermission?.ViewBasic
    ) {
      fetchTestCaseIncidents(filters);
    } else {
      setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
    }
  }, [commonTestCasePermission, pageSize, filters, activeDomain]);

  useEffect(() => {
    if (testCaseListData.data.length > 0) {
      fetchTestCasePermissions();
    }
  }, [testCaseListData.data]);

  const testCaseResolutionStatusDetailsRender = (
    value?: Assigned,
    record?: TestCaseResolutionStatus
  ) => {
    if (isPermissionLoading) {
      return <Skeleton height={24} variant="rectangular" width={100} />;
    }

    const hasPermission = testCasePermissions.find(
      (item) =>
        item.fullyQualifiedName ===
        record?.testCaseReference?.fullyQualifiedName
    );

    return (
      <div data-testid="assignee">
        <OwnerLabel
          isCompactView
          className="m-0"
          hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
          multiple={{
            user: false,
            team: false,
          }}
          owners={value?.assignee ? [value.assignee] : []}
          placeHolder={t('label.no-entity', {
            entity: t('label.assignee'),
          })}
          tooltipText={t('label.edit-entity', {
            entity: t('label.assignee'),
          })}
          onUpdate={(assignees) =>
            record && handleAssigneeUpdate(record, assignees)
          }
        />
      </div>
    );
  };

  const columns = useMemo(
    () => [
      { id: 'name', label: t('label.test-case-name') },
      ...(isIncidentPage
        ? [{ id: 'testCaseReference', label: t('label.table') }]
        : []),
      { id: 'timestamp', label: t('label.last-updated') },
      { id: 'testCaseResolutionStatusType', label: t('label.status') },
      { id: 'severity', label: t('label.severity') },
      { id: 'testCaseResolutionStatusDetails', label: t('label.assignee') },
    ],
    [isIncidentPage, t]
  );

  const loadingSkeletons = useMemo(
    () => (
      <div className="tw:p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton className="tw:mb-2" height={40} key={i} width="100%" />
        ))}
      </div>
    ),
    []
  );

  const renderRow = (record: TestCaseResolutionStatus) => {
    const ref = record.testCaseReference;
    const tableFqn = getPartialNameFromTableFQN(
      ref?.fullyQualifiedName ?? '',
      [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
      '.'
    );
    const hasPermission = testCasePermissions.find(
      (item) => item.fullyQualifiedName === ref?.fullyQualifiedName
    );

    return (
      <Table.Row id={record.id ?? ''} key={record.id}>
        <Table.Cell>
          <Link
            className="m-0 break-all text-primary"
            data-testid={`test-case-${ref?.name}`}
            to={observabilityRouterClassBase.getTestCaseDetailPagePath(
              ref?.fullyQualifiedName ?? ''
            )}>
            {getEntityName(ref)}
          </Link>
        </Table.Cell>
        {isIncidentPage && (
          <Table.Cell>
            <Link
              data-testid="table-link"
              to={getEntityDetailsPath(
                EntityType.TABLE,
                tableFqn,
                EntityTabs.PROFILER,
                ProfilerTabPath.DATA_QUALITY
              )}
              onClick={(e) => e.stopPropagation()}>
              {getNameFromFQN(tableFqn) ?? ref?.fullyQualifiedName}
            </Link>
          </Table.Cell>
        )}
        <Table.Cell>
          <DateTimeDisplay
            size="compact"
            timestamp={record.timestamp as number}
          />
        </Table.Cell>
        <Table.Cell>
          {isPermissionLoading ? (
            <Skeleton height={24} variant="rectangular" width={100} />
          ) : (
            <TestCaseIncidentManagerStatus
              isInline
              data={record}
              hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
              onSubmit={handleStatusSubmit}
            />
          )}
        </Table.Cell>
        <Table.Cell>
          {isPermissionLoading ? (
            <Skeleton height={24} variant="rectangular" width={100} />
          ) : (
            <Severity
              isInline
              hasPermission={hasPermission?.EditAll && !tableDetails?.deleted}
              severity={record.severity}
              onSubmit={(severity) => handleSeveritySubmit(record, severity)}
            />
          )}
        </Table.Cell>
        <Table.Cell>
          {testCaseResolutionStatusDetailsRender(
            record.testCaseResolutionStatusDetails as Assigned | undefined,
            record
          )}
        </Table.Cell>
      </Table.Row>
    );
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

      <Table
        aria-label={t('label.incident-manager')}
        data-testid="test-case-incident-manager-table"
        size="sm">
        <Table.Header columns={columns}>
          {(col) => <Table.Head id={col.id} key={col.id} label={col.label} />}
        </Table.Header>
        <Table.Body
          dependencies={[
            isPermissionLoading,
            testCasePermissions,
            testCaseListData.data,
            tableDetails?.deleted,
          ]}
          items={testCaseListData.isLoading ? [] : testCaseListData.data}
          renderEmptyState={() =>
            testCaseListData.isLoading ? (
              loadingSkeletons
            ) : (
              <FilterTablePlaceHolder
                placeholderText={t('message.no-incident-found')}
              />
            )
          }>
          {(record) => renderRow(record)}
        </Table.Body>
      </Table>
      {pagingData && showPagination && <NextPrevious {...pagingData} />}
    </div>
  );
};

export default IncidentManager;
