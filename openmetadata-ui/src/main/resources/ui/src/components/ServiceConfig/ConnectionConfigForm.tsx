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

import Form, { IChangeEvent } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { t } from 'i18next';
import { cloneDeep, isEmpty, isNil } from 'lodash';
import { LoadingState } from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  useEffect,
  useRef,
  useState,
} from 'react';
import AirflowMessageBanner from '../../components/common/AirflowMessageBanner/AirflowMessageBanner';
import { ServiceCategory } from '../../enums/service.enum';
import { MetadataServiceType } from '../../generated/api/services/createMetadataService';
import { MlModelServiceType } from '../../generated/api/services/createMlModelService';
import { StorageServiceType } from '../../generated/entity/data/container';
import { DashboardServiceType } from '../../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../../generated/entity/services/databaseService';
import { MessagingServiceType } from '../../generated/entity/services/messagingService';
import { PipelineServiceType } from '../../generated/entity/services/pipelineService';
import { SearchServiceType } from '../../generated/entity/services/searchService';
import { useAirflowStatus } from '../../hooks/useAirflowStatus';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { getPipelineServiceHostIp } from '../../rest/ingestionPipelineAPI';
import { getDashboardConfig } from '../../utils/DashboardServiceUtils';
import { getDatabaseConfig } from '../../utils/DatabaseServiceUtils';
import { formatFormDataForSubmit } from '../../utils/JSONSchemaFormUtils';
import { getMessagingConfig } from '../../utils/MessagingServiceUtils';
import { getMetadataConfig } from '../../utils/MetadataServiceUtils';
import { getMlmodelConfig } from '../../utils/MlmodelServiceUtils';
import { getPipelineConfig } from '../../utils/PipelineServiceUtils';
import { getSearchServiceConfig } from '../../utils/SearchServiceUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import FormBuilder from '../common/FormBuilder/FormBuilder';
import TestConnection from '../common/TestConnection/TestConnection';

interface Props {
  data?: ServicesType;
  okText?: string;
  cancelText?: string;
  serviceType: string;
  serviceCategory: ServiceCategory;
  status: LoadingState;
  onFocus: (id: string) => void;
  onSave: (data: IChangeEvent<ConfigData>) => Promise<void>;
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
  const config = !isNil(data)
    ? ((data as ServicesType).connection?.config as ConfigData)
    : ({} as ConfigData);

  const formRef = useRef<Form<ConfigData>>(null);

  const { isAirflowAvailable } = useAirflowStatus();
  const [hostIp, setHostIp] = useState<string>();

  const fetchHostIp = async () => {
    try {
      const { status, data } = await getPipelineServiceHostIp();
      if (status === 200) {
        setHostIp(data?.ip || '[unknown]');
      } else {
        setHostIp(undefined);
      }
    } catch (error) {
      setHostIp('[error - unknown]');
    }
  };

  useEffect(() => {
    if (isAirflowAvailable) {
      fetchHostIp();
    }
  }, [isAirflowAvailable]);

  const handleRequiredFieldsValidation = () => {
    return Boolean(formRef.current?.validateForm());
  };

  const handleSave = async (data: IChangeEvent<ConfigData>) => {
    const updatedFormData = formatFormDataForSubmit(data.formData);

    await onSave({ ...data, formData: updatedFormData });
  };

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
      case ServiceCategory.STORAGE_SERVICES: {
        connSch = serviceUtilClassBase.getStorageServiceConfig(
          serviceType as StorageServiceType
        );

        break;
      }
      case ServiceCategory.SEARCH_SERVICES: {
        connSch = getSearchServiceConfig(serviceType as SearchServiceType);

        break;
      }
    }

    return (
      <FormBuilder
        cancelText={cancelText}
        formData={validConfig}
        okText={okText}
        ref={formRef}
        schema={connSch.schema}
        serviceCategory={serviceCategory}
        status={status}
        uiSchema={connSch.uiSchema}
        validator={validator}
        onCancel={onCancel}
        onFocus={onFocus}
        onSubmit={handleSave}>
        {isEmpty(connSch.schema) && (
          <div className="text-grey-muted text-center">
            {t('message.no-config-available')}
          </div>
        )}
        {!isEmpty(connSch.schema) && isAirflowAvailable && hostIp && (
          <div
            className="d-flex justify-between bg-white global-border rounded-4 p-sm m-t-md"
            data-testid="ip-address">
            <div className="self-center">
              {t('message.airflow-host-ip-address', { hostIp })}
            </div>
          </div>
        )}
        {!isEmpty(connSch.schema) &&
          isAirflowAvailable &&
          formRef.current?.state?.formData && (
            <TestConnection
              connectionType={serviceType}
              getData={() => formRef.current?.state?.formData}
              isTestingDisabled={disableTestConnection}
              serviceCategory={serviceCategory}
              serviceName={data?.name}
              onValidateFormRequiredFields={handleRequiredFieldsValidation}
            />
          )}
      </FormBuilder>
    );
  };

  return (
    <Fragment>
      <AirflowMessageBanner />
      {getConfigFields()}
    </Fragment>
  );
};

export default ConnectionConfigForm;
