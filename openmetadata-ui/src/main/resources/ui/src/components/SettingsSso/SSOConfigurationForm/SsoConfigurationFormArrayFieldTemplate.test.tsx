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

import { FieldProps } from '@rjsf/utils';
import { render, screen, waitFor } from '@testing-library/react';
import { getRoles } from '../../../rest/rolesAPIV1';
import SsoConfigurationFormArrayFieldTemplate from './SsoConfigurationFormArrayFieldTemplate';

jest.mock('../../../rest/rolesAPIV1', () => ({
  getRoles: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGetRoles = getRoles as jest.Mock;

const mockRolesResponse = {
  data: [
    { name: 'Admin', displayName: 'Administrator' },
    { name: 'DataSteward', displayName: 'Data Steward' },
    { name: 'DataConsumer', displayName: '' },
  ],
  paging: { total: 3 },
};

const mockOnChange = jest.fn();
const mockOnBlur = jest.fn();
const mockOnFocus = jest.fn();

const baseFieldProps: FieldProps = {
  idSchema: { $id: 'root/authorizerConfiguration/adminPrincipals' },
  name: 'adminPrincipals',
  formData: [],
  schema: { type: 'array', items: { type: 'string' } },
  required: false,
  disabled: false,
  readonly: false,
  onChange: mockOnChange,
  onBlur: mockOnBlur,
  onFocus: mockOnFocus,
  rawErrors: [],
  formContext: {},
  uiSchema: {},
  registry: {} as FieldProps['registry'],
} as unknown as FieldProps;

describe('SsoConfigurationFormArrayFieldTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoles.mockResolvedValue(mockRolesResponse);
  });

  it('does NOT call getRoles for regular array fields', async () => {
    render(<SsoConfigurationFormArrayFieldTemplate {...baseFieldProps} />);

    await waitFor(() => {
      expect(mockGetRoles).not.toHaveBeenCalled();
    });
  });

  it('does NOT call getRoles when uiSchema has no roles config', async () => {
    const propsNoOptions = {
      ...baseFieldProps,
      uiSchema: { 'ui:title': 'Some Title' },
    } as unknown as FieldProps;

    render(<SsoConfigurationFormArrayFieldTemplate {...propsNoOptions} />);

    await waitFor(() => {
      expect(mockGetRoles).not.toHaveBeenCalled();
    });
  });

  it('renders standard tags-mode select for non-roles array fields', async () => {
    render(<SsoConfigurationFormArrayFieldTemplate {...baseFieldProps} />);

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-adminPrincipals'
        )
      ).toBeInTheDocument();
    });

    expect(mockGetRoles).not.toHaveBeenCalled();
  });

  it('renders the field label using startCase of the field name', async () => {
    render(<SsoConfigurationFormArrayFieldTemplate {...baseFieldProps} />);

    await waitFor(() => {
      expect(screen.getByText('Admin Principals')).toBeInTheDocument();
    });
  });

  it('renders error state when rawErrors are present', async () => {
    const propsWithErrors = {
      ...baseFieldProps,
      rawErrors: ['This field is required'],
    } as unknown as FieldProps;

    render(<SsoConfigurationFormArrayFieldTemplate {...propsWithErrors} />);

    await waitFor(() => {
      const select = screen.getByTestId(
        'sso-configuration-form-array-field-template-adminPrincipals'
      );

      expect(select.closest('.has-error')).toBeInTheDocument();
    });
  });

  it('renders with required indicator when field is required', async () => {
    const requiredProps = {
      ...baseFieldProps,
      required: true,
    } as unknown as FieldProps;

    render(<SsoConfigurationFormArrayFieldTemplate {...requiredProps} />);

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-adminPrincipals'
        )
      ).toBeInTheDocument();
    });
  });

  it('renders with enum options as multiple-select when schema items have enum', async () => {
    const enumFieldProps = {
      ...baseFieldProps,
      name: 'tokenValidationAlgorithm',
      idSchema: {
        $id: 'root/authenticationConfiguration/tokenValidationAlgorithm',
      },
      schema: {
        type: 'array',
        items: { type: 'string', enum: ['RS256', 'RS384', 'RS512'] },
      },
    } as unknown as FieldProps;

    render(<SsoConfigurationFormArrayFieldTemplate {...enumFieldProps} />);

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-tokenValidationAlgorithm'
        )
      ).toBeInTheDocument();
    });

    expect(mockGetRoles).not.toHaveBeenCalled();
  });
});
