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

jest.mock('@openmetadata/ui-core-components', () => ({
  SlideoutMenu: Object.assign(
    ({
      isOpen,
      onOpenChange,
      children,
      'data-testid': testId,
    }: {
      isOpen: boolean;
      onOpenChange?: (isOpen: boolean) => void;
      children: (arg: { close: () => void }) => React.ReactNode;
      'data-testid'?: string;
    }) => {
      if (!isOpen) {
        return null;
      }

      const close = () => onOpenChange?.(false);

      return <div data-testid={testId}>{children({ close })}</div>;
    },
    {
      Header: ({
        children,
        onClose,
        'data-testid': testId,
      }: {
        children: React.ReactNode;
        onClose?: () => void;
        'data-testid'?: string;
      }) => (
        <div data-testid={testId}>
          {children}
          <button data-testid="drawer-close-icon" onClick={onClose} />
        </div>
      ),
      Content: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Footer: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
    }
  ),
  Button: ({
    children,
    onClick,
    isDisabled,
    isLoading,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    isDisabled?: boolean;
    isLoading?: boolean;
    'data-testid'?: string;
  }) => (
    <button
      data-testid={testId}
      disabled={isDisabled || isLoading}
      onClick={onClick}>
      {children}
    </button>
  ),
  Typography: ({
    children,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={testId}>{children}</div>,
}));

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
    expect(screen.getByTestId('drawer-heading')).toHaveTextContent(
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
