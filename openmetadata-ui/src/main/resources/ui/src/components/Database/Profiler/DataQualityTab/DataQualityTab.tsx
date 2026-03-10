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
  Button,
  Dropdown,
  Skeleton,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { DotsVertical } from '@untitledui/icons';
import { ColumnsType, TablePaginationConfig } from 'antd/lib/table';
import { FilterValue, SorterResult } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isArray, isUndefined, sortBy, toLower } from 'lodash';
import { PagingResponse } from 'Models';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
import { TestCasePageTabs } from '../../../../pages/IncidentManager/IncidentManager.interface';
import { getListTestCaseIncidentByStateId } from '../../../../rest/incidentManagerAPI';
import { removeTestCaseFromTestSuite } from '../../../../rest/testAPI';
import { getNameFromFQN, Transi18next } from '../../../../utils/CommonUtils';
import {
  getColumnNameFromEntityLink,
  getEntityName,
} from '../../../../utils/EntityUtils';
import { getEntityFQN } from '../../../../utils/FeedUtils';
import {
  getEntityDetailsPath,
  getTestCaseDetailPagePath,
} from '../../../../utils/RouterUtils';
import { replacePlus } from '../../../../utils/StringsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DateTimeDisplay from '../../../common/DateTimeDisplay/DateTimeDisplay';
import DeleteWidgetModal from '../../../common/DeleteWidget/DeleteWidgetModal';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import StatusBadge from '../../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import Table from '../../../common/Table/Table';
import EditTestCaseModalV1 from '../../../DataQuality/AddDataQualityTest/components/EditTestCaseModalV1';
import TestCaseIncidentManagerStatus from '../../../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import {
  DataQualityTabProps,
  ProfilerTabPath,
  TestCaseAction,
  TestCasePermission,
} from '../ProfilerDashboard/profilerDashboard.interface';
import './data-quality-tab.less';

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
}: DataQualityTabProps) => {
  const { t } = useTranslation();
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
  const isApiSortingEnabled = useRef(false);

  const sortedData = useMemo(
    () =>
      isApiSortingEnabled.current
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
          }),
    [testCases]
  );

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
        if (item.stateId === value.stateId) {
          return value;
        }

        return item;
      });
    });
  };

  const columns = useMemo(() => {
    const data: ColumnsType<TestCase> = [
      {
        title: t('label.status'),
        dataIndex: 'testCaseResult',
        key: 'status',
        width: 80,
        render: (result: TestCaseResult, record) => {
          return result?.testCaseStatus ? (
            <StatusBadge
              dataTestId={`status-badge-${record.name}`}
              label={TEST_CASE_STATUS_LABELS[result.testCaseStatus]}
              status={toLower(result.testCaseStatus) as StatusType}
            />
          ) : (
            '--'
          );
        },
      },
      {
        title: t('label.failed-slash-aborted-reason'),
        dataIndex: 'testCaseResult',
        key: 'reason',
        width: 200,
        render: (result: TestCaseResult, record: TestCase) => {
          return result?.result &&
            result.testCaseStatus !== TestCaseStatus.Success ? (
            <Tooltip placement="top" title={result.result}>
              <p
                className="tw:m-0 tw:line-clamp-2 tw:cursor-pointer tw:wrap-break-word tw:text-sm"
                data-testid={`reason-text-${record.name}`}>
                {result.result}
              </p>
            </Tooltip>
          ) : (
            '--'
          );
        },
      },
      {
        title: t('label.last-run'),
        dataIndex: 'testCaseResult',
        key: 'lastRun',
        width: 150,
        sorter: true,
        render: (result: TestCaseResult) => {
          return <DateTimeDisplay timestamp={result?.timestamp} />;
        },
      },
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
        sorter: true,
        sortDirections: ['ascend', 'descend'],
        render: (name: string, record) => {
          const urlData = {
            pathname: getTestCaseDetailPagePath(
              record.fullyQualifiedName ?? ''
            ),
          };

          return (
            <p className="tw:m-0 tw:max-w-70" data-testid={name}>
              <Link state={{ breadcrumbData }} to={urlData}>
                {getEntityName(record)}
              </Link>
            </p>
          );
        },
      },
      ...(showTableColumn
        ? ([
            {
              title: t('label.table'),
              dataIndex: 'entityLink',
              key: 'table',
              width: 150,
              render: (entityLink: string) => {
                const tableFqn = getEntityFQN(entityLink);

                return (
                  <Link
                    className="break-word"
                    data-testid="table-link"
                    to={getEntityDetailsPath(
                      EntityType.TABLE,
                      tableFqn,
                      EntityTabs.PROFILER,
                      ProfilerTabPath.DATA_QUALITY
                    )}
                    onClick={(e) => e.stopPropagation()}>
                    {tableFqn}
                  </Link>
                );
              },
              sorter: (a, b) => {
                // Extract table name from entity link
                const tableAFqn = getEntityFQN(a.entityLink);
                const tableA = getNameFromFQN(tableAFqn);
                const tableBFqn = getEntityFQN(b.entityLink);
                const tableB = getNameFromFQN(tableBFqn);

                return tableA.localeCompare(tableB);
              },
              sortDirections: ['ascend', 'descend'],
            },
          ] as ColumnsType<TestCase>)
        : []),
      {
        title: t('label.column'),
        dataIndex: 'entityLink',
        key: 'column',
        width: 80,
        render: (entityLink) => {
          const isColumn = entityLink.includes('::columns::');
          if (isColumn) {
            const name = replacePlus(
              getColumnNameFromEntityLink(entityLink) ?? ''
            );

            return (
              <p className="tw:m-0 tw:max-w-30" data-testid={name}>
                {name}
              </p>
            );
          }

          return '--';
        },
        sorter: (a, b) => {
          // Extract column name from entity link if available
          const columnA = a.entityLink.includes('::columns::')
            ? replacePlus(getColumnNameFromEntityLink(a.entityLink))
            : '--';

          const columnB = b.entityLink.includes('::columns::')
            ? replacePlus(getColumnNameFromEntityLink(b.entityLink))
            : '--';

          return columnA.localeCompare(columnB);
        },
        sortDirections: ['ascend', 'descend'],
      },
      {
        title: t('label.incident'),
        dataIndex: 'testCaseResult',
        key: 'incident',
        width: 80,
        render: (_, record) => {
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

          // Check if user has permission to edit incident status
          const testCasePermission = testCasePermissions.find(
            (permission) =>
              permission.fullyQualifiedName === record.fullyQualifiedName
          );
          const hasEditPermission =
            isEditAllowed || testCasePermission?.EditAll;

          return (
            <TestCaseIncidentManagerStatus
              isInline
              data={testCaseResult}
              hasPermission={hasEditPermission}
              onSubmit={handleStatusSubmit}
            />
          );
        },
      },
      {
        dataIndex: 'actions',
        key: 'actions',
        width: 50,
        fixed: 'right',
        render: (_, record) => {
          if (isPermissionLoading) {
            return <Skeleton height={30} width={30} />;
          }

          const dimensions = record.dimensionColumns ?? [];

          const testCasePermission = testCasePermissions.find(
            (permission) =>
              permission.fullyQualifiedName === record.fullyQualifiedName
          );

          const testCaseEditPermission =
            isEditAllowed || testCasePermission?.EditAll;
          const testCaseDeletePermission =
            removeFromTestSuite?.isAllowed || testCasePermission?.Delete;

          const deleteBtnLabel = removeFromTestSuite
            ? t('label.remove')
            : t('label.delete');

          const hasAnyPermission =
            testCaseEditPermission || testCaseDeletePermission;

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
                    to={getTestCaseDetailPagePath(
                      record.fullyQualifiedName ?? '',
                      TestCasePageTabs.DIMENSIONALITY
                    )}>
                    <div
                      className="tw:flex tw:items-center tw:gap-2 tw:rounded-md tw:bg-blue-50 tw:p-2 tw:text-primary"
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
        },
      },
    ];

    return data;
  }, [
    testCases,
    testCaseStatus,
    isStatusLoading,
    isPermissionLoading,
    testCasePermissions,
    handleStatusSubmit,
    isEditAllowed,
    activeRecordId,
  ]);

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
      const testCaseStatus = await Promise.allSettled(promises);
      const data = testCaseStatus.reduce((acc, status) => {
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

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<TestCase> | SorterResult<TestCase>[]
  ) => {
    if (!isArray(sorter) && fetchTestCases) {
      if (sorter?.columnKey === 'lastRun' || sorter?.columnKey === 'name') {
        const sortData = isUndefined(sorter.order)
          ? undefined
          : {
              sortField:
                sorter?.columnKey === 'lastRun'
                  ? 'testCaseResult.timestamp'
                  : 'name.keyword',
              sortType:
                sorter?.order === 'ascend' ? SORT_ORDER.ASC : SORT_ORDER.DESC,
            };
        isApiSortingEnabled.current = !isUndefined(sorter.order);
        fetchTestCases(sortData);
      }
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

  return (
    <div
      className={classNames({
        'data-quality-tab-container': !isUndefined(tableHeader),
      })}>
      {tableHeader && (
        <div className="data-quality-table-header">{tableHeader}</div>
      )}
      <Table
        columns={columns}
        containerClassName={classNames('test-case-table-container', {
          'custom-card-with-table':
            !isUndefined(tableHeader) || removeTableBorder,
        })}
        {...(pagingData && showPagination
          ? {
              customPaginationProps: {
                ...pagingData,
                showPagination,
              },
            }
          : {})}
        data-testid="test-case-table"
        dataSource={sortedData}
        loading={isLoading}
        locale={{
          emptyText: (
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
          ),
        }}
        pagination={false}
        rowKey="fullyQualifiedName"
        scroll={{ x: true }}
        onChange={handleTableChange}
      />
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
