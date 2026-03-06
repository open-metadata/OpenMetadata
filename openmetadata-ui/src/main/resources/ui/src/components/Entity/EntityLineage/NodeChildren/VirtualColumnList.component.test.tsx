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
import React from 'react';
import { LINEAGE_CHILD_ITEMS_PER_PAGE } from '../../../../constants/constants';
import { Column } from '../../../../generated/entity/data/table';
import { TestSummary } from '../../../../generated/tests/testCase';
import VirtualColumnList, {
  VirtualColumnListProps,
} from './VirtualColumnList.component';

const mockUpdateColumnsInCurrentPages = jest.fn();
const mockUseLineageStore = {
  updateColumnsInCurrentPages: mockUpdateColumnsInCurrentPages,
  selectedColumn: undefined,
  tracedColumns: new Set<string>(),
};

jest.mock('../../../../hooks/useLineageStore', () => ({
  useLineageStore: () => mockUseLineageStore,
}));

jest.mock('../CustomNode.utils', () => ({
  ColumnContent: ({
    column,
    className,
  }: {
    column: Column;
    className: string;
  }) => (
    <div
      className={className}
      data-testid={`column-${column.fullyQualifiedName}`}>
      {column.name}
    </div>
  ),
}));

const createColumn = (name: string, fqn: string): Column => ({
  name,
  fullyQualifiedName: fqn,
  dataType: 'VARCHAR',
  dataTypeDisplay: 'varchar',
});

const createFlatItem = (column: Column, depth = 0) => ({
  ...column,
  depth,
});

