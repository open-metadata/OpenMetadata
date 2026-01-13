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
import { useTranslation } from 'react-i18next';
import { FileType } from '../../../BlockEditor.interface';
import EmbedLinkElement from './EmbedLinkElement';

describe('EmbedLinkElement', () => {
  const mockUpdateAttributes = jest.fn();
  const mockOnPopupVisibleChange = jest.fn();
  const mockOnUploadingChange = jest.fn();
  const mockDeleteNode = jest.fn();
  const mockSrc = 'https://example.com/image.jpg';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock translation function
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
  });

  it('renders the form with initial values', () => {
    render(
      <EmbedLinkElement
        deleteNode={mockDeleteNode}
        fileType={FileType.IMAGE}
        isUploading={false}
        isValidSource={false}
        src={mockSrc}
        updateAttributes={mockUpdateAttributes}
        onPopupVisibleChange={mockOnPopupVisibleChange}
        onUploadingChange={mockOnUploadingChange}
      />
    );

    // Check if form is rendered
    expect(screen.getByTestId('embed-link-form')).toBeInTheDocument();

    // Check if input field has initial value
    const input = screen.getByTestId('embed-input');

    expect(input).toHaveValue(mockSrc);
  });

  it('handles form submission with valid URL', async () => {
    render(
      <EmbedLinkElement
        deleteNode={mockDeleteNode}
        fileType={FileType.IMAGE}
        isUploading={false}
        isValidSource={false}
        src={mockSrc}
        updateAttributes={mockUpdateAttributes}
        onPopupVisibleChange={mockOnPopupVisibleChange}
        onUploadingChange={mockOnUploadingChange}
      />
    );

    const input = screen.getByTestId('embed-input');
    const submitButton = screen.getByText('label.embed-file-type');

    // Update input value
    fireEvent.change(input, {
      target: { value: 'https://example.com/new-image.jpg' },
    });

    // Submit form
    fireEvent.click(submitButton);

    // Verify the sequence of actions
    await waitFor(() => {
      expect(mockOnPopupVisibleChange).toHaveBeenCalledWith(false);
      expect(mockOnUploadingChange).toHaveBeenCalledWith(true);
      expect(mockUpdateAttributes).toHaveBeenCalledWith({
        src: 'https://example.com/new-image.jpg',
      });
      expect(mockOnUploadingChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows validation error for invalid URL', async () => {
    render(
      <EmbedLinkElement
        deleteNode={mockDeleteNode}
        fileType={FileType.IMAGE}
        isUploading={false}
        isValidSource={false}
        src={mockSrc}
        updateAttributes={mockUpdateAttributes}
        onPopupVisibleChange={mockOnPopupVisibleChange}
        onUploadingChange={mockOnUploadingChange}
      />
    );

    const input = screen.getByTestId('embed-input');
    const submitButton = screen.getByText('label.embed-file-type');

    // Set invalid URL
    fireEvent.change(input, { target: { value: 'invalid-url' } });

    // Submit form
    fireEvent.click(submitButton);

    // Verify validation error
    await waitFor(() => {
      expect(screen.getByText('label.field-required')).toBeInTheDocument();
    });

    // Verify that update functions were not called
    expect(mockUpdateAttributes).not.toHaveBeenCalled();
    expect(mockOnPopupVisibleChange).not.toHaveBeenCalled();
    expect(mockOnUploadingChange).not.toHaveBeenCalled();
  });

  it('handles delete button click', () => {
    render(
      <EmbedLinkElement
        deleteNode={mockDeleteNode}
        fileType={FileType.IMAGE}
        isUploading={false}
        isValidSource={false}
        src={mockSrc}
        updateAttributes={mockUpdateAttributes}
        onPopupVisibleChange={mockOnPopupVisibleChange}
        onUploadingChange={mockOnUploadingChange}
      />
    );

    const deleteButton = screen.getByText('label.delete');

    // Click delete button
    fireEvent.click(deleteButton);

    // Verify delete function was called
    expect(mockDeleteNode).toHaveBeenCalled();
  });

  it('prevents form submission event propagation on delete', () => {
    render(
      <EmbedLinkElement
        deleteNode={mockDeleteNode}
        fileType={FileType.IMAGE}
        isUploading={false}
        isValidSource={false}
        src={mockSrc}
        updateAttributes={mockUpdateAttributes}
        onPopupVisibleChange={mockOnPopupVisibleChange}
        onUploadingChange={mockOnUploadingChange}
      />
    );

    const deleteButton = screen.getByText('label.delete');

    // Create a mock event with preventDefault and stopPropagation
    const mockEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

    // Simulate the click event with our mock event
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(clickEvent, 'preventDefault', {
      value: mockEvent.preventDefault,
    });
    Object.defineProperty(clickEvent, 'stopPropagation', {
      value: mockEvent.stopPropagation,
    });

    // Dispatch the event on the delete button
    deleteButton.dispatchEvent(clickEvent);

    // Verify event methods were called
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });
});
