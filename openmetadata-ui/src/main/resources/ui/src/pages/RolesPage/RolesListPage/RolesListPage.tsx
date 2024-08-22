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
import { Operation } from '../../../generated/entity/policies/policy';
import { Role } from '../../../generated/entity/teams/role';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getRoles } from '../../../rest/rolesAPIV1';
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
import './roles-list.less';

const RolesListPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<Role>();
  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging(PAGE_SIZE_MEDIUM);

  const { permissions } = usePermissionProvider();

  const addRolePermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.ROLE, permissions)
    );
  }, [permissions]);
  const viewPolicyPermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      userPermissions?.hasViewPermissions(ResourceEntity.POLICY, permissions)
    );
  }, [permissions]);

  const deleteRolePermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      checkPermission(Operation.Delete, ResourceEntity.ROLE, permissions)
    );
  }, [permissions]);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.ACCESS,
        t('label.role-plural')
      ),
    []
  );

  const columns: ColumnsType<Role> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => (
          <Link
            className="link-hover"
            data-testid="role-name"
            to={getRoleWithFqnPath(record.fullyQualifiedName ?? '')}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (_, record) => (
          <RichTextEditorPreviewer markdown={record?.description || ''} />
        ),
      },
      {
        title: t('label.policy-plural'),
        dataIndex: 'policies',
        width: '250px',
        key: 'policies',
        render: (_, record) => {
          const listLength = record.policies?.length ?? 0;
          const hasMore = listLength > LIST_CAP;

          return record.policies?.length ? (
            <Space wrap data-testid="policy-link" size={4}>
              {record.policies.slice(0, LIST_CAP).map((policy) =>
                viewPolicyPermission ? (
                  <Link
                    key={uniqueId()}
                    to={getPolicyWithFqnPath(policy.fullyQualifiedName || '')}>
                    {getEntityName(policy)}
                  </Link>
                ) : (
                  <Tooltip key={uniqueId()} title={NO_PERMISSION_TO_VIEW}>
                    {getEntityName(policy)}
                  </Tooltip>
                )
              )}
              {hasMore && (
                <Popover
                  className="cursor-pointer"
                  content={
                    <Space wrap size={4}>
                      {record.policies.slice(LIST_CAP).map((policy) =>
                        viewPolicyPermission ? (
                          <Link
                            key={uniqueId()}
                            to={getPolicyWithFqnPath(
                              policy.fullyQualifiedName || ''
                            )}>
                            {getEntityName(policy)}
                          </Link>
                        ) : (
                          <Tooltip
                            key={uniqueId()}
                            title={NO_PERMISSION_TO_VIEW}>
                            {getEntityName(policy)}
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
                deleteRolePermission
                  ? t('label.delete-entity', {
                      entity: t('label.role-plural'),
                    })
                  : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                data-testid={`delete-action-${getEntityName(record)}`}
                disabled={!deleteRolePermission}
                icon={<IconDelete name={t('label.delete')} width="16px" />}
                type="text"
                onClick={() => setSelectedRole(record)}
              />
            </Tooltip>
          );
        },
      },
    ];
  }, []);

  const fetchRoles = async (paging?: Paging) => {
    setIsLoading(true);
    try {
      const data = await getRoles(
        'policies',
        paging?.after,
        paging?.before,
        undefined,
        pageSize
      );

      setRoles(data.data || []);
      handlePagingChange(data.paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAfterDeleteAction = useCallback(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleAddRole = () => {
    history.push(ROUTES.ADD_ROLE);
  };

  const handlePaging = ({ currentPage, cursorType }: PagingHandlerParams) => {
    handlePageChange(currentPage);
    if (cursorType && paging) {
      fetchRoles({
        [cursorType]: paging[cursorType],
        total: paging.total,
      } as Paging);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [pageSize]);

  return (
    <PageLayoutV1 pageTitle={t('label.role-plural')}>
      <Row
        className="roles-list-container page-container"
        data-testid="roles-list-container"
        gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Space className="w-full justify-between">
            <PageHeader data={PAGE_HEADERS.ROLES} />

            {addRolePermission && (
              <Button
                data-testid="add-role"
                type="primary"
                onClick={handleAddRole}>
                {t('label.add-entity', { entity: t('label.role') })}
              </Button>
            )}
          </Space>
        </Col>
        <Col span={24}>
          <Table
            bordered
            className="roles-list-table"
            columns={columns}
            data-testid="roles-list-table"
            dataSource={roles}
            loading={isLoading}
            locale={{
              emptyText: (
                <ErrorPlaceHolder
                  heading={t('label.role')}
                  permission={addRolePermission}
                  type={ERROR_PLACEHOLDER_TYPE.CREATE}
                  onClick={handleAddRole}
                />
              ),
            }}
            pagination={false}
            rowKey="name"
            size="small"
          />
          {selectedRole && (
            <DeleteWidgetModal
              afterDeleteAction={handleAfterDeleteAction}
              allowSoftDelete={false}
              deleteMessage={t('message.are-you-sure-delete-entity', {
                entity: getEntityName(selectedRole),
              })}
              entityId={selectedRole.id}
              entityName={getEntityName(selectedRole)}
              entityType={EntityType.ROLE}
              visible={!isUndefined(selectedRole)}
              onCancel={() => setSelectedRole(undefined)}
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

export default RolesListPage;
