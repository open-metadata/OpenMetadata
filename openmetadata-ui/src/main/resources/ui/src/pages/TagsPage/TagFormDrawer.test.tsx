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
    expect(screen.getByTestId('drawer-heading')).toHaveTextContent('Add Tag');
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

  it('should apply disabled attribute to save button when isLoading is true', () => {
    render(<TagFormDrawer {...defaultProps} isLoading />);

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toBeDisabled();
  });

  it('should display "Save" text in save button when isLoading is false', () => {
    render(<TagFormDrawer {...defaultProps} />);

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toHaveTextContent('label.save');
  });
});
