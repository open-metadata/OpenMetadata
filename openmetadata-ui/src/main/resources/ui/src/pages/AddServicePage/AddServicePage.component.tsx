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

import {
  Breadcrumbs,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { LoadingState } from 'Models';
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import { NavigationBlocker } from '../../components/common/NavigationBlocker/NavigationBlocker';
import { NavigationGuardModal } from '../../components/common/NavigationGuardModal/NavigationGuardModal';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceFlowStepper from '../../components/Settings/Services/AddService/ServiceFlowStepper/ServiceFlowStepper';
import ServiceNameCard from '../../components/Settings/Services/AddService/ServiceNameCard/ServiceNameCard';
import SelectServiceType from '../../components/Settings/Services/AddService/Steps/SelectServiceType';
import { ConnectionConfigFormHandle } from '../../components/Settings/Services/ServiceConfig/ConnectionConfigForm.interface';
import { FiltersConfigFormHandle } from '../../components/Settings/Services/ServiceConfig/FiltersConfigForm.interface';
import { AUTO_PILOT_APP_NAME } from '../../constants/Applications.constant';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  EXCLUDE_AUTO_PILOT_SERVICE_TYPES,
  SERVICE_DEFAULT_ERROR_MAP,
  STEPS_FOR_ADD_SERVICE,
} from '../../constants/Services.constant';
import { ServiceCategory } from '../../enums/service.enum';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFieldFocusManagement } from '../../hooks/useFieldFocusManagement';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { triggerOnDemandApp } from '../../rest/applicationAPI';
import { postService } from '../../rest/serviceAPI';
import connectionsRouterClassBase from '../../utils/ConnectionsRouterClassBase';
import { getServiceLogo } from '../../utils/EntityDisplayUtils';
import { getEntityFeedLink } from '../../utils/EntityPureUtils';
import { handleEntityCreationError } from '../../utils/formUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import { getSettingPath } from '../../utils/RouterUtils';
import {
  getEntityTypeFromServiceCategory,
  getServiceRouteFromServiceType,
  getServiceType,
} from '../../utils/ServicePureUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { getAddServiceEntityBreadcrumb } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { ServiceConfig } from './AddServicePage.interface';
import { useServiceNameValidation } from './useServiceNameValidation';

const ConnectionConfigForm = lazy(
  () =>
    import(
      '../../components/Settings/Services/ServiceConfig/ConnectionConfigForm'
    )
);
const FiltersConfigForm = lazy(
  () =>
    import('../../components/Settings/Services/ServiceConfig/FiltersConfigForm')
);
const ServiceDocPanel = lazy(
  () => import('../../components/common/ServiceDocPanel/ServiceDocPanel')
);

const AddServicePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceCategory;
  }>();
  const { currentUser, setInlineAlertDetails } = useApplicationStore();

  const [showErrorMessage, setShowErrorMessage] = useState(
    SERVICE_DEFAULT_ERROR_MAP
  );
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>({
    name: '',
    description: '',
    serviceType: '',
    connection: {
      config: {},
    },
  });
  const [saveServiceState, setSaveServiceState] =
    useState<LoadingState>('initial');
  const [isConnectionVerified, setIsConnectionVerified] = useState(false);
  const {
    activeField,
    activeFieldMeta,
    handleFieldBlur,
    handleFieldFocus,
    resetActiveField,
  } = useFieldFocusManagement();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showBackStepConfirm, setShowBackStepConfirm] = useState(false);
  const connectionFormRef = useRef<ConnectionConfigFormHandle>(null);
  const filtersFormRef = useRef<FiltersConfigFormHandle>(null);
  const {
    isServiceNameChecking,
    nameError,
    resetNameValidation,
    setNameError,
    validateServiceName,
  } = useServiceNameValidation({
    enabled: activeServiceStep === 2 && Boolean(serviceConfig.serviceType),
    serviceCategory,
    serviceName: serviceConfig.name,
  });

  const handleConnectorChangeClick = useCallback(() => {
    resetNameValidation();
    resetActiveField();
    setActiveServiceStep(1);
    setIsConnectionVerified(false);
    setServiceConfig({
      name: '',
      description: '',
      serviceType: '',
      connection: {
        config: {},
      },
    });
  }, [resetNameValidation]);

  const slashedBreadcrumb = useMemo(
    () => getAddServiceEntityBreadcrumb(serviceCategory),
    [serviceCategory]
  );

  const serviceBreadcrumb = useMemo(
    () =>
      serviceConfig.serviceType
        ? [
            {
              label: t('label.add-new-entity', {
                entity: t('label.service'),
              }),
              id: 'add-service',
            },
            {
              label: serviceConfig.serviceType,
              id: serviceConfig.serviceType,
            },
          ]
        : slashedBreadcrumb,
    [
      handleConnectorChangeClick,
      serviceCategory,
      serviceConfig.serviceType,
      slashedBreadcrumb,
      t,
    ]
  );

  const translatedSteps = useMemo(
    () =>
      STEPS_FOR_ADD_SERVICE.map((step) => ({
        ...step,
        name: translateWithNestedKeys(step.name, step.nameData),
      })),
    []
  );

  const handleServiceTypeClick = (type: string) => {
    resetNameValidation();
    setIsConnectionVerified(false);
    setServiceConfig({
      name: '',
      description: '',
      serviceType: type,
      connection: {
        config: {},
      },
    });
    setActiveServiceStep(2);
  };

  const handleServiceCategoryChange = (category: ServiceCategory) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    setServiceConfig((prev) => ({
      ...prev,
      serviceType: '',
    }));
    navigate(connectionsRouterClassBase.getAddServicePath(category));
  };

  const handleConfigUpdate = async (newConfigData: ConfigData) => {
    const serviceName = serviceConfig.name.trim();

    if (!serviceName) {
      setNameError(
        t('message.field-text-is-required', {
          fieldText: t('label.service-name'),
        })
      );
      document.getElementById('service-name')?.focus();

      return;
    }

    const isServiceNameAvailable = await validateServiceName(serviceName);

    if (!isServiceNameAvailable) {
      return;
    }

    const data = serviceUtilClassBase.getServiceConfigData({
      serviceName,
      serviceType: serviceConfig.serviceType,
      description: serviceConfig.description,
      userId: currentUser?.id ?? '',
      configData: newConfigData,
    });

    setServiceConfig((prev) => ({
      ...prev,
      ...data,
    }));
    setActiveServiceStep(3);
  };

  const triggerTheAutoPilotApplication = async (
    serviceDetails: ServicesType
  ) => {
    try {
      const entityType = getEntityTypeFromServiceCategory(serviceCategory);
      const entityLink = getEntityFeedLink(
        entityType,
        serviceDetails.fullyQualifiedName
      );

      await triggerOnDemandApp(AUTO_PILOT_APP_NAME, {
        entityLink,
      });
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const handleFiltersInputBackClick = () => setActiveServiceStep(2);
  const handleFiltersInputNextClick = async (config: ConfigData) => {
    const configData = {
      ...serviceConfig,
      connection: {
        config: {
          ...serviceConfig.connection.config,
          ...config,
        },
      },
    };
    setSaveServiceState('waiting');
    try {
      const serviceDetails = await postService(serviceCategory, configData);

      if (
        !EXCLUDE_AUTO_PILOT_SERVICE_TYPES.includes(
          getEntityTypeFromServiceCategory(serviceCategory)
        )
      ) {
        await triggerTheAutoPilotApplication(serviceDetails);
      }
    } catch (error) {
      handleEntityCreationError({
        error: error as AxiosError,
        entity: t('label.service'),
        entityLowercase: t('label.service-lowercase'),
        entityLowercasePlural: t('label.service-lowercase-plural'),
        setInlineAlertDetails,
        name: serviceConfig.name,
        defaultErrorType: 'create',
      });
    } finally {
      setSaveServiceState('initial');
      navigate(
        connectionsRouterClassBase.getServiceDetailsPath(
          serviceCategory,
          configData.name
        )
      );
    }
  };

  useEffect(() => {
    resetActiveField(activeServiceStep === 2 ? 'serviceName' : '');
  }, [activeServiceStep]);

  const hideSecondPanel = useMemo(
    () =>
      !(
        serviceConfig.serviceType &&
        (activeServiceStep === 2 || activeServiceStep === 3)
      ),
    [activeServiceStep, serviceConfig.serviceType]
  );

  const activeServiceStepRef = useRef(activeServiceStep);
  activeServiceStepRef.current = activeServiceStep;

  const handleBreadcrumbAction = useCallback(
    (id: React.Key) => {
      if (id === 'add-service') {
        if (activeServiceStepRef.current > 1) {
          setShowResetConfirm(true);
        } else {
          handleConnectorChangeClick();
        }
      } else if (id === 'category') {
        navigate(
          getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(serviceCategory)
          )
        );
      }
    },
    [handleConnectorChangeClick, navigate, serviceCategory]
  );

  const isStep2NextDisabled =
    !serviceConfig.name.trim() || Boolean(nameError) || isServiceNameChecking;
  const isSavingService = saveServiceState === 'waiting';
  const showFooter = activeServiceStep === 2 || activeServiceStep === 3;

  const handleFooterBack = () => {
    setShowBackStepConfirm(true);
  };

  const handleConfirmedStepBack = () => {
    setShowBackStepConfirm(false);
    if (activeServiceStep === 2) {
      handleConnectorChangeClick();
    } else {
      handleFiltersInputBackClick();
    }
  };

  const handleFooterNext = () => {
    if (activeServiceStep === 2) {
      connectionFormRef.current?.submit();
    } else {
      filtersFormRef.current?.submit();
    }
  };

  const footerNextText =
    activeServiceStep === 3
      ? t('label.create-and-deploy')
      : t('label.next-what-to-ingest');

  const footerNextDisabled =
    activeServiceStep === 2 ? isStep2NextDisabled : isSavingService;

  // flex-col layout bounds the scroll area so the footer stays anchored at the card bottom,
  // keeping the card's rounded corners visible at all times during scroll.
  const firstPanelChildren = (
    <div className="tw:max-w-screen-lg m-x-auto tw:p-0 tw:flex tw:flex-col tw:h-full tw:overflow-y-scroll no-scrollbar">
      <div className="tw:flex-1">
        <Breadcrumbs
          items={serviceBreadcrumb}
          onAction={handleBreadcrumbAction}
        />
        <div className="tw:mt-4">
          <div data-testid="add-new-service-container">
            {serviceConfig.serviceType ? (
              <div className="tw:flex tw:items-center tw:gap-3 tw:pb-0">
                {getServiceLogo(
                  serviceConfig.serviceType || '',
                  'tw:size-10 tw:max-w-10 tw:max-h-10 tw:object-contain'
                )}
                <Typography
                  className="tw:m-0"
                  data-testid="header"
                  size="text-xl"
                  weight="semibold">
                  {`${serviceConfig.serviceType} ${t('label.service')}`}
                </Typography>
              </div>
            ) : (
              <Typography
                className="tw:m-0"
                data-testid="header"
                size="text-xl"
                weight="semibold">
                {t('label.add-new-entity', { entity: t('label.service') })}
              </Typography>
            )}

            <ServiceFlowStepper
              activeStep={activeServiceStep}
              className="tw:mt-6"
              steps={translatedSteps}
            />
            <div className="tw:mt-7">
              {activeServiceStep === 1 && (
                <SelectServiceType
                  handleServiceTypeClick={handleServiceTypeClick}
                  serviceCategory={serviceCategory}
                  serviceCategoryHandler={handleServiceCategoryChange}
                  showError={showErrorMessage.serviceType}
                />
              )}

              <Suspense fallback={<Loader />}>
                {activeServiceStep === 2 && (
                  <div className="tw:flex tw:flex-col tw:gap-4">
                    <ServiceNameCard
                      description={serviceConfig.description}
                      name={serviceConfig.name}
                      nameError={nameError}
                      serviceType={serviceConfig.serviceType}
                      onBlur={handleFieldBlur}
                      onDescriptionChange={(description) =>
                        setServiceConfig((prev) => ({ ...prev, description }))
                      }
                      onFocus={handleFieldFocus}
                      onNameChange={(name) => {
                        resetNameValidation();
                        setServiceConfig((prev) => ({ ...prev, name }));
                      }}
                    />
                    <ConnectionConfigForm
                      hideFooter
                      additionalMissingFieldsCount={
                        !serviceConfig.name.trim() ||
                        Boolean(nameError) ||
                        isServiceNameChecking
                          ? 1
                          : 0
                      }
                      data={serviceConfig as ServicesType}
                      isSubmitDisabled={isStep2NextDisabled}
                      ref={connectionFormRef}
                      serviceCategory={serviceCategory}
                      serviceType={serviceConfig.serviceType}
                      status={saveServiceState}
                      onBlur={handleFieldBlur}
                      onFocus={handleFieldFocus}
                      onSave={async (e) => {
                        e.formData && (await handleConfigUpdate(e.formData));
                      }}
                      onTestConnectionStatusChange={setIsConnectionVerified}
                      onValidateAdditionalRequiredFields={() => {
                        if (!serviceConfig.name.trim()) {
                          setNameError(
                            t('message.field-text-is-required', {
                              fieldText: t('label.service-name'),
                            })
                          );
                          document.getElementById('service-name')?.focus();

                          return false;
                        }

                        if (nameError || isServiceNameChecking) {
                          document.getElementById('service-name')?.focus();

                          return false;
                        }

                        return true;
                      }}
                    />
                  </div>
                )}

                {activeServiceStep === 3 && (
                  <FiltersConfigForm
                    hideFooter
                    data={serviceConfig as ServicesType}
                    ref={filtersFormRef}
                    serviceCategory={serviceCategory}
                    serviceType={serviceConfig.serviceType}
                    showConnectedMessage={isConnectionVerified}
                    status={saveServiceState}
                    onFocus={handleFieldFocus}
                    onSave={async (e) => {
                      e.formData && handleFiltersInputNextClick(e.formData);
                    }}
                  />
                )}
              </Suspense>
            </div>
          </div>
        </div>
      </div>
      {showFooter && (
        <div className="tw:flex tw:flex-shrink-0 tw:items-center tw:justify-end tw:gap-5 tw:py-4">
          <Button
            color="secondary"
            data-testid="previous-button"
            isDisabled={isSavingService}
            size="sm"
            type="button"
            onPress={handleFooterBack}>
            {t('label.back')}
          </Button>
          <Button
            color="primary"
            data-testid="next-button"
            isDisabled={footerNextDisabled || isSavingService}
            size="sm"
            type="button"
            onPress={handleFooterNext}>
            {footerNextText}
          </Button>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    serviceUtilClassBase.getExtraInfo();
  }, []);

  return (
    <NavigationBlocker
      enabled={activeServiceStep > 1 && !isSavingService}
      renderModal={({ isOpen, onLeave, onStay }) => (
        <NavigationGuardModal
          isOpen={isOpen}
          onLeave={onLeave}
          onStay={onStay}
        />
      )}>
      <>
        <ResizablePanels
          className="add-service-page content-height-with-resizable-panel"
          firstPanel={{
            children: firstPanelChildren,
            minWidth: 700,
            flex: 0.7,
            className: 'content-resizable-panel-container',
            // Renders our own Card below; built-in AntD card would cause a double card and break the h-full layout.
            wrapInCard: false,
          }}
          hideSecondPanel={hideSecondPanel}
          pageTitle={t('label.add-entity', { entity: t('label.service') })}
          secondPanel={{
            children: (
              <Suspense fallback={null}>
                <ServiceDocPanel
                  focusedMode
                  activeField={activeField}
                  activeFieldMeta={activeFieldMeta}
                  serviceName={serviceConfig.serviceType}
                  serviceType={getServiceType(serviceCategory)}
                />
              </Suspense>
            ),
            className: 'service-doc-panel content-resizable-panel-container',
            minWidth: 400,
            flex: 0.3,
          }}
        />
        <NavigationGuardModal
          isOpen={showResetConfirm}
          onLeave={() => {
            setShowResetConfirm(false);
            handleConnectorChangeClick();
          }}
          onStay={() => setShowResetConfirm(false)}
        />
        <NavigationGuardModal
          isOpen={showBackStepConfirm}
          onLeave={handleConfirmedStepBack}
          onStay={() => setShowBackStepConfirm(false)}
        />
      </>
    </NavigationBlocker>
  );
};

export default withPageLayout(AddServicePage);
