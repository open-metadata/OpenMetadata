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
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { ServiceCategory } from '../../../../enums/service.enum';
import {
  getFilteredSchema,
  getSchemaWithSynthesizedAuthType,
  getUISchemaWithAuthFieldsAsSelect,
  getUISchemaWithNestedDefaultFilterFieldsHidden,
  loadConnectionSchema,
} from '../../../../utils/ServiceConnectionUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import AuthSelectField from '../../../common/Form/JSONSchema/JSONSchemaFields/AuthSelectField/AuthSelectField';
import BooleanFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/BooleanFieldTemplate';
import ConnectionObjectFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/ConnectionObjectFieldTemplate';
import WorkflowArrayFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/WorkflowArrayFieldTemplate';
import CoreOneOfField from '../../../common/FormBuilderV1/fields/CoreOneOfField';
import { CoreFieldTemplate } from '../../../common/FormBuilderV1/templates/CoreFieldTemplate';
import { CoreWrapIfAdditionalTemplate } from '../../../common/FormBuilderV1/templates/CoreWrapIfAdditionalTemplate';
import CoreInputWidget from '../../../common/FormBuilderV1/widgets/CoreInputWidget';
import CorePasswordWidget from '../../../common/FormBuilderV1/widgets/CorePasswordWidget';
import CoreSelectWidget from '../../../common/FormBuilderV1/widgets/CoreSelectWidget';
import CoreTextAreaWidget from '../../../common/FormBuilderV1/widgets/CoreTextAreaWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) => {
      if (key === 'label.show-advanced-credential-settings') {
        return `Show advanced credential settings (${params?.count})`;
      }
      if (key === 'label.hide-advanced-credential-settings') {
        return `Hide advanced credential settings (${params?.count})`;
      }
      if (key === 'label.show-impersonation-settings') {
        return `Show impersonation settings (${params?.count})`;
      }
      if (key === 'label.hide-impersonation-settings') {
        return `Hide impersonation settings (${params?.count})`;
      }

      return params?.count ? `${params.count} required` : key;
    },
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
  AnyOfField: CoreOneOfField,
  BooleanField: BooleanFieldTemplate,
  ArrayField: WorkflowArrayFieldTemplate,
  OneOfField: CoreOneOfField,
  authSelect: AuthSelectField,
};

const renderConnectionSchema = async (
  connectorType: string,
  serviceCategory = ServiceCategory.DATABASE_SERVICES
) => {
  const connSch = await loadConnectionSchema(serviceCategory, connectorType);
  const connectionSchema = getSchemaWithSynthesizedAuthType(
    connSch.schema,
    (key) => key
  ) as RJSFSchema;
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

  return render(
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
        TextWidget: CoreInputWidget,
        PasswordWidget: CorePasswordWidget,
        SelectWidget: CoreSelectWidget,
        TextareaWidget: CoreTextAreaWidget,
        EmailWidget: CoreInputWidget,
        URLWidget: CoreInputWidget,
        UpDownWidget: CoreInputWidget,
      }}
    />
  );
};

const getRequiredElement = (container: HTMLElement, selector: string) => {
  const element = container.querySelector<HTMLElement>(selector);

  expect(element).toBeInTheDocument();

  return element as HTMLElement;
};

