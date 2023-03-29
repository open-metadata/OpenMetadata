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

import { IChangeEvent } from '@rjsf/core';
import { LoadingState, ServicesData } from 'Models';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ServiceCategory } from '../../enums/service.enum';
import { DashboardService } from '../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { MessagingService } from '../../generated/entity/services/messagingService';
import { PipelineService } from '../../generated/entity/services/pipelineService';
import { ConfigData } from '../../interface/service.interface';
import { getPathByServiceFQN } from '../../utils/RouterUtils';
import ConnectionConfigForm from './ConnectionConfigForm';

interface ServiceConfigProps {
  serviceCategory: ServiceCategory;
  serviceFQN: string;
  serviceType: string;
  data?: ServicesData;
  handleUpdate: (
    data: ConfigData,
    serviceCategory: ServiceCategory
  ) => Promise<void>;
  disableTestConnection: boolean;
  onFocus: (fieldName: string) => void;
}

export const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const ServiceConfig = ({
  serviceCategory,
  serviceFQN,
  serviceType,
  data,
  handleUpdate,
  disableTestConnection,
  onFocus,
}: ServiceConfigProps) => {
  const history = useHistory();
  const [status, setStatus] = useState<LoadingState>('initial');

  const handleOnSaveClick = (e: IChangeEvent<ConfigData>) => {
    if (e.formData) {
      setStatus('waiting');

      handleUpdate(e.formData, serviceCategory)
        .then(() => {
          setTimeout(() => {
            setStatus('success');
            history.push(getPathByServiceFQN(serviceCategory, serviceFQN));
          }, 200);
        })
        .finally(() => {
          setTimeout(() => {
            setStatus('initial');
          }, 500);
        });
    }
  };

  const onCancel = () => {
    history.goBack();
  };

  const getDynamicFields = () => {
    return (
      <ConnectionConfigForm
        data={
          data as
            | DatabaseService
            | MessagingService
            | DashboardService
            | PipelineService
        }
        disableTestConnection={disableTestConnection}
        serviceCategory={serviceCategory}
        serviceType={serviceType}
        status={status}
        onCancel={onCancel}
        onFocus={onFocus}
        onSave={handleOnSaveClick}
      />
    );
  };

  return (
    <div className="bg-white h-full">
      <div
        className="w-full p-b-lg"
        data-testid="service-config"
        id="serviceConfig">
        <div className="tw-mx-auto">{getDynamicFields()}</div>
      </div>
    </div>
  );
};

export default ServiceConfig;
