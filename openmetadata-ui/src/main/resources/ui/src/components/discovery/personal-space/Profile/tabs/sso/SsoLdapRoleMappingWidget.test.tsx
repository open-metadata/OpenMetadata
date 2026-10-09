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
import { WidgetProps } from '@rjsf/utils';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SsoLdapRoleMappingWidget from './SsoLdapRoleMappingWidget';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  searchRoles: jest.fn().mockResolvedValue([]),
}));

const baseProps = (props: Partial<WidgetProps>) =>
  ({
    id: 'root/authenticationConfiguration/ldapConfiguration/authRolesMapping',
    label: 'Auth Roles Mapping',
    schema: {},
    options: { help: 'Map LDAP groups to roles.' },
    registry: {},
    onBlur: jest.fn(),
    onFocus: jest.fn(),
    ...props,
  } as unknown as WidgetProps);

const renderWidget = (props: Partial<WidgetProps> = {}) => {
  const onChange = jest.fn();
  render(
    <SsoLdapRoleMappingWidget
      {...({
        id: 'root/authenticationConfiguration/ldapConfiguration/authRolesMapping',
        label: 'Auth Roles Mapping',
        schema: {},
        options: { help: 'Map LDAP groups to roles.' },
        registry: {},
        onChange,
        onBlur: jest.fn(),
        onFocus: jest.fn(),
        ...props,
      } as unknown as WidgetProps)}
    />
  );

  return onChange;
};

const groupInputs = () =>
  screen
    .getAllByTestId(/^ldap-group-input-/)
    .map((wrapper) => within(wrapper).getByRole('textbox'));

describe('SsoLdapRoleMappingWidget', () => {
  it('lists the saved mappings with the field label and help', () => {
    renderWidget({
      value: JSON.stringify({ 'cn=admins': ['Admin'] }),
    });

    expect(screen.getByText('Auth Roles Mapping')).toBeInTheDocument();
    expect(screen.getByText('Map LDAP groups to roles.')).toBeInTheDocument();
    expect(groupInputs()[0]).toHaveValue('cn=admins');
  });

  it('adds a row and saves the mapping once it has a group', () => {
    const onChange = renderWidget();

    fireEvent.click(screen.getByTestId('add-mapping-btn'));

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(groupInputs()[0], { target: { value: 'cn=eng' } });

    expect(onChange).toHaveBeenLastCalledWith(JSON.stringify({ 'cn=eng': [] }));
  });

  it('flags a duplicate group and holds the value back until it is fixed', () => {
    const onChange = renderWidget({
      value: JSON.stringify({ 'cn=admins': ['Admin'] }),
    });
    fireEvent.click(screen.getByTestId('add-mapping-btn'));

    fireEvent.change(groupInputs()[1], { target: { value: 'CN=Admins' } });

    expect(
      screen.getAllByText('message.ldap-group-duplicate-error')
    ).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a mapping', () => {
    const onChange = renderWidget({
      value: JSON.stringify({ 'cn=admins': ['Admin'], 'cn=eng': [] }),
    });

    fireEvent.click(screen.getAllByTestId(/^remove-mapping-btn-/)[0]);

    expect(onChange).toHaveBeenLastCalledWith(JSON.stringify({ 'cn=eng': [] }));
  });

  it('shows the restored rows when the form discards its edits', () => {
    const saved = JSON.stringify({ 'cn=admins': ['Admin'] });
    const onChange = jest.fn();
    const { rerender } = render(
      <SsoLdapRoleMappingWidget {...baseProps({ value: saved, onChange })} />
    );

    fireEvent.change(groupInputs()[0], { target: { value: 'cn=typo' } });
    const edited = onChange.mock.calls[0][0];
    rerender(
      <SsoLdapRoleMappingWidget {...baseProps({ value: edited, onChange })} />
    );

    expect(groupInputs()[0]).toHaveValue('cn=typo');

    rerender(
      <SsoLdapRoleMappingWidget {...baseProps({ value: saved, onChange })} />
    );

    expect(groupInputs()[0]).toHaveValue('cn=admins');
  });

  it('keeps a row that is still being filled in when its own edit comes back', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <SsoLdapRoleMappingWidget {...baseProps({ onChange })} />
    );

    fireEvent.click(screen.getByTestId('add-mapping-btn'));
    fireEvent.click(screen.getByTestId('add-mapping-btn'));
    fireEvent.change(groupInputs()[0], { target: { value: 'cn=eng' } });
    rerender(
      <SsoLdapRoleMappingWidget
        {...baseProps({ value: onChange.mock.calls[0][0], onChange })}
      />
    );

    expect(groupInputs()).toHaveLength(2);
  });

  it('is read-only without add or remove controls', () => {
    renderWidget({ readonly: true });

    expect(screen.queryByTestId('add-mapping-btn')).not.toBeInTheDocument();
    expect(
      screen.getByText('message.no-ldap-role-mappings')
    ).toBeInTheDocument();
  });
});
