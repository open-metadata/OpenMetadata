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
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { addIngestionPipeline } from '../../axiosAPIs/ingestionPipelineAPI';
import { postService } from '../../axiosAPIs/serviceAPI';
import AddService from '../../components/AddService/AddService.component';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateIngestionPipeline } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { DataObj } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const AddServicePage = () => {
  const { serviceCategory } = useParams<{ [key: string]: string }>();
  const [newServiceData, setNewServiceData] = useState<DataObj>();

  const onAddServiceSave = (data: DataObj) => {
    return new Promise<void>((resolve, reject) => {
      postService(serviceCategory, data)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setNewServiceData(res.data);
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

  const onAddIngestionSave = (data: CreateIngestionPipeline) => {
    return new Promise<void>((resolve, reject) => {
      return addIngestionPipeline(data)
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
          showErrorToast(
            err,
            jsonData['api-error-messages']['create-ingestion-error']
          );
          reject();
        });
    });
  };

  return (
    <PageContainerV1>
      <AddService
        newServiceData={newServiceData}
        serviceCategory={serviceCategory as ServiceCategory}
        onAddIngestionSave={onAddIngestionSave}
        onAddServiceSave={onAddServiceSave}
      />
    </PageContainerV1>
  );
};

export default AddServicePage;
