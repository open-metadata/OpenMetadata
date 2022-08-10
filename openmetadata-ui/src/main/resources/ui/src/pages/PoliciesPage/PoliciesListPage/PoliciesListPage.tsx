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
import { getPolicies } from '../../../axiosAPIs/rolesAPIV1';
import Loader from '../../../components/Loader/Loader';
import { Policy } from '../../../generated/entity/policies/policy';
import { Paging } from '../../../generated/type/paging';
import { showErrorToast } from '../../../utils/ToastUtils';
import PoliciesList from './PoliciesList';
import './PoliciesList.less';

const PoliciesListPage = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchPolicies = async (paging?: Paging) => {
    setIsLoading(true);
    try {
      const data = await getPolicies(
        'owner,location,roles,teams',
        paging?.after,
        paging?.before
      );

      setPolicies(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  return isLoading ? (
    <Loader />
  ) : (
    <Row className="policies-list-container" gutter={[16, 16]}>
      <Col span={24}>
        <Space align="center" className="tw-w-full tw-justify-end" size={16}>
          <Button type="primary">Add Policy</Button>
        </Space>
      </Col>
      <Col span={24}>
        <PoliciesList policies={policies} />
      </Col>
    </Row>
  );
};

export default PoliciesListPage;
