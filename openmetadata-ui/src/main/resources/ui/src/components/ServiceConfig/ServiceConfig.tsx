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

import { ServicesData } from 'Models';
import React, { useState } from 'react';
import { ServiceCategory } from '../../enums/service.enum';
import { DashboardService } from '../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { MessagingService } from '../../generated/entity/services/messagingService';
import { PipelineService } from '../../generated/entity/services/pipelineService';
import ConnectionConfigForm from './ConnectionConfigForm';

interface ServiceConfigProps {
  serviceCategory: ServiceCategory;
  data?: ServicesData;
  handleUpdate: (
    data: ServicesData,
    serviceCategory: ServiceCategory
  ) => Promise<void>;
}

export const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const ServiceConfig = ({
  serviceCategory,
  data,
  handleUpdate,
}: ServiceConfigProps) => {
  const [status] = useState<'initial' | 'waiting' | 'success'>('initial');

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
        serviceCategory={serviceCategory}
        status={status}
        onSave={(e) => {
          handleUpdate(e.formData as ServicesData, serviceCategory);
        }}
      />
    );
  };

  return (
    <div className="tw-bg-white tw-h-full">
      <div
        className="tw-max-w-xl tw-mx-auto tw-pb-6"
        data-testid="service-config"
        id="serviceConfig">
        <div className="tw-px-4 tw-pt-3 tw-mx-auto">{getDynamicFields()}</div>
      </div>
    </div>
  );
};

export default ServiceConfig;
