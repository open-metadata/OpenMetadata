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

import { Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import Loader from 'components/Loader/Loader';
import ServiceConfig from 'components/ServiceConfig/ServiceConfig';
import { startCase } from 'lodash';
import { ServicesData, ServicesUpdateRequest, ServiceTypes } from 'Models';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getServiceByFQN, updateService } from 'rest/serviceAPI';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { addServiceGuide } from '../../constants/service-guide.constant';
import { OPENMETADATA } from '../../constants/Services.constant';
import { ServiceCategory } from '../../enums/service.enum';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { getEntityMissingError, getEntityName } from '../../utils/CommonUtils';
import { getPathByServiceFQN, getSettingPath } from '../../utils/RouterUtils';
import {
  getServiceRouteFromServiceType,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

function EditConnectionFormPage() {
  const { t } = useTranslation();
  const { serviceFQN, serviceCategory } = useParams() as Record<string, string>;
  const [isLoading, setIsloading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [serviceDetails, setServiceDetails] = useState<ServicesType>();
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const fetchRightPanel = () => {
    const guide = addServiceGuide.find((sGuide) => sGuide.step === 3);

    return (
      guide && (
        <>
          <Typography.Title level={5}>{guide.title}</Typography.Title>
          <div className="mb-5">{guide.description}</div>
        </>
      )
    );
  };

  const handleConfigUpdate = (updatedData: ConfigData) => {
    const configData = {
      name: serviceDetails?.name,
      serviceType: serviceDetails?.serviceType,
      description: serviceDetails?.description,
      owner: serviceDetails?.owner,
      connection: {
        config: updatedData,
      },
    } as ServicesUpdateRequest;

    return new Promise<void>((resolve, reject) => {
      updateService(serviceCategory, serviceDetails?.id ?? '', configData)
        .then((res) => {
          if (res) {
            setServiceDetails({
              ...res,
              owner: res?.owner ?? serviceDetails?.owner,
            });
          } else {
            showErrorToast(
              `${jsonData['api-error-messages']['update-service-config-error']}`
            );
          }

          resolve();
        })
        .catch((error: AxiosError) => {
          reject();
          showErrorToast(
            error,
            `${jsonData['api-error-messages']['update-service-config-error']}`
          );
        });
    });
  };

  useEffect(() => {
    setIsloading(true);
    getServiceByFQN(serviceCategory, serviceFQN, ['owner'])
      .then((resService) => {
        if (resService) {
          setServiceDetails(resService);
          setSlashedBreadcrumb([
            {
              name: startCase(serviceCategory),
              url: getSettingPath(
                GlobalSettingsMenuCategory.SERVICES,
                getServiceRouteFromServiceType(serviceCategory as ServiceTypes)
              ),
            },
            {
              name: getEntityName(resService),
              imgSrc: serviceTypeLogo(resService.serviceType),
              url: getPathByServiceFQN(serviceCategory, serviceFQN),
            },
            {
              name: t('label.edit-entity', { entity: t('label.connection') }),
              url: '',
              activeTitle: true,
            },
          ]);
        } else {
          showErrorToast(jsonData['api-error-messages']['fetch-service-error']);
        }
      })
      .catch((error: AxiosError) => {
        if (error.response?.status === 404) {
          setIsError(true);
        } else {
          showErrorToast(
            error,
            jsonData['api-error-messages']['fetch-service-error']
          );
        }
      })
      .finally(() => {
        setIsloading(false);
      });
  }, [serviceFQN, serviceCategory]);

  const renderPage = () => {
    return isError ? (
      <ErrorPlaceHolder>
        {getEntityMissingError(serviceCategory, serviceFQN)}
      </ErrorPlaceHolder>
    ) : (
      <PageLayoutV1
        center
        pageTitle={t('label.edit-entity', { entity: t('label.connection') })}>
        <Space direction="vertical" size="middle">
          <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
          <div className="form-container">
            <Typography.Title level={5}>
              {t('message.edit-service-entity-connection', {
                entity: serviceFQN,
              })}
            </Typography.Title>
            <ServiceConfig
              data={serviceDetails as ServicesData}
              disableTestConnection={
                ServiceCategory.METADATA_SERVICES === serviceCategory &&
                OPENMETADATA === serviceFQN
              }
              handleUpdate={handleConfigUpdate}
              serviceCategory={serviceCategory as ServiceCategory}
              serviceFQN={serviceFQN}
              serviceType={serviceDetails?.serviceType || ''}
            />
          </div>
        </Space>
        <div className="m-t-xlg p-x-lg w-800">{fetchRightPanel()}</div>
      </PageLayoutV1>
    );
  };

  return (
    <PageContainerV1>
      <div className="self-center">
        <>{isLoading ? <Loader /> : renderPage()}</>
      </div>
    </PageContainerV1>
  );
}

export default EditConnectionFormPage;
