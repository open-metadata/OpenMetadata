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
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getPolicies } from 'rest/rolesAPIV1';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
  ROUTES,
} from '../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { Operation, Policy } from '../../../generated/entity/policies/policy';
import { Paging } from '../../../generated/type/paging';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import PoliciesList from './PoliciesList';
import './PoliciesList.less';

const PoliciesListPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [paging, setPaging] = useState<Paging>();
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);

  const { permissions } = usePermissionProvider();

  const addPolicyPermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.POLICY, permissions)
    );
  }, [permissions]);

  const fetchPolicies = async (paging?: Paging) => {
    setIsLoading(true);
    try {
      const data = await getPolicies(
        'owner,location,roles,teams',
        paging?.after,
        paging?.before,
        PAGE_SIZE_MEDIUM
      );

      setPolicies(data.data || []);
      setPaging(data.paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPolicy = () => {
    history.push(ROUTES.ADD_POLICY);
  };

  const handlePaging = (_: string | number, activePage?: number) => {
    setCurrentPage(activePage ?? INITIAL_PAGING_VALUE);
    fetchPolicies(paging);
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchErrorPlaceHolder = useMemo(
    () => () => {
      return (
        <ErrorPlaceHolder
          buttons={
            <Button
              ghost
              data-testid="add-policy"
              disabled={!addPolicyPermission}
              type="primary"
              onClick={handleAddPolicy}>
              {t('label.add-entity', { entity: t('label.policy') })}
            </Button>
          }
          heading="Policy"
          type="ADD_DATA"
        />
      );
    },
    []
  );

  return isLoading ? (
    <Loader />
  ) : isEmpty(policies) ? (
    fetchErrorPlaceHolder()
  ) : (
    <Row
      className="policies-list-container"
      data-testid="policies-list-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between">
          <PageHeader data={PAGE_HEADERS.POLICIES} />
          <Tooltip
            placement="left"
            title={
              addPolicyPermission ? 'Add Policy' : NO_PERMISSION_FOR_ACTION
            }>
            <Button
              data-testid="add-policy"
              disabled={!addPolicyPermission}
              type="primary"
              onClick={handleAddPolicy}>
              {t('label.add-entity', { entity: t('label.policy') })}
            </Button>
          </Tooltip>
        </Space>
      </Col>
      <Col span={24}>
        <PoliciesList fetchPolicies={fetchPolicies} policies={policies} />
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

export default PoliciesListPage;
