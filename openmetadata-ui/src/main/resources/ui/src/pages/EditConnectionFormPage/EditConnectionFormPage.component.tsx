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

import { Breadcrumbs, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { LoadingState, ServicesUpdateRequest, ServiceTypes } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../components/common/ServiceDocPanel/ServiceDocPanel';
import ServiceFlowStepper from '../../components/Settings/Services/AddService/ServiceFlowStepper/ServiceFlowStepper';
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
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { getServiceByFQN, patchService } from '../../rest/serviceAPI';
import connectionsRouterClassBase from '../../utils/ConnectionsRouterClassBase';
import {
  getEntityMissingError,
  getServiceLogo,
} from '../../utils/EntityDisplayUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import { getPathByServiceFQN, getSettingPath } from '../../utils/RouterUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import {
  getServiceRouteFromServiceType,
  getServiceType,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

type BreadcrumbItem = { label: string; id: string; href: string };

function EditConnectionFormPage() {
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceCategory;
  }>();
  const { fqn: serviceFQN } = useFqn();
  const { t } = useTranslation();
  const isOpenMetadataService = useMemo(
    () => serviceFQN === OPEN_METADATA,
    [serviceFQN]
  );
  const navigate = useNavigate();
  const [saveServiceState, setSaveServiceState] =
    useState<LoadingState>('initial');
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [isLoading, setIsLoading] = useState(!isOpenMetadataService);
  const [isError, setIsError] = useState(isOpenMetadataService);
  const [serviceDetails, setServiceDetails] = useState<ServicesType>();
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<BreadcrumbItem[]>(
    []
  );
  const [activeField, setActiveField] = useState<string>('');
  const [serviceConfig, setServiceConfig] = useState<ServicesType>();

  const translatedSteps = useMemo(
    () =>
      STEPS_FOR_EDIT_SERVICE.map((step) => ({
        ...step,
        name: translateWithNestedKeys(step.name, step.nameData),
      })),
    []
  );

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
        serviceCategory as ServiceCategory,
        serviceDetails.id,
        jsonPatch
      );
      setServiceConfig({
        ...response,
        owners: response?.owners ?? serviceDetails?.owners,
      });

      navigate(
        connectionsRouterClassBase.getPathByServiceFQN(
          serviceCategory as ServiceCategory,
          serviceFQN
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setSaveServiceState('initial');
    }
  };

  const fetchServiceDetail = async () => {
    setIsLoading(true);
    try {
      const response = await getServiceByFQN(
        serviceCategory as ServiceCategory,
        serviceFQN,
        {
          fields: TabSpecificField.OWNERS,
        }
      );
      setServiceDetails(response);
      setSlashedBreadcrumb([
        {
          label: startCase(serviceCategory),
          id: 'service-category',
          href: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(serviceCategory as ServiceTypes)
          ),
        },
        {
          label: getEntityName(response),
          id: 'service-name',
          href: getPathByServiceFQN(
            serviceCategory as ServiceCategory,
            serviceFQN
          ),
        },
        {
          label: t('label.edit-entity', { entity: t('label.connection') }),
          id: 'edit-connection',
          href: '',
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
    navigate(-1);
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

  useEffect(() => {
    serviceUtilClassBase.setEditServiceDetails(serviceDetails);
  }, [serviceDetails, serviceCategory]);

  if (isLoading) {
    return <Loader />;
  }

  if (isError && !isLoading) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(serviceCategory as ServiceCategory, serviceFQN)}
      </ErrorPlaceHolder>
    );
  }

  const firstPanelChildren = (
    <>
      <Breadcrumbs items={slashedBreadcrumb} />
      <div className="tw:mt-[22px]">
        <div className="tw:flex tw:items-center tw:gap-3 tw:pb-0">
          {getServiceLogo(
            serviceDetails?.serviceType ?? '',
            'tw:size-10 tw:max-w-10 tw:max-h-10 tw:object-contain'
          )}
          <Typography
            className="tw:m-0"
            data-testid="header"
            size="text-xl"
            weight="semibold">
            {t('message.edit-service-entity-connection', {
              entity: serviceFQN,
            })}
          </Typography>
        </div>

        <ServiceFlowStepper
          activeStep={activeServiceStep}
          className="tw:mt-6"
          steps={translatedSteps}
        />

        <div className="tw:mt-[30px]">
          {activeServiceStep === 1 && (
            <ConnectionConfigForm
              cancelText={t('label.back')}
              data={serviceDetails}
              okText={t('label.next')}
              serviceCategory={serviceCategory as ServiceCategory}
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
              serviceCategory={serviceCategory as ServiceCategory}
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
      </div>
    </>
  );

  return (
    <ResizablePanels
      className="edit-connection-page content-height-with-resizable-panel"
      firstPanel={{
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
        className: 'content-resizable-panel-container',
        cardClassName: 'add-service-page-card max-width-lg m-x-auto',
        allowScroll: true,
      }}
      hideSecondPanel={!serviceDetails?.serviceType}
      pageTitle={t('label.edit-entity', { entity: t('label.connection') })}
      secondPanel={{
        children: (
          <ServiceDocPanel
            focusedMode
            activeField={activeField}
            serviceName={serviceDetails?.serviceType ?? ''}
            serviceType={getServiceType(serviceCategory as ServiceCategory)}
          />
        ),
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
}

export default withPageLayout(EditConnectionFormPage);
