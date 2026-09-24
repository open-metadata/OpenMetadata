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
import { Operation } from '../../../generated/entity/policies/policy';
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

const FULL_PERMISSIONS = {
  columnValuesToBeNotNull: {
    [Operation.EditAll]: true,
    [Operation.Delete]: true,
  },
} as unknown as TestDefinitionTableProps['testDefinitionPermissions'];

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
  isInitialLoading: false,
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

describe('TestDefinitionTable loading', () => {
  // Re-sorting, filtering and searching all refetch. Tearing the rows out for
  // skeletons each time is what made the list read as a full page reload.
  it('should keep the existing rows on screen while refetching', () => {
    render(
      <TestDefinitionTable
        {...makeProps({ isLoading: true, isInitialLoading: false })}
      />
    );

    expect(
      screen.getByText('Column Values To Be Not Null')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.no-test-definitions-yet')
    ).not.toBeInTheDocument();
  });

  it('should mark the table busy while refetching', () => {
    render(
      <TestDefinitionTable
        {...makeProps({ isLoading: true, isInitialLoading: false })}
      />
    );

    expect(
      screen.getByTestId('test-definition-table-container')
    ).toHaveAttribute('aria-busy', 'true');
  });

  // The first load is the one case with nothing to keep, so it still gets
  // skeletons rather than an empty table.
  it('should show skeletons on the very first load', () => {
    render(
      <TestDefinitionTable
        {...makeProps({ isLoading: true, isInitialLoading: true })}
      />
    );

    expect(
      screen.queryByText('Column Values To Be Not Null')
    ).not.toBeInTheDocument();
    // Skeletons, not the empty placeholder - the list is not known to be empty
    // yet, it just has not arrived.
    expect(
      screen.queryByText('message.no-test-definitions-yet')
    ).not.toBeInTheDocument();
  });

  // The retained rows belong to the PREVIOUS query. Acting on one would patch a
  // definition the list has moved on from, and the arriving response would
  // overwrite the toggle so a successful edit looked reverted.
  it('should hold the retained row controls shut while refetching', () => {
    render(
      <TestDefinitionTable
        {...makeProps({
          isLoading: true,
          isInitialLoading: false,
          testDefinitionPermissions: FULL_PERMISSIONS,
        })}
      />
    );

    expect(
      screen.getByTestId('enable-switch-columnValuesToBeNotNull')
    ).toBeDisabled();
    expect(
      screen.getByTestId('edit-test-definition-columnValuesToBeNotNull')
    ).toBeDisabled();
    expect(
      screen.getByTestId('delete-test-definition-columnValuesToBeNotNull')
    ).toBeDisabled();
  });

  // Mounting straight into the refetching state proves nothing: the rows are
  // built once, already disabled. The bug is in the TRANSITION - the row cells
  // live in a react-aria collection that reuses its cached nodes unless a
  // dependency changes, and a refetch changes no row data.
  it('should hold the row controls shut when a refetch starts on rendered rows', () => {
    const props = makeProps({
      testDefinitionPermissions: FULL_PERMISSIONS,
    });

    const { rerender } = render(<TestDefinitionTable {...props} />);

    expect(
      screen.getByTestId('edit-test-definition-columnValuesToBeNotNull')
    ).not.toBeDisabled();

    rerender(
      <TestDefinitionTable
        {...props}
        isLoading
        isInitialLoading={false}
        // The same array instance the previous render used. A refetch replaces
        // the rows only once the response lands.
        testDefinitions={props.testDefinitions}
      />
    );

    expect(
      screen.getByTestId('enable-switch-columnValuesToBeNotNull')
    ).toBeDisabled();
    expect(
      screen.getByTestId('edit-test-definition-columnValuesToBeNotNull')
    ).toBeDisabled();
    expect(
      screen.getByTestId('delete-test-definition-columnValuesToBeNotNull')
    ).toBeDisabled();
  });

  it('should hand the row controls back when the refetch lands', () => {
    const props = makeProps({
      isLoading: true,
      isInitialLoading: false,
      testDefinitionPermissions: FULL_PERMISSIONS,
    });

    const { rerender } = render(<TestDefinitionTable {...props} />);

    expect(
      screen.getByTestId('edit-test-definition-columnValuesToBeNotNull')
    ).toBeDisabled();

    rerender(<TestDefinitionTable {...props} isLoading={false} />);

    expect(
      screen.getByTestId('enable-switch-columnValuesToBeNotNull')
    ).not.toBeDisabled();
    expect(
      screen.getByTestId('edit-test-definition-columnValuesToBeNotNull')
    ).not.toBeDisabled();
    expect(
      screen.getByTestId('delete-test-definition-columnValuesToBeNotNull')
    ).not.toBeDisabled();
  });

  it('should leave the row controls usable once the refetch lands', () => {
    render(
      <TestDefinitionTable
        {...makeProps({ testDefinitionPermissions: FULL_PERMISSIONS })}
      />
    );

    expect(
      screen.getByTestId('enable-switch-columnValuesToBeNotNull')
    ).not.toBeDisabled();
    expect(
      screen.getByTestId('edit-test-definition-columnValuesToBeNotNull')
    ).not.toBeDisabled();
  });

  it('should not dim or mark the table busy when idle', () => {
    render(<TestDefinitionTable {...makeProps()} />);

    const container = screen.getByTestId('test-definition-table-container');

    expect(container).toHaveAttribute('aria-busy', 'false');
    expect(container.className).not.toContain('opacity-60');
  });
});

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
