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

import { Alert } from '@openmetadata/ui-core-components';
import Form, { IChangeEvent } from '@rjsf/core';
import { RegistryFieldsType, RJSFSchema } from '@rjsf/utils';

import { isEmpty, isEqual, isUndefined } from 'lodash';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import i18n, { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  buildValidConfig,
  ConnectionSchemaResult,
  EMPTY_CONNECTION_SCHEMA,
  flattenAuthTypeIntoConfig,
  getFilteredSchema,
  getMissingRequiredFieldsCount,
  getSchemaWithSynthesizedAuthType,
  getUISchemaWithAuthFieldsAsSelect,
  getUISchemaWithNestedDefaultFilterFieldsHidden,
  loadConnectionSchema,
  wrapFlatCredentialsIntoAuthType,
} from '../../../../utils/ServiceConnectionUtils';
import { shouldTestConnection } from '../../../../utils/ServiceUtils';
import AirflowMessageBanner from '../../../common/AirflowMessageBanner/AirflowMessageBanner';
import AuthSelectField from '../../../common/Form/JSONSchema/JSONSchemaFields/AuthSelectField/AuthSelectField';
import BooleanFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/BooleanFieldTemplate';
import ConnectionObjectFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/ConnectionObjectFieldTemplate';
import WorkflowArrayFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/WorkflowArrayFieldTemplate';
import FormBuilderV1 from '../../../common/FormBuilderV1/FormBuilderV1';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import Loader from '../../../common/Loader/Loader';
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
  isSubmitDisabled: isSubmitDisabledFromParent = false,
}: Readonly<ConnectionConfigFormProps>) => {
  const { inlineAlertDetails } = useApplicationStore();
  const { t } = useTranslation();
  const [ingestionRunner, setIngestionRunner] = useState<string | undefined>();
  const [currentFormData, setCurrentFormData] = useState<ConfigData>(
    {} as ConfigData
  );

  const formRef = useRef<Form<ConfigData>>(null);
  const currentFormDataRef = useRef<ConfigData>({} as ConfigData);

  const { isAirflowAvailable, platform } = useAirflowStatus();
  const [hostIp, setHostIp] = useState<string>();
  const [connSch, setConnSch] = useState<ConnectionSchemaResult['connSch']>(
    EMPTY_CONNECTION_SCHEMA
  );
  const [isSchemaLoading, setIsSchemaLoading] = useState(true);
  const rawValidConfig = useMemo(() => buildValidConfig(data), [data]);

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

  useEffect(() => {
    let cancelled = false;
    setIsSchemaLoading(true);
    loadConnectionSchema(serviceCategory, serviceType)
      .then((schema) => {
        if (!cancelled) {
          setConnSch(schema);
          setIsSchemaLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnSch(EMPTY_CONNECTION_SCHEMA);
          setIsSchemaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serviceCategory, serviceType]);

  const handleRequiredFieldsValidation = () => {
    return Boolean(formRef.current?.validateForm());
  };

  const handleSave = async (data: IChangeEvent<ConfigData>) => {
    const updatedFormData = formatFormDataForSubmit(
      flattenAuthTypeIntoConfig(data.formData, connSch.schema)
    );

    await onSave({ ...data, formData: updatedFormData });
  };

  const handleFormChange = (event: IChangeEvent<ConfigData>) => {
    const nextFormData = event.formData ?? {};

    currentFormDataRef.current = nextFormData;
    setCurrentFormData(nextFormData);
  };

  const customFields: RegistryFieldsType = {
    BooleanField: BooleanFieldTemplate,
    ArrayField: WorkflowArrayFieldTemplate,
    authSelect: AuthSelectField,
  };

  const connectionSchema = useMemo(
    () => getSchemaWithSynthesizedAuthType(connSch.schema, t) as RJSFSchema,
    [connSch.schema, t]
  );

  const validConfig = useMemo(
    () => wrapFlatCredentialsIntoAuthType(rawValidConfig, connSch.schema),
    [connSch.schema, rawValidConfig]
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
    return getUISchemaWithAuthFieldsAsSelect(
      schemaWithoutDefaultFilterPatternFields,
      getUISchemaWithNestedDefaultFilterFieldsHidden(connSch.uiSchema)
    );
  }, [connSch.uiSchema, schemaWithoutDefaultFilterPatternFields]);

  const shouldShowTestConnection = useMemo(
    () =>
      !isEmpty(connSch.schema) &&
      shouldTestConnection(serviceType) &&
      !disableTestConnection,
    [connSch.schema, disableTestConnection, serviceType]
  );

  const handleTestConnectionStatusChange = useCallback(
    (_isSuccessful: boolean) => {},
    []
  );

  const missingRequiredFieldsCount = useMemo(() => {
    if (isEmpty(connSch.schema)) {
      return 0;
    }

    return getMissingRequiredFieldsCount(
      schemaWithoutDefaultFilterPatternFields,
      currentFormData
    );
  }, [
    connSch.schema,
    currentFormData,
    schemaWithoutDefaultFilterPatternFields,
  ]);

  const isSubmitDisabled = useMemo(() => {
    if (isSubmitDisabledFromParent) {
      return true;
    }

    if (isEmpty(connSch.schema)) {
      return false;
    }

    return missingRequiredFieldsCount > 0;
  }, [connSch.schema, isSubmitDisabledFromParent, missingRequiredFieldsCount]);

  useEffect(() => {
    if (isEqual(currentFormDataRef.current, validConfig)) {
      return;
    }

    currentFormDataRef.current = validConfig;
    setCurrentFormData(validConfig);
  }, [validConfig]);

  useEffect(() => {
    const current = (currentFormData as Record<string, unknown>)?.[RUNNER];
    if (typeof current === 'string') {
      setIngestionRunner(current);
    } else {
      setIngestionRunner(undefined);
    }
  }, [currentFormData]);

  const formChildren = (
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
          title={t('label.pipeline-server-ip-address')}
          variant="brand">
          <Transi18next
            i18nKey="message.airflow-host-ip-address"
            renderElement={<strong />}
            values={{ hostIp }}
          />
        </Alert>
      )}
      {shouldShowTestConnection && (
        <TestConnection
          connectionType={serviceType}
          getData={() =>
            flattenAuthTypeIntoConfig(currentFormData, connSch.schema)
          }
          hostIp={hostIp}
          isTestingDisabled={disableTestConnection}
          missingRequiredFieldsCount={missingRequiredFieldsCount}
          serviceCategory={serviceCategory}
          serviceName={data?.name}
          onTestConnectionStatusChange={handleTestConnectionStatusChange}
          onValidateFormRequiredFields={handleRequiredFieldsValidation}
        />
      )}
      {!isUndefined(inlineAlertDetails) && (
        <InlineAlert alertClassName="m-t-xs" {...inlineAlertDetails} />
      )}
    </>
  );

  if (isSchemaLoading) {
    return (
      <Fragment>
        <AirflowMessageBanner />
        <div
          className="tw:flex tw:justify-center tw:py-10"
          data-testid="connection-schema-loader">
          <Loader size="small" />
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <AirflowMessageBanner />
      <FormBuilderV1
        cancelText={cancelText ?? ''}
        fields={customFields}
        formData={validConfig}
        isSubmitDisabled={isSubmitDisabled}
        noValidate={!isEmpty(connSch.schema)}
        okText={okText ?? ''}
        ref={formRef}
        schema={schemaWithoutDefaultFilterPatternFields}
        status={status}
        templates={{
          ObjectFieldTemplate: ConnectionObjectFieldTemplate,
        }}
        uiSchema={uiSchema}
        onCancel={onCancel}
        onChange={handleFormChange}
        onFocus={onFocus}
        onSubmit={handleSave}>
        {formChildren}
      </FormBuilderV1>
    </Fragment>
  );
};

export default ConnectionConfigForm;
