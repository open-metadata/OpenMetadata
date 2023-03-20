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
import validator from '@rjsf/validator-ajv6';
import { ObjectStoreServiceType } from 'generated/entity/services/objectstoreService';
import { cloneDeep, isNil } from 'lodash';
import { LoadingState } from 'Models';
import React, { FunctionComponent, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TestConnection } from 'rest/serviceAPI';
import { getObjectStoreConfig } from 'utils/ObjectStoreServiceUtils';
import { ServiceCategory } from '../../enums/service.enum';
import { MetadataServiceType } from '../../generated/api/services/createMetadataService';
import { MlModelServiceType } from '../../generated/api/services/createMlModelService';
import { DashboardServiceType } from '../../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../../generated/entity/services/databaseService';
import { MessagingServiceType } from '../../generated/entity/services/messagingService';
import { PipelineServiceType } from '../../generated/entity/services/pipelineService';
import { useAirflowStatus } from '../../hooks/useAirflowStatus';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { getDashboardConfig } from '../../utils/DashboardServiceUtils';
import { getDatabaseConfig } from '../../utils/DatabaseServiceUtils';
import { formatFormDataForSubmit } from '../../utils/JSONSchemaFormUtils';
import { getMessagingConfig } from '../../utils/MessagingServiceUtils';
import { getMetadataConfig } from '../../utils/MetadataServiceUtils';
import { getMlmodelConfig } from '../../utils/MlmodelServiceUtils';
import { getPipelineConfig } from '../../utils/PipelineServiceUtils';
import {
  getTestConnectionType,
  shouldTestConnection,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import FormBuilder from '../common/FormBuilder/FormBuilder';

interface Props {
  data?: ServicesType;
  okText?: string;
  cancelText?: string;
  serviceType: string;
  serviceCategory: ServiceCategory;
  status: LoadingState;
  onCancel?: () => void;
  onSave: (data: IChangeEvent<ConfigData>) => void;
  disableTestConnection?: boolean;
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
  disableTestConnection = false,
}: Props) => {
  const { t } = useTranslation();
  const { isAirflowAvailable } = useAirflowStatus();

  const allowTestConn = useMemo(() => {
    return shouldTestConnection(serviceType);
  }, [serviceType]);

  const config = useMemo(
    () =>
      !isNil(data)
        ? ((data as ServicesType).connection?.config as ConfigData)
        : ({} as ConfigData),
    [data]
  );

  const handleTestConnection = useCallback(
    (formData: ConfigData) => {
      const updatedFormData = formatFormDataForSubmit(formData);

      return new Promise<void>((resolve, reject) => {
        TestConnection(
          updatedFormData,
          getTestConnectionType(serviceCategory),
          serviceType,
          data?.name
        )
          .then((res) => {
            // This api only responds with status 200 on success
            // No data sent on api success
            if (res.status === 200) {
              resolve();
            } else {
              throw t('server.unexpected-response');
            }
          })
          .catch((err) => {
            showErrorToast(err, t('server.test-connection-error'));
            reject(err);
          });
      });
    },
    [serviceCategory, serviceType, data?.name]
  );

  const connectionSchema = useMemo(() => {
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

    return { ...connSch, validConfig };
  }, [serviceCategory, config]);

  const handleSave = useCallback(
    (formData: IChangeEvent<ConfigData>) => {
      const updatedFormData = formatFormDataForSubmit(formData.formData);

      onSave({ ...formData, formData: updatedFormData });
    },
    [onSave]
  );

  return (
    <FormBuilder
      cancelText={cancelText}
      disableTestConnection={disableTestConnection}
      formData={connectionSchema.validConfig}
      isAirflowAvailable={isAirflowAvailable}
      okText={okText}
      schema={connectionSchema.schema}
      status={status}
      uiSchema={connectionSchema.uiSchema}
      validator={validator}
      onCancel={onCancel}
      onSubmit={handleSave}
      onTestConnection={
        allowTestConn && isAirflowAvailable ? handleTestConnection : undefined
      }
    />
  );
};

export default ConnectionConfigForm;
