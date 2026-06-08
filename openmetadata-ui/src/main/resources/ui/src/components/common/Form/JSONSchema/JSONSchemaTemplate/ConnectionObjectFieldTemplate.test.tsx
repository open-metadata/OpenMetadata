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
import { ObjectFieldTemplateProps } from '@rjsf/utils';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { ADVANCED_PROPERTIES } from '../../../../../constants/ServiceType.constant';
import { ServiceCategory } from '../../../../../enums/service.enum';
import { loadConnectionSchema } from '../../../../../utils/ServiceConnectionUtils';
import serviceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import ConnectionObjectFieldTemplate from './ConnectionObjectFieldTemplate';

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <span data-testid="chevron" />,
  InfoCircle: () => <span data-testid="info-circle" />,
  Key01: () => <span data-testid="key-icon" />,
  Lock01: () => <span data-testid="lock-icon" />,
}));

jest.mock('./ObjectFieldTemplate', () => ({
  ObjectFieldTemplate: () => <div data-testid="default-object-template" />,
}));

jest.mock('../../../FormBuilderV1/templates/CoreObjectFieldTemplate', () => ({
  CoreObjectFieldTemplate: () => <div data-testid="core-object-template" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) =>
      params?.count ? `${params.count} required` : key,
  }),
}));

const field = (name: string) => ({
  name,
  content: <div data-testid={`field-${name}`}>{name}</div>,
  readonly: false,
  disabled: false,
  hidden: false,
});

const getProps = (id: string): ObjectFieldTemplateProps =>
  ({
    idSchema: { $id: id },
    title: 'Snowflake',
    schema: {
      required: ['account', 'warehouse'],
      properties: {
        account: { type: 'string' },
        warehouse: { type: 'string' },
        database: { type: 'string' },
        password: { type: 'string', format: 'password' },
        privateKey: { type: 'string', format: 'password' },
        scheme: { type: 'string' },
        useAccessHistory: { type: 'boolean' },
        accessHistoryChunkSize: { type: 'integer' },
        queryTag: { type: 'string' },
        connectionArguments: { type: 'object' },
      },
    },
    properties: [
      field('account'),
      field('warehouse'),
      field('database'),
      field('password'),
      field('privateKey'),
      field('scheme'),
      field('useAccessHistory'),
      field('accessHistoryChunkSize'),
      field('queryTag'),
      field('connectionArguments'),
    ],
  } as unknown as ObjectFieldTemplateProps);

const getSalesforceProps = (
  handleFocus = jest.fn()
): ObjectFieldTemplateProps =>
  ({
    idSchema: { $id: 'root' },
    title: 'Salesforce',
    formContext: {
      handleFocus,
    },
    schema: {
      properties: {
        type: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string', format: 'password' },
        securityToken: { type: 'string', format: 'password' },
        consumerKey: { type: 'string' },
        consumerSecret: { type: 'string', format: 'password' },
        organizationId: { type: 'string' },
        sobjectNames: { type: 'array' },
        databaseName: { type: 'string' },
        salesforceApiVersion: { type: 'string' },
        salesforceDomain: { type: 'string' },
      },
    },
    properties: [
      { ...field('type'), hidden: true },
      field('username'),
      field('password'),
      field('securityToken'),
      field('consumerKey'),
      field('consumerSecret'),
      field('organizationId'),
      field('sobjectNames'),
      field('databaseName'),
      field('salesforceApiVersion'),
      field('salesforceDomain'),
    ],
  } as unknown as ObjectFieldTemplateProps);

const getDatabaseConnectorProps = (
  serviceType: string,
  schema: Record<string, unknown>
): ObjectFieldTemplateProps => {
  const propertyNames = Object.keys(
    (schema.properties ?? {}) as Record<string, unknown>
  );

  return {
    idSchema: { $id: 'root' },
    title: serviceType,
    schema,
    properties: propertyNames.map(field),
  } as unknown as ObjectFieldTemplateProps;
};