describe('VirtualColumnList', () => {
  const defaultProps: VirtualColumnListProps = {
    flatItems: [],
    isConnectable: true,
    isLoading: false,
    nodeId: 'test-node',
    showDataObservabilitySummary: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty list without navigation buttons', () => {
    render(<VirtualColumnList {...defaultProps} />);

    expect(screen.queryByTestId('column-scroll-up')).not.toBeInTheDocument();
    expect(screen.queryByTestId('column-scroll-down')).not.toBeInTheDocument();
  });

  it('renders columns within page size without navigation', () => {
    const flatItems = Array.from({ length: 5 }, (_, i) =>
      createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    expect(screen.queryByTestId('column-scroll-up')).not.toBeInTheDocument();
    expect(screen.queryByTestId('column-scroll-down')).not.toBeInTheDocument();

    flatItems.forEach((item) => {
      expect(
        screen.getByTestId(`column-${item.fullyQualifiedName}`)
      ).toBeInTheDocument();
    });
  });

  it('renders navigation buttons when items exceed page size', () => {
    const flatItems = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    expect(screen.getByTestId('column-scroll-up')).toBeInTheDocument();
    expect(screen.getByTestId('column-scroll-down')).toBeInTheDocument();
  });

  it('disables up button at the start', () => {
    const flatItems = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    const upButton = screen.getByTestId('column-scroll-up');

    expect(upButton).toBeDisabled();
  });

  it('enables down button when there are more items', () => {
    const flatItems = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    const downButton = screen.getByTestId('column-scroll-down');

    expect(downButton).not.toBeDisabled();
  });

  it('scrolls down and shows correct items', () => {
    const flatItems = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    const downButton = screen.getByTestId('column-scroll-down');
    fireEvent.click(downButton);

    expect(screen.queryByTestId('column-table.col0')).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`column-table.col${LINEAGE_CHILD_ITEMS_PER_PAGE}`)
    ).toBeInTheDocument();
  });

  it('scrolls up and shows correct items', () => {
    const flatItems = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    const { rerender } = render(
      <VirtualColumnList {...defaultProps} flatItems={flatItems} />
    );

    const downButton = screen.getByTestId('column-scroll-down');
    fireEvent.click(downButton);

    rerender(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    const upButton = screen.getByTestId('column-scroll-up');
    fireEvent.click(upButton);

    expect(screen.getByTestId('column-table.col0')).toBeInTheDocument();
  });

  it('stops propagation on button clicks', () => {
    const flatItems = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    const downButton = screen.getByTestId('column-scroll-down');
    const mockEvent = {
      stopPropagation: jest.fn(),
    } as unknown as React.MouseEvent<HTMLButtonElement>;

    fireEvent.click(downButton);

    expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
  });

  it('updates columns in current pages on mount', () => {
    const flatItems = Array.from({ length: 3 }, (_, i) =>
      createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    render(
      <VirtualColumnList
        {...defaultProps}
        flatItems={flatItems}
        nodeId="node-1"
      />
    );

    expect(mockUpdateColumnsInCurrentPages).toHaveBeenCalledWith('node-1', [
      'table.col0',
      'table.col1',
      'table.col2',
    ]);
  });

  it('updates columns when visible items change', () => {
    const flatItems = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    const { rerender } = render(
      <VirtualColumnList {...defaultProps} flatItems={flatItems} />
    );

    const downButton = screen.getByTestId('column-scroll-down');
    fireEvent.click(downButton);

    rerender(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    expect(mockUpdateColumnsInCurrentPages).toHaveBeenCalled();
  });

  it('renders outside current page items when traced', () => {
    const flatItems = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    mockUseLineageStore.tracedColumns = new Set([
      `table.col${LINEAGE_CHILD_ITEMS_PER_PAGE + 2}`,
    ]);

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    const outsideItems = screen.getAllByTestId(/column-table\.col/);
    const outsideItem = outsideItems.find((item) =>
      item.className.includes('outside-current-page-item')
    );

    expect(outsideItem).toBeInTheDocument();
  });

  it('resets offset when flatItems change', () => {
    const flatItems1 = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    const { rerender } = render(
      <VirtualColumnList {...defaultProps} flatItems={flatItems1} />
    );

    const downButton = screen.getByTestId('column-scroll-down');
    fireEvent.click(downButton);

    expect(screen.queryByTestId('column-table.col0')).not.toBeInTheDocument();

    const flatItems2 = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`newcol${i}`, `table.newcol${i}`))
    );

    rerender(<VirtualColumnList {...defaultProps} flatItems={flatItems2} />);

    expect(screen.getByTestId('column-table.newcol0')).toBeInTheDocument();
  });

  it('renders with summary when provided', () => {
    const summary: TestSummary = {
      columnTestSummary: [
        {
          entityLink: '<#E::table::test.table.col0>',
          success: 5,
          failed: 0,
          aborted: 0,
          total: 5,
        },
      ],
      success: 5,
      failed: 0,
      aborted: 0,
      total: 5,
    };

    const flatItems = [createFlatItem(createColumn('col0', 'test.table.col0'))];

    render(
      <VirtualColumnList
        {...defaultProps}
        showDataObservabilitySummary
        flatItems={flatItems}
        summary={summary}
      />
    );

    expect(screen.getByTestId('column-test.table.col0')).toBeInTheDocument();
  });

  it('handles items with different depths', () => {
    const flatItems = [
      createFlatItem(createColumn('col0', 'table.col0'), 0),
      createFlatItem(createColumn('col1', 'table.col1'), 1),
      createFlatItem(createColumn('col2', 'table.col2'), 2),
    ];

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    flatItems.forEach((item) => {
      expect(
        screen.getByTestId(`column-${item.fullyQualifiedName}`)
      ).toBeInTheDocument();
    });
  });

  it('handles empty traced columns set', () => {
    mockUseLineageStore.tracedColumns = new Set();

    const flatItems = Array.from({ length: 3 }, (_, i) =>
      createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    const outsideItems = screen
      .getAllByTestId(/column-table\.col/)
      .filter((item) => item.className.includes('outside-current-page-item'));

    expect(outsideItems).toHaveLength(0);
  });

  it('applies correct CSS classes to visible and outside items', () => {
    const flatItems = Array.from(
      { length: LINEAGE_CHILD_ITEMS_PER_PAGE + 5 },
      (_, i) => createFlatItem(createColumn(`col${i}`, `table.col${i}`))
    );

    mockUseLineageStore.tracedColumns = new Set([
      `table.col${LINEAGE_CHILD_ITEMS_PER_PAGE + 1}`,
    ]);

    render(<VirtualColumnList {...defaultProps} flatItems={flatItems} />);

    const insideContainer = screen
      .getByTestId('column-table.col0')
      .closest('.inside-current-page-items');

    expect(insideContainer).toBeInTheDocument();

    const allItems = screen.getAllByTestId(/column-table\.col/);
    const outsideItem = allItems.find((item) =>
      item.className.includes('outside-current-page-item')
    );

    expect(outsideItem).toBeInTheDocument();
  });
});
