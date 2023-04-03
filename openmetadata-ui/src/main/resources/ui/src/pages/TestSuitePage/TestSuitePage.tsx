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
  Col,
  Row,
  Space,
  Switch,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import DeleteWidgetModal from 'components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { useAuth } from 'hooks/authHooks';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { getListTestSuites } from 'rest/testAPI';
import { getEntityName } from 'utils/EntityUtils';
import { checkPermission } from 'utils/PermissionsUtils';
import { ReactComponent as IconDelete } from '../../assets/svg/ic-delete.svg';
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
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { pluralize } from '../../utils/CommonUtils';
import { getTestSuitePath } from '../../utils/RouterUtils';

const TestSuitePage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [testSuites, setTestSuites] = useState<Array<TestSuite>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testSuitePage, setTestSuitePage] = useState(INITIAL_PAGING_VALUE);
  const [testSuitePaging, setTestSuitePaging] = useState<Paging>(pagingObject);
  const [selectedTestSuite, setSelectedTestSuite] = useState<TestSuite>();
  const [showDeleted, setShowDeleted] = useState(false);

  const { permissions } = usePermissionProvider();

  const createPermission = useMemo(() => {
    return checkPermission(
      Operation.Create,
      ResourceEntity.TEST_SUITE,
      permissions
    );
  }, [permissions]);

  const handleShowDeleted = (checked: boolean) => {
    setShowDeleted(checked);
  };

  const fetchTestSuites = async (param?: Record<string, string>) => {
    try {
      setIsLoading(true);
      const response = await getListTestSuites({
        fields: 'owner,tests',
        limit: PAGE_SIZE_MEDIUM,
        before: param && param.before,
        after: param && param.after,
        include: showDeleted ? Include.Deleted : Include.NonDeleted,
      });
      setTestSuites(response.data);
      setTestSuitePaging(response.paging);
    } catch (err) {
      setTestSuitePaging(pagingObject);
    } finally {
      setIsLoading(false);
    }
  };

  const hasDeleteAccess = useMemo(
    () =>
      isAdminUser ||
      isAuthDisabled ||
      permissions.testSuite.Delete ||
      permissions.testSuite.All,
    [isAdminUser, isAuthDisabled, Permissions]
  );
  const columns = useMemo(() => {
    const col: ColumnsType<TestSuite> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record) => (
          <Link
            data-testid={`test-suite-${record.name}`}
            to={getTestSuitePath(record.name)}>
            {getEntityName(record)}
          </Link>
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

      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 50,
        render: (_, record) => {
          return (
            <Row align="middle">
              <Tooltip
                placement="bottomLeft"
                title={
                  hasDeleteAccess ? t('label.delete') : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  className="flex-center"
                  data-testid={`delete-${record.name}`}
                  disabled={!hasDeleteAccess}
                  icon={<IconDelete width={16} />}
                  type="text"
                  onClick={(e) => {
                    // preventing expand/collapse on click of delete button
                    e.stopPropagation();
                    setSelectedTestSuite(record);
                  }}
                />
              </Tooltip>
            </Row>
          );
        },
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
  }, [showDeleted]);

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
        type={ERROR_PLACEHOLDER_TYPE.ADD}
      />
    ),
    [createPermission]
  );

  if (isLoading) {
    return <Loader />;
  }

  if (isEmpty(testSuites) && !showDeleted) {
    return <PageContainerV1>{fetchErrorPlaceHolder()}</PageContainerV1>;
  }

  return (
    <PageContainerV1>
      <PageLayoutV1 pageTitle={t('label.test-suite')}>
        <Row>
          <Col span={24}>
            <Space align="center" className="w-full justify-between" size={16}>
              <TitleBreadcrumb titleLinks={TEST_SUITE_BREADCRUMB} />

              <Space align="center" className="w-full justify-end" size={16}>
                <Space align="end" size={5}>
                  <Switch
                    checked={showDeleted}
                    data-testid="switch-deleted"
                    onClick={handleShowDeleted}
                  />
                  <label htmlFor="switch-deleted">
                    {t('label.show-deleted')}
                  </label>
                </Space>
                <Tooltip
                  placement="topRight"
                  title={
                    !createPermission && t('message.no-permission-for-action')
                  }>
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
            </Space>
          </Col>

          <Col className="m-t-lg" span={24}>
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
        <DeleteWidgetModal
          afterDeleteAction={fetchTestSuites}
          allowSoftDelete={!showDeleted}
          entityId={selectedTestSuite?.id || ''}
          entityName={selectedTestSuite?.name || ''}
          entityType="testSuite"
          prepareType={false}
          visible={!isUndefined(selectedTestSuite)}
          onCancel={() => {
            setSelectedTestSuite(undefined);
          }}
        />
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default TestSuitePage;
