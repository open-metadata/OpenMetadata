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
import { Query } from 'generated/entity/data/query';
import { MOCK_QUERIES } from 'mocks/Queries.mock';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { fetchTagsAndGlossaryTerms } from 'utils/TagsUtils';
import TableQueryRightPanel from './TableQueryRightPanel.component';
import { TableQueryRightPanelProps } from './TableQueryRightPanel.interface';

const mockProps: TableQueryRightPanelProps = {
  query: MOCK_QUERIES[0] as Query,
  isLoading: false,
  permission: DEFAULT_ENTITY_PERMISSION,
  onQueryUpdate: jest.fn(),
};

jest.mock('components/Tag/TagsViewer/tags-viewer', () => {
  return jest.fn().mockImplementation(() => <div>TagsViewer.component</div>);
});
jest.mock('components/Tag/TagsContainer/tags-container', () => {
  return jest.fn().mockImplementation(() => <div>TagsContainer.component</div>);
});
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
    expect(await screen.findByTestId('tag-container')).toBeInTheDocument();
    expect(await screen.findByText('TagsViewer.component')).toBeInTheDocument();
  });

  it('If no permission is granted, editing of the Owner, Description, and tags should be disabled.', async () => {
    render(<TableQueryRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const editDescriptionBtn = await screen.findByTestId(
      'edit-description-btn'
    );
    const tagEditor = screen.queryByText('TagsContainer.component');

    expect(editDescriptionBtn).toBeDisabled();
    expect(tagEditor).not.toBeInTheDocument();
  });

  it('If Edit All permission is granted, editing of the Owner, Description, and tags should not be disabled.', async () => {
    render(
      <TableQueryRightPanel
        {...mockProps}
        permission={{ ...DEFAULT_ENTITY_PERMISSION, EditAll: true }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const editDescriptionBtn = await screen.findByTestId(
      'edit-description-btn'
    );
    const tagEditor = await screen.findByText('TagsContainer.component');

    expect(editDescriptionBtn).not.toBeDisabled();
    expect(tagEditor).toBeInTheDocument();
  });

  it('Loader should visible', async () => {
    render(<TableQueryRightPanel {...mockProps} isLoading />, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByText('Loader')).toBeInTheDocument();
  });

  it('onClick of tag container it should fetch call tag and glossaryTerm API', async () => {
    const mockFetchTagsAndGlossaryTerms =
      fetchTagsAndGlossaryTerms as jest.Mock;

    render(
      <TableQueryRightPanel
        {...mockProps}
        permission={{ ...DEFAULT_ENTITY_PERMISSION, EditTags: true }}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const tagsContainer = await screen.findByTestId('tags-wrapper');

    expect(tagsContainer).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(tagsContainer);
    });

    expect(mockFetchTagsAndGlossaryTerms.mock.calls).toHaveLength(1);
  });
});
