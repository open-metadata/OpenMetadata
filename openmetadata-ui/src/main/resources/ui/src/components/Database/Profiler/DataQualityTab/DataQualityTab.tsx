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

import { Button, Col, Row, Skeleton, Space, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isUndefined, sortBy } from 'lodash';
import { PagingResponse } from 'Models';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { getTableTabPath } from '../../../../constants/constants';
import { DATA_QUALITY_PROFILER_DOCS } from '../../../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { TestCaseStatus } from '../../../../generated/configuration/testResultNotificationConfiguration';
import { Operation } from '../../../../generated/entity/policies/policy';
import { TestCase, TestCaseResult } from '../../../../generated/tests/testCase';
import { TestCaseResolutionStatus } from '../../../../generated/tests/testCaseResolutionStatus';
import { getListTestCaseIncidentByStateId } from '../../../../rest/incidentManagerAPI';
import { removeTestCaseFromTestSuite } from '../../../../rest/testAPI';
import { getNameFromFQN, Transi18next } from '../../../../utils/CommonUtils';
import {
  formatDate,
  formatDateTime,
} from '../../../../utils/date-time/DateTimeUtils';
import {
  getColumnNameFromEntityLink,
  getEntityName,
} from '../../../../utils/EntityUtils';
import { getEntityFQN } from '../../../../utils/FeedUtils';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import { getIncidentManagerDetailPagePath } from '../../../../utils/RouterUtils';
import { replacePlus } from '../../../../utils/StringsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import AppBadge from '../../../common/Badge/Badge.component';
import DeleteWidgetModal from '../../../common/DeleteWidget/DeleteWidgetModal';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { StatusBox } from '../../../common/LastRunGraph/LastRunGraph.component';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import Table from '../../../common/Table/Table';
import EditTestCaseModal from '../../../DataQuality/AddDataQualityTest/EditTestCaseModal';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import {
  DataQualityTabProps,
  TableProfilerTab,
  TestCaseAction,
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
}) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const [selectedTestCase, setSelectedTestCase] = useState<TestCaseAction>();
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [testCaseStatus, setTestCaseStatus] = useState<
    TestCaseResolutionStatus[]
  >([]);

  const testCaseEditPermission = useMemo(() => {
    return checkPermission(
      Operation.EditAll,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const testCaseDeletePermission = useMemo(() => {
    return checkPermission(
      Operation.Delete,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const sortedData = useMemo(
    () =>
      sortBy(testCases, (test) => {
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
    }
  };

  const columns = useMemo(() => {
    const data: ColumnsType<TestCase> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 300,
        sorter: (a, b) => a.name.localeCompare(b.name),
        sortDirections: ['ascend', 'descend'],
        render: (name: string, record) => {
          const status = record.testCaseResult?.testCaseStatus;
          const urlData = {
            pathname: getIncidentManagerDetailPagePath(
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
              width: 150,
              render: (entityLink: string) => {
                const tableFqn = getEntityFQN(entityLink);
                const name = getNameFromFQN(tableFqn);

                return (
                  <Link
                    data-testid="table-link"
                    to={{
                      pathname: getTableTabPath(tableFqn, 'profiler'),
                      search: QueryString.stringify({
                        activeTab: TableProfilerTab.DATA_QUALITY,
                      }),
                    }}
                    onClick={(e) => e.stopPropagation()}>
                    {name}
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
        render: (result: TestCaseResult) =>
          result?.timestamp ? formatDateTime(result.timestamp) : '--',
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
    testCaseEditPermission,
    testCaseDeletePermission,
    testCases,
    testCaseStatus,
    isStatusLoading,
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
    } catch (error) {
      // do nothing
    } finally {
      setIsStatusLoading(false);
    }
  };

  useEffect(() => {
    if (testCases.length) {
      fetchTestCaseStatus();
    } else {
      setIsStatusLoading(false);
    }
  }, [testCases]);

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Table
          bordered
          className="test-case-table-container"
          columns={columns}
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
                      <Link
                        rel="noreferrer"
                        target="_blank"
                        to={{ pathname: DATA_QUALITY_PROFILER_DOCS }}
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
          size="small"
        />
      </Col>
      <Col span={24}>
        {pagingData && showPagination && <NextPrevious {...pagingData} />}
      </Col>
      <Col>
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
            visible={selectedTestCase?.action === 'DELETE'}
            onCancel={handleCancel}
            onConfirm={handleConfirmClick}
          />
        ) : (
          <DeleteWidgetModal
            afterDeleteAction={afterDeleteAction}
            allowSoftDelete={false}
            entityId={selectedTestCase?.data?.id ?? ''}
            entityName={getEntityName(selectedTestCase?.data)}
            entityType={EntityType.TEST_CASE}
            visible={selectedTestCase?.action === 'DELETE'}
            onCancel={handleCancel}
          />
        )}
      </Col>
    </Row>
  );
};

export default DataQualityTab;
