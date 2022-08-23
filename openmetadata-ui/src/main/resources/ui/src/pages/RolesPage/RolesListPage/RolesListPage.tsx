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
import Loader from '../../../components/Loader/Loader';
import { ROUTES } from '../../../constants/constants';
import { Role } from '../../../generated/entity/teams/role';
import { Paging } from '../../../generated/type/paging';
import { showErrorToast } from '../../../utils/ToastUtils';
import RolesList from './RolesList';
import './RolesList.less';

const RolesListPage = () => {
  const history = useHistory();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchRoles = async (paging?: Paging) => {
    setIsLoading(true);
    try {
      const data = await getRoles(
        'policies,teams,users',
        paging?.after,
        paging?.before
      );

      setRoles(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRole = () => {
    history.push(ROUTES.ADD_ROLE);
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  return isLoading ? (
    <Loader />
  ) : (
    <Row className="roles-list-container" gutter={[16, 16]}>
      <Col span={24}>
        <Space align="center" className="tw-w-full tw-justify-end" size={16}>
          <Button type="primary" onClick={handleAddRole}>
            Add Role
          </Button>
        </Space>
      </Col>
      <Col span={24}>
        <RolesList fetchRoles={fetchRoles} roles={roles} />
      </Col>
    </Row>
  );
};

export default RolesListPage;
