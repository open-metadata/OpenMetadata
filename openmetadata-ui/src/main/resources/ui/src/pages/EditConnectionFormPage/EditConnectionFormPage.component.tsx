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

import { Card, Typography } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import ResizablePanels from 'components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from 'components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import Loader from 'components/Loader/Loader';
import ServiceConfig from 'components/ServiceConfig/ServiceConfig';
import { startCase } from 'lodash';
import { ServicesData, ServicesUpdateRequest, ServiceTypes } from 'Models';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getServiceByFQN, updateService } from 'rest/serviceAPI';
import { getEntityName } from 'utils/EntityUtils';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { OPEN_METADATA } from '../../constants/Services.constant';
import { ServiceCategory } from '../../enums/service.enum';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { getEntityMissingError } from '../../utils/CommonUtils';
import { getPathByServiceFQN, getSettingPath } from '../../utils/RouterUtils';
import {
  getServiceRouteFromServiceType,
  getServiceType,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

function EditConnectionFormPage() {
  const { t } = useTranslation();
  const { serviceFQN, serviceCategory } = useParams<{
    serviceFQN: string;
    serviceCategory: ServiceCategory;
  }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [serviceDetails, setServiceDetails] = useState<ServicesType>();
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [activeField, setActiveField] = useState<string>('');

  const handleConfigUpdate = async (updatedData: ConfigData) => {
    const configData = {
      name: serviceDetails?.name,
      serviceType: serviceDetails?.serviceType,
      description: serviceDetails?.description,
      owner: serviceDetails?.owner,
      connection: {
        config: updatedData,
      },
    } as ServicesUpdateRequest;

    try {
      const response = await updateService(
        serviceCategory,
        serviceDetails?.id ?? '',
        configData
      );
      setServiceDetails({
        ...response,
        owner: response?.owner ?? serviceDetails?.owner,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchServiceDetail = async () => {
    setIsLoading(true);
    try {
      const response = await getServiceByFQN(serviceCategory, serviceFQN, [
        'owner',
      ]);
      setServiceDetails(response);
      setSlashedBreadcrumb([
        {
          name: startCase(serviceCategory),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(serviceCategory as ServiceTypes)
          ),
        },
        {
          name: getEntityName(response),
          imgSrc: serviceTypeLogo(response.serviceType),
          url: getPathByServiceFQN(serviceCategory, serviceFQN),
        },
        {
          name: t('label.edit-entity', { entity: t('label.connection') }),
          url: '',
          activeTitle: true,
        },
      ]);
    } catch (err) {
      const error = err as AxiosError;
      if (error.response?.status === 404) {
        setIsError(true);
      } else {
        showErrorToast(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldFocus = (fieldName: string) => setActiveField(fieldName);

  useEffect(() => {
    fetchServiceDetail();
  }, [serviceFQN, serviceCategory]);

  if (isLoading) {
    return <Loader />;
  }

  if (isError && !isLoading) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(serviceCategory, serviceFQN)}
      </ErrorPlaceHolder>
    );
  }
  const firstPanelChildren = (
    <div className="max-width-md w-9/10 service-form-container">
      <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
      <Card className="p-lg m-t-md">
        <Typography.Title level={5}>
          {t('message.edit-service-entity-connection', {
            entity: serviceFQN,
          })}
        </Typography.Title>
        <ServiceConfig
          data={serviceDetails as ServicesData}
          disableTestConnection={
            ServiceCategory.METADATA_SERVICES === serviceCategory &&
            OPEN_METADATA === serviceFQN
          }
          handleUpdate={handleConfigUpdate}
          serviceCategory={serviceCategory}
          serviceFQN={serviceFQN}
          serviceType={serviceDetails?.serviceType || ''}
          onFocus={handleFieldFocus}
        />
      </Card>
    </div>
  );

  return (
    <PageContainerV1>
      <ResizablePanels
        firstPanel={{ children: firstPanelChildren, minWidth: 700 }}
        hideSecondPanel={!serviceDetails?.serviceType ?? ''}
        pageTitle={t('label.edit-entity', { entity: t('label.connection') })}
        secondPanel={{
          children: (
            <ServiceDocPanel
              activeField={activeField}
              serviceName={serviceDetails?.serviceType ?? ''}
              serviceType={getServiceType(serviceCategory)}
            />
          ),
          className: 'service-doc-panel',
          minWidth: 60,
          overlay: {
            displayThreshold: 200,
            header: t('label.setup-guide'),
            rotation: 'counter-clockwise',
          },
        }}
      />
    </PageContainerV1>
  );
}

export default EditConnectionFormPage;
