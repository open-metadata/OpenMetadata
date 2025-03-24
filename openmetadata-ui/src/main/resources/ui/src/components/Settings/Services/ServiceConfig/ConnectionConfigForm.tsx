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
import { RegistryFieldsType } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Alert } from 'antd';
import { t } from 'i18next';
import { isEmpty, isUndefined } from 'lodash';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useAirflowStatus } from '../../../../hooks/useAirflowStatus';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { ConfigData } from '../../../../interface/service.interface';
import { getPipelineServiceHostIp } from '../../../../rest/ingestionPipelineAPI';
import { Transi18next } from '../../../../utils/CommonUtils';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  getConnectionSchemas,
  getFilteredSchema,
} from '../../../../utils/ServiceConnectionUtils';
import AirflowMessageBanner from '../../../common/AirflowMessageBanner/AirflowMessageBanner';
import BooleanFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/BooleanFieldTemplate';
import WorkflowArrayFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/WorkflowArrayFieldTemplate';
import FormBuilder from '../../../common/FormBuilder/FormBuilder';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import TestConnection from '../../../common/TestConnection/TestConnection';
import { ConnectionConfigFormProps } from './ConnectionConfigForm.interface';

const ConnectionConfigForm = ({
  data,
  okText = t('label.save'),
  cancelText = t('label.cancel'),
  serviceType,
  serviceCategory,
  status,
  onCancel,
  onSave,
  onFocus,
  disableTestConnection = false,
}: Readonly<ConnectionConfigFormProps>) => {
  const { inlineAlertDetails } = useApplicationStore();

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

  const customFields: RegistryFieldsType = {
    BooleanField: BooleanFieldTemplate,
    ArrayField: WorkflowArrayFieldTemplate,
  };

  const getConfigFields = () => {
    const { connSch, validConfig } = getConnectionSchemas({
      data,
      serviceCategory,
      serviceType,
    });

    // Remove the filters property from the schema
    // Since it'll have a separate form in the next step

    const propertiesWithoutFilters = getFilteredSchema(
      connSch.schema.properties
    );

    const filteredSchema = {
      ...connSch.schema,
      properties: propertiesWithoutFilters,
    };

    return (
      <FormBuilder
        cancelText={cancelText ?? ''}
        fields={customFields}
        formData={validConfig}
        okText={okText ?? ''}
        ref={formRef}
        schema={filteredSchema}
        serviceCategory={serviceCategory}
        status={status}
        uiSchema={connSch.uiSchema}
        validator={validator}
        onCancel={onCancel}
        onFocus={onFocus}
        onSubmit={handleSave}>
        {isEmpty(connSch.schema) && (
          <div
            className="text-grey-muted text-center"
            data-testid="no-config-available">
            {t('message.no-config-available')}
          </div>
        )}
        {!isEmpty(connSch.schema) && isAirflowAvailable && hostIp && (
          <Alert
            data-testid="ip-address"
            description={
              <Transi18next
                i18nKey="message.airflow-host-ip-address"
                renderElement={<strong />}
                values={{
                  hostIp,
                }}
              />
            }
            type="info"
          />
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
        {!isUndefined(inlineAlertDetails) && (
          <InlineAlert alertClassName="m-t-xs" {...inlineAlertDetails} />
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
