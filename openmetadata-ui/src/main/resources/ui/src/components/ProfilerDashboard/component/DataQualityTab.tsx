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

import Icon from '@ant-design/icons';
import { Button, Row, Space, Table, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty, isUndefined } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconEdit } from '../../../assets/svg/ic-edit.svg';

import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { Operation } from 'generated/entity/policies/policy';
import { checkPermission } from 'utils/PermissionsUtils';
import { getTableTabPath } from '../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { TestCase, TestCaseResult } from '../../../generated/tests/testCase';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import { getTestSuitePath } from '../../../utils/RouterUtils';
import { getDecodedFqn } from '../../../utils/StringsUtils';
import {
  getEntityFqnFromEntityLink,
  getTableExpandableConfig,
  getTestResultBadgeIcon,
} from '../../../utils/TableUtils';
import { getFormattedDateFromSeconds } from '../../../utils/TimeUtils';
import EditTestCaseModal from '../../AddDataQualityTest/EditTestCaseModal';
import DeleteWidgetModal from '../../common/DeleteWidget/DeleteWidgetModal';
import Loader from '../../Loader/Loader';
import { DataQualityTabProps } from '../profilerDashboard.interface';
import TestSummary from './TestSummary';

const DataQualityTab: React.FC<DataQualityTabProps> = ({
  isLoading = false,
  testCases,
  deletedTable = false,
  onTestUpdate,
}) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase>();
  const [editTestCase, setEditTestCase] = useState<TestCase>();

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

  const columns: ColumnsType<TestCase> = useMemo(
    () => [
      {
        title: t('label.last-run-result'),
        dataIndex: 'testCaseResult',
        key: 'testCaseResult',
        width: 130,
        render: (result: TestCaseResult) => (
          <Space size={8}>
            {result?.testCaseStatus && (
              <Icon
                alt="result"
                component={getTestResultBadgeIcon(result.testCaseStatus)}
                style={{ fontSize: '16px' }}
              />
            )}
            <Typography.Text data-testid="test-case-status">
              {result?.testCaseStatus || '--'}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: t('label.last-run'),
        dataIndex: 'testCaseResult',
        key: 'lastRun',
        width: 120,
        render: (result: TestCaseResult) =>
          result?.timestamp
            ? getFormattedDateFromSeconds(result.timestamp)
            : '--',
      },
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 320,
        render: (name: string, record) => (
          <Typography.Text className="break-word" data-testid={name}>
            {getEntityName(record)}
          </Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 350,
        render: (text) => (isEmpty(text) ? '--' : text),
      },
      {
        title: t('label.test-suite'),
        dataIndex: 'testSuite',
        key: 'testSuite',
        render: (value) => {
          return (
            <Link
              data-testid="test-suite-link"
              to={getTestSuitePath(value?.fullyQualifiedName || '')}
              onClick={(e) => e.stopPropagation()}>
              {getEntityName(value)}
            </Link>
          );
        },
      },
      {
        title: t('label.table'),
        dataIndex: 'entityLink',
        key: 'table',
        render: (entityLink) => {
          const tableFqn = getEntityFqnFromEntityLink(entityLink);
          const name = getNameFromFQN(tableFqn);

          return (
            <Link
              data-testid="table-link"
              to={getTableTabPath(tableFqn, 'profiler')}
              onClick={(e) => e.stopPropagation()}>
              {name}
            </Link>
          );
        },
      },
      {
        title: t('label.column'),
        dataIndex: 'entityLink',
        key: 'column',
        render: (entityLink) => {
          const isColumn = entityLink.includes('::columns::');

          if (isColumn) {
            const name = getNameFromFQN(
              getDecodedFqn(
                getEntityFqnFromEntityLink(entityLink, isColumn),
                true
              )
            );

            return name;
          }

          return '--';
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
              {!deletedTable && (
                <Tooltip
                  placement="bottomRight"
                  title={
                    testCaseEditPermission
                      ? t('label.edit')
                      : NO_PERMISSION_FOR_ACTION
                  }>
                  <Button
                    className="flex-center"
                    data-testid={`edit-${record.name}`}
                    disabled={!testCaseEditPermission}
                    icon={<IconEdit width={16} />}
                    type="text"
                    onClick={(e) => {
                      // preventing expand/collapse on click of edit button
                      e.stopPropagation();
                      setEditTestCase(record);
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip
                placement="bottomLeft"
                title={
                  testCaseDeletePermission
                    ? t('label.delete')
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  className="flex-center"
                  data-testid={`delete-${record.name}`}
                  disabled={!testCaseDeletePermission}
                  icon={<IconDelete width={16} />}
                  type="text"
                  onClick={(e) => {
                    // preventing expand/collapse on click of delete button
                    e.stopPropagation();
                    setSelectedTestCase(record);
                  }}
                />
              </Tooltip>
            </Row>
          );
        },
      },
    ],
    [testCaseEditPermission, testCaseDeletePermission, deletedTable]
  );

  return (
    <>
      <Table
        bordered
        className="table-shadow"
        columns={columns}
        data-testid="data-quality-table"
        dataSource={testCases.map((test) => ({ ...test, key: test.name }))}
        expandable={{
          ...getTableExpandableConfig<TestCase>(),
          expandRowByClick: true,
          rowExpandable: () => true,
          expandedRowRender: (recode) => <TestSummary data={recode} />,
        }}
        loading={{
          indicator: <Loader size="small" />,
          spinning: isLoading,
        }}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1600 }}
        size="small"
      />
      <EditTestCaseModal
        testCase={editTestCase as TestCase}
        visible={!isUndefined(editTestCase)}
        onCancel={() => setEditTestCase(undefined)}
        onUpdate={onTestUpdate}
      />

      <DeleteWidgetModal
        afterDeleteAction={onTestUpdate}
        allowSoftDelete={!deletedTable}
        entityId={selectedTestCase?.id || ''}
        entityName={selectedTestCase?.name || ''}
        entityType="testCase"
        visible={!isUndefined(selectedTestCase)}
        onCancel={() => {
          setSelectedTestCase(undefined);
        }}
      />
    </>
  );
};

export default DataQualityTab;
