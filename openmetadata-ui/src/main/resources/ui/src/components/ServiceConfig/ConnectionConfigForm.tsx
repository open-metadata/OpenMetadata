/* eslint-disable @typescript-eslint/no-explicit-any */
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

import { ISubmitEvent } from '@rjsf/core';
import { LoadingState } from 'Models';
import React, { FunctionComponent } from 'react';
import { ServiceCategory } from '../../enums/service.enum';
import {
  DashboardConnection,
  DashboardService,
} from '../../generated/entity/services/dashboardService';
import {
  DatabaseConnection,
  DatabaseService,
} from '../../generated/entity/services/databaseService';
import {
  MessagingConnection,
  MessagingService,
} from '../../generated/entity/services/messagingService';
import { PipelineService } from '../../generated/entity/services/pipelineService';
import { getDashboardConfig } from '../../utils/DashboardServiceUtils';
import { getDatabaseConfig } from '../../utils/DatabaseServiceUtils';
import { getMessagingConfig } from '../../utils/MessagingServiceUtils';
import { getPipelineConfig } from '../../utils/PipelineServiceUtils';
import FormBuilder from '../common/FormBuilder/FormBuilder';

interface Props {
  data: DatabaseService | MessagingService | DashboardService | PipelineService;
  serviceCategory: ServiceCategory;
  status: LoadingState;
  onSave: (data: ISubmitEvent<Record<string, any>>) => void;
}

const ConnectionConfigForm: FunctionComponent<Props> = ({
  data,
  serviceCategory,
  status,
  onSave,
}: Props) => {
  /* eslint-disable-next-line no-prototype-builtins */
  const config = data.hasOwnProperty('connection')
    ? (data as DatabaseService | MessagingService | DashboardService).connection
        .config
    : { pipelineUrl: (data as PipelineService).pipelineUrl };
  const getDatabaseFields = () => {
    let connSch = {
      schema: {},
      uiSchema: {},
    };

    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES: {
        connSch = getDatabaseConfig(config as DatabaseConnection['config']);

        break;
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        connSch = getMessagingConfig(config as MessagingConnection['config']);

        break;
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        connSch = getDashboardConfig(config as DashboardConnection['config']);

        break;
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        connSch = getPipelineConfig();

        break;
      }
    }

    return (
      <FormBuilder
        formData={config as Record<string, any>}
        schema={connSch.schema}
        status={status}
        uiSchema={connSch.uiSchema}
        onSubmit={onSave}
      />
    );
  };

  return <>{getDatabaseFields()}</>;
};

export default ConnectionConfigForm;
