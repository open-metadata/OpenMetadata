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

import { Button, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { OpenIncidents } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import FormPanelBody, {
  getFormFirstPanelProps,
} from '../../components/common/FormPanelBody/FormPanelBody.component';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import AddIngestion from '../../components/Settings/Services/AddIngestion/AddIngestion.component';
import { AddIngestionHandle } from '../../components/Settings/Services/AddIngestion/IngestionWorkflow.interface';
import {
  DEPLOYED_PROGRESS_VAL,
  INGESTION_PROGRESS_END_VAL,
  INGESTION_PROGRESS_START_VAL,
} from '../../constants/constants';
import { INGESTION_ACTION_TYPE } from '../../constants/Ingestions.constant';
import { useAirflowStatus } from '../../context/AirflowStatusProvider/AirflowStatusProvider';
import { EntityTabs } from '../../enums/entity.enum';
import { FormSubmitType } from '../../enums/form.enum';
import { IngestionActionMessage } from '../../enums/ingestion.enum';
import { ServiceAgentSubTabs, ServiceCategory } from '../../enums/service.enum';
import { CreateIngestionPipeline } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionPipeline,
  PipelineType,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useFqn } from '../../hooks/useFqn';
import { DataObj } from '../../interface/service.interface';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
  getIngestionPipelineByFqn,
} from '../../rest/ingestionPipelineAPI';
import { getServiceByFQN } from '../../rest/serviceAPI';
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import {
  getBreadCrumbsArray,
  getIngestionHeadingName,
  getSettingsPathFromPipelineType,
} from '../../utils/IngestionConfigUtils';
import { getServiceDetailsPath } from '../../utils/RouterUtils';
import { getServiceType } from '../../utils/ServicePureUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

