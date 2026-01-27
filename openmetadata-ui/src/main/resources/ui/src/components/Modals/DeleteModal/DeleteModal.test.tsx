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
import DeleteModal from './DeleteModal';
import { DeleteModalProps } from './DeleteModal.interface';

const mockOnCancel = jest.fn();
const mockOnConfirm = jest.fn();

const defaultProps: DeleteModalProps = {
  open: true,
  entityName: 'Test Entity',
  entityType: 'Recognizer',
  isDeleting: false,
  onCancel: mockOnCancel,
  onConfirm: mockOnConfirm,
};

describe('DeleteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal when open is true', () => {
    render(<DeleteModal {...defaultProps} />);

    expect(screen.getByTestId('modal-header')).toBeInTheDocument();
    expect(screen.getByTestId('modal-body')).toBeInTheDocument();
    expect(screen.getByTestId('delete-icon-container')).toBeInTheDocument();
  });

  it('should display the entity name in the title', () => {
    render(<DeleteModal {...defaultProps} />);

    expect(screen.getByTestId('modal-header')).toHaveTextContent('Test Entity');
  });

  it('should display the entity type in the confirmation message', () => {
    render(<DeleteModal {...defaultProps} />);

    expect(screen.getByTestId('modal-body')).toHaveTextContent(
      'message.are-you-sure-you-want-to-delete-this-entity'
    );
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(<DeleteModal {...defaultProps} />);

    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when delete button is clicked', () => {
    render(<DeleteModal {...defaultProps} />);

    const confirmButton = screen.getByTestId('confirm-button');
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should disable buttons when isDeleting is true', () => {
    render(<DeleteModal {...defaultProps} isDeleting />);

    const cancelButton = screen.getByTestId('cancel-button');
    const confirmButton = screen.getByTestId('confirm-button');

    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
  });

  it('should show loading indicator when isDeleting is true', () => {
    render(<DeleteModal {...defaultProps} isDeleting />);

    const confirmButton = screen.getByTestId('confirm-button');

    expect(
      confirmButton.querySelector('.MuiCircularProgress-root')
    ).toBeInTheDocument();
  });

  it('should not call onCancel when clicking cancel while deleting', () => {
    render(<DeleteModal {...defaultProps} isDeleting />);

    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('should not render when open is false', () => {
    render(<DeleteModal {...defaultProps} open={false} />);

    expect(screen.queryByTestId('modal-header')).not.toBeInTheDocument();
  });

  it('should fallback to entityType when entityName is empty', () => {
    render(<DeleteModal {...defaultProps} entityName="" />);

    expect(screen.getByTestId('modal-header')).toHaveTextContent('Recognizer');
  });
});
