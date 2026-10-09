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
import { FieldProps } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import SsoRolesSelectField from './SsoRolesSelectField';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  searchRoles: jest.fn().mockResolvedValue([]),
}));

const renderField = (props: Partial<FieldProps> = {}) =>
  render(
    <SsoRolesSelectField
      {...({
        idSchema: {
          $id: 'root/authenticationConfiguration/ldapConfiguration/authReassignRoles',
        },
        name: 'authReassignRoles',
        schema: { type: 'array' },
        uiSchema: {},
        formData: ['Admin'],
        formContext: {},
        registry: {},
        onChange: jest.fn(),
        onBlur: jest.fn(),
        ...props,
      } as unknown as FieldProps<string[]>)}
    />
  );

describe('SsoRolesSelectField', () => {
  it('labels the field from its name and shows the selected roles', async () => {
    renderField();

    expect(screen.getByText('Auth Reassign Roles')).toBeInTheDocument();
    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(
      screen.getByTestId('sso-roles-select-authReassignRoles')
    ).toBeInTheDocument();
  });

  it('prefers the schema title and shows the first error', () => {
    renderField({
      schema: { type: 'array', title: 'Reassign Roles' },
      rawErrors: ['Unknown role'],
    });

    expect(screen.getByText('Reassign Roles')).toBeInTheDocument();
    expect(screen.getByText('Unknown role')).toBeInTheDocument();
  });
});
