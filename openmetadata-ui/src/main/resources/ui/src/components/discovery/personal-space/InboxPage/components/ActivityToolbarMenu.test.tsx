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
import ActivityToolbarMenu from './ActivityToolbarMenu';

const Icon = () => <svg />;

const options = [
  { value: 'yesterday', label: 'Yesterday', icon: Icon },
  { value: 'last30days', label: 'Last 30 days', icon: Icon },
];

const renderMenu = (triggerLabel?: string) => {
  const onChange = jest.fn();
  render(
    <ActivityToolbarMenu
      data-testid="date-menu"
      options={options}
      title="Date"
      triggerIcon={Icon}
      triggerLabel={triggerLabel}
      value="last30days"
      onChange={onChange}
    />
  );

  return onChange;
};

describe('ActivityToolbarMenu', () => {
  it('names the chosen option on its trigger', () => {
    renderMenu();

    expect(screen.getByTestId('date-menu')).toHaveTextContent('Last 30 days');
  });

  it('lets the caller name the trigger instead', () => {
    renderMenu('Group');

    expect(screen.getByTestId('date-menu')).toHaveTextContent('Group');
  });

  it('opens on a heading and its options, and reports the one picked', () => {
    const onChange = renderMenu();

    fireEvent.click(screen.getByTestId('date-menu'));

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'Last 30 days' })
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Yesterday' }));

    expect(onChange).toHaveBeenCalledWith('yesterday');
  });
});
