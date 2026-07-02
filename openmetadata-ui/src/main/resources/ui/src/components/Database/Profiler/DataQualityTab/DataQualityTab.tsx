/*
 *  Copyright 2022 Collate.
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
  Skeleton,
  Table,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown, DotsVertical } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isUndefined, sortBy, toLower } from 'lodash';
import { PagingResponse } from 'Models';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Selection, SortDescriptor } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as DimensionIcon } from '../../../../assets/svg/data-observability/dimension.svg';
import { DATA_QUALITY_PROFILER_DOCS } from '../../../../constants/docs.constants';
import { TEST_CASE_STATUS_LABELS } from '../../../../constants/profiler.constant';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { SORT_ORDER } from '../../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import {
  TestCase,
  TestCaseResult,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import { TestCaseResolutionStatus } from '../../../../generated/tests/testCaseResolutionStatus';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { TestCasePageTabs } from '../../../../pages/IncidentManager/IncidentManager.interface';
import { getListTestCaseIncidentByStateId } from '../../../../rest/incidentManagerAPI';
import { removeTestCaseFromTestSuite } from '../../../../rest/testAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getColumnNameFromEntityLink } from '../../../../utils/EntityPureUtils';
import { getEntityFQN } from '../../../../utils/FeedUtilsPure';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { replacePlus } from '../../../../utils/StringUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DateTimeDisplay from '../../../common/DateTimeDisplay/DateTimeDisplay';
import DeleteWidgetModal from '../../../common/DeleteWidget/DeleteWidgetModal';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import StatusBadge from '../../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import EditTestCaseModalV1 from '../../../DataQuality/AddDataQualityTest/components/EditTestCaseModalV1';
import AddToBundleSuiteModal from '../../../DataQuality/AddToBundleSuiteModal/AddToBundleSuiteModal.component';
import BundleSuiteForm from '../../../DataQuality/BundleSuiteForm/BundleSuiteForm';
import TestCaseIncidentManagerStatus from '../../../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import {
  DataQualityTabProps,
  ProfilerTabPath,
  TestCaseAction,
  TestCasePermission,
} from '../ProfilerDashboard/profilerDashboard.interface';
import './data-quality-tab.less';

const COLUMN_LAYOUT: Record<
  string,
  { minWidth: number; maxWidth?: number; fixed?: 'right' }
> = {
  status: { minWidth: 110 },
  reason: { minWidth: 200 },
  lastRun: { minWidth: 170 },
  name: { minWidth: 150, maxWidth: 220 },
  table: { minWidth: 300, maxWidth: 360 },
  column: { minWidth: 110 },
  incident: { minWidth: 130 },
  actions: { minWidth: 90, fixed: 'right' },
};

// Per-column min-widths give the table an intrinsic width so the core Table's
// built-in horizontal scroll engages on narrow viewports; long-identifier
// columns (name/table) are capped with maxWidth. The actions column is pinned to
// the right; its opaque background (matching the header/row state) is applied via
// className (bg-secondary header, bg-primary body, group-hover/selected) so it
// stays consistent with the rest of the row instead of looking detached.
const getColumnLayoutStyle = (
  id: string,
  zIndex: number
): React.CSSProperties => {
  const column = COLUMN_LAYOUT[id];

  return {
    minWidth: column?.minWidth,
    maxWidth: column?.maxWidth,
    ...(column?.fixed === 'right'
      ? { position: 'sticky', right: 0, zIndex }
      : {}),
  };
};

const DataQualityTab: React.FC<DataQualityTabProps> = ({
  isLoading = false,
  testCases,
  pagingData,
  onTestUpdate,
  removeFromTestSuite,
  showTableColumn = true,
  afterDeleteAction,
  showPagination,
  breadcrumbData,
  fetchTestCases,
  isEditAllowed,
  tableHeader,
  removeTableBorder = false,
  enableBulkActions = false,
}: DataQualityTabProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [selectedTestCase, setSelectedTestCase] = useState<TestCaseAction>();
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [testCaseStatus, setTestCaseStatus] = useState<
    TestCaseResolutionStatus[]
  >([]);
  const [isTestCaseRemovalLoading, setIsTestCaseRemovalLoading] =
    useState(false);
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);
  const [testCasePermissions, setTestCasePermissions] = useState<
    TestCasePermission[]
  >([]);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Selection>(
    new Set<string>()
  );
  const [isAddToBundleSuiteModalOpen, setIsAddToBundleSuiteModalOpen] =
    useState(false);
  const [isBundleSuiteFormOpen, setIsBundleSuiteFormOpen] = useState(false);
  const [bundleSuiteFormInitialCases, setBundleSuiteFormInitialCases] =
    useState<TestCase[]>([]);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: '',
    direction: 'ascending',
  });
  const isApiSortingEnabled = useRef(false);

  const sortedData = useMemo(() => {
    let data = isApiSortingEnabled.current
      ? testCases
      : sortBy(testCases, (test) => {
          switch (test.testCaseResult?.testCaseStatus) {
            case TestCaseStatus.Failed:
              return 0;
            case TestCaseStatus.Aborted:
              return 1;
            case TestCaseStatus.Success:
              return 2;

            default:
              return 3;
          }
        });

    if (
      sortDescriptor.column === 'table' ||
      sortDescriptor.column === 'column'
    ) {
      data = sortBy(data, (test) => {
        if (sortDescriptor.column === 'table') {
          const tableFqn = getEntityFQN(test.entityLink);

          return getNameFromFQN(tableFqn).toLowerCase();
        } else {
          return test.entityLink.includes('::columns::')
            ? replacePlus(
                getColumnNameFromEntityLink(test.entityLink) ?? ''
              ).toLowerCase()
            : '';
        }
      });
      if (sortDescriptor.direction === 'descending') {
        data = [...data].reverse();
      }
    }

    return data;
  }, [testCases, sortDescriptor]);

  const selectedTestCasesForBundle = useMemo(() => {
    if (selectedKeys === 'all') {
      return sortedData;
    }
    const keySet = selectedKeys as Set<string>;

    return sortedData.filter((tc) => keySet.has(tc.id ?? ''));
  }, [sortedData, selectedKeys]);

  const hasSelection = useMemo(() => {
    if (selectedKeys === 'all') {
      return true;
    }

    return (selectedKeys as Set<string>).size > 0;
  }, [selectedKeys]);

  const handleCancel = () => {
    setSelectedTestCase(undefined);
  };

  const handleEdit = (record: TestCase) => {
    setSelectedTestCase({ data: record, action: 'UPDATE' });
    setActiveRecordId(null);
  };

  const handleDelete = (record: TestCase) => {
    setSelectedTestCase({ data: record, action: 'DELETE' });
    setActiveRecordId(null);
  };

  const handleConfirmClick = async () => {
    setIsTestCaseRemovalLoading(true);
    if (isUndefined(removeFromTestSuite)) {
      return;
    }
    try {
      await removeTestCaseFromTestSuite(
        selectedTestCase?.data.id ?? '',
        removeFromTestSuite.testSuite?.id ?? ''
      );
      afterDeleteAction?.();
      setSelectedTestCase(undefined);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTestCaseRemovalLoading(false);
    }
  };

  const handleStatusSubmit = (value: TestCaseResolutionStatus) => {
    setTestCaseStatus((prev) => {
      return prev.map((item) => {
        if (
          item.testCaseReference?.fullyQualifiedName ===
          value.testCaseReference?.fullyQualifiedName
        ) {
          return value;
        }

        return item;
      });
    });
  };

  const handleSortChange = (descriptor: SortDescriptor) => {
    const isSameSort =
      descriptor.column === sortDescriptor.column &&
      descriptor.direction === sortDescriptor.direction;

    if (isSameSort) {
      setSortDescriptor({ column: '', direction: 'ascending' });
      if (isApiSortingEnabled.current) {
        isApiSortingEnabled.current = false;
        fetchTestCases?.(undefined);
      }

      return;
    }

    setSortDescriptor(descriptor);

    if (descriptor.column === 'lastRun' || descriptor.column === 'name') {
      isApiSortingEnabled.current = true;
      fetchTestCases?.({
        sortField:
          descriptor.column === 'lastRun'
            ? 'testCaseResult.timestamp'
            : 'name.keyword',
        sortType:
          descriptor.direction === 'ascending'
            ? SORT_ORDER.ASC
            : SORT_ORDER.DESC,
      });
    } else if (
      descriptor.column === 'table' ||
      descriptor.column === 'column'
    ) {
      if (isApiSortingEnabled.current) {
        isApiSortingEnabled.current = false;
        fetchTestCases?.(undefined);
      }
    }
  };

  const columnList = useMemo(() => {
    const cols = [
      { id: 'status', name: t('label.status') },
      { id: 'reason', name: t('label.failed-slash-aborted-reason') },
      { id: 'lastRun', name: t('label.last-run'), allowsSorting: true },
      {
        id: 'name',
        name: t('label.name'),
        allowsSorting: true,
      },
      ...(showTableColumn
        ? [{ id: 'table', name: t('label.table'), allowsSorting: true }]
        : []),
      { id: 'column', name: t('label.column'), allowsSorting: true },
      { id: 'incident', name: t('label.incident') },
      { id: 'actions', name: t('label.action-plural') },
    ];

    return cols;
  }, [showTableColumn, t]);

  const fetchTestCaseStatus = async () => {
    try {
      setIsStatusLoading(true);
      const promises = testCases.reduce((acc, testCase) => {
        if (testCase.incidentId) {
          return [
            ...acc,
            getListTestCaseIncidentByStateId(testCase.incidentId ?? ''),
          ];
        }

        return acc;
      }, [] as Promise<PagingResponse<TestCaseResolutionStatus[]>>[]);
      const testCaseStatusResults = await Promise.allSettled(promises);
      const data = testCaseStatusResults.reduce((acc, status) => {
        if (status.status === 'fulfilled' && status.value.data.length) {
          return [...acc, status.value.data[0]];
        }

        return acc;
      }, [] as TestCaseResolutionStatus[]);
      setTestCaseStatus(data);
    } catch {
      // do nothing
    } finally {
      setIsStatusLoading(false);
    }
  };

  const fetchTestCasePermissions = async () => {
    try {
      setIsPermissionLoading(true);
      const promises = testCases.map((testCase) => {
        return getEntityPermissionByFqn(
          ResourceEntity.TEST_CASE,
          testCase.fullyQualifiedName ?? ''
        );
      });
      const testCasePermission = await Promise.allSettled(promises);
      const data = testCasePermission.reduce((acc, status, i) => {
        if (status.status === 'fulfilled') {
          return [
            ...acc,
            {
              ...status.value,
              fullyQualifiedName: testCases[i].fullyQualifiedName,
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

  useEffect(() => {
    if (testCases.length) {
      fetchTestCaseStatus();
      fetchTestCasePermissions();
    } else {
      setIsStatusLoading(false);
    }
  }, [testCases]);

  const handleOpenBundleSuiteForm = (cases: TestCase[]) => {
    setBundleSuiteFormInitialCases(cases);
    setIsBundleSuiteFormOpen(true);
    setIsAddToBundleSuiteModalOpen(false);
  };

  const handleBundleSuiteSuccess = (testSuite: TestSuite) => {
    setIsBundleSuiteFormOpen(false);
    setBundleSuiteFormInitialCases([]);
    setSelectedKeys(new Set<string>());
    if (testSuite.fullyQualifiedName) {
      navigate(
        observabilityRouterClassBase.getTestSuitePath(
          testSuite.fullyQualifiedName
        )
      );
    }
  };

  const handleAddedToExistingBundleSuite = () => {
    setSelectedKeys(new Set<string>());
    fetchTestCases?.();
  };

  const renderStatusCell = (
    result: TestCaseResult | undefined,
    name: string
  ) => {
    return result?.testCaseStatus ? (
      <StatusBadge
        dataTestId={`status-badge-${name}`}
        label={TEST_CASE_STATUS_LABELS[result.testCaseStatus]}
        status={toLower(result.testCaseStatus) as StatusType}
      />
    ) : (
      '--'
    );
  };

  const renderReasonCell = (
    result: TestCaseResult | undefined,
    record: TestCase
  ) => {
    return result?.result &&
      result.testCaseStatus !== TestCaseStatus.Success ? (
      <Tooltip
        containerClassName="tw:break-all"
        placement="top"
        title={result.result}>
        <TooltipTrigger>
          <Typography
            className="tw:m-0 tw:max-w-54 tw:line-clamp-2 tw:break-all tw:overflow-hidden tw:whitespace-normal"
            data-testid={`reason-text-${record.name}`}
            size="text-sm">
            {result.result}
          </Typography>
        </TooltipTrigger>
      </Tooltip>
    ) : (
      '--'
    );
  };

  const renderIncidentCell = (record: TestCase) => {
    const testCaseResult = testCaseStatus.find(
      (status) =>
        status.testCaseReference?.fullyQualifiedName ===
        record.fullyQualifiedName
    );

    if (isStatusLoading) {
      return <Skeleton height={30} width={60} />;
    }

    if (!testCaseResult) {
      return '--';
    }

    const testCasePermission = testCasePermissions.find(
      (permission) =>
        permission.fullyQualifiedName === record.fullyQualifiedName
    );
    const hasEditPermission = isEditAllowed || testCasePermission?.EditAll;

    return (
      <TestCaseIncidentManagerStatus
        isInline
        data={testCaseResult}
        hasPermission={hasEditPermission}
        onSubmit={handleStatusSubmit}
      />
    );
  };

  const renderActionsCell = (record: TestCase) => {
    if (isPermissionLoading) {
      return <Skeleton height={30} width={30} />;
    }

    const dimensions = record.dimensionColumns ?? [];

    const testCasePermission = testCasePermissions.find(
      (permission) =>
        permission.fullyQualifiedName === record.fullyQualifiedName
    );

    const testCaseEditPermission = isEditAllowed || testCasePermission?.EditAll;
    const testCaseDeletePermission =
      removeFromTestSuite?.isAllowed || testCasePermission?.Delete;

    const deleteBtnLabel = removeFromTestSuite
      ? t('label.remove')
      : t('label.delete');

    const hasAnyPermission = testCaseEditPermission || testCaseDeletePermission;

    const menuItems = [
      {
        id: 'edit',
        isDisabled: !testCaseEditPermission,
        label: t('label.edit'),
        onAction: () => handleEdit(record),
        testId: `edit-${record.name}`,
      },
      {
        id: removeFromTestSuite ? 'remove' : 'delete',
        isDisabled: !testCaseDeletePermission,
        label: deleteBtnLabel,
        onAction: () => handleDelete(record),
        testId: removeFromTestSuite
          ? `remove-${record.name}`
          : `delete-${record.name}`,
      },
    ];

    return (
      <div className="tw:flex tw:items-center tw:justify-end tw:gap-5">
        {dimensions.length > 0 && (
          <Tooltip
            placement="top"
            title={t(
              dimensions.length === 1
                ? 'label.number-dimension-associated'
                : 'label.number-dimension-plural-associated',
              {
                number: dimensions.length,
              }
            )}>
            <Link
              to={observabilityRouterClassBase.getTestCaseDetailPagePath(
                record.fullyQualifiedName ?? '',
                TestCasePageTabs.DIMENSIONALITY
              )}>
              <div
                className="tw:flex tw:min-w-13 tw:items-center tw:gap-2 tw:rounded-md tw:bg-blue-50 tw:p-2 tw:text-primary"
                data-testid={`dimension-count-${record.name}`}>
                <DimensionIcon height={12} width={12} />
                <span className="tw:text-xs tw:font-medium">
                  {dimensions.length}
                </span>
              </div>
            </Link>
          </Tooltip>
        )}
        <Dropdown.Root
          isOpen={activeRecordId === (record.id ?? null)}
          onOpenChange={(isOpen) =>
            setActiveRecordId(isOpen ? record.id ?? null : null)
          }>
          <Button
            className="tw:h-6 tw:w-6 tw:p-0!"
            color="secondary"
            data-testid={`action-dropdown-${record.name}`}
            iconLeading={DotsVertical}
            isDisabled={!hasAnyPermission}
            size="sm"
          />
          <Dropdown.Popover className="tw:w-max">
            <Dropdown.Menu items={menuItems}>
              {(item) => (
                <Dropdown.Item
                  data-testid={item.testId}
                  id={item.id}
                  isDisabled={item.isDisabled}
                  label={item.label}
                  onAction={item.onAction}
                />
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>
    );
  };

  const renderRow = (record: TestCase) => {
    const entityLink = record.entityLink ?? '';
    const tableFqn = getEntityFQN(entityLink);
    const isColumn = entityLink.includes('::columns::');
    const columnName = isColumn
      ? replacePlus(getColumnNameFromEntityLink(entityLink) ?? '')
      : null;

    return (
      <Table.Row
        className="tw:group"
        id={record.id ?? record.name ?? ''}
        key={record.id}>
        <Table.Cell
          className="tw:whitespace-nowrap"
          style={getColumnLayoutStyle('status', 1)}>
          {renderStatusCell(record.testCaseResult, record.name ?? '')}
        </Table.Cell>
        <Table.Cell
          className="tw:whitespace-nowrap"
          style={getColumnLayoutStyle('reason', 1)}>
          {renderReasonCell(record.testCaseResult, record)}
        </Table.Cell>
        <Table.Cell
          className="tw:whitespace-nowrap"
          style={getColumnLayoutStyle('lastRun', 1)}>
          <DateTimeDisplay
            size="compact"
            timestamp={record.testCaseResult?.timestamp}
          />
        </Table.Cell>
        <Table.Cell
          className="tw:whitespace-nowrap"
          style={getColumnLayoutStyle('name', 1)}>
          <Box
            data-testid={record.name}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}>
            <Link
              className="tw:block tw:min-w-0 tw:truncate"
              state={{ breadcrumbData }}
              title={getEntityName(record)}
              to={{
                pathname:
                  observabilityRouterClassBase.getTestCaseDetailPagePath(
                    record.fullyQualifiedName ?? ''
                  ),
              }}>
              {getEntityName(record)}
            </Link>
          </Box>
        </Table.Cell>
        {showTableColumn && (
          <Table.Cell style={getColumnLayoutStyle('table', 1)}>
            <Box
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}>
              <Link
                className="break-word tw:min-w-0"
                data-testid="table-link"
                title={tableFqn}
                to={getEntityDetailsPath(
                  EntityType.TABLE,
                  tableFqn,
                  EntityTabs.PROFILER,
                  ProfilerTabPath.DATA_QUALITY
                )}>
                {tableFqn}
              </Link>
            </Box>
          </Table.Cell>
        )}
        <Table.Cell
          className="tw:whitespace-nowrap"
          style={getColumnLayoutStyle('column', 1)}>
          {columnName ? (
            <p
              className="tw:m-0 tw:max-w-30 tw:text-primary"
              data-testid={columnName}>
              {columnName}
            </p>
          ) : (
            '--'
          )}
        </Table.Cell>
        <Table.Cell
          className="tw:whitespace-nowrap"
          style={getColumnLayoutStyle('incident', 1)}>
          <Box
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}>
            {renderIncidentCell(record)}
          </Box>
        </Table.Cell>
        <Table.Cell
          className="tw:whitespace-nowrap tw:bg-primary tw:group-hover:bg-secondary tw:group-selected:bg-secondary"
          style={getColumnLayoutStyle('actions', 1)}>
          <Box
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}>
            {renderActionsCell(record)}
          </Box>
        </Table.Cell>
      </Table.Row>
    );
  };

  return (
    <div
      className={classNames({
        'data-quality-tab-container': !isUndefined(tableHeader),
      })}>
      {tableHeader && (
        <div className="data-quality-table-header">{tableHeader}</div>
      )}
      {enableBulkActions && hasSelection && (
        <Box
          align="center"
          className="tw:mb-3 tw:rounded-md tw:bg-(--color-bg-secondary) tw:px-4 tw:py-2"
          gap={3}
          wrap="wrap">
          <Box>
            <Typography size="text-sm">
              {t('label.bundle-test-case-selected-count', {
                count: selectedTestCasesForBundle.length,
              })}
            </Typography>
            <Typography
              as="a"
              className="tw:ml-2"
              data-testid="bulk-clear-test-case-selection"
              size="text-sm"
              onClick={() => setSelectedKeys(new Set<string>())}>
              {t('label.clear-selection')}
            </Typography>
          </Box>
          <Box align="center" className="tw:ml-auto" gap={3}>
            <Dropdown.Root>
              <Button
                color="primary"
                data-testid="add-selected-to-bundle-suite"
                iconTrailing={ChevronDown}
                size="sm">
                {t('label.add-to-bundle-suite')}
              </Button>
              <Dropdown.Popover className="tw:min-w-65">
                <Dropdown.Menu
                  items={[
                    {
                      id: 'existing',
                      label: t('label.add-to-existing-bundle-suite'),
                      onAction: () => setIsAddToBundleSuiteModalOpen(true),
                      testId: 'add-to-existing-bundle-suite',
                    },
                    {
                      id: 'new',
                      label: t('label.create-new-bundle-suite'),
                      onAction: () =>
                        handleOpenBundleSuiteForm(selectedTestCasesForBundle),
                      testId: 'create-new-bundle-suite',
                    },
                  ]}>
                  {(item) => (
                    <Dropdown.Item
                      data-testid={item.testId}
                      id={item.id}
                      label={item.label}
                      onAction={item.onAction}
                    />
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </Box>
        </Box>
      )}
      <div
        className={classNames('tw:overflow-x-auto', {
          'test-case-table-container': true,
          'custom-card-with-table':
            !isUndefined(tableHeader) || removeTableBorder,
          'tw:overflow-hidden tw:rounded-xl tw:shadow-xs tw:ring-1 tw:ring-secondary':
            isUndefined(tableHeader) && !removeTableBorder,
        })}>
        <Table
          aria-label={t('label.test-case-plural')}
          data-testid="test-case-table"
          selectedKeys={selectedKeys}
          selectionMode={enableBulkActions ? 'multiple' : 'none'}
          size="sm"
          sortDescriptor={sortDescriptor}
          onSelectionChange={setSelectedKeys}
          onSortChange={handleSortChange}>
          <Table.Header columns={columnList}>
            {(col) => (
              <Table.Head
                allowsSorting={col.allowsSorting}
                className={
                  COLUMN_LAYOUT[col.id]?.fixed === 'right'
                    ? 'tw:bg-secondary'
                    : undefined
                }
                id={col.id}
                isRowHeader={col.id === 'name'}
                key={col.id}
                label={col.name}
                style={getColumnLayoutStyle(col.id, 2)}
              />
            )}
          </Table.Header>
          <Table.Body
            dependencies={[
              isStatusLoading,
              isPermissionLoading,
              testCaseStatus,
              testCasePermissions,
              activeRecordId,
            ]}
            items={isLoading ? [] : sortedData}
            renderEmptyState={() =>
              isLoading ? (
                <div className="tw:p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton
                      className="tw:mb-2"
                      height={40}
                      key={i}
                      width="100%"
                    />
                  ))}
                </div>
              ) : (
                <FilterTablePlaceHolder
                  placeholderText={
                    <Transi18next
                      i18nKey="message.no-data-quality-test-case"
                      renderElement={
                        <a
                          href={DATA_QUALITY_PROFILER_DOCS}
                          rel="noreferrer"
                          target="_blank"
                          title="Data Quality Profiler Documentation"
                        />
                      }
                      values={{
                        explore: t('message.explore-our-guide-here'),
                      }}
                    />
                  }
                />
              )
            }>
            {(record) => renderRow(record)}
          </Table.Body>
        </Table>
      </div>
      {pagingData && showPagination && <NextPrevious {...pagingData} />}
      {enableBulkActions && (
        <AddToBundleSuiteModal
          open={isAddToBundleSuiteModalOpen}
          selectedTestCases={selectedTestCasesForBundle}
          onAddedToExisting={handleAddedToExistingBundleSuite}
          onCancel={() => setIsAddToBundleSuiteModalOpen(false)}
        />
      )}
      {isBundleSuiteFormOpen && (
        <BundleSuiteForm
          drawerProps={{ open: isBundleSuiteFormOpen }}
          initialValues={{ testCases: bundleSuiteFormInitialCases }}
          onCancel={() => {
            setIsBundleSuiteFormOpen(false);
            setBundleSuiteFormInitialCases([]);
          }}
          onSuccess={handleBundleSuiteSuccess}
        />
      )}
      {selectedTestCase?.action === 'UPDATE' && (
        <EditTestCaseModalV1
          open
          testCase={selectedTestCase?.data}
          onCancel={handleCancel}
          onUpdate={onTestUpdate}
        />
      )}

      {removeFromTestSuite ? (
        <ConfirmationModal
          bodyText={t(
            'message.are-you-sure-you-want-to-remove-child-from-parent',
            {
              child: getEntityName(selectedTestCase?.data),
              parent: getEntityName(removeFromTestSuite.testSuite),
            }
          )}
          cancelText={t('label.cancel')}
          confirmText={t('label.remove')}
          header={t('label.remove-entity', { entity: t('label.test-case') })}
          isLoading={isTestCaseRemovalLoading}
          visible={selectedTestCase?.action === 'DELETE'}
          onCancel={handleCancel}
          onConfirm={handleConfirmClick}
        />
      ) : (
        <DeleteWidgetModal
          isRecursiveDelete
          afterDeleteAction={afterDeleteAction}
          allowSoftDelete={false}
          entityId={selectedTestCase?.data?.id ?? ''}
          entityName={getEntityName(selectedTestCase?.data)}
          entityType={EntityType.TEST_CASE}
          visible={selectedTestCase?.action === 'DELETE'}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default DataQualityTab;
