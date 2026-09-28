/*
 *  Copyright 2023 Collate.
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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { mockedGlossaries } from '../../../mocks/Glossary.mock';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import GlossaryLeftPanel from './GlossaryLeftPanel.component';

const mockNavigate = jest.fn();
let mockFqn = '';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
  }),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: mockFqn })),
}));

const glossaries = [
  {
    ...mockedGlossaries[0],
    id: 'first-glossary-id',
    name: 'FirstGlossary',
    displayName: 'First Glossary',
    fullyQualifiedName: 'FirstGlossary',
  },
  {
    ...mockedGlossaries[0],
    id: 'second-glossary-id',
    name: 'SecondGlossary',
    displayName: 'Second Glossary',
    fullyQualifiedName: 'SecondGlossary',
  },
];
jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
    permissions: {
      glossaryTerm: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      glossary: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
    },
  }),
}));

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

describe('Test GlossaryLeftPanel component', () => {
  it('GlossaryLeftPanel Page Should render', async () => {
    act(() => {
      render(<GlossaryLeftPanel glossaries={mockedGlossaries} />);
    });

    expect(await screen.findByTestId('add-glossary')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-left-panel')
    ).toBeInTheDocument();
    expect(
      await screen.findByText(mockedGlossaries[0].displayName)
    ).toBeInTheDocument();
  });

  it('Add Glossary button should work properly', async () => {
    act(() => {
      render(<GlossaryLeftPanel glossaries={mockedGlossaries} />);
    });

    const addButton = await screen.findByTestId('add-glossary');

    expect(addButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('should render each glossary as a link to its page', async () => {
    render(<GlossaryLeftPanel glossaries={glossaries} />);

    const link = await screen.findByRole('link', {
      name: glossaries[1].displayName,
    });

    expect(link).toHaveAttribute(
      'href',
      getGlossaryPath(glossaries[1].fullyQualifiedName)
    );
  });

  it('should mark the first glossary as current when no fqn is in the url', async () => {
    mockFqn = '';
    render(<GlossaryLeftPanel glossaries={glossaries} />);

    expect(
      await screen.findByRole('link', { name: glossaries[0].displayName })
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('link', { name: glossaries[1].displayName })
    ).not.toHaveAttribute('aria-current');
  });

  it('should mark the owning glossary as current for a nested term fqn', async () => {
    mockFqn = `${glossaries[1].fullyQualifiedName}.Term`;
    render(<GlossaryLeftPanel glossaries={glossaries} />);

    expect(
      await screen.findByRole('link', { name: glossaries[1].displayName })
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('link', { name: glossaries[0].displayName })
    ).not.toHaveAttribute('aria-current');

    mockFqn = '';
  });
});
