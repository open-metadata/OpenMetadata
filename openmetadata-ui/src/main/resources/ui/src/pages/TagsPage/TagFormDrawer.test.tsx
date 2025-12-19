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

import { fireEvent, render, screen } from '@testing-library/react';
import { FormInstance } from 'antd';
import TagFormDrawer from './TagFormDrawer';

jest.mock('./TagsForm', () => {
  return jest.fn(() => <div data-testid="tags-form">Tags Form</div>);
});

const mockForm = {
  submit: jest.fn(),
  resetFields: jest.fn(),
  getFieldsValue: jest.fn(),
  setFieldsValue: jest.fn(),
  validateFields: jest.fn(),
} as unknown as FormInstance;

describe('TagFormDrawer', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  const defaultProps = {
    open: true,
    formRef: mockForm,
    isTier: false,
    isLoading: false,
    permissions: {
      createTags: true,
      editAll: true,
      editDescription: true,
      editDisplayName: true,
    },
    tagsFormHeader: 'Add Tag',
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render drawer when open is true', () => {
    render(<TagFormDrawer {...defaultProps} />);

    expect(screen.getByTestId('tag-form-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('form-heading')).toHaveTextContent('Add Tag');
  });

  it('should not render drawer when open is false', () => {
    render(<TagFormDrawer {...defaultProps} open={false} />);

    expect(screen.queryByTestId('tag-form-drawer')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(<TagFormDrawer {...defaultProps} />);

    const closeButton = screen.getByTestId('drawer-close-icon');

    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when cancel button is clicked', () => {
    render(<TagFormDrawer {...defaultProps} />);

    const cancelButton = screen.getByTestId('cancel-button');

    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should render TagsForm component', () => {
    render(<TagFormDrawer {...defaultProps} />);

    expect(screen.getByTestId('tags-form')).toBeInTheDocument();
  });

  it('should disable save button when isLoading is true', () => {
    render(<TagFormDrawer {...defaultProps} isLoading />);

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toBeDisabled();
  });

  it('should show "Saving" text when isLoading is true', () => {
    render(<TagFormDrawer {...defaultProps} isLoading />);

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toHaveTextContent('label.saving');
  });

  it('should show "Save" text when isLoading is false', () => {
    render(<TagFormDrawer {...defaultProps} />);

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toHaveTextContent('label.save');
  });
});
