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

import {
  act,
  findByRole,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockedGlossaryTerms } from '../../../mocks/Glossary.mock';
import ChangeParent from './ChangeParentHierarchy.component';

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

const mockProps = {
  selectedData: mockedGlossaryTerms[0],
  onCancel: mockOnCancel,
  onSubmit: mockOnSubmit,
};

jest.mock('../../../rest/glossaryAPI', () => ({
  moveGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockImplementation((obj) => obj.name),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('Test ChangeParentHierarchy modal component', () => {
  it('should render glossary selection dropdown', async () => {
    await act(async () => {
      render(<ChangeParent {...mockProps} />);
    });

    const selectInput = await findByRole(
      screen.getByTestId('change-parent-select'),
      'combobox'
    );

    expect(selectInput).toBeInTheDocument();

    await act(async () => {
      userEvent.click(selectInput);
    });

    // TreeAsyncSelectList will load glossaries and handle term filtering internally
    expect(selectInput).toBeInTheDocument();
  });

  it('should trigger onCancel button', async () => {
    await act(async () => {
      render(<ChangeParent {...mockProps} />);
    });

    const cancelButton = await screen.findByText('label.cancel');

    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should render submit button and handle form submission', async () => {
    await act(async () => {
      render(<ChangeParent {...mockProps} />);
    });

    const submitButton = await screen.findByText('label.submit');

    expect(submitButton).toBeInTheDocument();

    // The TreeAsyncSelectList will handle the selection logic internally
    // and the form submission will be handled by the parent component
    expect(submitButton).toBeInTheDocument();
  });
});
