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
  ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { AUTO_PILOT_APP_NAME } from '../../../../constants/Applications.constant';
import {
  EXCLUDE_AUTO_PILOT_SERVICE_TYPES,
  ServiceCategoryParam,
  SERVICE_DEFAULT_ERROR_MAP,
  STEPS_FOR_ADD_SERVICE,
} from '../../../../constants/Services.constant';
import { ServiceCategory } from '../../../../enums/service.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useFieldFocusManagement } from '../../../../hooks/useFieldFocusManagement';
import { useServiceNameValidation } from '../../../../hooks/useServiceNameValidation';
import {
  ConfigData,
  ServicesType,
} from '../../../../interface/service.interface';
import { triggerOnDemandApp } from '../../../../rest/applicationAPI';
import { postService } from '../../../../rest/serviceAPI';
import connectionsRouterClassBase from '../../../../utils/ConnectionsRouterClassBase';
import { getServiceLogo } from '../../../../utils/EntityDisplayUtils';
import { getEntityFeedLink } from '../../../../utils/EntityPureUtils';
import { handleEntityCreationError } from '../../../../utils/formUtils';
import { translateWithNestedKeys } from '../../../../utils/i18next/LocalUtil';
import {
  getEntityTypeFromServiceCategory,
  getServiceType,
} from '../../../../utils/ServicePureUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import {
  getAddServiceEntityBreadcrumb,
  getValidatedServiceType,
} from '../../../../utils/ServiceUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import FormPanelBody, {
  getFormFirstPanelProps,
} from '../../../common/FormPanelBody/FormPanelBody.component';
import Loader from '../../../common/Loader/Loader';
import { NavigationBlocker } from '../../../common/NavigationBlocker/NavigationBlocker';
import { NavigationGuardModal } from '../../../common/NavigationGuardModal/NavigationGuardModal';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import { ConnectionConfigFormHandle } from '../ServiceConfig/ConnectionConfigForm.interface';
import { FiltersConfigFormHandle } from '../ServiceConfig/FiltersConfigForm.interface';
import { ServiceConfig } from './AddServiceFlow.types';
import ServiceFlowStepper from './ServiceFlowStepper/ServiceFlowStepper';
import ServiceNameCard from './ServiceNameCard/ServiceNameCard';
import SelectServiceType from './Steps/SelectServiceType';

const SERVICE_NAME_ID = 'service-name';
const ADD_SERVICE_ID = 'add-service';
const CATEGORY_ID = 'category';
// Fallback "back" target when a deep-link does not specify one (e.g. the
// onboarding connector picker), instead of the connector grid the user skipped.
const DEFAULT_BACK_PATH = '/';
const EMBEDDED_CONNECTIONS_PATH = '/connections';
const PAGE_PANEL_CLASS = 'add-service-page content-height-with-resizable-panel';

// The embedded variant sits inside the Connections surface, so it drops the page
// background and the standalone page's own scroll chrome.
const getPanelChrome = (embedded: boolean, children: ReactNode) =>
  embedded
    ? {
        className: `${PAGE_PANEL_CLASS} tw:!bg-transparent`,
        firstPanel: {
          children,
          minWidth: 700,
          flex: 0.7,
          className: 'content-resizable-panel-container',
          allowScroll: true,
        },
      }
    : {
        className: PAGE_PANEL_CLASS,
        firstPanel: getFormFirstPanelProps(children),
      };

const ConnectionConfigForm = lazy(
  () => import('../ServiceConfig/ConnectionConfigForm')
);
const FiltersConfigForm = lazy(
  () => import('../ServiceConfig/FiltersConfigForm')
);
const ServiceDocPanel = lazy(
  () => import('../../../common/ServiceDocPanel/ServiceDocPanel')
);

type FieldFocusHandlers = ReturnType<typeof useFieldFocusManagement>;
type ServiceNameValidation = ReturnType<typeof useServiceNameValidation>;

