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
import { RegistryFieldsType } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { isEmpty, isUndefined } from 'lodash';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SERVICE_CONNECTION_UI_SCHEMA } from '../../../../constants/ServiceConnection.constants';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { ConfigData } from '../../../../interface/service.interface';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  getConnectionSchemas,
  getFilteredSchema,
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
  const { connSch, validConfig } = getConnectionSchemas({
    data,
    serviceCategory,
    serviceType,
  });

  const handleSave = async (data: IChangeEvent<ConfigData>) => {
    const updatedFormData = formatFormDataForSubmit(data.formData);

    await onSave({ ...data, formData: updatedFormData });
  };

  // Remove the filters property from the schema
  // Since it'll have a separate form in the next step
  const filteredSchema = useMemo(() => {
    const propertiesWithoutFilters = getFilteredSchema(
      connSch.schema.properties,
      false
    );

    return {
      ...connSch.schema,
      properties: propertiesWithoutFilters,
    };
  }, [connSch.schema.properties]);

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
