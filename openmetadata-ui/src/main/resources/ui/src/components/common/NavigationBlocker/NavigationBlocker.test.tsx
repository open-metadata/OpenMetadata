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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { NavigationBlocker } from './NavigationBlocker';

describe('NavigationBlocker component', () => {
  beforeEach(() => {
    // Reset any mocked functions
    jest.clearAllMocks();
  });

  it('should render children when navigation blocking is disabled', () => {
    render(
      <NavigationBlocker enabled={false}>
        <div data-testid="test-content">Test Content</div>
      </NavigationBlocker>
    );

    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('should render children when navigation blocking is enabled', () => {
    render(
      <NavigationBlocker enabled>
        <div data-testid="test-content">Test Content</div>
      </NavigationBlocker>
    );

    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('should not show modal initially', () => {
    render(
      <NavigationBlocker enabled>
        <div>Test Content</div>
      </NavigationBlocker>
    );

    // Modal should not be visible initially
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show correct modal content when blocking is enabled', () => {
    const customTitle = 'Custom Title';
    const customMessage = 'Custom message';
    const customConfirmText = 'Custom Confirm';
    const customCancelText = 'Custom Cancel';

    render(
      <NavigationBlocker
        enabled
        cancelText={customCancelText}
        confirmText={customConfirmText}
        message={customMessage}
        title={customTitle}>
        <div>
          <a data-testid="test-link" href="/new-page">
            Navigate Away
          </a>
        </div>
      </NavigationBlocker>
    );

    // Click link to trigger modal
    const link = screen.getByTestId('test-link');
    fireEvent.click(link);

    // Check if modal appears with custom content
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(customTitle)).toBeInTheDocument();
    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: customConfirmText })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: customCancelText })
    ).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const onCancel = jest.fn();

    render(
      <NavigationBlocker enabled onCancel={onCancel}>
        <div>
          <a data-testid="test-link" href="/new-page">
            Navigate Away
          </a>
        </div>
      </NavigationBlocker>
    );

    // Click link to show modal
    const link = screen.getByTestId('test-link');
    fireEvent.click(link);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: 'Stay' });
    await act(async () => {
      await fireEvent.click(cancelButton);
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const onConfirm = jest.fn();

    render(
      <NavigationBlocker enabled onConfirm={onConfirm}>
        <div>
          <a data-testid="test-link" href="/new-page">
            Navigate Away
          </a>
        </div>
      </NavigationBlocker>
    );

    // Click link to show modal
    const link = screen.getByTestId('test-link');
    fireEvent.click(link);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const confirmButton = await screen.findByRole('button', {
      name: 'Leave',
    });
    // Click confirm button
    await act(async () => {
      await fireEvent.click(confirmButton);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should not intercept navigation when blocking is disabled', () => {
    render(
      <NavigationBlocker enabled={false}>
        <div>
          <a data-testid="test-link" href="/new-page">
            Navigate Away
          </a>
        </div>
      </NavigationBlocker>
    );

    const link = screen.getByTestId('test-link');
    fireEvent.click(link);

    // Modal should not appear
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should handle default props correctly', () => {
    render(
      <NavigationBlocker enabled>
        <div>
          <a data-testid="test-link" href="/new-page">
            Navigate Away
          </a>
        </div>
      </NavigationBlocker>
    );

    // Click link to trigger modal with default props
    const link = screen.getByTestId('test-link');
    fireEvent.click(link);

    // Check default content
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to leave?')
    ).toBeInTheDocument();
    expect(
      screen.getByText('You have unsaved changes which will be discarded.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stay' })).toBeInTheDocument();
  });
});
