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

import { render, screen } from '@testing-library/react';
import { Query } from 'generated/entity/data/query';
import { MOCK_PERMISSIONS } from 'mocks/Glossary.mock';
import { MOCK_QUERIES } from 'mocks/Queries.mock';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import TableQueryRightPanel from './TableQueryRightPanel.component';
import { TableQueryRightPanelProps } from './TableQueryRightPanel.interface';

const mockProps: TableQueryRightPanelProps = {
  query: MOCK_QUERIES[0] as Query,
  isLoading: false,
  permission: MOCK_PERMISSIONS,
  onQueryUpdate: jest.fn(),
};

jest.mock(
  'components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest
      .fn()
      .mockImplementation(() => <div>UserTeamSelectableList</div>),
  })
);
jest.mock('components/common/description/Description', () => {
  return jest.fn().mockImplementation(() => <div>Description.component</div>);
});
jest.mock('components/TagsInput/TagsInput.component', () => {
  return jest.fn().mockImplementation(() => <div>TagsInput.component</div>);
});
jest.mock('components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});
jest.mock('utils/TagsUtils', () => ({
  fetchTagsAndGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
}));

describe('TableQueryRightPanel component test', () => {
  it('Component should render', async () => {
    render(<TableQueryRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });
    const owner = await screen.findByTestId('owner-name');

    expect(
      await screen.findByTestId('owner-name-container')
    ).toBeInTheDocument();
    expect(owner).toBeInTheDocument();
    expect(owner.textContent).toEqual(MOCK_QUERIES[0].owner?.displayName);
    expect(
      await screen.findByTestId('edit-description-btn')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Description.component')
    ).toBeInTheDocument();
    expect(await screen.findByText('TagsInput.component')).toBeInTheDocument();
  });

  it('If no permission is granted, editing of the Owner, Description, and tags should be disabled.', async () => {
    render(
      <TableQueryRightPanel
        {...mockProps}
        permission={DEFAULT_ENTITY_PERMISSION}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const editDescriptionBtn = screen.queryByTestId('edit-description-btn');

    expect(editDescriptionBtn).not.toBeInTheDocument();
  });

  it('If Edit All permission is granted, editing of the Owner, Description, and tags should not be disabled.', async () => {
    render(<TableQueryRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const editDescriptionBtn = await screen.findByTestId(
      'edit-description-btn'
    );

    expect(editDescriptionBtn).not.toBeDisabled();
  });

  it('Loader should visible', async () => {
    render(<TableQueryRightPanel {...mockProps} isLoading />, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByText('Loader')).toBeInTheDocument();
  });
});
