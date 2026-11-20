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
import AlertEnabledSwitch from './AlertEnabledSwitch';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderSwitch = (
  props: Partial<Parameters<typeof AlertEnabledSwitch>[0]>
) => {
  const onChange = jest.fn();
  render(
    <AlertEnabledSwitch canEdit isEnabled onChange={onChange} {...props} />
  );

  return onChange;
};

describe('AlertEnabledSwitch', () => {
  it('is a switch named Enabled, on for an enabled alert, with no notice', () => {
    renderSwitch({});

    const toggle = screen.getByRole('switch', { name: 'label.enabled' });

    expect(toggle).toBeChecked();
    expect(
      screen.queryByTestId('alert-disabled-notice')
    ).not.toBeInTheDocument();
  });

  it('announces that a disabled alert sends nothing, now or later', () => {
    renderSwitch({ isEnabled: false });

    expect(
      screen.getByRole('switch', { name: 'label.enabled' })
    ).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent(
      'message.alert-disabled-form-notice'
    );
  });

  it('reports the new state when switched', () => {
    const onChange = renderSwitch({});

    fireEvent.click(screen.getByRole('switch', { name: 'label.enabled' }));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('cannot be switched by someone who cannot edit the alert', () => {
    renderSwitch({ canEdit: false });

    expect(
      screen.getByRole('switch', { name: 'label.enabled' })
    ).toBeDisabled();
  });
});