interface AddServiceFooterProps {
  activeServiceStep: number;
  isSavingService: boolean;
  isStep2NextDisabled: boolean;
  onBack: () => void;
  onNext: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

// Extracted so the step-2/step-3 next label + disabled logic no longer adds
// to AddServiceFlow's own cyclomatic complexity.
const AddServiceFooter = ({
  activeServiceStep,
  isSavingService,
  isStep2NextDisabled,
  onBack,
  onNext,
  t,
}: AddServiceFooterProps) => {
  const footerNextText =
    activeServiceStep === 3
      ? t('label.create-and-deploy')
      : t('label.next-what-to-ingest');
  const footerNextDisabled =
    activeServiceStep === 2 ? isStep2NextDisabled : isSavingService;

  return (
    <>
      <Button
        color="secondary"
        data-testid="previous-button"
        isDisabled={isSavingService}
        size="sm"
        type="button"
        onPress={onBack}>
        {t('label.back')}
      </Button>
      <Button
        color="primary"
        data-testid="next-button"
        isDisabled={footerNextDisabled || isSavingService}
        size="sm"
        type="button"
        onPress={onNext}>
        {footerNextText}
      </Button>
    </>
  );
};

interface AddServiceStepContentProps {
  activeServiceStep: number;
  connectionFormRef: React.RefObject<ConnectionConfigFormHandle>;
  filtersFormRef: React.RefObject<FiltersConfigFormHandle>;
  handleConfigUpdate: (data: ConfigData) => Promise<void>;
  handleFieldBlur: FieldFocusHandlers['handleFieldBlur'];
  handleFieldFocus: FieldFocusHandlers['handleFieldFocus'];
  handleFiltersInputNextClick: (data: ConfigData) => Promise<void>;
  handleServiceCategoryChange: (category: ServiceCategoryParam) => void;
  handleServiceTypeClick: (type: string, category: ServiceCategory) => void;
  isConnectionVerified: boolean;
  isServiceNameChecking: boolean;
  isStep2NextDisabled: boolean;
  nameError: string;
  resetNameValidation: ServiceNameValidation['resetNameValidation'];
  saveServiceState: LoadingState;
  serviceCategory: ServiceCategory;
  serviceCategoryParam: ServiceCategoryParam;
  serviceConfig: ServiceConfig;
  setIsConnectionVerified: (value: boolean) => void;
  setNameError: ServiceNameValidation['setNameError'];
  setServiceConfig: React.Dispatch<React.SetStateAction<ServiceConfig>>;
  showErrorServiceType: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  translatedSteps: { name: string; step: number }[];
}

// Extracted so the step 1/2/3 conditional rendering (service type grid,
// connection form, filters form) no longer adds to AddServiceFlow's own
// cyclomatic complexity.
const AddServiceStepContent = ({
  activeServiceStep,
  connectionFormRef,
  filtersFormRef,
  handleConfigUpdate,
  handleFieldBlur,
  handleFieldFocus,
  handleFiltersInputNextClick,
  handleServiceCategoryChange,
  handleServiceTypeClick,
  isConnectionVerified,
  isServiceNameChecking,
  isStep2NextDisabled,
  nameError,
  resetNameValidation,
  saveServiceState,
  serviceCategory,
  serviceCategoryParam,
  serviceConfig,
  setIsConnectionVerified,
  setNameError,
  setServiceConfig,
  showErrorServiceType,
  t,
  translatedSteps,
}: AddServiceStepContentProps) => (
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
            showError={showErrorServiceType}
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
                additionalMissingFieldsCount={isStep2NextDisabled ? 1 : 0}
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
                    document.getElementById(SERVICE_NAME_ID)?.focus();

                    return false;
                  }

