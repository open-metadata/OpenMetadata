import { findByTestId, fireEvent, render } from '@testing-library/react';
import React from 'react';
import ConfirmationModal from './ConfirmationModal';

const mockConfirmation = jest.fn();
const mockCancel = jest.fn();

describe('Test Ingestion modal component', () => {
  it('Component Should render', async () => {
    const { container } = render(
      <ConfirmationModal
        bodyText="Are you sure?"
        cancelText="Cancel"
        confirmText="Save"
        header="confirmation modal"
        onCancel={mockCancel}
        onConfirm={mockConfirmation}
      />
    );

    const confirmationModal = await findByTestId(
      container,
      'confirmation-modal'
    );
    const header = await findByTestId(container, 'modal-header');
    const bodyText = await findByTestId(container, 'body-text');
    const cancel = await findByTestId(container, 'cancel');
    const save = await findByTestId(container, 'save-button');

    expect(confirmationModal).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(header.textContent).toStrictEqual('confirmation modal');
    expect(bodyText).toBeInTheDocument();
    expect(bodyText.textContent).toStrictEqual('Are you sure?');
    expect(cancel).toBeInTheDocument();
    expect(cancel.textContent).toStrictEqual('Cancel');
    expect(save).toBeInTheDocument();
    expect(save.textContent).toStrictEqual('Save');

    fireEvent.click(cancel);

    expect(mockCancel).toBeCalled();

    fireEvent.click(save);

    expect(mockConfirmation).toBeCalled();
  });
});
