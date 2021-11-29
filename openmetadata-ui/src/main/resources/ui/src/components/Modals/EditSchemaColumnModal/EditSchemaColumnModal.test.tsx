import { findByTestId, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { EditSchemaColumnModal } from './EditSchemaColumnModal';

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

describe('Test EditSchemaColumnModal Component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <EditSchemaColumnModal
        description="Test Description"
        header="Test"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const modal = await findByTestId(container, 'edit-schema');

    expect(modal).toBeInTheDocument();
  });

  it('modal should have header & description as provided', async () => {
    const { container } = render(
      <EditSchemaColumnModal
        description="Test Description"
        header="Test"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const header = await findByTestId(container, 'header');
    const description = await findByTestId(container, 'column-description');

    expect(header.textContent).toBe('Test');
    expect(description.textContent).toBe('Test Description');
  });

  it('Description box sholud be editable', async () => {
    const { container } = render(
      <EditSchemaColumnModal
        description="Test Description"
        header="Test"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const description = await findByTestId(container, 'column-description');

    fireEvent.change(description, {
      target: { value: 'test' },
    });

    expect(description).toHaveValue('test');
  });

  it('on click of cancel button, onCancel callback should call', async () => {
    const { container } = render(
      <EditSchemaColumnModal
        description="Test Description"
        header="Test"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const cancel = await findByTestId(container, 'cancel');

    fireEvent.click(cancel);

    expect(mockOnCancel).toBeCalledTimes(1);
  });

  it('on click of save button, onSave callback should call', async () => {
    const { container } = render(
      <EditSchemaColumnModal
        description="Test Description"
        header="Test"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const save = await findByTestId(container, 'save');

    fireEvent.click(save);

    expect(mockOnSave).toBeCalledTimes(1);
  });
});
