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

import { findByText, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { getQuotedGlossaryName } from 'utils/GlossaryUtils';
import { getGlossaryPath } from '../../utils/RouterUtils';
import AddGlossaryTermPage from './AddGlossaryTermPage.component';

const mockRedirect = jest.fn((fqn) => fqn);

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useHistory: () => ({
    push: jest.fn(),
  }),
  useParams: jest.fn().mockImplementation(() => ({
    glossaryName: 'GlossaryName',
    glossaryTermsFQN: '',
  })),
}));

jest.mock('components/AddGlossaryTerm/AddGlossaryTerm.component', () => {
  return jest.fn().mockImplementation(({ onCancel, onSave }) => (
    <div
      data-testid="add-glossary-term"
      onClick={onCancel}
      onMouseDown={onSave}>
      AddGlossaryTerm.component
    </div>
  ));
});

jest.mock('../../utils/RouterUtils', () => ({
  getGlossaryPath: jest.fn(),
}));

jest.mock('rest/glossaryAPI', () => ({
  addGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
  getGlossariesByName: jest.fn().mockImplementation(() => Promise.resolve()),
  getGlossaryTermByFQN: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('utils/GlossaryUtils', () => ({
  getQuotedGlossaryName: jest.fn().mockReturnValue('"GlossaryName"'),
}));

describe('Test AddGlossaryTerm component page', () => {
  it('AddGlossaryTerm component page should render', async () => {
    const { container } = render(<AddGlossaryTermPage />);

    const addGlossaryTerm = await findByText(
      container,
      /AddGlossaryTerm.component/i
    );

    expect(addGlossaryTerm).toBeInTheDocument();
  });

  it('Redirect to Glossary on cancel', async () => {
    (getGlossaryPath as jest.Mock).mockImplementation(mockRedirect);
    (getQuotedGlossaryName as jest.Mock).mockImplementationOnce(mockRedirect);
    const { findByTestId } = render(<AddGlossaryTermPage />);

    const addGlossaryTerm = await findByTestId('add-glossary-term');

    fireEvent.click(
      addGlossaryTerm,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(mockRedirect).toHaveBeenCalledWith('GlossaryName');
  });
});
