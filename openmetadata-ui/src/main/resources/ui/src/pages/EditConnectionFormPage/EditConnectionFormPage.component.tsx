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
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { ServicesData, ServicesUpdateRequest, ServiceTypes } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import ServiceConfig from '../../components/Settings/Services/ServiceConfig/ServiceConfig';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { OPEN_METADATA } from '../../constants/Services.constant';
import { TabSpecificField } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { useFqn } from '../../hooks/useFqn';
import { SearchSourceAlias } from '../../interface/search.interface';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { getServiceByFQN, patchService } from '../../rest/serviceAPI';
import { getEntityMissingError } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getPathByServiceFQN, getSettingPath } from '../../utils/RouterUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import {
  getServiceRouteFromServiceType,
  getServiceType,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

function EditConnectionFormPage() {
  const { t } = useTranslation();
  const { serviceCategory } = useParams<{
    serviceCategory: ServiceCategory;
  }>();
  const { fqn: serviceFQN } = useFqn();

  const isOpenMetadataService = useMemo(
    () => serviceFQN === OPEN_METADATA,
    [serviceFQN]
  );

  const [isLoading, setIsLoading] = useState(!isOpenMetadataService);
  const [isError, setIsError] = useState(isOpenMetadataService);
  const [serviceDetails, setServiceDetails] = useState<ServicesType>();
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [activeField, setActiveField] = useState<string>('');

  const handleConfigUpdate = async (updatedData: ConfigData) => {
    if (isUndefined(serviceDetails)) {
      return;
    }

    const configData: ServicesUpdateRequest =
      serviceUtilClassBase.getEditConfigData(serviceDetails, updatedData);

    const jsonPatch = compare(serviceDetails, configData);

    if (isEmpty(jsonPatch)) {
      return;
    }

    try {
      const response = await patchService(
        serviceCategory,
        serviceDetails.id,
        jsonPatch
      );
      setServiceDetails({
        ...response,
        owners: response?.owners ?? serviceDetails?.owners,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchServiceDetail = async () => {
    setIsLoading(true);
    try {
      const response = await getServiceByFQN(serviceCategory, serviceFQN, {
        fields: TabSpecificField.OWNERS,
      });
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
          imgSrc: serviceUtilClassBase.getServiceTypeLogo(
            response as SearchSourceAlias
          ),
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

  const handleFieldFocus = (fieldName: string) => {
    if (isEmpty(fieldName)) {
      return;
    }
    setTimeout(() => {
      setActiveField(fieldName);
    }, 50);
  };

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
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
        className: 'content-resizable-panel-container',
      }}
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
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
}

export default EditConnectionFormPage;
