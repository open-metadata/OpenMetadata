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

import { AxiosError } from 'axios';
import AddService from 'components/AddService/AddService.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import { startCase } from 'lodash';
import { ServicesUpdateRequest, ServiceTypes } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
  getIngestionPipelineByFqn,
} from 'rest/ingestionPipelineAPI';
import { postService } from 'rest/serviceAPI';
import {
  DEPLOYED_PROGRESS_VAL,
  INGESTION_PROGRESS_END_VAL,
  INGESTION_PROGRESS_START_VAL,
} from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { IngestionActionMessage } from '../../enums/ingestion.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateIngestionPipeline } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { useAirflowStatus } from '../../hooks/useAirflowStatus';
import { DataObj } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { getSettingPath } from '../../utils/RouterUtils';
import { getServiceRouteFromServiceType } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AddServicePage = () => {
  const { fetchAirflowStatus } = useAirflowStatus();
  const { serviceCategory } = useParams<{ [key: string]: string }>();
  const [newServiceData, setNewServiceData] = useState<ServicesUpdateRequest>();
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
  const [addIngestion, setAddIngestion] = useState(false);

  const handleAddIngestion = (value: boolean) => {
    setAddIngestion(value);
  };

  const onAddServiceSave = (data: DataObj) => {
    return new Promise<void>((resolve, reject) => {
      postService(serviceCategory, data)
        .then((res) => {
          if (res) {
            setNewServiceData(res);
            resolve();
          } else {
            showErrorToast(
              jsonData['api-error-messages']['create-service-error']
            );
            reject();
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['create-service-error']
          );
          reject();
        });
    });
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
          getIngestionPipelineByFqn(`${newServiceData?.name}.${data.name}`)
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
        });
    });
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
        name: addIngestion ? 'Add New Ingestion' : 'Add New Service',
        url: '',
        activeTitle: true,
      },
    ]);
  }, [serviceCategory, addIngestion]);

  return (
    <PageContainerV1>
      <div className="self-center">
        <AddService
          addIngestion={addIngestion}
          handleAddIngestion={handleAddIngestion}
          ingestionAction={ingestionAction}
          ingestionProgress={ingestionProgress}
          isIngestionCreated={isIngestionCreated}
          isIngestionDeployed={isIngestionDeployed}
          newServiceData={newServiceData}
          serviceCategory={serviceCategory as ServiceCategory}
          showDeployButton={showIngestionButton}
          slashedBreadcrumb={slashedBreadcrumb}
          onAddIngestionSave={onAddIngestionSave}
          onAddServiceSave={onAddServiceSave}
          onAirflowStatusCheck={fetchAirflowStatus}
          onIngestionDeploy={onIngestionDeploy}
        />
      </div>
    </PageContainerV1>
  );
};

export default AddServicePage;
