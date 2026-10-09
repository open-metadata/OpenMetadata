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
import { RJSFSchema } from '@rjsf/utils';
import { fireEvent, render, screen, within } from '@testing-library/react';
import FormBuilderV1 from '../../../../../common/FormBuilderV1/FormBuilderV1';
import SsoObjectFieldTemplate from './SsoObjectFieldTemplate';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SCHEMA: RJSFSchema = {
  type: 'object',
  properties: {
    authenticationConfiguration: {
      type: 'object',
      title: 'Authentication',
      properties: {
        providerName: { type: 'string', title: 'Provider Name' },
        clientId: { type: 'string', title: 'Client ID' },
        oidcConfiguration: {
          type: 'object',
          title: 'OIDC Configuration',
          properties: { id: { type: 'string', title: 'OIDC Client ID' } },
        },
      },
    },
    authorizerConfiguration: {
      type: 'object',
      title: 'Authorizer',
      properties: {
        adminEmails: { type: 'string', title: 'Admin Emails' },
        connectionArguments: { type: 'string', title: 'Connection Arguments' },
      },
    },
  },
};

const renderForm = () =>
  render(
    <FormBuilderV1
      hideFooter
      schema={SCHEMA}
      templates={{ ObjectFieldTemplate: SsoObjectFieldTemplate }}
    />
  );

const objectSection = (id: string) => screen.getByTestId(`sso-object-${id}`);

describe('SsoObjectFieldTemplate', () => {
  it('names nested provider sections but not the two top-level objects', () => {
    renderForm();

    expect(screen.getByText('OIDC Configuration')).toBeInTheDocument();
    expect(screen.queryByText('Authentication')).not.toBeInTheDocument();
    expect(screen.queryByText('Authorizer')).not.toBeInTheDocument();
  });

  it('lays the authentication fields out in their classic groups', () => {
    renderForm();
    const auth = objectSection('root/authenticationConfiguration');

    const providerGroup = within(auth)
      .getByRole('textbox', { name: /^Provider Name/ })
      .closest('.tw\\:border') as HTMLElement;

    expect(
      within(providerGroup).queryByRole('textbox', { name: /^Client ID/ })
    ).not.toBeInTheDocument();
    expect(
      within(auth).getByRole('textbox', { name: /^OIDC Client ID/ })
    ).toBeInTheDocument();
  });

  it('tucks advanced properties into a collapsed, still-mounted accordion', () => {
    renderForm();
    const header = screen.getByTestId(
      'sso-advanced-root/authorizerConfiguration'
    );
    const advancedInput = document.querySelector(
      '[id="root/authorizerConfiguration/connectionArguments"]'
    );

    expect(header).toHaveTextContent('label.advanced-config');
    expect(advancedInput).toBeInTheDocument();
    expect(advancedInput).not.toBeVisible();

    fireEvent.click(header);

    expect(advancedInput).toBeVisible();
  });
});
