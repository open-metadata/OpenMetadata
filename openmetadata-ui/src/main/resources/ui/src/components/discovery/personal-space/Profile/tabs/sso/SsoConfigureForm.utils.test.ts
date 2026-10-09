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
import { getFieldDocsByName, toCoreUiSchema } from './SsoConfigureForm.utils';

describe('getFieldDocsByName', () => {
  it('keeps section docs and adds them under the fields they explain', () => {
    const docs = getFieldDocsByName({
      clientSecret: 'secret doc',
      providerName: 'name doc',
    });

    expect(docs).toMatchObject({
      clientSecret: 'secret doc',
      secret: 'secret doc',
      secretKey: 'secret doc',
      providerName: 'name doc',
    });
    expect(docs).not.toHaveProperty('authority');
  });
});

describe('toCoreUiSchema', () => {
  const schema: RJSFSchema = {
    type: 'object',
    properties: {
      authenticationConfiguration: {
        type: 'object',
        description: 'This schema defines the Authentication Configuration.',
        properties: {
          clientId: { type: 'string' },
          provider: { type: 'string' },
        },
      },
    },
  };

  it('makes every field full width, keeping the existing ui settings', () => {
    const uiSchema = toCoreUiSchema(schema, {
      authenticationConfiguration: {
        provider: { 'ui:widget': 'hidden' },
        clientId: { 'ui:options': { help: 'Client ID help' } },
      },
    });

    expect(uiSchema.authenticationConfiguration).toMatchObject({
      'ui:description': '',
      'ui:options': { fullWidth: true },
      provider: {
        'ui:widget': 'hidden',
        'ui:options': { fullWidth: true },
      },
      clientId: { 'ui:options': { help: 'Client ID help', fullWidth: true } },
    });
  });

  it('swaps the classic-only renderers for FormBuilderV1 ones', () => {
    const ldapSchema: RJSFSchema = {
      type: 'object',
      properties: {
        ldapConfiguration: {
          type: 'object',
          properties: {
            authRolesMapping: { type: 'string' },
            authReassignRoles: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    };

    const uiSchema = toCoreUiSchema(ldapSchema, {
      ldapConfiguration: {
        authRolesMapping: { 'ui:widget': 'LdapRoleMappingWidget' },
        authReassignRoles: {
          'ui:field': 'RolesSelectField',
          'ui:placeholder': 'Select roles',
        },
      },
    });

    expect(uiSchema.ldapConfiguration.authRolesMapping['ui:widget']).toBe(
      'textarea'
    );
    expect(uiSchema.ldapConfiguration.authReassignRoles).not.toHaveProperty(
      'ui:field'
    );
    expect(uiSchema.ldapConfiguration.authReassignRoles['ui:placeholder']).toBe(
      'Select roles'
    );
  });

  it('keeps root-level ui settings such as the submit button options', () => {
    expect(
      toCoreUiSchema(schema, {
        'ui:submitButtonOptions': { norender: true },
      })
    ).toHaveProperty('ui:submitButtonOptions', { norender: true });
  });
});