                  if (nameError || isServiceNameChecking) {
                    document.getElementById(SERVICE_NAME_ID)?.focus();

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
);

export interface AddServiceFlowProps {
  /** Embedded variant: rendered inside the Connections surface rather than as a
   * standalone settings page. It carries its own breadcrumb trail, honours a
   * `backTo` deep-link target, and drops the page-level panel chrome. */
  embedded?: boolean;
}

/**
 * The add-service wizard shared by the standalone settings page and the embedded
 * Connections variant. Everything except breadcrumbs, the back target and the
 * panel chrome is identical between the two, so the difference is a single flag
 * rather than a forked copy of the flow.
 */
const AddServiceFlow = ({ embedded = false }: AddServiceFlowProps) => {
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
  // A connector deep-linked via router state (from the flattened `all` grid, or the onboarding
  // picker) skips the connector grid and opens straight on the Connect step.
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
  // Embedded deep-links skipped the connector grid, so "back" returns to wherever
  // the user came from instead of resetting the wizard to step 1.
  const shouldReturnToBackPath = embedded && Boolean(preselectedServiceType);

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

  const embeddedRootBreadcrumb = useMemo(
    () => [
      {
        label: t('label.connection-plural'),
        id: CATEGORY_ID,
      },
      {
        label: t('label.add-new-entity', {
          entity: t('label.service'),
        }),
        href: '',
        id: ADD_SERVICE_ID,
      },
    ],
    [t]
  );

  const serviceBreadcrumb = useMemo(() => {
    if (serviceConfig.serviceType) {
      return [
        {
          label: t('label.add-new-entity', {
            entity: t('label.service'),
          }),
          id: ADD_SERVICE_ID,
        },
        {
          label: serviceConfig.serviceType,
          id: serviceConfig.serviceType,
        },
      ];
    }

    return embedded ? embeddedRootBreadcrumb : slashedBreadcrumb;
  }, [
    embedded,
    embeddedRootBreadcrumb,
    serviceConfig.serviceType,
    slashedBreadcrumb,
    t,
  ]);

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
      document.getElementById(SERVICE_NAME_ID)?.focus();

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
      if (id === ADD_SERVICE_ID) {
        if (shouldReturnToBackPath) {
          navigate(backPath);
        } else if (activeServiceStepRef.current > 1) {
          setShowResetConfirm(true);
        } else {
          handleConnectorChangeClick();
        }
      } else if (id === CATEGORY_ID) {
        navigate(
          embedded
            ? EMBEDDED_CONNECTIONS_PATH
            : connectionsRouterClassBase.getSettingsServicesPath(
                serviceCategory
              )
        );
      }
    },
    [
      backPath,
      embedded,
      handleConnectorChangeClick,
      navigate,
      serviceCategory,
      shouldReturnToBackPath,
    ]
  );

  const isStep2NextDisabled =
    !serviceConfig.name.trim() || Boolean(nameError) || isServiceNameChecking;
  const isSavingService = saveServiceState === 'waiting';
  const showFooter = activeServiceStep === 2 || activeServiceStep === 3;

  const handleFooterBack = () => {
    if (shouldReturnToBackPath && activeServiceStep === 2) {
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

  const firstPanelChildren = (
    <FormPanelBody
      footer={
        showFooter ? (
          <AddServiceFooter
            activeServiceStep={activeServiceStep}
            isSavingService={isSavingService}
            isStep2NextDisabled={isStep2NextDisabled}
            t={t}
            onBack={handleFooterBack}
            onNext={handleFooterNext}
          />
        ) : undefined
      }>
      <>
        <Breadcrumbs
          items={serviceBreadcrumb}
          onAction={handleBreadcrumbAction}
        />
        <AddServiceStepContent
          activeServiceStep={activeServiceStep}
          connectionFormRef={connectionFormRef}
          filtersFormRef={filtersFormRef}
          handleConfigUpdate={handleConfigUpdate}
          handleFieldBlur={handleFieldBlur}
          handleFieldFocus={handleFieldFocus}
          handleFiltersInputNextClick={handleFiltersInputNextClick}
          handleServiceCategoryChange={handleServiceCategoryChange}
          handleServiceTypeClick={handleServiceTypeClick}
          isConnectionVerified={isConnectionVerified}
          isServiceNameChecking={isServiceNameChecking}
          isStep2NextDisabled={isStep2NextDisabled}
          nameError={nameError}
          resetNameValidation={resetNameValidation}
          saveServiceState={saveServiceState}
          serviceCategory={serviceCategory}
          serviceCategoryParam={serviceCategoryParam}
          serviceConfig={serviceConfig}
          setIsConnectionVerified={setIsConnectionVerified}
          setNameError={setNameError}
          setServiceConfig={setServiceConfig}
          showErrorServiceType={showErrorMessage.serviceType}
          t={t}
          translatedSteps={translatedSteps}
        />
      </>
    </FormPanelBody>
  );

  useEffect(() => {
    serviceUtilClassBase.getExtraInfo();
  }, []);

  const panelChrome = getPanelChrome(embedded, firstPanelChildren);

  return (
    <NavigationBlocker
      enabled={activeServiceStep > 1 && !isSavingService}
      leaveTo={shouldReturnToBackPath ? backPath : undefined}
      renderModal={({ isOpen, onLeave, onStay }) => (
        <NavigationGuardModal
          isOpen={isOpen}
          onLeave={onLeave}
          onStay={onStay}
        />
      )}>
      <>
        <ResizablePanels
          className={panelChrome.className}
          firstPanel={panelChrome.firstPanel}
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

export default AddServiceFlow;
