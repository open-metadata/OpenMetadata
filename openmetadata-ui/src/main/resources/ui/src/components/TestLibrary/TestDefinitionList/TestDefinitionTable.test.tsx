/*
 *  Copyright 2026 Collate.
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
import { fireEvent, render, screen } from '@testing-library/react';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import TestDefinitionTable from './TestDefinitionTable.component';
import { TestDefinitionTableProps } from './TestDefinitionTable.interface';

jest.mock('../../common/NextPrevious/NextPrevious', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div />),
}));

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ markdown }) => <span>{markdown}</span>),
}));

const mockOnSortChange = jest.fn();

const TEST_DEFINITIONS = [
  {
    id: 'test-def-1',
    name: 'columnValuesToBeNotNull',
    fullyQualifiedName: 'columnValuesToBeNotNull',
    displayName: 'Column Values To Be Not Null',
    description: 'Ensures that all values in a column are not null',
    entityType: 'COLUMN',
    testPlatforms: ['OpenMetadata'],
    enabled: true,
  },
] as unknown as TestDefinition[];

const makeProps = (
  overrides: Partial<TestDefinitionTableProps> = {}
): TestDefinitionTableProps => ({
  testDefinitions: TEST_DEFINITIONS,
  isLoading: false,
  pagingData: {} as TestDefinitionTableProps['pagingData'],
  showPagination: false,
  testDefinitionPermissions: {},
  permissionLoading: false,
  sortDescriptor: { column: 'name', direction: 'ascending' },
  onSortChange: mockOnSortChange,
  onEnableToggle: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  ...overrides,
});

const headerFor = (name: RegExp) => screen.getByRole('columnheader', { name });

describe('TestDefinitionTable sorting', () => {
  beforeEach(() => {
    mockOnSortChange.mockReset();
  });

  // Rendered against the real core-components Table: whether a header is
  // actually clickable is react-aria's decision from `allowsSorting`, so a
  // mocked Table would assert the prop rather than the behaviour.
  it('should only offer a sort affordance on the columns the server can order by', () => {
    render(<TestDefinitionTable {...makeProps()} />);

    expect(headerFor(/label.name/)).toHaveAttribute('aria-sort');
    expect(headerFor(/label.entity-type/)).toHaveAttribute('aria-sort');
    expect(headerFor(/label.test-platform-plural/)).toHaveAttribute(
      'aria-sort'
    );

    expect(headerFor(/label.description/)).not.toHaveAttribute('aria-sort');
    expect(headerFor(/label.enabled/)).not.toHaveAttribute('aria-sort');
    expect(headerFor(/label.action-plural/)).not.toHaveAttribute('aria-sort');
  });

  it('should mark the active column with the current direction', () => {
    render(
      <TestDefinitionTable
        {...makeProps({
          sortDescriptor: { column: 'entityType', direction: 'descending' },
        })}
      />
    );

    expect(headerFor(/label.entity-type/)).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    expect(headerFor(/label.name/)).toHaveAttribute('aria-sort', 'none');
  });

  it('should report a newly sorted column as ascending', () => {
    render(<TestDefinitionTable {...makeProps()} />);

    fireEvent.click(headerFor(/label.entity-type/));

    expect(mockOnSortChange).toHaveBeenCalledWith('entityType', 'asc');
  });

  // Clicking the column that is already ascending is how a user asks for the
  // reverse, so this is the only path to a descending listing.
  it('should flip the active column to descending', () => {
    render(<TestDefinitionTable {...makeProps()} />);

    fireEvent.click(headerFor(/label.name/));

    expect(mockOnSortChange).toHaveBeenCalledWith('name', 'desc');
  });
});
