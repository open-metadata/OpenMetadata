/*
 *  Copyright 2021 Collate
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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import { LoadingState } from 'Models';
import React from 'react';
import AddGlossary from './AddGlossary.component';

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
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

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('../common/rich-text-editor/RichTextEditor', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditor</p>);
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
  it('AddGlossary component should render', () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const addGlossaryForm = getByTestId(container, 'add-glossary');

    expect(addGlossaryForm).toBeInTheDocument();
  });

  it('should be able to cancel', () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const cancelButton = getByTestId(container, 'cancel-glossary');

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

  it('should be able to save', () => {
    const { container } = render(<AddGlossary {...mockProps} />);

    const nameInput = getByTestId(container, 'name');
    const saveButton = getByTestId(container, 'save-glossary');

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
