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
import { useCopyEntityLink } from '../../../hooks/useCopyEntityLink';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import CopyLinkButton from './CopyLinkButton';

jest.mock('../../../hooks/useCopyEntityLink', () => ({
  useCopyEntityLink: jest.fn(),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(),
}));

const mockCopyEntityLink = jest.fn();

describe('CopyLinkButton', () => {
  const defaultProps = {
    entityType: EntityType.TABLE,
    fieldFqn: 'test.database.schema.table.column1',
    testId: 'copy-column-link-button',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useCopyEntityLink as jest.Mock).mockReturnValue({
      copyEntityLink: mockCopyEntityLink,
      copiedFqn: '',
    });
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { fullyQualifiedName: 'test.database.schema.table' },
    });
  });

  it('should render the copy button', () => {
    render(<CopyLinkButton {...defaultProps} />);

    expect(screen.getByTestId('copy-column-link-button')).toBeInTheDocument();
  });

  it('should render with default test id when not provided', () => {
    const { testId: _testId, ...propsWithoutTestId } = defaultProps;

    render(<CopyLinkButton {...propsWithoutTestId} />);

    expect(
      screen.getByTestId('copy-field-link-button')
    ).toBeInTheDocument();
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
      expect(mockCopyEntityLink).toHaveBeenCalledWith(defaultProps.fieldFqn);
    });
  });

  it('should display copied message after copying', () => {
    (useCopyEntityLink as jest.Mock).mockReturnValue({
      copyEntityLink: mockCopyEntityLink,
      copiedFqn: defaultProps.fieldFqn,
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

    expect(mockCopyEntityLink).not.toHaveBeenCalled();
  });

  it('should use entityFqn from context', () => {
    const contextFqn = 'context.entity.fqn';
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { fullyQualifiedName: contextFqn },
    });

    render(
      <CopyLinkButton
        entityType={EntityType.API_ENDPOINT}
        fieldFqn={defaultProps.fieldFqn}
      />
    );

    expect(useCopyEntityLink).toHaveBeenCalledWith(
      EntityType.API_ENDPOINT,
      contextFqn
    );
  });

  it('should use entityFqn from context when provided', () => {
    const contextFqn = 'context.entity.fqn';
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { fullyQualifiedName: contextFqn },
    });

    render(<CopyLinkButton {...defaultProps} />);

    expect(useCopyEntityLink).toHaveBeenCalledWith(
      EntityType.TABLE,
      contextFqn
    );
  });

  it('should handle undefined entityFqn from context', () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: null,
    });

    render(<CopyLinkButton {...defaultProps} />);

    expect(useCopyEntityLink).toHaveBeenCalledWith(
      EntityType.TABLE,
      undefined
    );
  });

  it('should handle different entity types correctly', () => {
    const contextFqn = 'test.database.schema.table';
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { fullyQualifiedName: contextFqn },
    });

    const entityTypes = [
      EntityType.TABLE,
      EntityType.TOPIC,
      EntityType.CONTAINER,
      EntityType.API_ENDPOINT,
      EntityType.SEARCH_INDEX,
    ];

    entityTypes.forEach((entityType) => {
      jest.clearAllMocks();

      render(
        <CopyLinkButton
          entityType={entityType}
          fieldFqn={defaultProps.fieldFqn}
        />
      );

      expect(useCopyEntityLink).toHaveBeenCalledWith(
        entityType,
        contextFqn
      );
    });
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

    expect(button).toHaveClass('cursor-pointer', 'hover-cell-icon', 'flex-center');
  });
});
