/*
 *  Copyright 2022 Collate.
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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_TABLE_DATA } from '../../mocks/Teams.mock';
import AddTestSuiteForm from './AddTestSuiteForm';

const mockOnSubmit = jest.fn();

jest.mock('rest/testAPI', () => ({
  getListTestSuites: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE_DATA)),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
  })),
}));

jest.mock('components/common/rich-text-editor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<>RichTextEditor</>)
);

jest.mock('components/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div>Loader</div>);
});

describe('Test Suite Form Page', () => {
  it('Component should render form', async () => {
    await act(async () => {
      render(<AddTestSuiteForm onSubmit={mockOnSubmit} />, {
        wrapper: MemoryRouter,
      });
    });

    const form = await screen.findByTestId('test-suite-form');
    const saveButton = await screen.findByTestId('submit-button');
    const cancelButton = await screen.findByTestId('cancel-button');

    expect(form).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
  });

  it('Component should render form input fields', async () => {
    await act(async () => {
      render(<AddTestSuiteForm onSubmit={mockOnSubmit} />, {
        wrapper: MemoryRouter,
      });
    });

    const form = await screen.findByTestId('test-suite-form');
    const nameField = await screen.findByTestId('test-suite-name');
    const descriptionField = await screen.findByText('RichTextEditor');

    expect(form).toBeInTheDocument();
    expect(nameField).toBeInTheDocument();
    expect(descriptionField).toBeInTheDocument();
  });
});
