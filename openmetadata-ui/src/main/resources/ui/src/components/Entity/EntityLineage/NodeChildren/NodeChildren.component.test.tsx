/*
 *  Copyright 2025 Collate.
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
import { EntityType } from '../../../../enums/entity.enum';
import { LineageLayer } from '../../../../generated/settings/settings';
import NodeChildren from './NodeChildren.component';

const mockNode = {
  id: 'test-id',
  entityType: EntityType.TABLE,
  fullyQualifiedName: 'test.fqn',
  name: 'test',
  columns: [
    {
      name: 'column1',
      fullyQualifiedName: 'test.fqn.column1',
      dataType: 'STRING',
    },
    {
      name: 'column2',
      fullyQualifiedName: 'test.fqn.column2',
      dataType: 'STRING',
    },
  ],
};

const mockLineageProvider = {
  tracedColumns: [],
  activeLayer: [LineageLayer.ColumnLevelLineage],
  onColumnClick: jest.fn(),
  columnsHavingLineage: ['test.fqn.column1'],
  isEditMode: false,
  expandAllColumns: false,
};

jest.mock('../../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: jest.fn().mockImplementation(() => mockLineageProvider),
}));

jest.mock('../../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn(),
  TestCaseType: {
    all: 'all',
    table: 'table',
    column: 'column',
  },
}));

jest.mock('../../../../utils/EntityLink', () => ({
  EntityLink: jest.fn(),
}));

jest.mock('../../../../utils/SearchClassBase', () => ({
  getEntityIcon: jest.fn().mockReturnValue('entityIcon'),
}));

jest.mock('../CustomNode.utils', () => ({
  getColumnContent: jest
    .fn()
    .mockImplementation((column) => <p>{column.name}</p>),
}));

jest.mock('../TestSuiteSummaryWidget/TestSuiteSummaryWidget.component', () =>
  jest.fn().mockReturnValue(<p>TestSuiteSummaryWidget</p>)
);

describe('NodeChildren Component', () => {
  it('should show all columns when searching', () => {
    render(
      <NodeChildren
        isChildrenListExpanded
        isConnectable={false}
        node={mockNode}
      />
    );

    const searchInput = screen.getByPlaceholderText('label.search-entity');
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'column' } });
    });

    expect(screen.getByText('column1')).toBeInTheDocument();
    expect(screen.getByText('column2')).toBeInTheDocument();
  });

  it('should filter columns based on search input', () => {
    render(
      <NodeChildren
        isChildrenListExpanded
        isConnectable={false}
        node={mockNode}
      />
    );

    const searchInput = screen.getByPlaceholderText('label.search-entity');
    fireEvent.change(searchInput, { target: { value: 'column1' } });

    expect(screen.getByText('column1')).toBeInTheDocument();
    expect(screen.queryByText('column2')).not.toBeInTheDocument();
  });
});
