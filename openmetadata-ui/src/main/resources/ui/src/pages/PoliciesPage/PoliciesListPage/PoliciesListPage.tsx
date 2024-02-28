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

import { Button, Col, Popover, Row, Space, Tag, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import DeleteWidgetModal from '../../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewer from '../../../components/common/RichTextEditor/RichTextEditorPreviewer';
import Table from '../../../components/common/Table/Table';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { PAGE_SIZE_MEDIUM, ROUTES } from '../../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import {
  NO_PERMISSION_FOR_ACTION,
  NO_PERMISSION_TO_VIEW,
} from '../../../constants/HelperTextUtil';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { Operation, Policy } from '../../../generated/entity/policies/policy';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getPolicies } from '../../../rest/rolesAPIV1';
import { getEntityName } from '../../../utils/EntityUtils';
import { getSettingPageEntityBreadCrumb } from '../../../utils/GlobalSettingsUtils';
import {
  checkPermission,
  LIST_CAP,
  userPermissions,
} from '../../../utils/PermissionsUtils';
import {
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './policies-list.less';

const PoliciesListPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [selectedPolicy, setSelectedPolicy] = useState<Policy>();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const {
    currentPage,
    handlePageChange,
    paging,
    handlePagingChange,
    pageSize,
    handlePageSizeChange,
    showPagination,
  } = usePaging(PAGE_SIZE_MEDIUM);

  const { permissions } = usePermissionProvider();

  const addPolicyPermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.POLICY, permissions)
    );
  }, [permissions]);
  const deletePolicyPermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      checkPermission(Operation.Delete, ResourceEntity.POLICY, permissions)
    );
  }, [permissions]);

  const viewRolePermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      userPermissions?.hasViewPermissions(ResourceEntity.ROLE, permissions)
    );
  }, [permissions]);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.ACCESS,
        t('label.policy-plural')
      ),
    []
  );

  const columns: ColumnsType<Policy> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => (
          <Link
            className="link-hover"
            data-testid="policy-name"
            to={
              record.fullyQualifiedName
                ? getPolicyWithFqnPath(record.fullyQualifiedName)
                : ''
            }>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (_, record) => (
          <RichTextEditorPreviewer markdown={record?.description ?? ''} />
        ),
      },
      {
        title: t('label.role-plural'),
        dataIndex: 'roles',
        width: '250px',
        key: 'roles',
        render: (_, record) => {
          const listLength = record.roles?.length ?? 0;
          const hasMore = listLength > LIST_CAP;

          return record.roles?.length ? (
            <Space wrap data-testid="role-link" size={4}>
              {record.roles.slice(0, LIST_CAP).map((role) =>
                viewRolePermission ? (
                  <Link
                    key={uniqueId()}
                    to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
                    {getEntityName(role)}
                  </Link>
                ) : (
                  <Tooltip key={uniqueId()} title={NO_PERMISSION_TO_VIEW}>
                    {getEntityName(role)}
                  </Tooltip>
                )
              )}
              {hasMore && (
                <Popover
                  className="cursor-pointer"
                  content={
                    <Space wrap size={4}>
                      {record.roles.slice(LIST_CAP).map((role) =>
                        viewRolePermission ? (
                          <Link
                            key={uniqueId()}
                            to={getRoleWithFqnPath(
                              role.fullyQualifiedName || ''
                            )}>
                            {getEntityName(role)}
                          </Link>
                        ) : (
                          <Tooltip
                            key={uniqueId()}
                            title={NO_PERMISSION_TO_VIEW}>
                            {getEntityName(role)}
                          </Tooltip>
                        )
                      )}
                    </Space>
                  }
                  overlayClassName="w-40 text-center"
                  trigger="click">
                  <Tag className="m-l-xss" data-testid="plus-more-count">{`+${
                    listLength - LIST_CAP
                  } more`}</Tag>
                </Popover>
              )}
            </Space>
          ) : (
            '-- '
          );
        },
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        width: '80px',
        align: 'center',
        key: 'actions',
        render: (_, record) => {
          return (
            <Tooltip
              placement="left"
              title={
                deletePolicyPermission
                  ? t('label.delete-entity', {
                      entity: t('label.policy'),
                    })
                  : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                data-testid={`delete-action-${getEntityName(record)}`}
                disabled={!deletePolicyPermission}
                icon={<IconDelete name={t('label.delete')} width="16px" />}
                type="text"
                onClick={() => setSelectedPolicy(record)}
              />
            </Tooltip>
          );
        },
      },
    ];
  }, []);

  const fetchPolicies = async (paging?: Paging) => {
    setIsLoading(true);
    try {
      const data = await getPolicies(
        'roles',
        paging?.after,
        paging?.before,
        pageSize
      );

      setPolicies(data.data || []);
      handlePagingChange(data.paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAfterDeleteAction = useCallback(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleAddPolicy = () => {
    history.push(ROUTES.ADD_POLICY);
  };

  const handlePaging = ({ currentPage, cursorType }: PagingHandlerParams) => {
    handlePageChange(currentPage);
    if (cursorType && paging) {
      fetchPolicies({
        [cursorType]: paging[cursorType],
        total: paging?.total,
      } as Paging);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [pageSize]);

  return (
    <PageLayoutV1 pageTitle={t('label.policy-plural')}>
      <Row
        className="policies-list-container page-container"
        data-testid="policies-list-container"
        gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Space className="w-full justify-between">
            <PageHeader data={PAGE_HEADERS.POLICIES} />

            {addPolicyPermission && (
              <Button
                data-testid="add-policy"
                type="primary"
                onClick={handleAddPolicy}>
                {t('label.add-entity', { entity: t('label.policy') })}
              </Button>
            )}
          </Space>
        </Col>
        <Col span={24}>
          <Table
            bordered
            className="policies-list-table"
            columns={columns}
            data-testid="policies-list-table"
            dataSource={policies}
            loading={isLoading}
            locale={{
              emptyText: (
                <ErrorPlaceHolder
                  heading={t('label.policy')}
                  permission={addPolicyPermission}
                  type={ERROR_PLACEHOLDER_TYPE.CREATE}
                  onClick={handleAddPolicy}
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
          {selectedPolicy && deletePolicyPermission && (
            <DeleteWidgetModal
              afterDeleteAction={handleAfterDeleteAction}
              allowSoftDelete={false}
              deleteMessage={t('message.are-you-sure-delete-entity', {
                entity: getEntityName(selectedPolicy),
              })}
              entityId={selectedPolicy.id}
              entityName={getEntityName(selectedPolicy)}
              entityType={EntityType.POLICY}
              visible={!isUndefined(selectedPolicy)}
              onCancel={() => setSelectedPolicy(undefined)}
            />
          )}
        </Col>
        <Col span={24}>
          {showPagination && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handlePaging}
              onShowSizeChange={handlePageSizeChange}
            />
          )}
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default PoliciesListPage;
