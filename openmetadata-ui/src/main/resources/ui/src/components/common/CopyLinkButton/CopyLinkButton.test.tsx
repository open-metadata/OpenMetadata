/*
 *  Copyright 2024 Collate.
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
import { EntityType } from '../../../enums/entity.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import CopyLinkButton from './CopyLinkButton';

jest.mock('../../../hooks/useClipBoard', () => ({
  useClipboard: jest.fn(),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn((entityType: EntityType, fqn: string) => {
    return `/${entityType.toLowerCase()}/${fqn}`;
  }),
}));

const mockOnCopyToClipBoard = jest.fn();

describe('CopyLinkButton', () => {
  const defaultProps = {
    entityType: EntityType.TABLE,
    fieldFqn: 'test.database.schema.table.column1',
    testId: 'copy-column-link-button',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useClipboard as jest.Mock).mockReturnValue({
      onCopyToClipBoard: mockOnCopyToClipBoard,
      hasCopied: false,
    });
    (getEntityDetailsPath as jest.Mock).mockImplementation(
      (entityType: EntityType, fqn: string) => {
        return `/${entityType.toLowerCase()}/${fqn}`;
      }
    );
  });

  it('should render the copy button', () => {
    render(<CopyLinkButton {...defaultProps} />);

    expect(screen.getByTestId('copy-column-link-button')).toBeInTheDocument();
  });

  it('should render with default test id when not provided', () => {
    const { testId: _testId, ...propsWithoutTestId } = defaultProps;

    render(<CopyLinkButton {...propsWithoutTestId} />);

    expect(screen.getByTestId('copy-field-link-button')).toBeInTheDocument();
  });

  it('should display copy URL tooltip before clicking', () => {
    render(<CopyLinkButton {...defaultProps} />);

    const button = screen.getByTestId('copy-column-link-button');

    expect(button).toBeInTheDocument();
  });

  it('should call copyEntityLink with field FQN when clicked', async () => {
    render(<CopyLinkButton {...defaultProps} />);

    const button = screen.getByTestId('copy-column-link-button');
    fireEvent.click(button);

    await waitFor(() => {
      const expectedLink = `${window.location.origin}/table/${defaultProps.fieldFqn}`;

      expect(mockOnCopyToClipBoard).toHaveBeenCalledWith(expectedLink);
    });
  });

  it('should display copied message after copying', () => {
    (useClipboard as jest.Mock).mockReturnValue({
      onCopyToClipBoard: mockOnCopyToClipBoard,
      hasCopied: true,
    });

    render(<CopyLinkButton {...defaultProps} />);

    const button = screen.getByTestId('copy-column-link-button');

    expect(button).toBeInTheDocument();
  });

  it('should be disabled when fieldFqn is empty', () => {
    render(<CopyLinkButton {...defaultProps} fieldFqn="" />);

    const button = screen.getByTestId('copy-column-link-button');

    expect(button).toBeDisabled();
  });

  it('should not call copyEntityLink when fieldFqn is empty', () => {
    render(<CopyLinkButton {...defaultProps} fieldFqn="" />);

    const button = screen.getByTestId('copy-column-link-button');
    fireEvent.click(button);

    expect(mockOnCopyToClipBoard).not.toHaveBeenCalled();
  });

  it('should apply correct button styles', () => {
    render(<CopyLinkButton {...defaultProps} />);

    const button = screen.getByTestId('copy-column-link-button');

    expect(button).toHaveStyle({
      padding: '0',
      width: '24px',
      height: '24px',
    });
  });

  it('should have correct CSS classes', () => {
    render(<CopyLinkButton {...defaultProps} />);

    const button = screen.getByTestId('copy-column-link-button');

    expect(button).toHaveClass(
      'cursor-pointer',
      'hover-cell-icon',
      'flex-center'
    );
  });
});
