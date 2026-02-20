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

import { ThemeProvider } from '@mui/material/styles';
import { createMuiTheme } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormInstance } from 'antd';
import TagFormDrawer from './TagFormDrawer';

const theme = createMuiTheme();

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
    render(
      <ThemeProvider theme={theme}>
        <TagFormDrawer {...defaultProps} />
      </ThemeProvider>
    );

    expect(screen.getByTestId('tag-form-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('form-heading')).toHaveTextContent('Add Tag');
  });

  it('should not render drawer when open is false', () => {
    render(
      <ThemeProvider theme={theme}>
        <TagFormDrawer {...defaultProps} open={false} />
      </ThemeProvider>
    );

    expect(screen.queryByTestId('tag-form-drawer')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <TagFormDrawer {...defaultProps} />
      </ThemeProvider>
    );

    const closeButton = screen.getByTestId('drawer-close-icon');

    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when cancel button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <TagFormDrawer {...defaultProps} />
      </ThemeProvider>
    );

    const cancelButton = screen.getByTestId('cancel-button');

    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should render TagsForm component', () => {
    render(
      <ThemeProvider theme={theme}>
        <TagFormDrawer {...defaultProps} />
      </ThemeProvider>
    );

    expect(screen.getByTestId('tags-form')).toBeInTheDocument();
  });

  it('should apply disabled attribute to save button when isLoading is true', () => {
    render(
      <ThemeProvider theme={theme}>
        <TagFormDrawer {...defaultProps} isLoading />
      </ThemeProvider>
    );

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toBeDisabled();
  });

  it('should display "Save" text in save button when isLoading is false', () => {
    render(
      <ThemeProvider theme={theme}>
        <TagFormDrawer {...defaultProps} />
      </ThemeProvider>
    );

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toHaveTextContent('label.save');
  });
});
