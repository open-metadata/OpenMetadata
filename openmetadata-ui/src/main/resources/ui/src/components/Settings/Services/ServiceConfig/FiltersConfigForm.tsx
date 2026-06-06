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
import { RegistryFieldsType, RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { isEmpty, isUndefined } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SERVICE_CONNECTION_UI_SCHEMA } from '../../../../constants/ServiceConnection.constants';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { ConfigData } from '../../../../interface/service.interface';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  buildValidConfig,
  ConnectionSchemaResult,
  EMPTY_CONNECTION_SCHEMA,
  getFilteredSchema,
  loadConnectionSchema,
} from '../../../../utils/ServiceConnectionUtils';
import WorkflowArrayFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/WorkflowArrayFieldTemplate';
import FormBuilder from '../../../common/FormBuilder/FormBuilder';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import { FiltersConfigFormProps } from './FiltersConfigForm.interface';

function FiltersConfigForm({
  data,
  okText = 'Save',
  cancelText = 'Cancel',
  serviceType,
  serviceCategory,
  status,
  onCancel,
  onSave,
  onFocus,
}: Readonly<FiltersConfigFormProps>) {
  const { t } = useTranslation();
  const { inlineAlertDetails } = useApplicationStore();
  const formRef = useRef<Form<ConfigData>>(null);
  const customFields: RegistryFieldsType = {
    ArrayField: WorkflowArrayFieldTemplate,
  };
  const [connSch, setConnSch] = useState<ConnectionSchemaResult['connSch']>(
    EMPTY_CONNECTION_SCHEMA
  );

  // {@code validConfig} is the sanitized initial form data — sync useMemo on {@code data}
  // so RJSF's {@code formData} prop is stable until the parent commits a new prop. See
  // {@link EmbeddedConnectionConfigForm} for the original bug context.
  const validConfig = useMemo(() => buildValidConfig(data), [data]);

  // Schema only depends on serviceCategory + serviceType. Refetching on every {@code data}
  // change reset the RJSF form mid-edit.
  useEffect(() => {
    let cancelled = false;
    loadConnectionSchema(serviceCategory, serviceType)
      .then((schema) => {
        if (!cancelled) {
          setConnSch(schema);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnSch(EMPTY_CONNECTION_SCHEMA);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serviceCategory, serviceType]);

  const handleSave = async (data: IChangeEvent<ConfigData>) => {
    const updatedFormData = formatFormDataForSubmit(data.formData);

    await onSave({ ...data, formData: updatedFormData });
  };

  const filteredSchema = useMemo<RJSFSchema>(() => {
    const propertiesWithoutFilters = getFilteredSchema(
      connSch.schema.properties as Record<string, unknown> | undefined,
      false
    );

    return {
      ...(connSch.schema as Record<string, unknown>),
      properties: propertiesWithoutFilters as RJSFSchema['properties'],
      additionalProperties: false,
    } as RJSFSchema;
  }, [connSch.schema]);

  return (
    <FormBuilder
      showFormHeader
      cancelText={cancelText}
      fields={customFields}
      formData={validConfig}
      okText={okText}
      ref={formRef}
      schema={filteredSchema}
      serviceCategory={serviceCategory}
      status={status}
      uiSchema={SERVICE_CONNECTION_UI_SCHEMA}
      validator={validator}
      onCancel={onCancel}
      onFocus={onFocus}
      onSubmit={handleSave}>
      {isEmpty(filteredSchema) && (
        <div
          className="text-grey-muted text-center"
          data-testid="no-config-available">
          {t('message.no-config-available')}
        </div>
      )}

      {!isUndefined(inlineAlertDetails) && (
        <InlineAlert alertClassName="m-t-xs" {...inlineAlertDetails} />
      )}
    </FormBuilder>
  );
}

export default FiltersConfigForm;
