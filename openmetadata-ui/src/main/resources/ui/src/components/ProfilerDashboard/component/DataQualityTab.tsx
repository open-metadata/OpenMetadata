/*
 *  Copyright 2022 Collate
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

import { Button, Row, Space, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined } from 'lodash';
import moment from 'moment';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as ArrowDown } from '../../../assets/svg/arrow-down.svg';
import { ReactComponent as ArrowRight } from '../../../assets/svg/arrow-right.svg';
import { getTableTabPath } from '../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { TestCase, TestCaseResult } from '../../../generated/tests/testCase';
import { getEntityName, getNameFromFQN } from '../../../utils/CommonUtils';
import { getTestSuitePath } from '../../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import {
  getEntityFqnFromEntityLink,
  getTestResultBadgeIcon,
} from '../../../utils/TableUtils';
import EditTestCaseModal from '../../AddDataQualityTest/EditTestCaseModal';
import DeleteWidgetModal from '../../common/DeleteWidget/DeleteWidgetModal';
import { DataQualityTabProps } from '../profilerDashboard.interface';
import TestSummary from './TestSummary';

const DataQualityTab: React.FC<DataQualityTabProps> = ({
  testCases,
  onTestUpdate,
  hasAccess,
}) => {
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase>();
  const [editTestCase, setEditTestCase] = useState<TestCase>();

  const columns: ColumnsType<TestCase> = useMemo(() => {
    return [
      {
        title: 'Last Run Result',
        dataIndex: 'testCaseResult',
        key: 'testCaseResult',
        render: (result: TestCaseResult) => (
          <Space size={8}>
            {result?.testCaseStatus && (
              <SVGIcons
                alt="result"
                className="tw-w-4"
                icon={getTestResultBadgeIcon(result.testCaseStatus)}
              />
            )}
            <span>{result?.testCaseStatus || '--'}</span>
          </Space>
        ),
      },
      {
        title: 'Last Run',
        dataIndex: 'testCaseResult',
        key: 'lastRun',
        render: (result: TestCaseResult) =>
          result?.timestamp
            ? moment.unix(result.timestamp || 0).format('DD/MMM HH:mm')
            : '--',
      },
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        render: (name: string) => <span data-testid={name}>{name}</span>,
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
      },
      {
        title: 'Test Suite',
        dataIndex: 'testSuite',
        key: 'testSuite',
        render: (value) => {
          return (
            <Link
              to={getTestSuitePath(value?.fullyQualifiedName || '')}
              onClick={(e) => e.stopPropagation()}>
              {getEntityName(value)}
            </Link>
          );
        },
      },
      {
        title: 'Table',
        dataIndex: 'entityLink',
        key: 'table',
        render: (entityLink) => {
          const tableFqn = getEntityFqnFromEntityLink(entityLink);
          const name = getNameFromFQN(tableFqn);

          return (
            <Link
              to={getTableTabPath(tableFqn, 'profiler')}
              onClick={(e) => e.stopPropagation()}>
              {name}
            </Link>
          );
        },
      },
      {
        title: 'Column',
        dataIndex: 'entityLink',
        key: 'column',
        render: (entityLink) => {
          const isColumn = entityLink.includes('::columns::');

          if (isColumn) {
            const name = getNameFromFQN(
              getEntityFqnFromEntityLink(entityLink, isColumn)
            );

            return name;
          }

          return isColumn
            ? getNameFromFQN(getEntityFqnFromEntityLink(entityLink, isColumn))
            : '--';
        },
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        key: 'actions',
        width: 100,
        render: (_, record) => {
          return (
            <Row align="middle">
              <Tooltip
                placement="bottomLeft"
                title={hasAccess ? 'Delete' : NO_PERMISSION_FOR_ACTION}>
                <Button
                  className="flex-center"
                  data-testid={`delete-${record.name}`}
                  disabled={!hasAccess}
                  icon={
                    <SVGIcons
                      alt="Delete"
                      className="tw-h-4"
                      icon={Icons.DELETE}
                    />
                  }
                  type="text"
                  onClick={(e) => {
                    // preventing expand/collapse on click of delete button
                    e.stopPropagation();
                    setSelectedTestCase(record);
                  }}
                />
              </Tooltip>
              <Tooltip
                placement="bottomRight"
                title={hasAccess ? 'Edit' : NO_PERMISSION_FOR_ACTION}>
                <Button
                  className="flex-center"
                  data-testid={`edit-${record.name}`}
                  disabled={!hasAccess}
                  icon={
                    <SVGIcons
                      alt="edit"
                      className="tw-h-4"
                      icon={Icons.EDIT}
                      title="Edit"
                    />
                  }
                  type="text"
                  onClick={(e) => {
                    // preventing expand/collapse on click of edit button
                    e.stopPropagation();
                    setEditTestCase(record);
                  }}
                />
              </Tooltip>
            </Row>
          );
        },
      },
    ];
  }, [hasAccess]);

  return (
    <>
      <Table
        columns={columns}
        dataSource={testCases.map((test) => ({ ...test, key: test.name }))}
        expandable={{
          expandRowByClick: true,
          rowExpandable: () => true,
          expandedRowRender: (recode) => <TestSummary data={recode} />,
          expandIcon: ({ expanded, onExpand, record }) =>
            expanded ? (
              <ArrowDown
                className="mx-auto"
                onClick={(e: React.MouseEvent) =>
                  onExpand(
                    record,
                    e as React.MouseEvent<HTMLElement, MouseEvent>
                  )
                }
              />
            ) : (
              <ArrowRight
                className="mx-auto"
                onClick={(e: React.MouseEvent) =>
                  onExpand(
                    record,
                    e as React.MouseEvent<HTMLElement, MouseEvent>
                  )
                }
              />
            ),
        }}
        pagination={false}
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
        entityId={selectedTestCase?.id || ''}
        entityName={selectedTestCase?.name || ''}
        entityType="testCase"
        prepareType={false}
        visible={!isUndefined(selectedTestCase)}
        onCancel={() => {
          setSelectedTestCase(undefined);
        }}
      />
    </>
  );
};

export default DataQualityTab;
