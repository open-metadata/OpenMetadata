/*
 *  Copyright 2021 Collate
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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import ToggleSwitch from './ToggleSwitch';

describe('Test Toggle Switch Component', () => {
  it('Renders the Toggle Switch with the label sent to it', async () => {
    const handleToggle = jest.fn();
    const { findByText } = render(
      <ToggleSwitch isEnabled label="Test Label" onToggle={handleToggle} />
    );
    const labelElement = await findByText('Test Label');

    expect(labelElement).toBeInTheDocument();
  });

  it('Changes the checked state on click on the toggle switch', async () => {
    const handleToggle = jest.fn();
    const { findByTestId } = render(
      <ToggleSwitch isEnabled label="Test Label" onToggle={handleToggle} />
    );
    const toggleSwitchElement = (await findByTestId(
      'toggle-checkbox'
    )) as HTMLInputElement;

    expect(toggleSwitchElement.checked).toBe(true);

    fireEvent.change(toggleSwitchElement, { target: { checked: false } });

    expect(toggleSwitchElement.checked).toBe(false);
  });

  it('Renders the Toggle switch in the enabled state if the state is sent to it', async () => {
    const handleToggle = jest.fn();
    const { findByTestId } = render(
      <ToggleSwitch isEnabled label="Test Label" onToggle={handleToggle} />
    );
    const toggleSwitchElement = (await findByTestId(
      'toggle-checkbox'
    )) as HTMLInputElement;

    expect(toggleSwitchElement.checked).toBe(true);
  });
});