const AddIngestionPage = () => {
  const { fetchAirflowStatus } = useAirflowStatus();
  const { ingestionType, serviceCategory } = useRequiredParams<{
    ingestionType: string;
    serviceCategory: string;
  }>();
  const { fqn: serviceFQN } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [serviceData, setServiceData] = useState<DataObj>();
  const [activeIngestionStep, setActiveIngestionStep] = useState(1);
  const [isStepReady, setIsStepReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [isIngestionCreated, setIsIngestionCreated] = useState(false);
  const [isIngestionDeployed, setIsIngestionDeployed] = useState(false);
  const [ingestionAction, setIngestionAction] = useState(
    IngestionActionMessage.CREATING
  );
  const [ingestionId, setIngestionId] = useState('');
  const [showIngestionButton, setShowIngestionButton] = useState(false);
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [activeField, setActiveField] = useState<string>('');
  const addIngestionRef = useRef<AddIngestionHandle>(null);

  const isSettingsPipeline = useMemo(
    () =>
      ingestionType === PipelineType.DataInsight ||
      ingestionType === PipelineType.ElasticSearchReindex,
    [ingestionType]
  );

  const fetchServiceDetails = async () => {
    try {
      const response = await getServiceByFQN(serviceCategory, serviceFQN);
      if (response) {
        setServiceData(response as DataObj);
      } else {
        showErrorToast(
          t('server.entity-fetch-error', {
            entity: t('label.service-detail-lowercase-plural'),
          })
        );
      }
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        setIsError(true);
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.service-detail-lowercase-plural'),
          })
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onIngestionDeploy = (id?: string) => {
    return new Promise<void>((resolve) => {
      setIsIngestionCreated(true);
      setIngestionProgress(INGESTION_PROGRESS_END_VAL);
      setIngestionAction(IngestionActionMessage.DEPLOYING);

      deployIngestionPipelineById(id ?? ingestionId)
        .then(() => {
          setIsIngestionDeployed(true);
          setShowIngestionButton(false);
          setIngestionProgress(DEPLOYED_PROGRESS_VAL);
          setIngestionAction(IngestionActionMessage.DEPLOYED);
        })
        .catch((err: AxiosError) => {
          setShowIngestionButton(true);
          setIngestionAction(IngestionActionMessage.DEPLOYING_ERROR);
          showErrorToast(
            err,
            t('server.deploy-entity-error', {
              entity: t('label.ingestion-workflow-lowercase'),
            })
          );
        })
        .finally(() => resolve());
    });
  };

  const onAddIngestionSave = (data: CreateIngestionPipeline) => {
    setIngestionProgress(INGESTION_PROGRESS_START_VAL);

    const handleCreateSuccess = (
      res: IngestionPipeline,
      resolve: () => void,
      reject: () => void
    ) => {
      if (res) {
        setIngestionId(res.id ?? '');
        onIngestionDeploy(res.id).finally(() => resolve());
      } else {
        showErrorToast(
          t('server.create-entity-error', {
            entity: t('label.ingestion-workflow'),
          })
        );
        reject();
      }
    };

    const handleCreateError = (
      err: AxiosError,
      resolve: () => void,
      reject: () => void
    ) => {
      if (err.response?.status === 409) {
        showErrorToast(
          err,
          t('message.entity-already-exists', {
            entity: t('label.data-asset'),
          })
        );
        reject();
      } else {
        getIngestionPipelineByFqn(`${serviceData?.name}.${data.name}`)
          .then((res) => {
            if (res) {
              resolve();
              showErrorToast(
                err,
                t('server.deploy-entity-error', {
                  entity: t('label.ingestion-workflow'),
                })
              );
            } else {
              throw t('server.unexpected-response');
            }
          })
          .catch(() => {
            showErrorToast(
              err,
              t('server.create-entity-error', {
                entity: t('label.ingestion-workflow'),
              })
            );
            reject();
          });
      }
    };

    return new Promise<void>((resolve, reject) => {
      return addIngestionPipeline(data)
        .then((res) => handleCreateSuccess(res, resolve, reject))
        .catch((err: AxiosError) => handleCreateError(err, resolve, reject));
    });
  };

  const goToSettingsPage = () => {
    navigate(getSettingsPathFromPipelineType(ingestionType));
  };

  const goToService = () => {
    navigate(
      getServiceDetailsPath(
        serviceFQN,
        serviceCategory,
        EntityTabs.AGENTS,
        ServiceAgentSubTabs.METADATA
      )
    );
  };

  const handleCancelClick = isSettingsPipeline ? goToSettingsPage : goToService;

  const handleFieldFocus = (fieldName: string) => {
    if (isEmpty(fieldName)) {
      return;
    }
    setTimeout(() => {
      setActiveField(fieldName);
    }, 50);
  };

  useEffect(() => {
    const breadCrumbsArray = getBreadCrumbsArray(
      isSettingsPipeline,
      ingestionType,
      serviceCategory,
      serviceFQN,
      INGESTION_ACTION_TYPE.ADD,
      serviceData
    );
    setSlashedBreadcrumb(breadCrumbsArray);
  }, [serviceCategory, ingestionType, serviceData, isSettingsPipeline]);

  const footerNextText =
    activeIngestionStep === 2 ? t('label.add-deploy') : t('label.next');

  const handleFooterBack = () => {
    if (activeIngestionStep === 1) {
      handleCancelClick();
    } else {
      setActiveIngestionStep(1);
    }
  };

  const handleFooterNext = () => {
    addIngestionRef.current?.submit();
  };

  const firstPanelChildren = (
    <FormPanelBody
      footer={
        activeIngestionStep <= 2 ? (
          <>
            <Button
              color="secondary"
              data-testid="previous-button"
              size="sm"
              type="button"
              onPress={handleFooterBack}>
              {t('label.back')}
            </Button>
            <Button
              color="primary"
              data-testid="next-button"
              isDisabled={!isStepReady}
              size="sm"
              type="button"
              onPress={handleFooterNext}>
              {footerNextText}
            </Button>
          </>
        ) : undefined
      }>
      <>
        <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
        <div className="tw:mt-4">
          <AddIngestion
            hideFooter
            activeIngestionStep={activeIngestionStep}
            handleCancelClick={handleCancelClick}
            handleViewServiceClick={handleCancelClick}
            heading={getIngestionHeadingName(
              ingestionType,
              INGESTION_ACTION_TYPE.ADD
            )}
            ingestionAction={ingestionAction}
            ingestionProgress={ingestionProgress}
            isIngestionCreated={isIngestionCreated}
            isIngestionDeployed={isIngestionDeployed}
            pipelineType={ingestionType as PipelineType}
            ref={addIngestionRef}
            serviceCategory={serviceCategory as ServiceCategory}
            serviceData={serviceData as DataObj}
            setActiveIngestionStep={(step) => setActiveIngestionStep(step)}
            showDeployButton={showIngestionButton}
            status={FormSubmitType.ADD}
            onAddIngestionSave={onAddIngestionSave}
            onFocus={handleFieldFocus}
            onIngestionDeploy={onIngestionDeploy}
            onStepReadyChange={setIsStepReady}
          />
        </div>
      </>
    </FormPanelBody>
  );

  const secondPanelChildren = (
    <ServiceDocPanel
      focusedMode
      isWorkflow
      activeField={activeField}
      serviceName={serviceData?.serviceType ?? ''}
      serviceType={getServiceType(serviceCategory as ServiceCategory)}
      workflowType={ingestionType as PipelineType}
    />
  );

  useEffect(() => {
    fetchAirflowStatus().finally(() => {
      fetchServiceDetails();
    });
  }, [serviceCategory, serviceFQN]);

  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return (
      <div className="tw:relative tw:flex-1 tw:h-[calc(100vh-80px)]">
        <EmptyPlaceholder
          description={getEntityMissingError(serviceCategory, serviceFQN)}
          icon={<OpenIncidents className="tw:text-secondary" />}
          title={t('message.something-went-wrong')}
        />
      </div>
    );
  }

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel tw:bg-transparent"
      firstPanel={getFormFirstPanelProps(firstPanelChildren)}
      pageTitle={t('label.add-entity', {
        entity: t('label.ingestion'),
      })}
      secondPanel={{
        children: secondPanelChildren,
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(AddIngestionPage);
