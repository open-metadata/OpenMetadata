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
import { Glossary } from 'generated/entity/data/glossary';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
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

jest.mock('components/common/description/Description', () => {
  return jest.fn().mockImplementation(() => <div>Description</div>);
});

const mockOnUpdate = jest.fn();

describe('GlossaryHeader component', () => {
  it('should render name of Glossary', () => {
    render(
      <GlossaryHeader
        permissions={DEFAULT_ENTITY_PERMISSION}
        selectedData={{ displayName: 'glossaryTest' } as Glossary}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('glossaryTest')).toBeInTheDocument();
  });

  it('should render reviewers', () => {
    render(
      <GlossaryHeader
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
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('reviewer1')).toBeInTheDocument();
    expect(screen.getByText('reviewer2')).toBeInTheDocument();
  });

  it('should render edit name icon', () => {
    render(
      <GlossaryHeader
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
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByTestId('edit-name')).toBeInTheDocument();
  });

  it('Edit name icon with should be disabled for no permission', () => {
    render(
      <GlossaryHeader
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
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByTestId('edit-name')).toBeInTheDocument();
    expect(screen.getByTestId('edit-name')).toBeDisabled();
  });

  it('should show editing of name after clicking on edit icon', () => {
    render(
      <GlossaryHeader
        permissions={{
          ...DEFAULT_ENTITY_PERMISSION,
          EditAll: true,
          EditDisplayName: true,
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
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByTestId('edit-name')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('edit-name'));
    });

    expect(screen.getByTestId('displayName')).toBeInTheDocument();
    expect(screen.getByTestId('displayName')).toHaveValue('glossaryTest');
    expect(screen.getByTestId('cancelAssociatedTag')).toBeInTheDocument();
    expect(screen.getByTestId('saveAssociatedTag')).toBeInTheDocument();
  });

  it('should update name after editing', () => {
    render(
      <GlossaryHeader
        permissions={{
          ...DEFAULT_ENTITY_PERMISSION,
          EditAll: true,
          EditDisplayName: true,
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
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByTestId('edit-name')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('edit-name'));
    });

    expect(screen.getByTestId('displayName')).toBeInTheDocument();

    act(() => {
      fireEvent.change(screen.getByTestId('displayName'), {
        target: { value: 'updated glossary' },
      });
    });

    expect(screen.getByTestId('displayName')).toHaveValue('updated glossary');

    act(() => {
      fireEvent.click(screen.getByTestId('saveAssociatedTag'));
    });

    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it('should render no owner if owner is not present', () => {
    render(
      <GlossaryHeader
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
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('label.no-entity')).toBeInTheDocument();
  });

  it('should render owner if present', () => {
    render(
      <MemoryRouter>
        <GlossaryHeader
          permissions={DEFAULT_ENTITY_PERMISSION}
          selectedData={
            {
              displayName: 'glossaryTest',
              reviewers: [
                { displayName: 'reviewer1' },
                { displayName: 'reviewer2' },
              ],
              owner: {
                id: '1',
                displayName: 'test',
              },
            } as Glossary
          }
          onUpdate={mockOnUpdate}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('should update owner if updated', () => {
    render(
      <MemoryRouter>
        <GlossaryHeader
          permissions={DEFAULT_ENTITY_PERMISSION}
          selectedData={
            {
              displayName: 'glossaryTest',
              reviewers: [
                { displayName: 'reviewer1' },
                { displayName: 'reviewer2' },
              ],
              owner: {
                id: '1',
                displayName: 'test',
              },
            } as Glossary
          }
          onUpdate={mockOnUpdate}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('update')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('update'));
    });

    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it('should render Description component', () => {
    render(
      <MemoryRouter>
        <GlossaryHeader
          permissions={DEFAULT_ENTITY_PERMISSION}
          selectedData={
            {
              displayName: 'glossaryTest',
              reviewers: [
                { displayName: 'reviewer1' },
                { displayName: 'reviewer2' },
              ],
              owner: {
                id: '1',
                displayName: 'test',
              },
            } as Glossary
          }
          onUpdate={mockOnUpdate}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});
