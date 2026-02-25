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
import { act, render, screen, waitFor } from '@testing-library/react';
import { getRoles } from '../../../rest/rolesAPIV1';
import { showErrorToast } from '../../../utils/ToastUtils';
import SsoConfigurationFormArrayFieldTemplate, {
  SsoRolesSelectField,
} from './SsoConfigurationFormArrayFieldTemplate';

jest.mock('../../../rest/rolesAPIV1', () => ({
  getRoles: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGetRoles = getRoles as jest.Mock;
const mockShowErrorToast = showErrorToast as jest.Mock;

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

const rolesSelectProps: FieldProps = {
  idSchema: {
    $id: 'root/authenticationConfiguration/ldapConfiguration/authReassignRoles',
  },
  name: 'authReassignRoles',
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
  uiSchema: { 'ui:placeholder': 'label.select-field' },
  registry: {} as FieldProps['registry'],
} as unknown as FieldProps;

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

describe('SsoRolesSelectField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoles.mockResolvedValue(mockRolesResponse);
  });

  it('renders the roles select', async () => {
    await act(async () => {
      render(<SsoRolesSelectField {...rolesSelectProps} />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-authReassignRoles'
        )
      ).toBeInTheDocument();
    });
  });

  it('displays the field label using startCase of the field name', async () => {
    await act(async () => {
      render(<SsoRolesSelectField {...rolesSelectProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Auth Reassign Roles')).toBeInTheDocument();
    });
  });

  it('calls getRoles API on mount', async () => {
    await act(async () => {
      render(<SsoRolesSelectField {...rolesSelectProps} />);
    });

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalledWith(
        '*',
        undefined,
        undefined,
        true,
        1000
      );
    });
  });

  it('calls getRoles exactly once on mount', async () => {
    await act(async () => {
      render(<SsoRolesSelectField {...rolesSelectProps} />);
    });

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalledTimes(1);
    });
  });

  it('uses displayName when available for role option label', async () => {
    mockGetRoles.mockResolvedValue({
      data: [{ name: 'Admin', displayName: 'Administrator' }],
      paging: { total: 1 },
    });

    await act(async () => {
      render(<SsoRolesSelectField {...rolesSelectProps} />);
    });

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalled();
    });
  });

  it('falls back to name when displayName is empty', async () => {
    mockGetRoles.mockResolvedValue({
      data: [{ name: 'DataConsumer', displayName: '' }],
      paging: { total: 1 },
    });

    await act(async () => {
      render(<SsoRolesSelectField {...rolesSelectProps} />);
    });

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalled();
    });
  });

  it('shows error toast when getRoles API call fails', async () => {
    const apiError = new Error('Network error');
    mockGetRoles.mockRejectedValue(apiError);

    await act(async () => {
      render(<SsoRolesSelectField {...rolesSelectProps} />);
    });

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(apiError);
    });
  });

  it('renders with required indicator when field is required', async () => {
    const requiredProps = {
      ...rolesSelectProps,
      required: true,
    } as unknown as FieldProps;

    await act(async () => {
      render(<SsoRolesSelectField {...requiredProps} />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-authReassignRoles'
        )
      ).toBeInTheDocument();
    });
  });

  it('renders as disabled when disabled prop is true', async () => {
    const disabledProps = {
      ...rolesSelectProps,
      disabled: true,
    } as unknown as FieldProps;

    await act(async () => {
      render(<SsoRolesSelectField {...disabledProps} />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-authReassignRoles'
        )
      ).toBeInTheDocument();
    });
  });

  it('renders with existing selected roles from formData', async () => {
    const propsWithData = {
      ...rolesSelectProps,
      formData: ['Admin', 'DataSteward'],
    } as unknown as FieldProps;

    await act(async () => {
      render(<SsoRolesSelectField {...propsWithData} />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-authReassignRoles'
        )
      ).toBeInTheDocument();
    });
  });

  it('renders error state when rawErrors are present', async () => {
    const propsWithErrors = {
      ...rolesSelectProps,
      rawErrors: ['This field is required'],
    } as unknown as FieldProps;

    await act(async () => {
      render(<SsoRolesSelectField {...propsWithErrors} />);
    });

    await waitFor(() => {
      const select = screen.getByTestId(
        'sso-configuration-form-array-field-template-authReassignRoles'
      );

      expect(select.closest('.has-error')).toBeInTheDocument();
    });
  });

  it('renders with empty roles list when API returns empty data', async () => {
    mockGetRoles.mockResolvedValue({ data: [], paging: { total: 0 } });

    await act(async () => {
      render(<SsoRolesSelectField {...rolesSelectProps} />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-authReassignRoles'
        )
      ).toBeInTheDocument();
    });
  });

  it('renders with empty roles when API returns null data', async () => {
    mockGetRoles.mockResolvedValue({ data: null, paging: { total: 0 } });

    await act(async () => {
      render(<SsoRolesSelectField {...rolesSelectProps} />);
    });

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalled();
      expect(mockShowErrorToast).not.toHaveBeenCalled();
    });
  });
});

describe('SsoConfigurationFormArrayFieldTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoles.mockResolvedValue(mockRolesResponse);
  });

  it('does NOT call getRoles for regular array fields', async () => {
    await act(async () => {
      render(<SsoConfigurationFormArrayFieldTemplate {...baseFieldProps} />);
    });

    await waitFor(() => {
      expect(mockGetRoles).not.toHaveBeenCalled();
    });
  });

  it('does NOT call getRoles when uiSchema has no roles config', async () => {
    const propsNoOptions = {
      ...baseFieldProps,
      uiSchema: { 'ui:title': 'Some Title' },
    } as unknown as FieldProps;

    await act(async () => {
      render(<SsoConfigurationFormArrayFieldTemplate {...propsNoOptions} />);
    });

    await waitFor(() => {
      expect(mockGetRoles).not.toHaveBeenCalled();
    });
  });

  it('renders standard tags-mode select for non-roles array fields', async () => {
    await act(async () => {
      render(<SsoConfigurationFormArrayFieldTemplate {...baseFieldProps} />);
    });

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
    await act(async () => {
      render(<SsoConfigurationFormArrayFieldTemplate {...baseFieldProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Admin Principals')).toBeInTheDocument();
    });
  });

  it('renders error state when rawErrors are present', async () => {
    const propsWithErrors = {
      ...baseFieldProps,
      rawErrors: ['This field is required'],
    } as unknown as FieldProps;

    await act(async () => {
      render(<SsoConfigurationFormArrayFieldTemplate {...propsWithErrors} />);
    });

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

    await act(async () => {
      render(<SsoConfigurationFormArrayFieldTemplate {...requiredProps} />);
    });

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

    await act(async () => {
      render(<SsoConfigurationFormArrayFieldTemplate {...enumFieldProps} />);
    });

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