describe('ConnectionObjectFieldTemplate', () => {
  it('renders the grouped section cards at the connection root', () => {
    render(<ConnectionObjectFieldTemplate {...getProps('root')} />);

    expect(screen.getByTestId('connection-grouped-form')).toBeInTheDocument();
    expect(
      screen.getByTestId('connection-section-connection')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('connection-section-authentication')
    ).toBeInTheDocument();
    expect(screen.getByTestId('connection-section-scope')).toBeInTheDocument();
    expect(
      screen.getByTestId('connection-section-advanced')
    ).toBeInTheDocument();
  });

  it('puts required fields under Connection', () => {
    render(<ConnectionObjectFieldTemplate {...getProps('root')} />);

    const connection = screen.getByTestId('connection-section-connection');

    expect(within(connection).getByTestId('field-account')).toBeInTheDocument();
    expect(
      within(connection).getByTestId('field-warehouse')
    ).toBeInTheDocument();
    expect(within(connection).getByText('2 required')).toBeInTheDocument();
    expect(
      within(connection).queryByText('3 required')
    ).not.toBeInTheDocument();
  });

  it('shows Authentication as its own section with dynamic required badge', () => {
    render(<ConnectionObjectFieldTemplate {...getProps('root')} />);

    const auth = screen.getByTestId('connection-section-authentication');

    // password/privateKey are not schema-required in the Snowflake test fixture,
    // so the badge shows "optional" rather than a fixed "1 required"
    expect(within(auth).getByText('label.optional')).toBeInTheDocument();
  });

  it('renders Authentication as Password / Key pair tabs and swaps fields', () => {
    render(<ConnectionObjectFieldTemplate {...getProps('root')} />);

    const auth = screen.getByTestId('connection-section-authentication');

    expect(within(auth).getByTestId('auth-tabs')).toBeInTheDocument();
    expect(within(auth).getByTestId('field-password')).toBeInTheDocument();
    expect(
      within(auth).queryByTestId('field-privateKey')
    ).not.toBeInTheDocument();

    fireEvent.click(within(auth).getByTestId('auth-tab-keypair'));

    expect(within(auth).getByTestId('field-privateKey')).toBeInTheDocument();
    expect(
      within(auth).queryByTestId('field-password')
    ).not.toBeInTheDocument();
  });

  it('keeps connector fields visible when a schema omits required keys', () => {
    const handleFocus = jest.fn();

    render(
      <ConnectionObjectFieldTemplate {...getSalesforceProps(handleFocus)} />
    );

    const connection = screen.getByTestId('connection-section-connection');

    expect(
      within(connection).getByTestId('field-username')
    ).toBeInTheDocument();
    expect(
      within(connection).getByTestId('field-consumerKey')
    ).toBeInTheDocument();
    expect(
      within(connection).getByTestId('field-organizationId')
    ).toBeInTheDocument();
    expect(within(connection).getByText('label.optional')).toBeInTheDocument();
    expect(screen.queryByTestId('field-sobjectNames')).not.toBeInTheDocument();

    fireEvent.click(within(connection).getByRole('button'));

    expect(handleFocus).toHaveBeenCalledWith('username');
  });

  it('does not render Snowflake key-pair tabs for non-key-pair secrets', () => {
    render(<ConnectionObjectFieldTemplate {...getSalesforceProps()} />);

    const auth = screen.getByTestId('connection-section-authentication');

    expect(within(auth).queryByTestId('auth-tabs')).not.toBeInTheDocument();
    expect(within(auth).getByTestId('field-password')).toBeInTheDocument();
    expect(within(auth).getByTestId('field-securityToken')).toBeInTheDocument();
    expect(
      within(auth).getByTestId('field-consumerSecret')
    ).toBeInTheDocument();
  });

  it('collapses Scope & options until expanded', () => {
    render(<ConnectionObjectFieldTemplate {...getProps('root')} />);

    expect(screen.queryByTestId('field-database')).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId('connection-section-scope')).getByRole('button')
    );

    expect(screen.getByTestId('field-database')).toBeInTheDocument();
    expect(screen.getByTestId('field-queryTag')).toBeInTheDocument();
  });

  it('does not render Scope & options when it only has hidden fields', () => {
    const props = getProps('root');

    render(
      <ConnectionObjectFieldTemplate
        {...props}
        properties={props.properties.map((property) =>
          ['database', 'queryTag'].includes(property.name)
            ? { ...property, hidden: true }
            : property
        )}
      />
    );

    expect(
      screen.queryByTestId('connection-section-scope')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('field-database')).toBeInTheDocument();
    expect(screen.getByTestId('field-queryTag')).toBeInTheDocument();
  });

  it('renders Advanced Config with compact primary fields before object rows', () => {
    render(<ConnectionObjectFieldTemplate {...getProps('root')} />);

    const advanced = screen.getByTestId('connection-section-advanced');

    fireEvent.click(within(advanced).getByRole('button'));

    const primaryGrid = advanced.querySelector(
      '.connection-advanced-primary-grid'
    );
    const fullRow = advanced.querySelector('.connection-advanced-full-row');

    expect(primaryGrid).not.toBeNull();
    expect(fullRow).not.toBeNull();
    expect(
      within(primaryGrid as HTMLElement).getByTestId('field-scheme')
    ).toBeInTheDocument();
    expect(
      within(primaryGrid as HTMLElement).getByTestId('field-useAccessHistory')
    ).toBeInTheDocument();
    expect(
      within(primaryGrid as HTMLElement).getByTestId(
        'field-accessHistoryChunkSize'
      )
    ).toBeInTheDocument();
    expect(
      within(fullRow as HTMLElement).getByTestId('field-connectionArguments')
    ).toBeInTheDocument();
  });

  it('marks a section active when its header is used', () => {
    render(<ConnectionObjectFieldTemplate {...getProps('root')} />);

    const advanced = screen.getByTestId('connection-section-advanced');

    fireEvent.click(within(advanced).getByRole('button'));

    expect(advanced).toHaveClass('connection-section-card-active');
  });

  it('delegates nested (non-root) objects to the core template', () => {
    render(<ConnectionObjectFieldTemplate {...getProps('root/authType')} />);

    expect(screen.getByTestId('core-object-template')).toBeInTheDocument();
    expect(
      screen.queryByTestId('connection-grouped-form')
    ).not.toBeInTheDocument();
  });

  it('renders grouped sections for every supported database connector schema', async () => {
    const connectorTypes =
      serviceUtilClassBase.getSupportedServiceFromList().databaseServices;
    let renderedConnectorCount = 0;
    let scopeConnectorCount = 0;
    let advancedConnectorCount = 0;

    expect(connectorTypes.length).toBeGreaterThan(20);

    for (const connectorType of connectorTypes) {
      const { schema } = await loadConnectionSchema(
        ServiceCategory.DATABASE_SERVICES,
        connectorType
      );
      const properties = (schema.properties ?? {}) as Record<string, unknown>;
      const propertyNames = Object.keys(properties);

      if (propertyNames.length === 0) {
        continue;
      }

      cleanup();
      renderedConnectorCount += 1;
      render(
        <ConnectionObjectFieldTemplate
          {...getDatabaseConnectorProps(connectorType, schema)}
        />
      );

      expect(screen.getByTestId('connection-grouped-form')).toBeInTheDocument();
      expect(
        screen.getByTestId('connection-section-connection')
      ).toBeInTheDocument();

      const scope = screen.queryByTestId('connection-section-scope');

      if (scope) {
        scopeConnectorCount += 1;
        fireEvent.click(within(scope).getByRole('button'));

        expect(scope).toHaveClass('connection-section-card-active');
        expect(
          scope.querySelector(
            '.connection-section-field-grid, .connection-section-boolean-grid, .connection-section-fields'
          )
        ).not.toBeNull();
      }

      const advanced = screen.queryByTestId('connection-section-advanced');

      if (advanced) {
        advancedConnectorCount += 1;
        fireEvent.click(within(advanced).getByRole('button'));

        expect(
          advanced.querySelector('.connection-advanced-section-fields')
        ).not.toBeNull();

        propertyNames
          .filter((name) => ADVANCED_PROPERTIES.includes(name))
          .forEach((name) => {
            expect(
              within(advanced).getByTestId(`field-${name}`)
            ).toBeInTheDocument();
          });
      }
    }

    expect(renderedConnectorCount).toBeGreaterThan(40);
    expect(scopeConnectorCount).toBeGreaterThan(30);
    expect(advancedConnectorCount).toBeGreaterThan(30);
  });
});
