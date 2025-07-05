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

import { isEmpty, isUndefined } from 'lodash';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
import { Transi18next } from '../../../../utils/CommonUtils';
import i18n from '../../../../utils/i18next/LocalUtil';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  getConnectionSchemas,
  getFilteredSchema,
  getUISchemaWithNestedDefaultFilterFieldsHidden,
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
  const [hasTestedConnection, setHasTestedConnection] = useState(false);

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

  const customFields: RegistryFieldsType = {
    BooleanField: BooleanFieldTemplate,
    ArrayField: WorkflowArrayFieldTemplate,
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

  // Remove the filters property from the schema
  // Since it'll have a separate form in the next step
  const propertiesWithoutDefaultFilterPatternFields = useMemo(
    () => getFilteredSchema(connSch.schema.properties),
    [connSch.schema.properties]
  );

  const schemaWithoutDefaultFilterPatternFields = useMemo(
    () => ({
      ...connSch.schema,
      properties: propertiesWithoutDefaultFilterPatternFields,
    }),
    [connSch.schema, propertiesWithoutDefaultFilterPatternFields]
  );

  // UI Schema to hide the nested default filter pattern fields
  // Since some connections have reference to the other connections
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

  const handleTestConnection = () => {
    setHasTestedConnection(true);
  };

  return (
    <Fragment>
      <AirflowMessageBanner />
      <FormBuilder
        cancelText={cancelText ?? ''}
        fields={customFields}
        formData={validConfig}
        hasTestedConnection={hasTestedConnection}
        okText={okText ?? ''}
        ref={formRef}
        schema={schemaWithoutDefaultFilterPatternFields}
        serviceCategory={serviceCategory}
        status={status}
        uiSchema={uiSchema}
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
        {shouldShowIPAlert && (
          <Alert
            data-testid="ip-address"
            description={
              <Transi18next
                i18nKey="message.airflow-host-ip-address"
                renderElement={<strong />}
                values={{ hostIp }}
              />
            }
            type="info"
          />
        )}
        {!isEmpty(connSch.schema) && (
          <TestConnection
            connectionType={serviceType}
            getData={() => formRef.current?.state?.formData}
            hostIp={hostIp}
            isTestingDisabled={disableTestConnection}
            serviceCategory={serviceCategory}
            serviceName={data?.name}
            onTestConnection={handleTestConnection}
            onValidateFormRequiredFields={handleRequiredFieldsValidation}
          />
        )}
        {!isUndefined(inlineAlertDetails) && (
          <InlineAlert alertClassName="m-t-xs" {...inlineAlertDetails} />
        )}
      </FormBuilder>
    </Fragment>
  );
};

export default ConnectionConfigForm;
