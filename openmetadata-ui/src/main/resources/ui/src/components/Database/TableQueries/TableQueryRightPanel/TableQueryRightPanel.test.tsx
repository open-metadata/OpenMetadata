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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Query } from '../../../../generated/entity/data/query';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import { MOCK_QUERIES } from '../../../../mocks/Queries.mock';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import TableQueryRightPanel from './TableQueryRightPanel.component';
import { TableQueryRightPanelProps } from './TableQueryRightPanel.interface';

const mockQueryUpdate = jest.fn();
const mockProps: TableQueryRightPanelProps = {
  query: MOCK_QUERIES[0] as Query,
  isLoading: false,
  permission: MOCK_PERMISSIONS,
  onQueryUpdate: mockQueryUpdate,
};

const mockNewOwner = {
  id: '471353cb-f925-4c4e-be6c-14da2c0b00ce',
  type: 'user',
  name: 'new_owner',
  fullyQualifiedName: 'new_owner',
  displayName: 'New Owner',
  deleted: false,
  href: 'http://localhost:8585/api/v1/users/471353cb-f925-4c4e-be6c-14da2c0b00ce',
};

const mockNewTag = [
  {
    description: 'new-description',
    displayName: 'new-displayName',
    labelType: LabelType.Derived,
    name: 'test tag',
    source: TagSource.Glossary,
    state: State.Confirmed,
    tagFQN: 'test tag',
  },
];
jest.mock(
  '../../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest.fn().mockImplementation(({ onUpdate }) => (
      <div>
        UserTeamSelectableList
        <button
          data-testid="update-button"
          onClick={() => onUpdate(mockNewOwner)}>
          onUpdate button
        </button>
      </div>
    )),
  })
);
jest.mock('../../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(({ onDescriptionUpdate }) => (
    <div>
      Description.component
      <button
        data-testid="update-description-button"
        onClick={() => onDescriptionUpdate('new description')}
      />
    </div>
  ));
});
jest.mock('../../../TagsInput/TagsInput.component', () => {
  return jest.fn().mockImplementation(({ onTagsUpdate }) => (
    <div>
      TagsInput.component
      <button
        data-testid="update-tags-button"
        onClick={() => onTagsUpdate(mockNewTag)}>
        {' '}
        Update Tags
      </button>
    </div>
  ));
});
jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});
jest.mock('../../../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockImplementation(() => <>testProfilePicture</>);
});

describe('TableQueryRightPanel component test', () => {
  it('Component should render', async () => {
    render(<TableQueryRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });
    const owner = await screen.findByTestId('owner-link');

    expect(owner).toBeInTheDocument();
    expect(owner.textContent).toEqual(MOCK_QUERIES[0].owner?.displayName);
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

  it('Loader should visible', async () => {
    render(<TableQueryRightPanel {...mockProps} isLoading />, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByText('Loader')).toBeInTheDocument();
  });

  it('call onupdate owner', async () => {
    render(<TableQueryRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });
    const updateButton = await screen.findByTestId('update-button');
    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(mockQueryUpdate).toHaveBeenCalledWith(
      {
        ...MOCK_QUERIES[0],
        owner: mockNewOwner,
      },
      'owner'
    );
  });

  it('call description update', async () => {
    render(<TableQueryRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });
    const updateDescriptionButton = await screen.findByTestId(
      'update-description-button'
    );
    await act(async () => {
      fireEvent.click(updateDescriptionButton);
    });

    expect(mockQueryUpdate).toHaveBeenCalledWith(
      {
        ...MOCK_QUERIES[0],
        description: 'new description',
      },
      'description'
    );
  });

  it('call tags update', async () => {
    render(<TableQueryRightPanel {...mockProps} />, {
      wrapper: MemoryRouter,
    });
    const updateTagsButton = await screen.findByTestId('update-tags-button');
    await act(async () => {
      fireEvent.click(updateTagsButton);
    });

    expect(mockQueryUpdate).toHaveBeenCalledWith(
      {
        ...MOCK_QUERIES[0],
        tags: mockNewTag,
      },
      'tags'
    );
  });
});
