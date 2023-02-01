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

import { Button, Col, Row, Space, Table, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { getListTestSuites } from 'rest/testAPI';
import { checkPermission } from 'utils/PermissionsUtils';
import {
  INITIAL_PAGING_VALUE,
  MAX_CHAR_LIMIT_TEST_SUITE,
  PAGE_SIZE_MEDIUM,
  pagingObject,
  ROUTES,
} from '../../constants/constants';
import { WEBHOOK_DOCS } from '../../constants/docs.constants';
import { TEST_SUITE_BREADCRUMB } from '../../constants/TestSuite.constant';
import { Operation } from '../../generated/entity/policies/policy';
import { TestSuite } from '../../generated/tests/testSuite';
import { Paging } from '../../generated/type/paging';
import { getEntityName, pluralize } from '../../utils/CommonUtils';
import { getTestSuitePath } from '../../utils/RouterUtils';

const TestSuitePage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [testSuites, setTestSuites] = useState<Array<TestSuite>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testSuitePage, setTestSuitePage] = useState(INITIAL_PAGING_VALUE);
  const [testSuitePaging, setTestSuitePaging] = useState<Paging>(pagingObject);
  const { permissions } = usePermissionProvider();

  const createPermission = useMemo(() => {
    return checkPermission(
      Operation.Create,
      ResourceEntity.TEST_SUITE,
      permissions
    );
  }, [permissions]);

  const fetchTestSuites = async (param?: Record<string, string>) => {
    try {
      setIsLoading(true);
      const response = await getListTestSuites({
        fields: 'owner,tests',
        limit: PAGE_SIZE_MEDIUM,
        before: param && param.before,
        after: param && param.after,
      });
      setTestSuites(response.data);
      setTestSuitePaging(response.paging);
    } catch (err) {
      setTestSuitePaging(pagingObject);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = useMemo(() => {
    const col: ColumnsType<TestSuite> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record) => (
          <Link to={getTestSuitePath(record.name)}>{record.name}</Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 500,
        render: (description) => (
          <Tooltip
            overlayStyle={{ maxWidth: '400px' }}
            placement="topLeft"
            title={
              description.length > MAX_CHAR_LIMIT_TEST_SUITE && description
            }>
            <Typography.Paragraph className="ant-typography-ellipsis-custom">
              <RichTextEditorPreviewer
                enableSeeMoreVariant={false}
                markdown={description}
                maxLength={MAX_CHAR_LIMIT_TEST_SUITE}
              />
            </Typography.Paragraph>
          </Tooltip>
        ),
      },
      {
        title: t('label.no-of-test'),
        dataIndex: 'noOfTests',
        key: 'noOfTests',
        render: (_, record) => (
          <Typography.Text>
            {pluralize(record?.tests?.length || 0, 'Test')}
          </Typography.Text>
        ),
      },
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        render: (_, record) => (
          <span>{getEntityName(record.owner) || '--'}</span>
        ),
      },
    ];

    return col;
  }, [testSuites]);

  const testSuitePagingHandler = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    setTestSuitePage(activePage as number);
    fetchTestSuites({
      [cursorValue]: testSuitePaging[cursorValue as keyof Paging] as string,
    });
  };

  const onAddTestSuite = () => history.push(ROUTES.ADD_TEST_SUITES);

  useEffect(() => {
    fetchTestSuites();
  }, []);

  const fetchErrorPlaceHolder = useCallback(
    () => (
      <ErrorPlaceHolder
        buttons={
          <p className="text-center">
            <Button
              ghost
              className="h-8 rounded-4 tw-m-y-sm"
              data-testid="add-test-suite-button"
              disabled={!createPermission}
              size="small"
              type="primary"
              onClick={onAddTestSuite}>
              {t('label.add-entity', {
                entity: t('label.test-suite'),
              })}
            </Button>
          </p>
        }
        doc={WEBHOOK_DOCS}
        heading="Test Suite"
        type="ADD_DATA"
      />
    ),
    []
  );

  if (isLoading) {
    return <Loader />;
  }

  if (isEmpty(testSuites)) {
    return fetchErrorPlaceHolder();
  }

  return (
    <PageLayoutV1>
      <Space align="center" className="w-full justify-between" size={16}>
        <TitleBreadcrumb titleLinks={TEST_SUITE_BREADCRUMB} />
        <Tooltip
          placement="topRight"
          title={!createPermission && t('message.no-permission-for-action')}>
          <Button
            data-testid="add-test-suite"
            disabled={!createPermission}
            type="primary"
            onClick={onAddTestSuite}>
            {t('label.add-entity', {
              entity: t('label.test-suite'),
            })}
          </Button>
        </Tooltip>
      </Space>

      <Row className="w-full mt-4">
        <Col span={24}>
          <Table
            bordered
            columns={columns}
            data-testid="test-suite-table"
            dataSource={testSuites}
            loading={{ spinning: isLoading, indicator: <Loader /> }}
            pagination={false}
            rowKey="name"
            size="small"
          />
        </Col>
        {testSuitePaging.total > PAGE_SIZE_MEDIUM && (
          <Col span={24}>
            <NextPrevious
              currentPage={testSuitePage}
              pageSize={PAGE_SIZE_MEDIUM}
              paging={testSuitePaging}
              pagingHandler={testSuitePagingHandler}
              totalCount={testSuitePaging.total}
            />
          </Col>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default TestSuitePage;
