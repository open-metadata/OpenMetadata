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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'message.unsaved-changes': 'Unsaved changes',
        'message.unsaved-changes-description':
          'Do you want to save or discard changes?',
        'message.unsaved-changes-discard': 'Discard',
        'message.unsaved-changes-save': 'Save changes',
      };

      return translations[key] || key;
    },
  }),
}));

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

  it('should show custom modal content when props are provided', () => {
    const customTitle = 'Custom Title';
    const customMessage = 'Custom message';

    render(
      <NavigationBlocker enabled message={customMessage} title={customTitle}>
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

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(
      screen.getByText('Do you want to save or discard changes?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save changes' })
    ).toBeInTheDocument();
  });

  it('should call onConfirm when save button is clicked', async () => {
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

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click save button (which calls onConfirm)
    const saveButton = screen.getByRole('button', { name: 'Save changes' });
    await act(async () => {
      await fireEvent.click(saveButton);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when modal is closed', async () => {
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

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Close modal by clicking the X button
    const closeButton = screen.getByLabelText('Close');
    await act(async () => {
      await fireEvent.click(closeButton);
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(
      screen.getByText('Do you want to save or discard changes?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save changes' })
    ).toBeInTheDocument();
  });
});
