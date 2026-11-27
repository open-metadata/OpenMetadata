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
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider } from '../../../../../../generated/settings/settings';
import SsoProviderGrid from './SsoProviderGrid';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('SsoProviderGrid', () => {
  it('offers every SSO provider as a clickable card', () => {
    render(<SsoProviderGrid onSelect={jest.fn()} />);

    expect(screen.getByTestId('sso-provider-grid')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'LDAP' })).toBeInTheDocument();
  });

  it('reports the provider on click and on keyboard activation', () => {
    const onSelect = jest.fn();
    render(<SsoProviderGrid onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Okta' }));

    expect(onSelect).toHaveBeenCalledWith(AuthProvider.Okta);

    fireEvent.keyDown(screen.getByRole('button', { name: 'LDAP' }), {
      key: 'Enter',
    });

    expect(onSelect).toHaveBeenLastCalledWith(AuthProvider.LDAP);
  });
});
