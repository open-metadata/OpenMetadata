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
import ClassificationFormDrawer from './ClassificationFormDrawer';

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

describe('ClassificationFormDrawer', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  const defaultProps = {
    open: true,
    formRef: mockForm,
    classifications: [],
    isTier: false,
    isLoading: false,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render drawer when open is true', () => {
    render(<ClassificationFormDrawer {...defaultProps} />);

    expect(
      screen.getByTestId('classification-form-drawer')
    ).toBeInTheDocument();
    expect(screen.getByTestId('form-heading')).toHaveTextContent(
      'label.adding-new-classification'
    );
  });

  it('should not render drawer when open is false', () => {
    render(<ClassificationFormDrawer {...defaultProps} open={false} />);

    expect(
      screen.queryByTestId('classification-form-drawer')
    ).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(<ClassificationFormDrawer {...defaultProps} />);

    const closeButton = screen.getByTestId('drawer-close-icon');

    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when cancel button is clicked', () => {
    render(<ClassificationFormDrawer {...defaultProps} />);

    const cancelButton = screen.getByTestId('cancel-button');

    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should render TagsForm component', () => {
    render(<ClassificationFormDrawer {...defaultProps} />);

    expect(screen.getByTestId('tags-form')).toBeInTheDocument();
  });

  it('should disable save button when isLoading is true', () => {
    render(<ClassificationFormDrawer {...defaultProps} isLoading />);

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toBeDisabled();
  });

  it('should keep "Save" text visible when isLoading is true', () => {
    render(<ClassificationFormDrawer {...defaultProps} isLoading />);

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toHaveTextContent('label.save');
  });

  it('should show "Save" text when isLoading is false', () => {
    render(<ClassificationFormDrawer {...defaultProps} />);

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toHaveTextContent('label.save');
  });
});
