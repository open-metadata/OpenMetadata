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
  it('offers every SSO provider as one choice', () => {
    render(<SsoProviderGrid onSelect={jest.fn()} />);

    expect(
      screen.getByRole('radiogroup', { name: 'label.choose-provider' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    expect(screen.getByRole('radio', { name: 'LDAP' })).not.toBeChecked();
  });

  it('reports the picked provider and marks the selected one', () => {
    const onSelect = jest.fn();
    const { rerender } = render(<SsoProviderGrid onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Okta'));

    expect(onSelect).toHaveBeenCalledWith(AuthProvider.Okta);

    rerender(
      <SsoProviderGrid
        selectedProvider={AuthProvider.Okta}
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole('radio', { name: 'Okta' })).toBeChecked();
  });
});
