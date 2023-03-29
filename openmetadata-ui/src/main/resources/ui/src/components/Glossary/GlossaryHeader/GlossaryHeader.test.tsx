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
import { Glossary } from 'generated/entity/data/glossary';
import React from 'react';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import GlossaryHeader from './GlossaryHeader.component';

jest.mock(
  'components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => {
    return {
      UserTeamSelectableList: jest.fn().mockImplementation(({ onUpdate }) => (
        <div>
          <p>UserTeamSelectableList</p>
          <button data-testid="update" onClick={onUpdate}>
            update
          </button>
        </div>
      )),
    };
  }
);

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    glossaryFqn: 'glossaryFqn',
    action: 'action',
  }),
}));

jest.mock('components/common/description/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>Description</div>);
});

const mockOnUpdate = jest.fn();
const mockOnDelete = jest.fn();

describe('GlossaryHeader component', () => {
  it('should render name of Glossary', () => {
    render(
      <GlossaryHeader
        isGlossary
        permissions={DEFAULT_ENTITY_PERMISSION}
        selectedData={{ displayName: 'glossaryTest' } as Glossary}
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('glossaryTest')).toBeInTheDocument();
  });

  it('should render edit name icon', () => {
    render(
      <GlossaryHeader
        isGlossary
        permissions={DEFAULT_ENTITY_PERMISSION}
        selectedData={
          {
            displayName: 'glossaryTest',
            reviewers: [
              { displayName: 'reviewer1' },
              { displayName: 'reviewer2' },
            ],
          } as Glossary
        }
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByTestId('edit-name')).toBeInTheDocument();
  });

  it('Edit name icon with should be disabled for no permission', () => {
    render(
      <GlossaryHeader
        isGlossary
        permissions={{
          ...DEFAULT_ENTITY_PERMISSION,
          EditAll: false,
          EditDisplayName: false,
        }}
        selectedData={
          {
            displayName: 'glossaryTest',
            reviewers: [
              { displayName: 'reviewer1' },
              { displayName: 'reviewer2' },
            ],
          } as Glossary
        }
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByTestId('edit-name')).toBeInTheDocument();
    expect(screen.getByTestId('edit-name')).toBeDisabled();
  });

  it('should render no owner if owner is not present', () => {
    render(
      <GlossaryHeader
        isGlossary
        permissions={DEFAULT_ENTITY_PERMISSION}
        selectedData={
          {
            displayName: 'glossaryTest',
            reviewers: [
              { displayName: 'reviewer1' },
              { displayName: 'reviewer2' },
            ],
          } as Glossary
        }
        onDelete={mockOnDelete}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('label.no-entity')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});
