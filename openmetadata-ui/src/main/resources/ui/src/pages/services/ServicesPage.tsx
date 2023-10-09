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

import { Col, Row, Tabs } from 'antd';
import { isEmpty } from 'lodash';
import qs from 'qs';
import React, { useMemo } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import { IngestionPipelineList } from '../../components/Ingestion/IngestionPipelineList/IngestionPipelineList.component';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import Services from '../../components/Services/Services';
import { SERVICE_CATEGORY } from '../../constants/Services.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { userPermissions } from '../../utils/PermissionsUtils';
import { getResourceEntityFromServiceCategory } from '../../utils/ServiceUtils';

const ServicesPage = () => {
  const { tab } = useParams<{ tab: string }>();
  const location = useLocation();
  const history = useHistory();

  const search =
    qs.parse(
      location.search.startsWith('?')
        ? location.search.substring(1)
        : location.search
    ).tab ?? 'services';

  const serviceName = useMemo(
    () => SERVICE_CATEGORY[tab] ?? ServiceCategory.DATABASE_SERVICES,
    [tab]
  );

  const { permissions } = usePermissionProvider();

  const viewAllPermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      userPermissions.hasViewPermissions(
        getResourceEntityFromServiceCategory(tab),
        permissions
      )
    );
  }, [permissions]);

  return viewAllPermission ? (
    <Tabs
      destroyInactiveTabPane
      activeKey={search as string}
      items={[
        {
          key: 'services',
          children: <Services serviceName={serviceName} />,
          label: 'Services',
        },
        {
          key: 'pipelines',
          children: <IngestionPipelineList serviceName={serviceName} />,
          label: 'Pipelines',
        },
      ]}
      onChange={(activeKey) => history.push({ search: `tab=${activeKey}` })}
    />
  ) : (
    <Row>
      <Col span={24}>
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
      </Col>
    </Row>
  );
};

export default ServicesPage;
