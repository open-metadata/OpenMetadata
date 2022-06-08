/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosResponse } from 'axios';
import { capitalize, startCase } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  addIngestionPipeline,
  checkAirflowStatus,
  deployIngestionPipelineById,
  getIngestionPipelineByFqn,
} from '../../axiosAPIs/ingestionPipelineAPI';
import { getServiceByFQN } from '../../axiosAPIs/serviceAPI';
import AddIngestion from '../../components/AddIngestion/AddIngestion.component';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import {
  DEPLOYED_PROGRESS_VAL,
  getServiceDetailsPath,
  INGESTION_PROGRESS_END_VAL,
  INGESTION_PROGRESS_START_VAL,
} from '../../constants/constants';
import { FormSubmitType } from '../../enums/form.enum';
import { IngestionActionMessage } from '../../enums/ingestion.enum';
import { PageLayoutType } from '../../enums/layout.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateIngestionPipeline } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { DataObj } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { getEntityMissingError } from '../../utils/CommonUtils';
import { getServicesWithTabPath } from '../../utils/RouterUtils';
import {
  getServiceIngestionStepGuide,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AddIngestionPage = () => {
  const { ingestionType, serviceFQN, serviceCategory } =
    useParams<{ [key: string]: string }>();
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
  const [isAirflowRunning, setIsAirflowRunning] = useState(true);

  const fetchServiceDetails = () => {
    getServiceByFQN(serviceCategory, serviceFQN)
      .then((resService: AxiosResponse) => {
        if (resService.data) {
          setServiceData(resService.data);
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
        .then((res: AxiosResponse) => {
          if (res.data) {
            setIngestionId(res.data.id);
            onIngestionDeploy(res.data.id).finally(() => resolve());
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
              jsonData['api-error-messages']['entity-already-exist-error']
            );
            reject();
          } else {
            getIngestionPipelineByFqn(`${serviceData?.name}.${data.name}`)
              .then((res: AxiosResponse) => {
                if (res.data) {
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

  const onAirflowStatusCheck = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      checkAirflowStatus()
        .then((res) => {
          if (res.status === 200) {
            resolve();
          } else {
            reject();
          }
        })
        .catch(() => reject());
    });
  };

  const fetchAirflowStatusCheck = () => {
    return new Promise<void>((resolve) => {
      onAirflowStatusCheck()
        .then(() => {
          setIsAirflowRunning(true);
        })
        .catch(() => {
          setIsAirflowRunning(false);
        })
        .finally(() => resolve());
    });
  };

  const goToService = () => {
    history.push(
      getServiceDetailsPath(serviceFQN, serviceCategory, 'ingestions')
    );
  };

  const isDeployed = () => {
    const ingestion =
      ingestionType === PipelineType.Metadata
        ? activeIngestionStep >= 3
        : activeIngestionStep >= 2;

    return ingestion && !showIngestionButton;
  };

  useEffect(() => {
    setSlashedBreadcrumb([
      {
        name: startCase(serviceCategory),
        url: getServicesWithTabPath(serviceCategory),
      },
      {
        name: serviceData?.name || '',
        url: getServiceDetailsPath(serviceFQN, serviceCategory, 'ingestions'),
        imgSrc: serviceTypeLogo(serviceData?.serviceType || ''),
        activeTitle: true,
      },
      {
        name: `Add ${capitalize(ingestionType)} Ingestion`,
        url: '',
        activeTitle: true,
      },
    ]);
  }, [serviceCategory, ingestionType, serviceData]);

  const renderAddIngestionPage = () => {
    if (isLoading) {
      return <Loader />;
    } else if (isError) {
      return (
        <ErrorPlaceHolder>
          {getEntityMissingError(serviceCategory, serviceFQN)}
        </ErrorPlaceHolder>
      );
    } else {
      return (
        <PageLayout
          classes="tw-max-w-full-hd tw-h-full tw-pt-4"
          header={<TitleBreadcrumb titleLinks={slashedBreadcrumb} />}
          layout={PageLayoutType['2ColRTL']}
          rightPanel={getServiceIngestionStepGuide(
            activeIngestionStep,
            true,
            `${serviceData?.name || ''}_${ingestionType}`,
            '',
            ingestionType as PipelineType,
            isDeployed(),
            false,
            isAirflowRunning
          )}>
          <div className="tw-form-container">
            <AddIngestion
              activeIngestionStep={activeIngestionStep}
              handleCancelClick={goToService}
              handleViewServiceClick={goToService}
              heading={`Add ${capitalize(ingestionType)} Ingestion`}
              ingestionAction={ingestionAction}
              ingestionProgress={ingestionProgress}
              isAirflowSetup={isAirflowRunning}
              isIngestionCreated={isIngestionCreated}
              isIngestionDeployed={isIngestionDeployed}
              pipelineType={ingestionType as PipelineType}
              serviceCategory={serviceCategory as ServiceCategory}
              serviceData={serviceData as DataObj}
              setActiveIngestionStep={(step) => setActiveIngestionStep(step)}
              showDeployButton={showIngestionButton}
              status={FormSubmitType.ADD}
              onAddIngestionSave={onAddIngestionSave}
              onAirflowStatusCheck={onAirflowStatusCheck}
              onIngestionDeploy={onIngestionDeploy}
            />
          </div>
        </PageLayout>
      );
    }
  };

  useEffect(() => {
    fetchAirflowStatusCheck().finally(() => {
      fetchServiceDetails();
    });
  }, [serviceCategory, serviceFQN]);

  return <PageContainerV1>{renderAddIngestionPage()}</PageContainerV1>;
};

export default AddIngestionPage;