const expectAwsCredentialLayout = (
  container: HTMLElement,
  selector = '[data-field-id="root/awsConfig"]'
) => {
  const awsConfigBlock = getRequiredElement(container, selector);

  expect(awsConfigBlock).toHaveClass(
    'core-object-field-template-gated-credential-block'
  );
  expect(
    awsConfigBlock.querySelector('.core-object-field-template-body-gated')
  ).toBeInTheDocument();
  expect(
    awsConfigBlock.querySelector('.core-object-field-template-property-enabled')
  ).toHaveClass('core-object-field-template-property-toggle-banner');
  expect(
    Array.from(
      awsConfigBlock.querySelectorAll(
        ':scope > .core-object-field-template-body-gated > .core-object-field-template-property'
      )
    ).map((element) => element.getAttribute('data-field-name'))
  ).toEqual(['enabled']);
  expect(
    Array.from(
      awsConfigBlock.querySelectorAll(
        '.core-object-field-template-credential-field-grid > .core-object-field-template-property'
      )
    ).map((element) => element.getAttribute('data-field-name'))
  ).toEqual(['awsAccessKeyId', 'awsSecretAccessKey', 'awsRegion']);

  const advancedConfigButton = within(awsConfigBlock).getByRole('button', {
    name: 'label.show label.advanced-config (6)',
  });

  expect(advancedConfigButton).toBeInTheDocument();

  fireEvent.click(advancedConfigButton);

  ['endPointURL', 'assumeRoleArn', 'assumeRoleSourceIdentity'].forEach(
    (fieldName) => {
      expect(
        getRequiredElement(
          awsConfigBlock,
          `.core-object-field-template-property-${fieldName}`
        )
      ).not.toHaveClass('core-object-field-template-property-full-width');
    }
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
      expect(
        screen.queryByText(/Unsupported field schema/)
      ).not.toBeInTheDocument();
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
      expect(
        screen.queryByText(/Unsupported field schema/)
      ).not.toBeInTheDocument();
    }

    expect(renderedConnectorCount).toBe(connectorTypes.length);
  });

  it('renders Snowflake password and key-pair credentials as one selectable auth method', async () => {
    const { container } = await renderConnectionSchema('Snowflake');

    expect(screen.getByTestId('auth-select-field')).toBeInTheDocument();
    expect(screen.getByTestId('auth-method-0')).toHaveTextContent(
      'label.password'
    );
    expect(screen.getByTestId('auth-method-1')).toHaveTextContent(
      'label.key-pair'
    );
    expect(screen.queryByTestId('auth-tabs')).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-field-name="authType"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-field-name="password"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-field-name="privateKey"]')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('auth-method-1'));

    expect(
      container.querySelector('[data-field-name="password"]')
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-field-name="privateKey"]')
    ).toBeInTheDocument();
  });

  it('renders Cassandra cloud config as a compact nested credential block', async () => {
    const { container } = await renderConnectionSchema('Cassandra');

    fireEvent.click(screen.getByTestId('auth-method-1'));

    expect(
      screen.getByText('DataStax Astra DB Configuration')
    ).toBeInTheDocument();

    const cloudConfigBlock = container.querySelector(
      '[data-field-id="root/authType/cloudConfig"]'
    );

    expect(cloudConfigBlock).toHaveClass(
      'core-object-field-template-credential-block'
    );
    expect(
      cloudConfigBlock?.querySelector('.core-object-field-template-body-grid')
    ).toBeInTheDocument();
    expect(
      cloudConfigBlock?.querySelector(
        '.core-object-field-template-property-connectTimeout'
      )
    ).not.toHaveClass('core-object-field-template-property-full-width');
    expect(
      cloudConfigBlock?.querySelector(
        '.core-object-field-template-property-requestTimeout'
      )
    ).not.toHaveClass('core-object-field-template-property-full-width');
    expect(
      cloudConfigBlock?.querySelector(
        '.core-object-field-template-property-secureConnectBundle'
      )
    ).toHaveClass('core-object-field-template-property-full-width');
  });

  it.each([
    {
      connectorType: 'Athena',
      serviceCategory: ServiceCategory.DATABASE_SERVICES,
    },
    {
      connectorType: 'DynamoDB',
      serviceCategory: ServiceCategory.DATABASE_SERVICES,
    },
    {
      connectorType: 'Glue',
      serviceCategory: ServiceCategory.DATABASE_SERVICES,
    },
    {
      connectorType: 'Kinesis',
      serviceCategory: ServiceCategory.MESSAGING_SERVICES,
    },
    {
      connectorType: 'QuickSight',
      serviceCategory: ServiceCategory.DASHBOARD_SERVICES,
    },
  ])(
    'organizes $connectorType AWS credentials into visible essentials and collapsed advanced fields',
    async ({ connectorType, serviceCategory }) => {
      const { container } = await renderConnectionSchema(
        connectorType,
        serviceCategory
      );

      expectAwsCredentialLayout(container);
    }
  );

  it.each(['Mysql', 'Postgres', 'Redshift'])(
    'organizes selected %s IAM credentials without compressing fields',
    async (connectorType) => {
      const { container } = await renderConnectionSchema(connectorType);

      fireEvent.click(screen.getByTestId('auth-method-1'));

      expectAwsCredentialLayout(container, '[data-field-id$="/awsConfig"]');
    }
  );

  it('keeps DeltaLake configuration source as a full-width schema choice', async () => {
    const { container } = await renderConnectionSchema('DeltaLake');
    const field = getRequiredElement(
      container,
      '[data-field-name="configSource"]'
    );

    expect(field).toHaveClass('connection-section-wide-property');
    expect(
      field.querySelector(
        ':scope > .core-one-of-field .core-one-of-field-select'
      )
    ).toBeInTheDocument();
    expect(
      field.querySelector(
        ':scope > .core-one-of-field > .core-one-of-field-tabs'
      )
    ).not.toBeInTheDocument();
  });

  it('organizes BigQuery GCP credentials without dumping default plumbing fields', async () => {
    const { container } = await renderConnectionSchema('BigQuery');
    const connectionSection = getRequiredElement(
      container,
      '[data-testid="connection-section-connection"]'
    );
    const gcpCredentialsBlock = getRequiredElement(
      connectionSection,
      '[data-field-id="root/credentials"]'
    );
    const credentialsWrapper = getRequiredElement(
      connectionSection,
      '[data-field-name="credentials"]'
    );
    const hostPortWrapper = getRequiredElement(
      connectionSection,
      '[data-field-name="hostPort"]'
    );
    const gcpConfigProperty = getRequiredElement(
      gcpCredentialsBlock,
      ':scope > .core-object-field-template-body-grid > .core-object-field-template-property-gcpConfig'
    );
    const gcpConfigField = getRequiredElement(
      gcpCredentialsBlock,
      '.core-one-of-field[data-field-id="root/credentials/gcpConfig"]'
    );
    const selectedCredentialBranch = getRequiredElement(
      gcpConfigField,
      '.core-one-of-field-selected .core-object-field-template-body-grid'
    );

    expect(
      getRequiredElement(connectionSection, '[data-field-name="hostPort"]')
    ).toBeInTheDocument();
    expect(
      getRequiredElement(
        connectionSection,
        '[data-field-name="billingProjectId"]'
      )
    ).toBeInTheDocument();
    expect(gcpCredentialsBlock).toHaveClass(
      'core-object-field-template-credential-block'
    );
    expect(
      credentialsWrapper.compareDocumentPosition(hostPortWrapper) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(gcpConfigProperty).toHaveClass(
      'core-object-field-template-property-full-width'
    );
    expect(
      gcpConfigField.querySelector('.core-object-field-template-title')
    ).not.toBeInTheDocument();
    expect(
      Array.from(
        selectedCredentialBranch.querySelectorAll(
          ':scope > .core-object-field-template-property'
        )
      ).map((element) => element.getAttribute('data-field-name'))
    ).toEqual([
      'projectId',
      'privateKeyId',
      'clientEmail',
      'privateKey',
      'clientId',
    ]);
    expect(
      getRequiredElement(
        selectedCredentialBranch,
        '.core-object-field-template-property-projectId'
      )
    ).toHaveClass('core-object-field-template-property-full-width');
    expect(
      getRequiredElement(
        selectedCredentialBranch,
        '.core-object-field-template-property-projectId .core-one-of-field'
      )
    ).toHaveClass('core-one-of-field-inline-selected');
    expect(
      within(
        getRequiredElement(
          selectedCredentialBranch,
          '.core-object-field-template-property-projectId'
        )
      ).getAllByText('Single Project ID').length
    ).toBeGreaterThan(0);
    expect(
      getRequiredElement(
        selectedCredentialBranch,
        '.core-object-field-template-property-privateKey'
      )
    ).toHaveClass('core-object-field-template-property-full-width');
    expect(
      selectedCredentialBranch.querySelector(
        ':scope > .core-object-field-template-property-type'
      )
    ).not.toBeInTheDocument();
    expect(
      selectedCredentialBranch.querySelector(
        ':scope > .core-object-field-template-property-authUri'
      )
    ).not.toBeInTheDocument();
    expect(
      selectedCredentialBranch.querySelector(
        ':scope > .core-object-field-template-property-tokenUri'
      )
    ).not.toBeInTheDocument();

    const advancedCredentialButton = within(gcpConfigField).getByRole(
      'button',
      {
        name: 'Show advanced credential settings (5)',
      }
    );

    fireEvent.click(advancedCredentialButton);

    expect(
      getRequiredElement(
        gcpConfigField,
        '.core-object-field-template-property-type'
      )
    ).toBeInTheDocument();
    expect(
      getRequiredElement(
        gcpConfigField,
        '.core-object-field-template-property-authUri'
      )
    ).toHaveClass('core-object-field-template-property-full-width');
    expect(
      getRequiredElement(
        gcpConfigField,
        '.core-object-field-template-property-tokenUri'
      )
    ).toHaveClass('core-object-field-template-property-full-width');
    expect(
      within(gcpConfigField).getByRole('button', {
        name: 'Hide advanced credential settings (5)',
      })
    ).toBeInTheDocument();
    expect(
      gcpCredentialsBlock.querySelector(
        '.core-object-field-template-property-gcpImpersonateServiceAccount'
      )
    ).not.toBeInTheDocument();
    expect(
      within(gcpCredentialsBlock).queryByRole('button', {
        name: 'Show advanced credential settings (1)',
      })
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(gcpCredentialsBlock).getByRole('button', {
        name: 'Show impersonation settings (1)',
      })
    );

    expect(
      getRequiredElement(
        gcpCredentialsBlock,
        '.core-object-field-template-property-gcpImpersonateServiceAccount'
      )
    ).toBeInTheDocument();
    expect(
      gcpCredentialsBlock.querySelector(
        ':scope > .core-object-field-template-body-grid > .core-object-field-template-property-gcpImpersonateServiceAccount'
      )
    ).not.toBeInTheDocument();
  });

  it('keeps Hive metastore connection details as a full-width schema choice', async () => {
    const { container } = await renderConnectionSchema('Hive');
    const scopeSection = getRequiredElement(
      container,
      '[data-testid="connection-section-scope"]'
    );
    const scopeButton = getRequiredElement(scopeSection, 'button');

    fireEvent.click(scopeButton);

    expect(
      getRequiredElement(container, '[data-field-name="metastoreConnection"]')
    ).toHaveClass('connection-section-wide-property');
  });

  it.each([
    {
      connectorType: 'Nifi',
      fieldName: 'nifiConfig',
      serviceCategory: ServiceCategory.PIPELINE_SERVICES,
    },
    {
      connectorType: 'Rest',
      fieldName: 'openAPISchemaConnection',
      serviceCategory: ServiceCategory.API_SERVICES,
    },
  ])(
    'renders $connectorType oneOf connection choices as segmented tabs',
    async ({ connectorType, fieldName, serviceCategory }) => {
      const { container } = await renderConnectionSchema(
        connectorType,
        serviceCategory
      );

      const field = getRequiredElement(
        container,
        `[data-field-name="${fieldName}"]`
      );
      const tabs = getRequiredElement(
        field,
        ':scope > .core-one-of-field > .core-one-of-field-tabs'
      );

      expect(field).toHaveClass('connection-section-wide-property');
      expect(within(tabs).getByTestId('oneof-option-0')).toBeInTheDocument();
      expect(within(tabs).getByTestId('oneof-option-1')).toBeInTheDocument();
      expect(
        container.querySelector(`[data-testid$="${fieldName}__oneof_select"]`)
      ).not.toBeInTheDocument();
    }
  );

  it('keeps Airflow five-way connection choices as a compact select', async () => {
    const { container } = await renderConnectionSchema(
      'Airflow',
      ServiceCategory.PIPELINE_SERVICES
    );
    const field = getRequiredElement(
      container,
      '[data-field-name="connection"]'
    );

    expect(field).toHaveClass('connection-section-wide-property');
    expect(
      field.querySelector('.core-one-of-field-select')
    ).toBeInTheDocument();
    expect(
      field.querySelector('.core-one-of-field-tabs')
    ).not.toBeInTheDocument();
  });
});
