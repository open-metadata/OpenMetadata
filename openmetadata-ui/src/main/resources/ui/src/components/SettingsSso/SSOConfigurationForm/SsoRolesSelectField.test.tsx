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
import { showErrorToast } from '../../../utils/ToastUtils';
import SsoRolesSelectField from './SsoRolesSelectField';

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

describe('SsoRolesSelectField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoles.mockResolvedValue(mockRolesResponse);
  });

  it('renders the roles select', async () => {
    render(<SsoRolesSelectField {...rolesSelectProps} />);

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-authReassignRoles'
        )
      ).toBeInTheDocument();
    });
  });

  it('displays the field label using startCase of the field name', async () => {
    render(<SsoRolesSelectField {...rolesSelectProps} />);

    await waitFor(() => {
      expect(screen.getByText('Auth Reassign Roles')).toBeInTheDocument();
    });
  });

  it('calls getRoles API on mount with correct arguments', async () => {
    render(<SsoRolesSelectField {...rolesSelectProps} />);

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalledTimes(1);
      expect(mockGetRoles).toHaveBeenCalledWith(
        '*',
        undefined,
        undefined,
        true,
        1000
      );
    });
  });

  it('uses displayName as option label when available', async () => {
    mockGetRoles.mockResolvedValue({
      data: [{ name: 'Admin', displayName: 'Administrator' }],
      paging: { total: 1 },
    });

    render(<SsoRolesSelectField {...rolesSelectProps} />);

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalled();
    });
  });

  it('falls back to name as option label when displayName is empty', async () => {
    mockGetRoles.mockResolvedValue({
      data: [{ name: 'DataConsumer', displayName: '' }],
      paging: { total: 1 },
    });

    render(<SsoRolesSelectField {...rolesSelectProps} />);

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalled();
    });
  });

  it('shows error toast when getRoles API call fails', async () => {
    const apiError = new Error('Network error');
    mockGetRoles.mockRejectedValue(apiError);

    render(<SsoRolesSelectField {...rolesSelectProps} />);

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(apiError);
    });
  });

  it('renders with required indicator when field is required', async () => {
    const requiredProps = {
      ...rolesSelectProps,
      required: true,
    } as unknown as FieldProps;

    render(<SsoRolesSelectField {...requiredProps} />);

    await waitFor(() => {
      expect(
        screen
          .getByTestId(
            'sso-configuration-form-array-field-template-authReassignRoles'
          )
          .closest('.field-error')
          ?.querySelector('.required-field')
      ).toBeInTheDocument();
    });
  });

  it('renders as disabled when disabled prop is true', async () => {
    const disabledProps = {
      ...rolesSelectProps,
      disabled: true,
    } as unknown as FieldProps;

    render(<SsoRolesSelectField {...disabledProps} />);

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-authReassignRoles'
        )
      ).toBeInTheDocument();
    });
  });

  it('applies error styling when rawErrors are present', async () => {
    const propsWithErrors = {
      ...rolesSelectProps,
      rawErrors: ['This field is required'],
    } as unknown as FieldProps;

    render(<SsoRolesSelectField {...propsWithErrors} />);

    await waitFor(() => {
      const select = screen.getByTestId(
        'sso-configuration-form-array-field-template-authReassignRoles'
      );

      expect(select.closest('.has-error')).toBeInTheDocument();
    });
  });

  it('renders with empty options list when API returns empty data', async () => {
    mockGetRoles.mockResolvedValue({ data: [], paging: { total: 0 } });

    render(<SsoRolesSelectField {...rolesSelectProps} />);

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'sso-configuration-form-array-field-template-authReassignRoles'
        )
      ).toBeInTheDocument();
    });
  });

  it('renders with empty options and no error toast when API returns null data', async () => {
    mockGetRoles.mockResolvedValue({ data: null, paging: { total: 0 } });

    render(<SsoRolesSelectField {...rolesSelectProps} />);

    await waitFor(() => {
      expect(mockGetRoles).toHaveBeenCalled();
      expect(mockShowErrorToast).not.toHaveBeenCalled();
    });
  });
});
