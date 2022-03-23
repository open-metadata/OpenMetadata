import { fireEvent, getByTestId, render } from '@testing-library/react';
import { LoadingState } from 'Models';
import React from 'react';
import AddGlossary from './AddGlossary.component';

jest.mock('../../auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock('../../axiosAPIs/glossaryAPI', () => ({
  addGlossaries: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const mockProps = {
  header: 'Header',
  allowAccess: true,
  saveState: 'initial' as LoadingState,
  onCancel: mockOnCancel,
  onSave: mockOnSave,
};

describe('Test AddGlossary component', () => {
  it('AddGlossary component should render', async () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const addGlossaryForm = await getByTestId(container, 'add-glossary');

    expect(addGlossaryForm).toBeInTheDocument();
  });

  it('should be able to cancel', async () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const cancelButton = await getByTestId(container, 'cancel-glossary');

    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(
      cancelButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnCancel).toBeCalled();
  });

  it('should be able to save', async () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const nameInput = await getByTestId(container, 'name');
    const saveButton = await getByTestId(container, 'save-glossary');

    expect(saveButton).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Test Glossary' } });

    fireEvent.click(
      saveButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnSave).toBeCalled();
  });
});
