import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import ToggleSwitch from './ToggleSwitch';

describe('Test Toggle Switch Component', () => {
  it('Renders the Toggle Switch with the label sent to it', async () => {
    const handleToggle = jest.fn();
    const { findByText } = render(
      <ToggleSwitch label="Test Label" onToggle={handleToggle} />
    );
    const labelElement = await findByText('Test Label');

    expect(labelElement).toBeInTheDocument();
  });

  it('Changes the checked state on click on the toggle switch', async () => {
    const handleToggle = jest.fn();
    const { findByTestId } = render(
      <ToggleSwitch label="Test Label" onToggle={handleToggle} />
    );
    const toggleSwitchElement = await findByTestId('toggle-checkbox');

    expect(toggleSwitchElement.checked).toBe(false);

    fireEvent.change(toggleSwitchElement, { target: { checked: true } });

    expect(toggleSwitchElement.checked).toBe(true);
  });

  it('Renders the Toggle switch in the enabled state if the state is sent to it', async () => {
    const handleToggle = jest.fn();
    const { findByTestId } = render(
      <ToggleSwitch isEnabled label="Test Label" onToggle={handleToggle} />
    );
    const toggleSwitchElement = await findByTestId('toggle-checkbox');

    expect(toggleSwitchElement.checked).toBe(true);
  });
});
