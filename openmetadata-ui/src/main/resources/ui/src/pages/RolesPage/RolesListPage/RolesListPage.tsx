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

import { Button, Col, Row, Space, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import PageHeader from 'components/header/PageHeader.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getRoles } from 'rest/rolesAPIV1';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
  ROUTES,
} from '../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { Operation } from '../../../generated/entity/policies/policy';
import { Role } from '../../../generated/entity/teams/role';
import { Paging } from '../../../generated/type/paging';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RolesList from './RolesList';
import './RolesList.less';

const RolesListPage = () => {
  const history = useHistory();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [paging, setPaging] = useState<Paging>();
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);

  const { permissions } = usePermissionProvider();

  const addRolePermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.ROLE, permissions)
    );
  }, [permissions]);

  const fetchRoles = async (paging?: Paging) => {
    setIsLoading(true);
    try {
      const data = await getRoles(
        'policies,teams,users',
        paging?.after,
        paging?.before,
        undefined,
        PAGE_SIZE_MEDIUM
      );

      setRoles(data.data || []);
      setPaging(data.paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRole = () => {
    history.push(ROUTES.ADD_ROLE);
  };

  const handlePaging = (_: string | number, activePage?: number) => {
    setCurrentPage(activePage ?? INITIAL_PAGING_VALUE);
    fetchRoles(paging);
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchErrorPlaceHolder = useMemo(
    () => () =>
      (
        <ErrorPlaceHolder
          buttons={
            <Button
              ghost
              data-testid="add-role"
              disabled={!addRolePermission}
              type="primary"
              onClick={handleAddRole}>
              {t('label.add-entity', { entity: t('label.role') })}
            </Button>
          }
          heading={t('label.role')}
          type={ERROR_PLACEHOLDER_TYPE.ADD}
        />
      ),
    [addRolePermission]
  );

  return isLoading ? (
    <Loader />
  ) : isEmpty(roles) ? (
    fetchErrorPlaceHolder()
  ) : (
    <Row
      className="roles-list-container"
      data-testid="roles-list-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between">
          <PageHeader data={PAGE_HEADERS.ROLES} />
          <Tooltip
            placement="left"
            title={
              addRolePermission
                ? t('label.add-entity', {
                    entity: t('label.role'),
                  })
                : NO_PERMISSION_FOR_ACTION
            }>
            <Button
              data-testid="add-role"
              disabled={!addRolePermission}
              type="primary"
              onClick={handleAddRole}>
              {t('label.add-entity', { entity: t('label.role') })}
            </Button>
          </Tooltip>
        </Space>
      </Col>
      <Col span={24}>
        <RolesList fetchRoles={fetchRoles} roles={roles} />
      </Col>
      <Col span={24}>
        {paging && paging.total > PAGE_SIZE_MEDIUM && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={PAGE_SIZE_MEDIUM}
            paging={paging}
            pagingHandler={handlePaging}
            totalCount={paging.total}
          />
        )}
      </Col>
    </Row>
  );
};

export default RolesListPage;
