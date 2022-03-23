import { fireEvent, getByTestId, render } from '@testing-library/react';
import { LoadingState } from 'Models';
import React from 'react';
import {
  mockedGlossaries,
  mockedGlossaryTerms,
} from '../../mocks/Glossary.mock';
import AddGlossaryTerm from './AddGlossaryTerm.component';

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
  allowAccess: true,
  glossaryData: mockedGlossaries[0],
  parentGlossaryData: mockedGlossaryTerms[0],
  saveState: 'initial' as LoadingState,
  onCancel: mockOnCancel,
  onSave: mockOnSave,
};

describe('Test AddGlossaryTerm component', () => {
  it('AddGlossaryTerm component should render', async () => {
    const { container } = render(<AddGlossaryTerm {...mockProps} />);

    const addGlossaryTermForm = await getByTestId(
      container,
      'add-glossary-term'
    );

    expect(addGlossaryTermForm).toBeInTheDocument();
  });

  it('should be able to cancel', async () => {
    const { container } = render(<AddGlossaryTerm {...mockProps} />);

    const cancelButton = await getByTestId(container, 'cancel-glossary-term');

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
    const { container } = render(<AddGlossaryTerm {...mockProps} />);

    const nameInput = await getByTestId(container, 'name');
    const saveButton = await getByTestId(container, 'save-glossary-term');

    expect(saveButton).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Test Glossary Term' } });

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
