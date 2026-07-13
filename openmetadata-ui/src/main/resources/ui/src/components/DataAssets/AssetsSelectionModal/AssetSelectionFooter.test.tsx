/*
 *  Copyright 2026 Collate.
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
import AssetSelectionFooter, {
  AssetSelectionFooterProps,
} from './AssetSelectionFooter';

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={testId}>{children}</div>,
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
      data-loading={isLoading ? 'true' : 'false'}
      data-testid={testId}
      disabled={isDisabled}
      onClick={onClick}>
      {children}
    </button>
  ),
  Divider: ({ 'data-testid': testId }: { 'data-testid'?: string }) => (
    <div data-testid={testId ?? 'divider'} />
  ),
  Typography: ({
    children,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={testId}>{children}</span>,
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const defaultProps: AssetSelectionFooterProps = {
  selectedCount: 0,
  errorCount: 0,
  isLoading: false,
  isSaveLoading: false,
  hasAssetJobResponse: false,
  onCancel: mockOnCancel,
  onSave: mockOnSave,
};

describe('AssetSelectionFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render selected count when selectedCount is 0', () => {
    render(<AssetSelectionFooter {...defaultProps} />);

    expect(
      screen.queryByText(/label.selected-lowercase/)
    ).not.toBeInTheDocument();
  });

  it('should render selected count when selectedCount is at least 1', () => {
    render(<AssetSelectionFooter {...defaultProps} selectedCount={3} />);

    expect(screen.getByText(/label.selected-lowercase/)).toBeInTheDocument();
  });

  it('should not render error count or divider when errorCount is 0', () => {
    render(<AssetSelectionFooter {...defaultProps} />);

    expect(screen.queryByText(/label.error/)).not.toBeInTheDocument();
  });

  it('should render error count and divider when errorCount is greater than 0', () => {
    render(<AssetSelectionFooter {...defaultProps} errorCount={2} />);

    expect(screen.getByText(/label.error/)).toBeInTheDocument();
  });

  it('should disable save button when selectedCount is 0', () => {
    render(<AssetSelectionFooter {...defaultProps} selectedCount={0} />);

    expect(screen.getByTestId('save-btn')).toBeDisabled();
  });

  it('should disable save button when isLoading is true', () => {
    render(
      <AssetSelectionFooter
        {...defaultProps}
        isLoading
        selectedCount={1}
      />
    );

    expect(screen.getByTestId('save-btn')).toBeDisabled();
  });

  it('should disable save button when isSaveLoading is true', () => {
    render(
      <AssetSelectionFooter
        {...defaultProps}
        isSaveLoading
        selectedCount={1}
      />
    );

    expect(screen.getByTestId('save-btn')).toBeDisabled();
  });

  it('should disable save button when hasAssetJobResponse is true', () => {
    render(
      <AssetSelectionFooter
        {...defaultProps}
        hasAssetJobResponse
        selectedCount={1}
      />
    );

    expect(screen.getByTestId('save-btn')).toBeDisabled();
  });

  it('should enable save button when selectedCount is at least 1 and nothing is loading', () => {
    render(<AssetSelectionFooter {...defaultProps} selectedCount={1} />);

    expect(screen.getByTestId('save-btn')).not.toBeDisabled();
  });

  it('should show loading state on save button when isSaveLoading is true', () => {
    render(
      <AssetSelectionFooter
        {...defaultProps}
        isSaveLoading
        selectedCount={1}
      />
    );

    expect(screen.getByTestId('save-btn')).toHaveAttribute(
      'data-loading',
      'true'
    );
  });

  it('should show loading state on save button when hasAssetJobResponse is true', () => {
    render(
      <AssetSelectionFooter
        {...defaultProps}
        hasAssetJobResponse
        selectedCount={1}
      />
    );

    expect(screen.getByTestId('save-btn')).toHaveAttribute(
      'data-loading',
      'true'
    );
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(<AssetSelectionFooter {...defaultProps} />);

    fireEvent.click(screen.getByTestId('cancel-btn'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onSave when save button is clicked and enabled', () => {
    render(<AssetSelectionFooter {...defaultProps} selectedCount={1} />);

    fireEvent.click(screen.getByTestId('save-btn'));

    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });
});
