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
import { mockedGlossaries } from '../../mocks/Glossary.mock';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import GlossaryDetails from './GlossaryDetails.component';

jest.mock(
  'components/Glossary/GlossaryTermTab/GlossaryTermTab.component',
  () => {
    return jest.fn().mockReturnValue(<p>GlossaryTermTab.component</p>);
  }
);
jest.mock('components/Glossary/GlossaryHeader/GlossaryHeader.component', () => {
  return jest.fn().mockReturnValue(<p>GlossaryHeader.component</p>);
});
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
    )),
  useParams: jest.fn().mockImplementation(() => ({
    glossaryName: 'GlossaryName',
  })),
}));

const mockProps = {
  glossary: mockedGlossaries[0],
  glossaryTerms: [],
  permissions: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  } as OperationPermission,
  updateGlossary: jest.fn(),
};

describe('Test Glossary-details component', () => {
  it('Should render Glossary-details component', async () => {
    await act(async () => {
      render(<GlossaryDetails {...mockProps} />);
    });

    const glossaryDetails = screen.getByTestId('glossary-details');
    const headerComponent = await screen.findByText('GlossaryHeader.component');

    expect(headerComponent).toBeInTheDocument();
    expect(glossaryDetails).toBeInTheDocument();
    expect(
      await screen.findByText('GlossaryTermTab.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('GlossaryHeader.component')
    ).toBeInTheDocument();
  });
});
