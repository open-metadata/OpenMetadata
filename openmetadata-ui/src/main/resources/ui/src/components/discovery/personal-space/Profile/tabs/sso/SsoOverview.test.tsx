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
import SsoOverview from './SsoOverview';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('SsoOverview', () => {
  it('reflects and flips the self signup setting', () => {
    const onSelfSignupChange = jest.fn();
    render(
      <SsoOverview
        isSelfSignupEnabled
        onSelfSignupChange={onSelfSignupChange}
      />
    );
    const toggle = screen.getByRole('switch', { name: 'label.enable-sso' });

    expect(toggle).toBeChecked();
    expect(
      screen.getByText('message.allow-user-to-login-via-sso')
    ).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(onSelfSignupChange).toHaveBeenCalledWith(false);
  });
});
