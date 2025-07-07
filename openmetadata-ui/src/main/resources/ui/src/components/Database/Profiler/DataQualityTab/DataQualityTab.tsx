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

import { Col, Row, Skeleton, Typography } from 'antd';
import { ColumnsType, TablePaginationConfig } from 'antd/lib/table';
import { FilterValue, SorterResult } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isArray, isUndefined, sortBy, toLower } from 'lodash';
import { PagingResponse } from 'Models';
import QueryString from 'qs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
import {
  DeleteIconButton,
  EditIconButton,
} from '../../../common/IconButtons/EditIconButton';
import StatusBadge from '../../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import Table from '../../../common/Table/Table';
import EditTestCaseModalV1 from '../../../DataQuality/AddDataQualityTest/components/EditTestCaseModalV1';
import TestCaseIncidentManagerStatus from '../../../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component';
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
  tableHeader,
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
        width: 120,
        render: (result: TestCaseResult) => {
          return result?.testCaseStatus ? (
            <StatusBadge
              label={result.testCaseStatus}
              status={toLower(result.testCaseStatus) as StatusType}
            />
          ) : (
            '--'
          );
        },
      },
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 300,
        sorter: true,
        sortDirections: ['ascend', 'descend'],
        render: (name: string, record) => {
          const urlData = {
            pathname: getTestCaseDetailPagePath(
              record.fullyQualifiedName ?? ''
            ),
            state: { breadcrumbData },
          };

          return (
            <Typography.Paragraph
              className="m-0"
              data-testid={name}
              style={{ maxWidth: 280 }}>
              <Link to={urlData}>{getEntityName(record)}</Link>
            </Typography.Paragraph>
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

            return (
              <Typography.Paragraph
                className="m-0"
                data-testid={name}
                style={{ maxWidth: 150 }}>
                {name}
              </Typography.Paragraph>
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
        title: t('label.incident'),
        dataIndex: 'testCaseResult',
        key: 'incident',
        width: 120,
        render: (_, record) => {
          const testCaseResult = testCaseStatus.find(
            (status) =>
              status.testCaseReference?.fullyQualifiedName ===
              record.fullyQualifiedName
          );

          if (isStatusLoading) {
            return <Skeleton.Input size="small" />;
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
              data={testCaseResult}
              hasPermission={hasEditPermission}
              onSubmit={handleStatusSubmit}
            />
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

          const deleteBtnTooltip = removeFromTestSuite
            ? t('label.remove')
            : t('label.delete');

          return (
            <Row align="middle" gutter={[8, 8]}>
              <Col>
                <EditIconButton
                  newLook
                  className="flex-center"
                  data-testid={`edit-${record.name}`}
                  disabled={!testCaseEditPermission}
                  size="middle"
                  title={
                    testCaseEditPermission
                      ? t('label.edit')
                      : NO_PERMISSION_FOR_ACTION
                  }
                  onClick={(e) => {
                    // preventing expand/collapse on click of edit button
                    e.stopPropagation();
                    setSelectedTestCase({ data: record, action: 'UPDATE' });
                  }}
                />
              </Col>
              <Col>
                <DeleteIconButton
                  className="flex-center"
                  data-testid={
                    removeFromTestSuite
                      ? `remove-${record.name}`
                      : `delete-${record.name}`
                  }
                  disabled={!testCaseDeletePermission}
                  size="middle"
                  title={
                    testCaseDeletePermission
                      ? deleteBtnTooltip
                      : NO_PERMISSION_FOR_ACTION
                  }
                  onClick={(e) => {
                    // preventing expand/collapse on click of delete button
                    e.stopPropagation();
                    setSelectedTestCase({ data: record, action: 'DELETE' });
                  }}
                />
              </Col>
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
    handleStatusSubmit,
    isEditAllowed,
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
          'custom-card-with-table': !isUndefined(tableHeader),
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
        rowKey="id"
        scroll={{ x: true }}
        size="small"
        onChange={handleTableChange}
      />
      {selectedTestCase?.action === 'UPDATE' && (
        <EditTestCaseModalV1
          open
          testCase={selectedTestCase?.data as TestCase}
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
