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
import GlossaryLeftPanel from './GlossaryLeftPanel.component';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
  }),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));
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

jest.mock('../../../components/common/LeftPanelCard/LeftPanelCard', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="glossary-left-panel-container">{children}</div>
    ));
});

describe('Test GlossaryLeftPanel component', () => {
  it('GlossaryLeftPanel Page Should render', async () => {
    act(() => {
      render(<GlossaryLeftPanel glossaries={mockedGlossaries} />);
    });

    expect(
      await screen.findByTestId('glossary-left-panel-container')
    ).toBeInTheDocument();
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

  it('Menu click should work properly', async () => {
    act(() => {
      render(<GlossaryLeftPanel glossaries={mockedGlossaries} />);
    });

    const menuItem = await screen.findByText(mockedGlossaries[0].displayName);

    expect(menuItem).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(menuItem);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
