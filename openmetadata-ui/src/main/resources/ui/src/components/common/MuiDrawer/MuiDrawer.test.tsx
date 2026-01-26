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
import MuiDrawer from './MuiDrawer';

const mockOnClose = jest.fn();
const mockFormSubmit = jest.fn();
const mockFormRef = {
  submit: mockFormSubmit,
} as unknown as FormInstance;

const theme = createMuiTheme();

describe('MuiDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    title: 'Test Drawer',
    children: <div>Drawer Content</div>,
  };

  it('should render the drawer with title and content', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} />
      </ThemeProvider>
    );

    expect(screen.getByText('Test Drawer')).toBeInTheDocument();
    expect(screen.getByText('Drawer Content')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} />
      </ThemeProvider>
    );

    const closeButton = screen.getAllByRole('button')[0];
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should render footer buttons when formRef is provided', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} formRef={mockFormRef} />
      </ThemeProvider>
    );

    expect(screen.getByText('label.cancel')).toBeInTheDocument();
    expect(screen.getByText('label.create')).toBeInTheDocument();
  });

  it('should call form submit when create button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} formRef={mockFormRef} />
      </ThemeProvider>
    );

    const createButton = screen.getByText('label.create');
    fireEvent.click(createButton);

    expect(mockFormSubmit).toHaveBeenCalled();
  });

  it('should call onClose when cancel button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} formRef={mockFormRef} />
      </ThemeProvider>
    );

    const cancelButton = screen.getByText('label.cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show side panel toggle when hasSidePanel is true', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer
          {...defaultProps}
          hasSidePanel
          sidePanel={<div>Side Panel Content</div>}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('label.show-help-text')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('should show side panel content when toggle is switched on', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer
          {...defaultProps}
          hasSidePanel
          sidePanel={<div>Side Panel Content</div>}
        />
      </ThemeProvider>
    );

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(screen.getByText('Side Panel Content')).toBeInTheDocument();
  });

  it('should disable create button when isLoading is true', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} isLoading formRef={mockFormRef} />
      </ThemeProvider>
    );

    const createButton = screen.getByTestId('create-button');

    expect(createButton).toBeDisabled();
  });

  it('should disable create button when isFormInvalid is true', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} isFormInvalid formRef={mockFormRef} />
      </ThemeProvider>
    );

    const createButton = screen.getByTestId('create-button');

    expect(createButton).toBeDisabled();
  });

  it('should not render footer when formRef is not provided', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} />
      </ThemeProvider>
    );

    expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('create-button')).not.toBeInTheDocument();
  });

  it('should render custom submit button label', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer
          {...defaultProps}
          formRef={mockFormRef}
          submitBtnLabel="Save Changes"
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('should render custom cancel button label', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer
          {...defaultProps}
          cancelBtnLabel="Discard"
          formRef={mockFormRef}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Discard')).toBeInTheDocument();
  });

  it('should render header widget when provided', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer
          {...defaultProps}
          headerWidget={<span data-testid="header-widget">Widget</span>}
        />
      </ThemeProvider>
    );

    expect(screen.getByTestId('header-widget')).toBeInTheDocument();
  });

  it('should not show side panel when hasSidePanel is false', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} hasSidePanel={false} />
      </ThemeProvider>
    );

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText('label.show-help-text')).not.toBeInTheDocument();
  });

  it('should hide side panel content when toggle is switched off', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer
          {...defaultProps}
          hasSidePanel
          sidePanel={<div>Side Panel Content</div>}
        />
      </ThemeProvider>
    );

    expect(screen.queryByText('Side Panel Content')).not.toBeInTheDocument();

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(screen.getByText('Side Panel Content')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.queryByText('Side Panel Content')).not.toBeInTheDocument();
  });

  it('should disable cancel button when isLoading is true', () => {
    render(
      <ThemeProvider theme={theme}>
        <MuiDrawer {...defaultProps} isLoading formRef={mockFormRef} />
      </ThemeProvider>
    );

    const cancelButton = screen.getByTestId('cancel-button');

    expect(cancelButton).toBeDisabled();
  });
});
