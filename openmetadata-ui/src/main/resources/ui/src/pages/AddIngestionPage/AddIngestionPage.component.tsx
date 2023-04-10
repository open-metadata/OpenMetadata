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
import { ServiceTypes } from 'Models';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
  getIngestionPipelineByFqn,
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
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
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

const AddIngestionPage = () => {
  const { fetchAirflowStatus } = useAirflowStatus();
  const { ingestionType, serviceFQN, serviceCategory } =
    useParams<{ [key: string]: string }>();
  const { t } = useTranslation();
  const history = useHistory();
  const [serviceData, setServiceData] = useState<DataObj>();
  const [activeIngestionStep, setActiveIngestionStep] = useState(1);
  const [isLoading, setIsloading] = useState(true);
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

  const fetchServiceDetails = () => {
    getServiceByFQN(serviceCategory, serviceFQN)
      .then((resService) => {
        if (resService) {
          setServiceData(resService as DataObj);
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
      .finally(() => setIsloading(false));
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
            err || jsonData['api-error-messages']['deploy-ingestion-error']
          );
        })
        .finally(() => resolve());
    });
  };

  const onAddIngestionSave = (data: CreateIngestionPipeline) => {
    setIngestionProgress(INGESTION_PROGRESS_START_VAL);

    return new Promise<void>((resolve, reject) => {
      return addIngestionPipeline(data)
        .then((res) => {
          if (res) {
            setIngestionId(res.id ?? '');
            onIngestionDeploy(res.id).finally(() => resolve());
          } else {
            showErrorToast(
              jsonData['api-error-messages']['create-ingestion-error']
            );
            reject();
          }
        })
        .catch((err: AxiosError) => {
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
                    jsonData['api-error-messages']['deploy-ingestion-error']
                  );
                } else {
                  throw jsonData['api-error-messages'][
                    'unexpected-server-response'
                  ];
                }
              })
              .catch(() => {
                showErrorToast(
                  err,
                  jsonData['api-error-messages']['create-ingestion-error']
                );
                reject();
              });
          }
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
        name: getIngestionHeadingName(ingestionType, INGESTION_ACTION_TYPE.ADD),
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
          handleCancelClick={goToService}
          handleViewServiceClick={goToService}
          heading={getIngestionHeadingName(
            ingestionType,
            INGESTION_ACTION_TYPE.ADD
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
          status={FormSubmitType.ADD}
          onAddIngestionSave={onAddIngestionSave}
          onIngestionDeploy={onIngestionDeploy}
        />
      </Card>
    </div>
  );

  const secondPanelChildren = (
    <ServiceDocPanel
      serviceName={serviceData?.serviceType ?? ''}
      serviceType={getServiceType(serviceCategory as ServiceCategory)}
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
      <ErrorPlaceHolder>
        {getEntityMissingError(serviceCategory, serviceFQN)}
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageContainerV1>
      <ResizablePanels
        firstPanel={{ children: firstPanelChildren, minWidth: 700, flex: 0.7 }}
        pageTitle={t('label.add-entity', { entity: t('label.ingestion') })}
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

export default AddIngestionPage;
