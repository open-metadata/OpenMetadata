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

import { Card } from 'antd';
import { AxiosError } from 'axios';
import AddIngestion from 'components/AddIngestion/AddIngestion.component';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import ResizablePanels from 'components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from 'components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import Loader from 'components/Loader/Loader';
import { startCase } from 'lodash';
import { ServicesUpdateRequest, ServiceTypes } from 'Models';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  deployIngestionPipelineById,
  getIngestionPipelineByFqn,
  updateIngestionPipeline,
} from 'rest/ingestionPipelineAPI';
import { getServiceByFQN } from 'rest/serviceAPI';
import {
  DEPLOYED_PROGRESS_VAL,
  getServiceDetailsPath,
  INGESTION_PROGRESS_END_VAL,
  INGESTION_PROGRESS_START_VAL,
} from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { INGESTION_ACTION_TYPE } from '../../constants/Ingestions.constant';
import { FormSubmitType } from '../../enums/form.enum';
import { IngestionActionMessage } from '../../enums/ingestion.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateIngestionPipeline } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionPipeline,
  PipelineType,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useAirflowStatus } from '../../hooks/useAirflowStatus';
import { DataObj } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { getEntityMissingError } from '../../utils/CommonUtils';
import { getIngestionHeadingName } from '../../utils/IngestionUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import {
  getServiceRouteFromServiceType,
  getServiceType,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const EditIngestionPage = () => {
  const { t } = useTranslation();
  const { fetchAirflowStatus } = useAirflowStatus();
  const { ingestionFQN, ingestionType, serviceFQN, serviceCategory } =
    useParams<{ [key: string]: string }>();
  const history = useHistory();
  const [serviceData, setServiceData] = useState<ServicesUpdateRequest>();
  const [ingestionData, setIngestionData] = useState<IngestionPipeline>(
    {} as IngestionPipeline
  );
  const [activeIngestionStep, setActiveIngestionStep] = useState(1);
  const [isLoading, setIsloading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | JSX.Element>('');
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [isIngestionCreated, setIsIngestionCreated] = useState(false);
  const [isIngestionDeployed, setIsIngestionDeployed] = useState(false);
  const [ingestionAction, setIngestionAction] = useState(
    IngestionActionMessage.UPDATING
  );
  const [showIngestionButton, setShowIngestionButton] = useState(false);
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const fetchServiceDetails = () => {
    return new Promise<void>((resolve, reject) => {
      getServiceByFQN(serviceCategory, serviceFQN)
        .then((resService) => {
          if (resService) {
            setServiceData(resService as ServicesUpdateRequest);
            resolve();
          } else {
            showErrorToast(
              jsonData['api-error-messages']['fetch-service-error']
            );
          }
        })
        .catch((error: AxiosError) => {
          if (error.response?.status === 404) {
            setErrorMsg(getEntityMissingError(serviceCategory, serviceFQN));
          } else {
            const errTextService =
              jsonData['api-error-messages']['fetch-service-error'];
            showErrorToast(error, errTextService);
            setErrorMsg(errTextService);
          }
          reject();
        });
    });
  };

  const fetchIngestionDetails = () => {
    return new Promise<void>((resolve, reject) => {
      getIngestionPipelineByFqn(ingestionFQN, ['pipelineStatuses'])
        .then((res) => {
          if (res) {
            setIngestionData(res);
            resolve();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((error: AxiosError) => {
          if (error.response?.status === 404) {
            setErrorMsg(getEntityMissingError('Ingestion', ingestionFQN));
          } else {
            const errTextIngestion =
              jsonData['api-error-messages']['fetch-ingestion-error'];
            showErrorToast(error, errTextIngestion);
            setErrorMsg(errTextIngestion);
          }
          reject();
        });
    });
  };

  const fetchData = () => {
    const promises = [fetchServiceDetails(), fetchIngestionDetails()];
    Promise.allSettled(promises).finally(() => setIsloading(false));
  };

  const onIngestionDeploy = () => {
    return new Promise<void>((resolve) => {
      setIsIngestionCreated(true);
      setIngestionProgress(INGESTION_PROGRESS_END_VAL);
      setIngestionAction(IngestionActionMessage.DEPLOYING);

      deployIngestionPipelineById(ingestionData.id as string)
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
            err || jsonData['api-error-messages']['deploy-ingestion-error']
          );
        })
        .finally(() => resolve());
    });
  };

  const onEditIngestionSave = (data: IngestionPipeline) => {
    if (!ingestionData.deployed) {
      setIngestionProgress(INGESTION_PROGRESS_START_VAL);
    }
    const {
      airflowConfig,
      description,
      displayName,
      loggerLevel,
      name,
      owner,
      pipelineType,
      service,
      sourceConfig,
    } = data;
    const updateData = {
      airflowConfig,
      description,
      displayName,
      loggerLevel,
      name,
      owner,
      pipelineType,
      service,
      sourceConfig,
    };

    return new Promise<void>((resolve, reject) => {
      return updateIngestionPipeline(updateData as CreateIngestionPipeline)
        .then((res) => {
          if (res) {
            onIngestionDeploy();
            resolve();
          } else {
            throw jsonData['api-error-messages']['update-ingestion-error'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-ingestion-error']
          );
          reject();
        });
    });
  };

  const goToService = () => {
    history.push(
      getServiceDetailsPath(serviceFQN, serviceCategory, 'ingestions')
    );
  };

  useEffect(() => {
    setSlashedBreadcrumb([
      {
        name: startCase(serviceCategory),
        url: getSettingPath(
          GlobalSettingsMenuCategory.SERVICES,
          getServiceRouteFromServiceType(serviceCategory as ServiceTypes)
        ),
      },
      {
        name: serviceData?.name || '',
        url: getServiceDetailsPath(serviceFQN, serviceCategory, 'ingestions'),
        imgSrc: serviceTypeLogo(serviceData?.serviceType || ''),
        activeTitle: true,
      },
      {
        name: getIngestionHeadingName(
          ingestionType,
          INGESTION_ACTION_TYPE.EDIT
        ),
        url: '',
        activeTitle: true,
      },
    ]);
  }, [serviceCategory, ingestionType, serviceData]);

  useEffect(() => {
    if (ingestionType === PipelineType.Dbt) {
      setActiveIngestionStep(2);
    }
  }, [ingestionType]);

  const firstPanelChildren = (
    <div className="max-width-md w-9/10 service-form-container">
      <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
      <Card className="p-lg m-t-md">
        <AddIngestion
          activeIngestionStep={activeIngestionStep}
          data={ingestionData}
          handleCancelClick={goToService}
          handleViewServiceClick={goToService}
          heading={getIngestionHeadingName(
            ingestionType,
            INGESTION_ACTION_TYPE.EDIT
          )}
          ingestionAction={ingestionAction}
          ingestionProgress={ingestionProgress}
          isIngestionCreated={isIngestionCreated}
          isIngestionDeployed={isIngestionDeployed}
          pipelineType={ingestionType as PipelineType}
          serviceCategory={serviceCategory as ServiceCategory}
          serviceData={serviceData as DataObj}
          setActiveIngestionStep={(step) => setActiveIngestionStep(step)}
          showDeployButton={showIngestionButton}
          status={FormSubmitType.EDIT}
          onIngestionDeploy={onIngestionDeploy}
          onSuccessSave={goToService}
          onUpdateIngestion={onEditIngestionSave}
        />
      </Card>
    </div>
  );

  const secondPanelChildren = (
    <ServiceDocPanel
      isWorkflow
      serviceName={serviceData?.serviceType ?? ''}
      serviceType={getServiceType(serviceCategory as ServiceCategory)}
      workflowType={ingestionType as PipelineType}
    />
  );

  useEffect(() => {
    fetchAirflowStatus().finally(() => {
      fetchData();
    });
  }, [serviceCategory, serviceFQN]);

  if (isLoading) {
    return <Loader />;
  }
  if (errorMsg) {
    return <ErrorPlaceHolder>{errorMsg}</ErrorPlaceHolder>;
  }

  return (
    <PageContainerV1>
      <ResizablePanels
        firstPanel={{ children: firstPanelChildren, minWidth: 700, flex: 0.7 }}
        pageTitle={t('label.edit-entity', {
          entity: t('label.ingestion'),
        })}
        secondPanel={{
          children: secondPanelChildren,
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
};

export default EditIngestionPage;
