/*
 *  Copyright 2025 Collate.
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
import { RJSFSchema } from '@rjsf/utils';
import { Alert } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AIRFLOW_HYBRID,
  COLLATE_SAAS,
  COLLATE_SAAS_RUNNER,
  RUNNER,
} from '../../../../constants/constants';
import { useAirflowStatus } from '../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { ConfigData } from '../../../../interface/service.interface';
import { getPipelineServiceHostIp } from '../../../../rest/ingestionPipelineAPI';
import brandClassBase from '../../../../utils/BrandData/BrandClassBase';
import i18n, { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  getConnectionSchemas,
  getFilteredSchema,
  getUISchemaWithNestedDefaultFilterFieldsHidden,
} from '../../../../utils/ServiceConnectionUtils';
import AirflowMessageBanner from '../../../common/AirflowMessageBanner/AirflowMessageBanner';
import FormBuilderV1 from '../../../common/FormBuilderV1/FormBuilderV1';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import TestConnection from '../../../common/TestConnection/TestConnection';
import { ConnectionConfigFormProps } from './ConnectionConfigForm.interface';

const EmbeddedConnectionConfigForm = ({
  data,
  okText = i18n.t('label.save'),
  cancelText = i18n.t('label.cancel'),
  serviceType,
  serviceCategory,
  status,
  onCancel,
  onSave,
  onFocus,
  disableTestConnection = false,
}: Readonly<ConnectionConfigFormProps>) => {
  const { inlineAlertDetails } = useApplicationStore();
  const { t } = useTranslation();
  const [ingestionRunner, setIngestionRunner] = useState<string | undefined>();

  const formRef = useRef<Form<ConfigData>>(null);

  const { isAirflowAvailable, platform } = useAirflowStatus();
  const [hostIp, setHostIp] = useState<string>();

  const fetchHostIp = async () => {
    try {
      const { status, data } = await getPipelineServiceHostIp();
      if (status === 200) {
        setHostIp(data?.ip || '[unknown]');
      } else {
        setHostIp(undefined);
      }
    } catch {
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

  const { connSch, validConfig } = useMemo(
    () =>
      getConnectionSchemas({
        data,
        serviceCategory,
        serviceType,
      }),
    [data, serviceCategory, serviceType]
  );
  const connectionSchema = connSch.schema as RJSFSchema;

  const shouldShowIPAlert = useMemo(() => {
    return (
      !isEmpty(connSch.schema) &&
      isAirflowAvailable &&
      hostIp &&
      (platform !== AIRFLOW_HYBRID ||
        ingestionRunner === COLLATE_SAAS ||
        ingestionRunner === COLLATE_SAAS_RUNNER)
    );
  }, [connSch.schema, isAirflowAvailable, hostIp, platform, ingestionRunner]);

  const propertiesWithoutDefaultFilterPatternFields = useMemo(
    () =>
      getFilteredSchema(
        connectionSchema.properties as Record<string, unknown> | undefined
      ),
    [connectionSchema.properties]
  );

  const schemaWithoutDefaultFilterPatternFields = useMemo<RJSFSchema>(
    () => ({
      ...connectionSchema,
      properties:
        propertiesWithoutDefaultFilterPatternFields as RJSFSchema['properties'],
    }),
    [connectionSchema, propertiesWithoutDefaultFilterPatternFields]
  );

  const uiSchema = useMemo(() => {
    return getUISchemaWithNestedDefaultFilterFieldsHidden(connSch.uiSchema);
  }, [connSch.uiSchema]);

  useEffect(() => {
    const current = (
      formRef.current?.state?.formData as Record<string, unknown>
    )?.[RUNNER];
    if (typeof current === 'string') {
      setIngestionRunner(current);
    } else {
      setIngestionRunner(undefined);
    }
  }, [formRef.current?.state?.formData]);

  return (
    <>
      <AirflowMessageBanner />
      <FormBuilderV1
        cancelText={cancelText ?? ''}
        formContext={{ handleFocus: onFocus }}
        formData={validConfig}
        okText={okText ?? ''}
        ref={formRef}
        schema={schemaWithoutDefaultFilterPatternFields}
        status={status}
        uiSchema={uiSchema}
        onCancel={onCancel}
        onFocus={onFocus}
        onSubmit={handleSave}>
        <>
          {isEmpty(connSch.schema) && (
            <div
              className="text-grey-muted text-center"
              data-testid="no-config-available">
              {t('message.no-config-available')}
            </div>
          )}
          {shouldShowIPAlert && (
            <Alert
              className="tw:mt-2 tw:rounded-lg"
              data-testid="ip-address"
              description={
                <Transi18next
                  i18nKey="message.airflow-host-ip-address"
                  renderElement={<strong />}
                  values={{ hostIp, brandName: brandClassBase.getPageTitle() }}
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
                hostIp={hostIp}
                isTestingDisabled={disableTestConnection}
                serviceCategory={serviceCategory}
                serviceName={data?.name}
                onValidateFormRequiredFields={handleRequiredFieldsValidation}
              />
            )}
          {!isUndefined(inlineAlertDetails) && (
            <InlineAlert alertClassName="m-t-xs" {...inlineAlertDetails} />
          )}
        </>
      </FormBuilderV1>
    </>
  );
};

export default EmbeddedConnectionConfigForm;
