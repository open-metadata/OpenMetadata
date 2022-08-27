/*
 *  Copyright 2021 Collate
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

import { Button, Col, Row, Space } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getRoles } from '../../../axiosAPIs/rolesAPIV1';
import NextPrevious from '../../../components/common/next-previous/NextPrevious';
import Loader from '../../../components/Loader/Loader';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  ROUTES,
} from '../../../constants/constants';
import { Role } from '../../../generated/entity/teams/role';
import { Paging } from '../../../generated/type/paging';
import { showErrorToast } from '../../../utils/ToastUtils';
import RolesList from './RolesList';
import './RolesList.less';

const RolesListPage = () => {
  const history = useHistory();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [paging, setPaging] = useState<Paging>();
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);

  const fetchRoles = async (paging?: Paging) => {
    setIsLoading(true);
    try {
      const data = await getRoles(
        'policies,teams,users',
        paging?.after,
        paging?.before
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

  return isLoading ? (
    <Loader />
  ) : (
    <Row
      className="roles-list-container"
      data-testid="roles-list-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <Space align="center" className="tw-w-full tw-justify-end" size={16}>
          <Button data-testid="add-role" type="primary" onClick={handleAddRole}>
            Add Role
          </Button>
        </Space>
      </Col>
      <Col span={24}>
        <RolesList fetchRoles={fetchRoles} roles={roles} />
      </Col>
      <Col span={24}>
        {paging && paging.total > PAGE_SIZE && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
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
