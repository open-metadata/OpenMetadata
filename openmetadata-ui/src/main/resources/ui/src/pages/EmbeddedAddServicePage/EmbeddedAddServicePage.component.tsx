/*
 *  Copyright 2025 Collate.
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
import { useLocation, useNavigate } from 'react-router-dom';
import FormPanelBody from '../../components/common/FormPanelBody/FormPanelBody.component';
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
import {
  EXCLUDE_AUTO_PILOT_SERVICE_TYPES,
  ServiceCategoryParam,
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
import {
  getEntityTypeFromServiceCategory,
  getServiceType,
} from '../../utils/ServicePureUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import {
  getAddServiceEntityBreadcrumb,
  getValidatedServiceType,
} from '../../utils/ServiceUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { ServiceConfig } from '../AddServicePage/AddServicePage.interface';
import { useServiceNameValidation } from '../AddServicePage/useServiceNameValidation';

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

// Fallback "back" target when a deep-link does not specify one (e.g. the
// onboarding connector picker), instead of the connector grid the user skipped.
const DEFAULT_BACK_PATH = '/';
const ADD_SERVICE = 'add-service';
const SERVICE_NAME = 'service-name';

const EmbeddedAddServicePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { serviceCategory: serviceCategoryParam } = useRequiredParams<{
    serviceCategory: ServiceCategoryParam;
  }>();
  // Safe cast: picking a card in the flattened `all` grid navigates to a concrete-category URL
  // first (see handleServiceTypeClick), so the sentinel never reaches step 2 or the save path.
  const serviceCategory = serviceCategoryParam as ServiceCategory;
  const { currentUser, setInlineAlertDetails } = useApplicationStore();
  const { state: locationState } = useLocation();
  const preselectedServiceType = useMemo(
    () => getValidatedServiceType(locationState, serviceCategory),
    [locationState, serviceCategory]
  );
  const backPath = useMemo(
    () =>
      (locationState as { backTo?: string } | null)?.backTo ??
      DEFAULT_BACK_PATH,
    [locationState]
  );

  const [showErrorMessage, setShowErrorMessage] = useState(
    SERVICE_DEFAULT_ERROR_MAP
  );
  const [activeServiceStep, setActiveServiceStep] = useState(
    preselectedServiceType ? 2 : 1
  );
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>({
    name: '',
    description: '',
    serviceType: preselectedServiceType,
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
              id: ADD_SERVICE,
            },
            {
              label: serviceConfig.serviceType,
              id: serviceConfig.serviceType,
            },
          ]
        : [
            {
              label: t('label.connection-plural'),
              id: 'category',
            },
            {
              label: t('label.add-new-entity', {
                entity: t('label.service'),
              }),
              href: '',
              id: ADD_SERVICE,
            },
          ],
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

  // Picking a card in the flattened `all` grid navigates to this same route with a different
  // category, so the component re-renders rather than remounting and the initial state above
  // never re-runs. Sync the deep-linked connector on arrival so the user lands on the Connect
  // step instead of just watching the URL change.
  useEffect(() => {
    if (
      !preselectedServiceType ||
      preselectedServiceType === serviceConfig.serviceType
    ) {
      return;
    }

    resetNameValidation();
    setIsConnectionVerified(false);
    setServiceConfig({
      name: '',
      description: '',
      serviceType: preselectedServiceType,
      connection: {
        config: {},
      },
    });
    setActiveServiceStep(2);
    // Only the arriving connector should retrigger this — including serviceConfig.serviceType
    // would fight the user's own edits on the Connect step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedServiceType]);

  const handleServiceTypeClick = (
    type: string,
    clickedCategory: ServiceCategory
  ) => {
    // Only possible from the flattened `all` grid: the connector belongs to a different category
    // than the URL, so continue in that category's own wizard with the connector deep-linked.
    if (clickedCategory !== serviceCategory) {
      navigate(connectionsRouterClassBase.getAddServicePath(clickedCategory), {
        state: { serviceType: type },
      });

      return;
    }

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

  // Receives the `all` sentinel as well as a real category; `getAddServicePath` handles both.
  const handleServiceCategoryChange = (category: ServiceCategoryParam) => {
    setShowErrorMessage((prev) => ({ ...prev, serviceType: false }));
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
      document.getElementById(SERVICE_NAME)?.focus();

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
        showSuccessToast(t('message.auto-pilot-triggered-message'), 5000);
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
      if (id === ADD_SERVICE) {
        if (preselectedServiceType) {
          navigate(backPath);
        } else if (activeServiceStepRef.current > 1) {
          setShowResetConfirm(true);
        } else {
          handleConnectorChangeClick();
        }
      } else if (id === 'category') {
        navigate(`/connections`);
      }
    },
    [
      backPath,
      handleConnectorChangeClick,
      navigate,
      preselectedServiceType,
      serviceCategory,
    ]
  );

  const isStep2NextDisabled =
    !serviceConfig.name.trim() || Boolean(nameError) || isServiceNameChecking;
  const isSavingService = saveServiceState === 'waiting';
  const showFooter = activeServiceStep === 2 || activeServiceStep === 3;

  const handleFooterBack = () => {
    if (activeServiceStep === 2 && preselectedServiceType) {
      navigate(backPath);
    } else {
      setShowBackStepConfirm(true);
    }
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

  const firstPanelChildren = (
    <FormPanelBody
      footer={
        showFooter ? (
          <>
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
          </>
        ) : undefined
      }>
      <>
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
                  serviceCategory={serviceCategoryParam}
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
                      isAdditionalValidationPending={isServiceNameChecking}
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
                          document.getElementById(SERVICE_NAME)?.focus();

                          return false;
                        }

                        if (nameError || isServiceNameChecking) {
                          document.getElementById(SERVICE_NAME)?.focus();

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
      </>
    </FormPanelBody>
  );

  useEffect(() => {
    serviceUtilClassBase.getExtraInfo();
  }, []);

  return (
    <NavigationBlocker
      enabled={activeServiceStep > 1 && !isSavingService}
      leaveTo={preselectedServiceType ? backPath : undefined}
      renderModal={({ isOpen, onLeave, onStay }) => (
        <NavigationGuardModal
          isOpen={isOpen}
          onLeave={onLeave}
          onStay={onStay}
        />
      )}>
      <>
        <ResizablePanels
          className="add-service-page content-height-with-resizable-panel tw:!bg-transparent"
          firstPanel={{
            children: firstPanelChildren,
            minWidth: 700,
            flex: 0.7,
            className: 'content-resizable-panel-container',
            allowScroll: true,
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

export default withPageLayout(EmbeddedAddServicePage);
