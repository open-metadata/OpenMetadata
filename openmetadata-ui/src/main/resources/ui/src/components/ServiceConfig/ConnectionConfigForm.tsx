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
import { ObjectStoreServiceType } from 'generated/entity/data/container';
import { cloneDeep, isNil } from 'lodash';
import { LoadingState } from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  useCallback,
  useMemo,
} from 'react';
import { getObjectStoreConfig } from 'utils/ObjectStoreServiceUtils';
import { ServiceCategory } from '../../enums/service.enum';
import { MetadataServiceType } from '../../generated/api/services/createMetadataService';
import { MlModelServiceType } from '../../generated/api/services/createMlModelService';
import { DashboardServiceType } from '../../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../../generated/entity/services/databaseService';
import { MessagingServiceType } from '../../generated/entity/services/messagingService';
import { PipelineServiceType } from '../../generated/entity/services/pipelineService';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { getDashboardConfig } from '../../utils/DashboardServiceUtils';
import { getDatabaseConfig } from '../../utils/DatabaseServiceUtils';
import { formatFormDataForSubmit } from '../../utils/JSONSchemaFormUtils';
import { getMessagingConfig } from '../../utils/MessagingServiceUtils';
import { getMetadataConfig } from '../../utils/MetadataServiceUtils';
import { getMlmodelConfig } from '../../utils/MlmodelServiceUtils';
import { getPipelineConfig } from '../../utils/PipelineServiceUtils';
import FormBuilder from '../common/FormBuilder/FormBuilder';

interface Props {
  data?: ServicesType;
  okText?: string;
  cancelText?: string;
  serviceType: string;
  serviceCategory: ServiceCategory;
  status: LoadingState;
  onFocus: (fieldName: string) => void;
  onSave: (data: IChangeEvent<ConfigData>) => void;
  disableTestConnection?: boolean;
  onCancel?: () => void;
}

const ConnectionConfigForm: FunctionComponent<Props> = ({
  data,
  okText = 'Save',
  cancelText = 'Cancel',
  serviceType,
  serviceCategory,
  status,
  onCancel,
  onSave,
  onFocus,
  disableTestConnection = false,
}: Props) => {
  const config = useMemo(
    () =>
      !isNil(data)
        ? ((data as ServicesType).connection?.config as ConfigData)
        : ({} as ConfigData),
    [data]
  );

  const handleSave = useCallback(
    (data: IChangeEvent<ConfigData>) => {
      const updatedFormData = formatFormDataForSubmit(data.formData);
      onSave({ ...data, formData: updatedFormData });
    },
    [onSave]
  );

  const getConfigFields = () => {
    let connSch = {
      schema: {},
      uiSchema: {},
    };

    const validConfig = cloneDeep(config || {});

    for (const [key, value] of Object.entries(validConfig)) {
      if (isNil(value)) {
        delete validConfig[key as keyof ConfigData];
      }
    }

    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES: {
        connSch = getDatabaseConfig(serviceType as DatabaseServiceType);

        break;
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        connSch = getMessagingConfig(serviceType as MessagingServiceType);

        break;
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        connSch = getDashboardConfig(serviceType as DashboardServiceType);

        break;
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        connSch = getPipelineConfig(serviceType as PipelineServiceType);

        break;
      }
      case ServiceCategory.ML_MODEL_SERVICES: {
        connSch = getMlmodelConfig(serviceType as MlModelServiceType);

        break;
      }
      case ServiceCategory.METADATA_SERVICES: {
        connSch = getMetadataConfig(serviceType as MetadataServiceType);

        break;
      }
      case ServiceCategory.OBJECT_STORE_SERVICES: {
        connSch = getObjectStoreConfig(serviceType as ObjectStoreServiceType);

        break;
      }
    }

    return (
      <FormBuilder
        cancelText={cancelText}
        disableTestConnection={disableTestConnection}
        formData={validConfig}
        okText={okText}
        schema={connSch.schema}
        serviceCategory={serviceCategory}
        serviceName={data?.name}
        serviceType={serviceType}
        status={status}
        uiSchema={connSch.uiSchema}
        onCancel={onCancel}
        onFocus={onFocus}
        onSubmit={handleSave}
      />
    );
  };

  return <Fragment>{getConfigFields()}</Fragment>;
};

export default ConnectionConfigForm;
