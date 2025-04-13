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
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { LoadingState, ServicesUpdateRequest, ServiceTypes } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import IngestionStepper from '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import ConnectionConfigForm from '../../components/Settings/Services/ServiceConfig/ConnectionConfigForm';
import FiltersConfigForm from '../../components/Settings/Services/ServiceConfig/FiltersConfigForm';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  OPEN_METADATA,
  STEPS_FOR_EDIT_SERVICE,
} from '../../constants/Services.constant';
import { TabSpecificField } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useFqn } from '../../hooks/useFqn';
import { SearchSourceAlias } from '../../interface/search.interface';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { getServiceByFQN, patchService } from '../../rest/serviceAPI';
import { getEntityMissingError, getServiceLogo } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import i18n from '../../utils/i18next/LocalUtil';
import { getPathByServiceFQN, getSettingPath } from '../../utils/RouterUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import {
  getServiceRouteFromServiceType,
  getServiceType,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

function EditConnectionFormPage() {
  const { serviceCategory } = useParams<{
    serviceCategory: ServiceCategory;
  }>();
  const { fqn: serviceFQN } = useFqn();
  const { t } = useTranslation();
  const isOpenMetadataService = useMemo(
    () => serviceFQN === OPEN_METADATA,
    [serviceFQN]
  );
  const history = useHistory();
  const [saveServiceState, setSaveServiceState] =
    useState<LoadingState>('initial');
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [isLoading, setIsLoading] = useState(!isOpenMetadataService);
  const [isError, setIsError] = useState(isOpenMetadataService);
  const [serviceDetails, setServiceDetails] = useState<ServicesType>();
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [activeField, setActiveField] = useState<string>('');
  const [serviceConfig, setServiceConfig] = useState<ServicesType>();

  const handleConfigSave = (updatedData: ConfigData) => {
    const configData = serviceUtilClassBase.getEditConfigData(
      serviceDetails,
      updatedData
    );

    setServiceConfig(configData);
    setActiveServiceStep(2);
  };

  const handleFiltersSave = async (updatedData: ConfigData) => {
    if (isUndefined(serviceDetails)) {
      return;
    }

    const configData: ServicesUpdateRequest = {
      ...serviceDetails,
      ...serviceConfig,
      connection: {
        config: {
          ...serviceDetails?.connection?.config,
          ...serviceConfig?.connection?.config,
          ...updatedData,
        },
      },
    };

    const jsonPatch = compare(serviceDetails, configData);

    if (isEmpty(jsonPatch)) {
      return;
    }

    try {
      setSaveServiceState('waiting');
      const response = await patchService(
        serviceCategory,
        serviceDetails.id,
        jsonPatch
      );
      setServiceConfig({
        ...response,
        owners: response?.owners ?? serviceDetails?.owners,
      });

      history.push(getPathByServiceFQN(serviceCategory, serviceFQN));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setSaveServiceState('initial');
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
          name: t('label.edit-entity', {
            entity: t('label.connection'),
          }),
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

  const onCancel = () => {
    history.goBack();
  };

  const handleFiltersInputBackClick = () => setActiveServiceStep(1);

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
    <>
      <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
      <div className="m-t-md">
        <Space className="p-b-xs">
          {getServiceLogo(serviceDetails?.serviceType ?? '', 'h-6')}{' '}
          <Typography className="text-base" data-testid="header">
            {t('message.edit-service-entity-connection', {
              entity: serviceFQN,
            })}
          </Typography>
        </Space>
        <IngestionStepper
          activeStep={activeServiceStep}
          steps={STEPS_FOR_EDIT_SERVICE}
        />

        {activeServiceStep === 1 && (
          <ConnectionConfigForm
            cancelText={t('label.back')}
            data={serviceDetails}
            okText={t('label.next')}
            serviceCategory={serviceCategory}
            serviceType={serviceDetails?.serviceType ?? ''}
            status={saveServiceState}
            onCancel={onCancel}
            onFocus={handleFieldFocus}
            onSave={async (e) => {
              e.formData && handleConfigSave(e.formData);
            }}
          />
        )}

        {activeServiceStep === 2 && (
          <FiltersConfigForm
            cancelText={t('label.back')}
            data={serviceDetails}
            serviceCategory={serviceCategory}
            serviceType={serviceDetails?.serviceType ?? ''}
            status={saveServiceState}
            onCancel={handleFiltersInputBackClick}
            onFocus={handleFieldFocus}
            onSave={async (e) => {
              e.formData && handleFiltersSave(e.formData);
            }}
          />
        )}
      </div>
    </>
  );

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
        className: 'content-resizable-panel-container',
        cardClassName: 'steps-form-container',
        allowScroll: true,
      }}
      hideSecondPanel={!serviceDetails?.serviceType}
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

export default withPageLayout(
  i18n.t('label.edit-entity', {
    entity: i18n.t('label.connection'),
  })
)(EditConnectionFormPage);
