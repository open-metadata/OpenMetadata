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

import { Button, Row, Skeleton, Space, Tooltip, Typography } from 'antd';
import { ColumnsType, TablePaginationConfig } from 'antd/lib/table';
import { FilterValue, SorterResult } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isArray, isUndefined, sortBy } from 'lodash';
import { PagingResponse } from 'Models';
import QueryString from 'qs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { DATA_QUALITY_PROFILER_DOCS } from '../../../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
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
import { getListTestCaseIncidentByStateId } from '../../../../rest/incidentManagerAPI';
import { removeTestCaseFromTestSuite } from '../../../../rest/testAPI';
import { getNameFromFQN, Transi18next } from '../../../../utils/CommonUtils';
import {
  formatDate,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
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
import AppBadge from '../../../common/Badge/Badge.component';
import DeleteWidgetModal from '../../../common/DeleteWidget/DeleteWidgetModal';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { StatusBox } from '../../../common/LastRunGraph/LastRunGraph.component';
import Table from '../../../common/Table/Table';
import EditTestCaseModal from '../../../DataQuality/AddDataQualityTest/EditTestCaseModal';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import {
  DataQualityTabProps,
  TableProfilerTab,
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
}) => {
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

  const columns = useMemo(() => {
    const data: ColumnsType<TestCase> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 300,
        sorter: true,
        sortDirections: ['ascend', 'descend'],
        render: (name: string, record) => {
          const status = record.testCaseResult?.testCaseStatus;
          const urlData = {
            pathname: getTestCaseDetailPagePath(
              record.fullyQualifiedName ?? ''
            ),
            state: { breadcrumbData },
          };

          return (
            <Space data-testid={name}>
              <Tooltip title={status}>
                <div>
                  <StatusBox status={status?.toLocaleLowerCase()} />
                </div>
              </Tooltip>

              <Typography.Paragraph className="m-0" style={{ maxWidth: 280 }}>
                <Link to={urlData}>{getEntityName(record)}</Link>
              </Typography.Paragraph>
            </Space>
          );
        },
      },
      ...(showTableColumn
        ? ([
            {
              title: t('label.table'),
              dataIndex: 'entityLink',
              key: 'table',
              width: 200,
              render: (entityLink: string) => {
                const tableFqn = getEntityFQN(entityLink);

                return (
                  <Link
                    className="break-word"
                    data-testid="table-link"
                    to={{
                      pathname: getEntityDetailsPath(
                        EntityType.TABLE,
                        tableFqn,
                        EntityTabs.PROFILER
                      ),
                      search: QueryString.stringify({
                        activeTab: TableProfilerTab.DATA_QUALITY,
                      }),
                    }}
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
        width: 150,
        render: (entityLink) => {
          const isColumn = entityLink.includes('::columns::');
          if (isColumn) {
            const name = replacePlus(
              getColumnNameFromEntityLink(entityLink) ?? ''
            );

            return name;
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
        title: t('label.last-run'),
        dataIndex: 'testCaseResult',
        key: 'lastRun',
        width: 150,
        sorter: true,
        render: (result: TestCaseResult) =>
          result?.timestamp ? formatDateTimeLong(result.timestamp) : '--',
      },
      {
        title: t('label.incident'),
        dataIndex: 'testCaseResult',
        key: 'incident',
        width: 100,
        render: (_, record) => {
          const testCaseResult = testCaseStatus.find(
            (status) =>
              status.testCaseReference?.fullyQualifiedName ===
              record.fullyQualifiedName
          );
          const label = testCaseResult?.testCaseResolutionStatusType;

          if (isStatusLoading) {
            return <Skeleton.Input size="small" />;
          }

          return label ? (
            <Tooltip
              placement="bottom"
              title={
                testCaseResult?.updatedAt &&
                `${formatDate(testCaseResult.updatedAt)}
                    ${
                      testCaseResult.updatedBy
                        ? 'by ' + getEntityName(testCaseResult.updatedBy)
                        : ''
                    }`
              }>
              <span data-testid={`${record.name}-status`}>
                <AppBadge
                  className={classNames(
                    'resolution',
                    label.toLocaleLowerCase()
                  )}
                  label={label}
                />
              </span>
            </Tooltip>
          ) : (
            '--'
          );
        },
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 100,
        fixed: 'right',
        render: (_, record) => {
          if (isPermissionLoading) {
            return <Skeleton.Input size="small" />;
          }

          const testCasePermission = testCasePermissions.find(
            (permission) =>
              permission.fullyQualifiedName === record.fullyQualifiedName
          );

          const testCaseEditPermission =
            isEditAllowed || testCasePermission?.EditAll;
          const testCaseDeletePermission = testCasePermission?.Delete;

          return (
            <Row align="middle">
              <Tooltip
                title={
                  testCaseEditPermission
                    ? t('label.edit')
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  className="flex-center"
                  data-testid={`edit-${record.name}`}
                  disabled={!testCaseEditPermission}
                  icon={<IconEdit width={14} />}
                  size="small"
                  type="text"
                  onClick={(e) => {
                    // preventing expand/collapse on click of edit button
                    e.stopPropagation();
                    setSelectedTestCase({ data: record, action: 'UPDATE' });
                  }}
                />
              </Tooltip>

              {removeFromTestSuite ? (
                <Tooltip
                  title={
                    testCaseDeletePermission
                      ? t('label.remove')
                      : NO_PERMISSION_FOR_ACTION
                  }>
                  <Button
                    className="flex-center"
                    data-testid={`remove-${record.name}`}
                    disabled={!testCaseDeletePermission}
                    icon={<IconDelete width={14} />}
                    size="small"
                    type="text"
                    onClick={(e) => {
                      // preventing expand/collapse on click of delete button
                      e.stopPropagation();
                      setSelectedTestCase({ data: record, action: 'DELETE' });
                    }}
                  />
                </Tooltip>
              ) : (
                <Tooltip
                  title={
                    testCaseDeletePermission
                      ? t('label.delete')
                      : NO_PERMISSION_FOR_ACTION
                  }>
                  <Button
                    className="flex-center"
                    data-testid={`delete-${record.name}`}
                    disabled={!testCaseDeletePermission}
                    icon={<IconDelete width={14} />}
                    size="small"
                    type="text"
                    onClick={(e) => {
                      // preventing expand/collapse on click of delete button
                      e.stopPropagation();
                      setSelectedTestCase({ data: record, action: 'DELETE' });
                    }}
                  />
                </Tooltip>
              )}
            </Row>
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
    <>
      <Table
        columns={columns}
        containerClassName="test-case-table-container"
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
        rowKey="id"
        scroll={{ x: true }}
        size="small"
        onChange={handleTableChange}
      />
      <EditTestCaseModal
        testCase={selectedTestCase?.data as TestCase}
        visible={selectedTestCase?.action === 'UPDATE'}
        onCancel={handleCancel}
        onUpdate={onTestUpdate}
      />

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
    </>
  );
};

export default DataQualityTab;
