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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconSelector } from './IconSelector.component';
import { IconSelectorProps } from './IconSelector.interface';

const mockProps: IconSelectorProps = {
  open: true,
  selectedIconFileName: undefined,
  selectedIconUrl: undefined,
  onIconSelect: jest.fn(),
  onUrlSelect: jest.fn(),
  onClear: jest.fn(),
  onClose: jest.fn(),
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (options) {
        return `${key} ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

// Mock Ant Design components for testing
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('IconSelector Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when open is true', () => {
    render(<IconSelector {...mockProps} />);

    expect(
      screen.getByRole('tab', { name: 'label.icon-plural' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'label.url-uppercase' })
    ).toBeInTheDocument();
    expect(screen.getByText('label.upload-image')).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    const closedProps = { ...mockProps, open: false };
    const { container } = render(<IconSelector {...closedProps} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render search input in Icons tab', () => {
    render(<IconSelector {...mockProps} />);

    const searchInput = screen.getByPlaceholderText(
      /label.search-for-type.*label.icon-plural/
    );

    expect(searchInput).toBeInTheDocument();
  });

  it('should render domain icons grid', () => {
    render(<IconSelector {...mockProps} />);

    // Should render multiple icon items including default lightning icon
    const iconItems = screen
      .getAllByRole('generic')
      .filter((element) => element.className.includes('icon-item'));

    expect(iconItems.length).toBeGreaterThan(0);
  });

  it('should call onIconSelect when default lightning icon is clicked', async () => {
    const user = userEvent.setup();
    render(<IconSelector {...mockProps} />);

    const defaultIcon = screen
      .getAllByRole('generic')
      .find((element) => element.className.includes('default'));

    expect(defaultIcon).toBeDefined();
    expect(defaultIcon).toBeTruthy();

    await user.click(defaultIcon!);

    expect(mockProps.onIconSelect).toHaveBeenCalledWith('lightning-01.svg');
  });

  it('should show default lightning icon as selected when lightning-01.svg is selected', () => {
    const propsWithLightningSelected = {
      ...mockProps,
      selectedIconFileName: 'lightning-01.svg',
    };

    render(<IconSelector {...propsWithLightningSelected} />);

    const defaultIcon = screen
      .getAllByRole('generic')
      .find((element) => element.className.includes('default'));

    expect(defaultIcon).toBeDefined();
    expect(defaultIcon).toHaveClass('selected');
  });

  it('should filter icons based on search query', async () => {
    const user = userEvent.setup();
    render(<IconSelector {...mockProps} />);

    const searchInput = screen.getByPlaceholderText(
      /label.search-for-type.*label.icon-plural/
    );

    await user.type(searchInput, 'bank');

    // Should filter to show only bank-related icons
    const iconItems = screen
      .getAllByRole('generic')
      .filter((element) => element.className.includes('icon-item'));

    // Bank icon should be visible, others should be filtered out
    expect(iconItems.length).toBeLessThan(10); // Assuming there are many icons
  });

  it('should call onIconSelect when icon is clicked', async () => {
    const user = userEvent.setup();
    render(<IconSelector {...mockProps} />);

    const iconItems = screen
      .getAllByRole('generic')
      .filter(
        (element) =>
          element.className.includes('icon-item') &&
          !element.className.includes('default')
      );

    expect(iconItems.length).toBeGreaterThan(0);

    await user.click(iconItems[0]);

    expect(mockProps.onIconSelect).toHaveBeenCalled();
  });

  it('should switch to URL tab and show URL input', async () => {
    const user = userEvent.setup();
    render(<IconSelector {...mockProps} />);

    const urlTab = screen.getByRole('tab', { name: 'label.url-uppercase' });

    await user.click(urlTab);

    const urlInput = await waitFor(() =>
      screen.getByPlaceholderText(/label.enter-entity.*label.url-uppercase/)
    );

    expect(urlInput).toBeInTheDocument();
  });

  it('should handle URL input changes', async () => {
    const user = userEvent.setup();
    render(<IconSelector {...mockProps} />);

    const urlTab = screen.getByRole('tab', { name: 'label.url-uppercase' });

    await user.click(urlTab);

    const urlInput = await waitFor(() =>
      screen.getByPlaceholderText(/label.enter-entity.*label.url-uppercase/)
    );

    await user.type(urlInput, 'https://example.com/icon.svg');

    expect(urlInput).toHaveValue('https://example.com/icon.svg');
  });

  it('should call onUrlSelect when Add button is clicked', async () => {
    const user = userEvent.setup();
    render(<IconSelector {...mockProps} />);

    const urlTab = screen.getByRole('tab', { name: 'label.url-uppercase' });

    await user.click(urlTab);

    const urlInput = await waitFor(() =>
      screen.getByPlaceholderText(/label.enter-entity.*label.url-uppercase/)
    );

    await user.type(urlInput, 'https://example.com/icon.svg');

    const addButton = screen.getByText('label.add');

    await user.click(addButton);

    expect(mockProps.onUrlSelect).toHaveBeenCalledWith(
      'https://example.com/icon.svg'
    );
  });

  it('should call onUrlSelect when Enter is pressed in URL input', async () => {
    const user = userEvent.setup();
    render(<IconSelector {...mockProps} />);

    const urlTab = screen.getByRole('tab', { name: 'label.url-uppercase' });

    await user.click(urlTab);

    const urlInput = await waitFor(() =>
      screen.getByPlaceholderText(/label.enter-entity.*label.url-uppercase/)
    );

    await user.type(urlInput, 'https://example.com/icon.svg');

    fireEvent.keyDown(urlInput, { key: 'Enter', code: 'Enter' });

    expect(mockProps.onUrlSelect).toHaveBeenCalledWith(
      'https://example.com/icon.svg'
    );
  });

  it('should call onClear when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<IconSelector {...mockProps} />);

    const deleteButton = screen.getByRole('button', { name: '' });

    await user.click(deleteButton);

    expect(mockProps.onClear).toHaveBeenCalled();
  });

  it('should switch to Upload Image tab and show upload area', async () => {
    const user = userEvent.setup();
    render(<IconSelector {...mockProps} />);

    const uploadTab = screen.getByRole('tab', { name: 'label.upload-image' });

    await user.click(uploadTab);

    const uploadArea = await waitFor(() =>
      screen.getByText(/message.click-or-drag-file-to-upload/)
    );

    expect(uploadArea).toBeInTheDocument();
  });

  it('should initialize URL input with selectedIconUrl prop', async () => {
    const propsWithUrl = {
      ...mockProps,
      selectedIconUrl: 'https://example.com/existing-icon.svg',
    };

    render(<IconSelector {...propsWithUrl} />);

    const urlTab = screen.getByRole('tab', { name: 'label.url-uppercase' });

    await fireEvent.click(urlTab);

    const urlInput = await waitFor(() =>
      screen.getByPlaceholderText(/label.enter-entity.*label.url-uppercase/)
    );

    expect(urlInput).toHaveValue('https://example.com/existing-icon.svg');
  });
});
