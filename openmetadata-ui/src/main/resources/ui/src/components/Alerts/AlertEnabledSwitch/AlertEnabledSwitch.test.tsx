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
  const result = render(
    <AlertEnabledSwitch canEdit isEnabled onChange={onChange} {...props} />
  );

  return { onChange, ...result };
};

describe('AlertEnabledSwitch', () => {
  it('shows a titled row whose switch is named Enabled and on for an enabled alert', () => {
    renderSwitch({});

    expect(screen.getByTestId('alert-enabled-row')).toHaveTextContent(
      'label.enabled'
    );
    expect(screen.getByRole('switch', { name: 'label.enabled' })).toBeChecked();
    expect(screen.getByTestId('alert-enabled-description')).toHaveTextContent(
      'message.alert-enabled-description'
    );
  });

  it('describes a disabled alert as sending nothing, now or later', () => {
    renderSwitch({ isEnabled: false });

    expect(
      screen.getByRole('switch', { name: 'label.enabled' })
    ).not.toBeChecked();
    expect(screen.getByTestId('alert-enabled-description')).toHaveTextContent(
      'message.alert-disabled-description'
    );
  });

  it('announces the description when the state changes and ties it to the switch', () => {
    const { rerender, onChange } = renderSwitch({});
    const region = screen.getByTestId('alert-enabled-description');

    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getByRole('switch', { name: 'label.enabled' })
    ).toHaveAttribute('aria-describedby', region.id);

    rerender(
      <AlertEnabledSwitch canEdit isEnabled={false} onChange={onChange} />
    );

    expect(region).toHaveTextContent('message.alert-disabled-description');
  });

  it('reports the new state when switched', () => {
    const { onChange } = renderSwitch({});

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
