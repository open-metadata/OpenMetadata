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

import { Registry, WidgetProps } from '@rjsf/utils';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { getRoles } from '../../../../../../rest/rolesAPIV1';
import LdapRoleMappingWidget from './LdapRoleMappingWidget';

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  getRoles: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetRoles = getRoles as jest.Mock;

const mockRoles = {
  data: [
    { name: 'Admin', displayName: 'Administrator' },
    { name: 'DataSteward', displayName: 'Data Steward' },
    { name: 'DataConsumer', displayName: 'Data Consumer' },
  ],
  paging: { total: 3 },
};

const mockOnChange = jest.fn();
const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();

const baseProps: WidgetProps = {
  id: 'ldap-role-mapping',
  name: 'ldapRoleMapping',
  value: '',
  onChange: mockOnChange,
  onFocus: mockOnFocus,
  onBlur: mockOnBlur,
  registry: {} as Registry,
  label: 'Auth Roles Mapping',
  schema: {},
  disabled: false,
  readonly: false,
  formContext: {},
  rawErrors: [],
  options: {},
};

describe('LdapRoleMappingWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoles.mockResolvedValue(mockRoles);
  });

  describe('Rendering Tests', () => {
    it('should render empty state with add button', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      expect(screen.queryByText(/label.ldap-group-dn/)).not.toBeInTheDocument();
      expect(mockGetRoles).toHaveBeenCalledWith(
        '*',
        undefined,
        undefined,
        true,
        1000
      );
    });

    it('should render with existing mappings', async () => {
      const existingMappings = JSON.stringify({
        'cn=admins,dc=company,dc=com': ['Admin', 'DataSteward'],
        'cn=users,dc=company,dc=com': ['DataConsumer'],
      });

      await act(async () => {
        render(
          <LdapRoleMappingWidget {...baseProps} value={existingMappings} />
        );
      });

      await waitFor(() => {
        expect(screen.getAllByTestId(/^mapping-card-/).length).toBe(2);
      });

      expect(
        screen.getByDisplayValue('cn=admins,dc=company,dc=com')
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('cn=users,dc=company,dc=com')
      ).toBeInTheDocument();
    });

    it('should show header when mappings exist', async () => {
      const existingMappings = JSON.stringify({
        'cn=admins,dc=company,dc=com': ['Admin'],
      });

      await act(async () => {
        render(
          <LdapRoleMappingWidget {...baseProps} value={existingMappings} />
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/label.ldap-group-dn/)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/label.openmetadata-role-plural/)
      ).toBeInTheDocument();
    });

    it('should render in readonly mode', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} readonly />);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/message.no-ldap-role-mappings/)
        ).toBeInTheDocument();
      });

      expect(screen.queryByTestId('add-mapping-btn')).not.toBeInTheDocument();
    });
  });

  describe('User Interaction Tests', () => {
    it('should add new mapping when add button is clicked', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      await waitFor(() => {
        expect(screen.getAllByTestId(/^ldap-group-input-/).length).toBe(1);
      });
    });

    it('should remove mapping when delete button is clicked', async () => {
      const existingMappings = JSON.stringify({
        'cn=admins,dc=company,dc=com': ['Admin'],
      });

      await act(async () => {
        render(
          <LdapRoleMappingWidget {...baseProps} value={existingMappings} />
        );
      });

      await waitFor(() => {
        expect(screen.getAllByTestId(/^remove-mapping-btn-/).length).toBe(1);
      });

      const removeButton = screen.getByTestId(/^remove-mapping-btn-/);

      await act(async () => {
        fireEvent.click(removeButton);
      });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('{}');
      });
    });

    it('should update LDAP group input', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      const input = await screen.findByTestId(/^ldap-group-input-/);

      await act(async () => {
        fireEvent.change(input, {
          target: { value: 'cn=test,dc=example,dc=com' },
        });
      });

      expect(input).toHaveValue('cn=test,dc=example,dc=com');
    });

    it('should update roles select', async () => {
      const existingMappings = JSON.stringify({
        'cn=admins,dc=company,dc=com': ['Admin'],
      });

      await act(async () => {
        render(
          <LdapRoleMappingWidget {...baseProps} value={existingMappings} />
        );
      });

      await waitFor(() => {
        const rolesSelect = screen.getByTestId(/^roles-select-/);

        expect(rolesSelect).toBeInTheDocument();
      });
    });
  });

  describe('Data Synchronization Tests', () => {
    it('should parse JSON string value correctly', async () => {
      const validJson = JSON.stringify({
        'cn=admins,dc=company,dc=com': ['Admin', 'DataSteward'],
      });

      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} value={validJson} />);
      });

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('cn=admins,dc=company,dc=com')
        ).toBeInTheDocument();
      });
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidJson = 'not a valid json';

      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} value={invalidJson} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      expect(screen.queryByTestId(/^mapping-card-/)).not.toBeInTheDocument();
    });

    it('should keep mappings with ldapGroup but no roles', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      const input = await screen.findByTestId(/^ldap-group-input-/);

      await act(async () => {
        fireEvent.change(input, {
          target: { value: 'cn=test,dc=example,dc=com' },
        });
      });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          JSON.stringify({ 'cn=test,dc=example,dc=com': [] })
        );
      });
    });

    it('should not remove mapping when ldapGroup is cleared', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      const input = await screen.findByTestId(/^ldap-group-input-/);

      await act(async () => {
        fireEvent.change(input, {
          target: { value: 'cn=test,dc=example,dc=com' },
        });
      });

      await waitFor(() => {
        expect(input).toHaveValue('cn=test,dc=example,dc=com');
      });

      await act(async () => {
        fireEvent.change(input, {
          target: { value: '' },
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId(/^ldap-group-input-/)).toBeInTheDocument();
      });

      expect(mockOnChange).toHaveBeenCalledWith('{}');
    });

    it('should convert mappings to JSON string on change', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      const input = await screen.findByTestId(/^ldap-group-input-/);

      await act(async () => {
        fireEvent.change(input, {
          target: { value: 'cn=test,dc=example,dc=com' },
        });
      });

      await waitFor(() => {
        expect(input).toHaveValue('cn=test,dc=example,dc=com');
      });
    });
  });

  describe('Duplicate Validation Tests', () => {
    it('should prevent duplicate LDAP group names', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      const firstInput = await screen.findByTestId(/^ldap-group-input-/);

      await act(async () => {
        fireEvent.change(firstInput, {
          target: { value: 'cn=test,dc=example,dc=com' },
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      const inputs = await screen.findAllByTestId(/^ldap-group-input-/);

      await act(async () => {
        fireEvent.change(inputs[1], {
          target: { value: 'cn=test,dc=example,dc=com' },
        });
      });

      await waitFor(() => {
        expect(
          screen.getAllByText(/message.ldap-group-duplicate-error/).length
        ).toBe(2);
      });
    });

    it('should show error for duplicate entries', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      await waitFor(async () => {
        const inputs = screen.getAllByTestId(/^ldap-group-input-/);

        expect(inputs.length).toBe(2);
      });

      const inputs = screen.getAllByTestId(/^ldap-group-input-/);

      await act(async () => {
        fireEvent.change(inputs[0], {
          target: { value: 'cn=duplicate,dc=example,dc=com' },
        });
      });

      await act(async () => {
        fireEvent.change(inputs[1], {
          target: { value: 'cn=duplicate,dc=example,dc=com' },
        });
      });

      await waitFor(() => {
        expect(screen.getAllByTestId(/^ldap-group-error-/).length).toBe(2);
      });
    });

    it('should clear error when duplicate is removed', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      await waitFor(async () => {
        const inputs = screen.getAllByTestId(/^ldap-group-input-/);

        expect(inputs.length).toBe(2);
      });

      const inputs = screen.getAllByTestId(/^ldap-group-input-/);

      await act(async () => {
        fireEvent.change(inputs[0], {
          target: { value: 'cn=duplicate,dc=example,dc=com' },
        });
      });

      await act(async () => {
        fireEvent.change(inputs[1], {
          target: { value: 'cn=duplicate,dc=example,dc=com' },
        });
      });

      await waitFor(() => {
        expect(screen.getAllByTestId(/^ldap-group-error-/).length).toBe(2);
      });

      await act(async () => {
        fireEvent.change(inputs[1], {
          target: { value: 'cn=unique,dc=example,dc=com' },
        });
      });

      await waitFor(() => {
        expect(screen.queryAllByTestId(/^ldap-group-error-/).length).toBe(0);
      });
    });
  });

  describe('React Key Stability Tests', () => {
    it('should use stable IDs for consistent mappings', async () => {
      const existingMappings = JSON.stringify({
        'cn=admins,dc=company,dc=com': ['Admin'],
      });

      await act(async () => {
        render(
          <LdapRoleMappingWidget {...baseProps} value={existingMappings} />
        );
      });

      const firstCard = await screen.findByTestId(/^mapping-card-/);
      const firstCardId = firstCard.dataset['testid'];

      expect(firstCardId).toMatch(/^mapping-card-mapping-\d+$/);
    });

    it('should not remount component when typing in ldapGroup input', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      const input = await screen.findByTestId(/^ldap-group-input-/);
      const initialId = input.dataset['testid'];

      await act(async () => {
        fireEvent.change(input, { target: { value: 'c' } });
      });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'cn' } });
      });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'cn=' } });
      });

      const finalInput = await screen.findByTestId(/^ldap-group-input-/);
      const finalId = finalInput.dataset['testid'];

      expect(initialId).toBe(finalId);
    });
  });

  describe('API Integration Tests', () => {
    const newPromise = new Promise((resolve) => {
      setTimeout(() => resolve(mockRoles), 100);
    });

    it('should fetch roles from API on mount', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
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

    it('should handle API errors', async () => {
      mockGetRoles.mockRejectedValueOnce(new Error('API Error'));

      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching roles', async () => {
      mockGetRoles.mockImplementationOnce(() => newPromise);

      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} />);
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-mapping-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId(/^roles-select-/)).toBeInTheDocument();
      });
    });
  });

  describe('Incomplete Mapping Tests', () => {
    it('should keep mapping visible when ldapGroup is cleared but roles are selected', async () => {
      const existingMappings = JSON.stringify({
        'cn=admins,dc=company,dc=com': ['Admin', 'DataSteward'],
      });

      await act(async () => {
        render(
          <LdapRoleMappingWidget {...baseProps} value={existingMappings} />
        );
      });

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('cn=admins,dc=company,dc=com')
        ).toBeInTheDocument();
      });

      const input = screen.getByTestId(/^ldap-group-input-/);

      await act(async () => {
        fireEvent.change(input, { target: { value: '' } });
      });

      await waitFor(() => {
        expect(screen.getByTestId(/^ldap-group-input-/)).toBeInTheDocument();
      });

      expect(screen.getByTestId(/^roles-select-/)).toBeInTheDocument();
      expect(screen.getByTestId(/^remove-mapping-btn-/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty value prop', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} value="" />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });

      expect(screen.queryByTestId(/^mapping-card-/)).not.toBeInTheDocument();
    });

    it('should handle null value prop', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} value={undefined} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-btn')).toBeInTheDocument();
      });
    });

    it('should disable inputs when disabled prop is true', async () => {
      const existingMappings = JSON.stringify({
        'cn=admins,dc=company,dc=com': ['Admin'],
      });

      await act(async () => {
        render(
          <LdapRoleMappingWidget
            {...baseProps}
            disabled
            value={existingMappings}
          />
        );
      });

      const input = await screen.findByTestId(/^ldap-group-input-/);

      expect(input).toBeDisabled();

      const addButton = screen.getByTestId('add-mapping-btn');

      expect(addButton).toBeDisabled();
    });

    it('should hide add button in readonly mode', async () => {
      await act(async () => {
        render(<LdapRoleMappingWidget {...baseProps} readonly />);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('add-mapping-btn')).not.toBeInTheDocument();
      });
    });

    it('should handle large number of mappings', async () => {
      const largeMappings: Record<string, string[]> = {};

      for (let i = 0; i < 50; i++) {
        largeMappings[`cn=group${i},dc=company,dc=com`] = ['Admin'];
      }

      await act(async () => {
        render(
          <LdapRoleMappingWidget
            {...baseProps}
            value={JSON.stringify(largeMappings)}
          />
        );
      });

      await waitFor(() => {
        expect(screen.getAllByTestId(/^mapping-card-/).length).toBe(50);
      });
    });
  });
});
