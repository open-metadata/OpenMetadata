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
import { capitalize } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  getIngestionPipelineByFqn,
  updateIngestionPipeline,
} from '../../axiosAPIs/ingestionPipelineAPI';
import { getServiceByFQN } from '../../axiosAPIs/serviceAPI';
import AddIngestion from '../../components/AddIngestion/AddIngestion.component';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import { getServiceDetailsPath } from '../../constants/constants';
import { FormSubmitType } from '../../enums/form.enum';
import { PageLayoutType } from '../../enums/layout.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateIngestionPipeline } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionPipeline,
  PipelineType,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { DataObj } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { getEntityMissingError } from '../../utils/CommonUtils';
import { getServiceIngestionStepGuide } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const EditIngestionPage = () => {
  const { ingestionFQN, ingestionType, serviceFQN, serviceCategory } =
    useParams<{ [key: string]: string }>();
  const history = useHistory();
  const [serviceData, setServiceData] = useState<DataObj>();
  const [ingestionData, setIngestionData] = useState<IngestionPipeline>(
    {} as IngestionPipeline
  );
  const [activeIngestionStep, setActiveIngestionStep] = useState(1);
  const [isLoading, setIsloading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | JSX.Element>('');

  const fetchServiceDetails = () => {
    return new Promise<void>((resolve, reject) => {
      getServiceByFQN(serviceCategory, serviceFQN)
        .then((resService: AxiosResponse) => {
          if (resService.data) {
            setServiceData(resService.data);
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
      getIngestionPipelineByFqn(ingestionFQN)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setIngestionData(res.data);
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

  const onEditIngestionSave = (data: IngestionPipeline) => {
    const {
      airflowConfig,
      description,
      displayName,
      name,
      owner,
      pipelineType,
      service,
      source,
    } = data;
    const updateData = {
      airflowConfig,
      description,
      displayName,
      name,
      owner,
      pipelineType,
      service,
      sourceConfig: source.sourceConfig,
    };

    return new Promise<void>((resolve, reject) => {
      return updateIngestionPipeline(updateData as CreateIngestionPipeline)
        .then((res: AxiosResponse) => {
          if (res.data) {
            resolve();
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
                  jsonData['api-error-messages']['update-ingestion-error']
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

  const renderAddIngestionPage = () => {
    if (isLoading) {
      return <Loader />;
    } else if (errorMsg) {
      return <ErrorPlaceHolder>{errorMsg}</ErrorPlaceHolder>;
    } else {
      return (
        <PageLayout
          classes="tw-max-w-full-hd tw-h-full tw-pt-4"
          layout={PageLayoutType['2ColRTL']}
          rightPanel={getServiceIngestionStepGuide(
            activeIngestionStep,
            true,
            ingestionData?.name || '',
            '',
            ingestionType as PipelineType
          )}>
          <div className="tw-form-container">
            <AddIngestion
              activeIngestionStep={activeIngestionStep}
              data={ingestionData}
              handleCancelClick={goToService}
              handleViewServiceClick={goToService}
              heading={`Edit ${capitalize(ingestionType)} Ingestion`}
              pipelineType={ingestionType as PipelineType}
              serviceCategory={serviceCategory as ServiceCategory}
              serviceData={serviceData as DataObj}
              setActiveIngestionStep={(step) => setActiveIngestionStep(step)}
              status={FormSubmitType.EDIT}
              onSuccessSave={goToService}
              onUpdateIngestion={onEditIngestionSave}
            />
          </div>
        </PageLayout>
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, [serviceCategory, serviceFQN]);

  return <PageContainerV1>{renderAddIngestionPage()}</PageContainerV1>;
};

export default EditIngestionPage;
