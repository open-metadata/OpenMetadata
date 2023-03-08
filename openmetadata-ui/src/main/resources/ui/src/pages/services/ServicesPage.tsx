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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import Services from 'components/Services/Services';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getServices } from 'rest/serviceAPI';
import { pagingObject, SERVICE_VIEW_CAP } from '../../constants/constants';
import { NO_PERMISSION_TO_VIEW } from '../../constants/HelperTextUtil';
import { SERVICE_CATEGORY } from '../../constants/Services.constant';
import { ServiceCategory } from '../../enums/service.enum';
import { Paging } from '../../generated/type/paging';
import { ServicesType } from '../../interface/service.interface';
import { userPermissions } from '../../utils/PermissionsUtils';
import { getResourceEntityFromServiceCategory } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const ServicesPage = () => {
  const { tab } = useParams<{ tab: string }>();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [serviceDetails, setServiceDetails] = useState<ServicesType[]>([]);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [serviceName, setServiceName] = useState<ServiceCategory>(
    ServiceCategory.DATABASE_SERVICES
  );
  const [currentPage, setCurrentPage] = useState<number>(1);

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

  const getServiceDetails = async (type: string) => {
    setIsLoading(true);
    try {
      const { data, paging } = await getServices(type, SERVICE_VIEW_CAP);
      setServiceDetails(data);
      setPaging(paging);
    } catch (error) {
      setServiceDetails([]);
      setPaging(pagingObject);
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.service-plural') })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (
    cursorType: string | number,
    activePage?: number
  ) => {
    const pagingString = `${serviceName}?${cursorType}=${
      paging[cursorType as keyof Paging]
    }`;
    setCurrentPage(activePage || 1);
    getServiceDetails(pagingString);
  };

  useEffect(() => {
    if (tab) {
      setServiceName(SERVICE_CATEGORY[tab]);
      setCurrentPage(1);
      getServiceDetails(SERVICE_CATEGORY[tab]);
    }
  }, [tab]);

  if (isLoading) {
    return <Loader />;
  }

  return viewAllPermission ? (
    <Services
      currentPage={currentPage}
      paging={paging}
      serviceData={serviceDetails}
      serviceName={serviceName}
      onPageChange={handlePageChange}
    />
  ) : (
    <Row>
      <Col span={24}>
        <ErrorPlaceHolder>
          <p>{NO_PERMISSION_TO_VIEW}</p>
        </ErrorPlaceHolder>
      </Col>
    </Row>
  );
};

export default ServicesPage;
