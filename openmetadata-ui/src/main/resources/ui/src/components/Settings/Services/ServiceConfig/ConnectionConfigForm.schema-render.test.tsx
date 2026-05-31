/*
 *  Copyright 2026 Collate.
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

import Form from '@rjsf/core';
import { RegistryFieldsType, RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { cleanup, render, screen } from '@testing-library/react';
import { ServiceCategory } from '../../../../enums/service.enum';
import {
  getFilteredSchema,
  getUISchemaWithAuthFieldsAsSelect,
  getUISchemaWithNestedDefaultFilterFieldsHidden,
  loadConnectionSchema,
} from '../../../../utils/ServiceConnectionUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import AuthSelectField from '../../../common/Form/JSONSchema/JSONSchemaFields/AuthSelectField/AuthSelectField';
import {
  DesignSecretWidget,
  DesignTextWidget,
} from '../../../common/Form/JSONSchema/JSONSchemaFields/DesignControls/DesignWidgets';
import BooleanFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/BooleanFieldTemplate';
import ConnectionObjectFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/ConnectionObjectFieldTemplate';
import WorkflowArrayFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/WorkflowArrayFieldTemplate';
import { CoreFieldTemplate } from '../../../common/FormBuilderV1/templates/CoreFieldTemplate';
import { CoreWrapIfAdditionalTemplate } from '../../../common/FormBuilderV1/templates/CoreWrapIfAdditionalTemplate';
import CoreSelectWidget from '../../../common/FormBuilderV1/widgets/CoreSelectWidget';
import CoreTextAreaWidget from '../../../common/FormBuilderV1/widgets/CoreTextAreaWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) =>
      params?.count ? `${params.count} required` : key,
  }),
}));

jest.mock('../../../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
  t: (key: string) => key,
  Transi18next: ({ values }: { values?: { method?: string } }) => (
    <span>{values?.method}</span>
  ),
}));

const customFields: RegistryFieldsType = {
  BooleanField: BooleanFieldTemplate,
  ArrayField: WorkflowArrayFieldTemplate,
  authSelect: AuthSelectField,
};

const renderConnectionSchema = async (connectorType: string) => {
  const connSch = await loadConnectionSchema(
    ServiceCategory.DATABASE_SERVICES,
    connectorType
  );
  const connectionSchema = connSch.schema as RJSFSchema;
  const propertiesWithoutDefaultFilterPatternFields = getFilteredSchema(
    connectionSchema.properties as Record<string, unknown> | undefined
  );
  const schemaWithoutDefaultFilterPatternFields = {
    ...connectionSchema,
    properties:
      propertiesWithoutDefaultFilterPatternFields as RJSFSchema['properties'],
  };
  const uiSchema = getUISchemaWithAuthFieldsAsSelect(
    schemaWithoutDefaultFilterPatternFields,
    getUISchemaWithNestedDefaultFilterFieldsHidden(connSch.uiSchema)
  );

  render(
    <Form
      noHtml5Validate
      fields={customFields}
      formContext={{ handleFocus: jest.fn() }}
      formData={{}}
      idSeparator="/"
      schema={schemaWithoutDefaultFilterPatternFields}
      showErrorList={false}
      templates={{
        ObjectFieldTemplate: ConnectionObjectFieldTemplate,
        FieldTemplate: CoreFieldTemplate,
        WrapIfAdditionalTemplate: CoreWrapIfAdditionalTemplate,
      }}
      uiSchema={uiSchema}
      validator={validator}
      widgets={{
        TextWidget: DesignTextWidget,
        PasswordWidget: DesignSecretWidget,
        SelectWidget: CoreSelectWidget,
        TextareaWidget: CoreTextAreaWidget,
        EmailWidget: DesignTextWidget,
        URLWidget: DesignTextWidget,
        UpDownWidget: DesignTextWidget,
      }}
    />
  );
};

describe('ConnectionConfigForm schema rendering', () => {
  it.each(['Cassandra', 'Cockroach', 'Databricks', 'Glue', 'Greenplum'])(
    'renders %s without leaving the connection form empty',
    async (connectorType) => {
      await renderConnectionSchema(connectorType);

      expect(screen.getByTestId('connection-grouped-form')).toBeInTheDocument();
      expect(
        screen.getByTestId('connection-section-connection')
      ).toBeInTheDocument();
    }
  );

  it('renders every supported database connector schema', async () => {
    const connectorTypes =
      serviceUtilClassBase.getSupportedServiceFromList().databaseServices;
    let renderedConnectorCount = 0;

    expect(connectorTypes.length).toBeGreaterThan(40);

    for (const connectorType of connectorTypes) {
      cleanup();
      await renderConnectionSchema(connectorType);
      renderedConnectorCount += 1;

      expect(screen.getByTestId('connection-grouped-form')).toBeInTheDocument();
      expect(
        screen.getByTestId('connection-section-connection')
      ).toBeInTheDocument();
    }

    expect(renderedConnectorCount).toBe(connectorTypes.length);
  });
});
