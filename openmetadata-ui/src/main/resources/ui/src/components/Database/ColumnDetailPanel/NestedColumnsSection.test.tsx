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
import { render, screen } from '@testing-library/react';
import { Column } from '../../../generated/entity/data/table';
import { DataType } from '../../../generated/tests/testDefinition';
import { NestedColumnsSection } from './NestedColumnsSection';

const mockOnColumnClick = jest.fn();

const mockFlatColumn: Column = {
  name: 'simple_column',
  dataType: DataType.String,
  fullyQualifiedName: 'test.table.simple_column',
  displayName: 'Simple Column',
};

const mockNestedColumn: Column = {
  name: 'nested_struct',
  dataType: DataType.Struct,
  fullyQualifiedName: 'test.table.nested_struct',
  displayName: 'Nested Struct',
  children: [
    {
      name: 'field_1',
      dataType: DataType.String,
      fullyQualifiedName: 'test.table.nested_struct.field_1',
      displayName: 'Field 1',
    },
    {
      name: 'field_2',
      dataType: DataType.Int,
      fullyQualifiedName: 'test.table.nested_struct.field_2',
      displayName: 'Field 2',
    },
  ],
};

const mockDeeplyNestedColumn: Column = {
  name: 'deeply_nested',
  dataType: DataType.Struct,
  fullyQualifiedName: 'test.table.deeply_nested',
  displayName: 'Deeply Nested',
  children: [
    {
      name: 'level_1',
      dataType: DataType.Struct,
      fullyQualifiedName: 'test.table.deeply_nested.level_1',
      displayName: 'Level 1',
      children: [
        {
          name: 'level_2',
          dataType: DataType.Struct,
          fullyQualifiedName: 'test.table.deeply_nested.level_1.level_2',
          displayName: 'Level 2',
          children: [
            {
              name: 'level_3',
              dataType: DataType.String,
              fullyQualifiedName:
                'test.table.deeply_nested.level_1.level_2.level_3',
              displayName: 'Level 3',
            },
          ],
        },
      ],
    },
  ],
};

const mockComplexNestedColumn: Column = {
  name: 'complex_struct',
  dataType: DataType.Struct,
  fullyQualifiedName: 'test.table.complex_struct',
  displayName: 'Complex Struct',
  children: [
    {
      name: 'simple_field',
      dataType: DataType.String,
      fullyQualifiedName: 'test.table.complex_struct.simple_field',
      displayName: 'Simple Field',
    },
    {
      name: 'nested_level_1',
      dataType: DataType.Struct,
      fullyQualifiedName: 'test.table.complex_struct.nested_level_1',
      displayName: 'Nested Level 1',
      children: [
        {
          name: 'nested_field_a',
          dataType: DataType.Int,
          fullyQualifiedName:
            'test.table.complex_struct.nested_level_1.nested_field_a',
          displayName: 'Nested Field A',
        },
        {
          name: 'nested_level_2',
          dataType: DataType.Struct,
          fullyQualifiedName:
            'test.table.complex_struct.nested_level_1.nested_level_2',
          displayName: 'Nested Level 2',
          children: [
            {
              name: 'deep_field',
              dataType: DataType.Boolean,
              fullyQualifiedName:
                'test.table.complex_struct.nested_level_1.nested_level_2.deep_field',
              displayName: 'Deep Field',
            },
          ],
        },
      ],
    },
    {
      name: 'another_simple_field',
      dataType: DataType.Bigint,
      fullyQualifiedName: 'test.table.complex_struct.another_simple_field',
      displayName: 'Another Simple Field',
    },
  ],
};

const mockArrayOfStructs: Column = {
  name: 'array_of_structs',
  dataType: DataType.Array,
  fullyQualifiedName: 'test.table.array_of_structs',
  displayName: 'Array of Structs',
  children: [
    {
      name: 'struct_element',
      dataType: DataType.Struct,
      fullyQualifiedName: 'test.table.array_of_structs.struct_element',
      displayName: 'Struct Element',
      children: [
        {
          name: 'id',
          dataType: DataType.String,
          fullyQualifiedName: 'test.table.array_of_structs.struct_element.id',
          displayName: 'ID',
        },
        {
          name: 'metadata',
          dataType: DataType.Struct,
          fullyQualifiedName:
            'test.table.array_of_structs.struct_element.metadata',
          displayName: 'Metadata',
          children: [
            {
              name: 'created_at',
              dataType: DataType.Timestamp,
              fullyQualifiedName:
                'test.table.array_of_structs.struct_element.metadata.created_at',
              displayName: 'Created At',
            },
            {
              name: 'updated_at',
              dataType: DataType.Timestamp,
              fullyQualifiedName:
                'test.table.array_of_structs.struct_element.metadata.updated_at',
              displayName: 'Updated At',
            },
          ],
        },
      ],
    },
  ],
};

describe('NestedColumnsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when columns array is empty', () => {
      const { container } = render(
        <NestedColumnsSection columns={[]} onColumnClick={mockOnColumnClick} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render the section title and count badge', () => {
      render(
        <NestedColumnsSection
          columns={[mockFlatColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(
        screen.getByText('label.nested-column-plural')
      ).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should render a single flat column', () => {
      render(
        <NestedColumnsSection
          columns={[mockFlatColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(screen.getByText('Simple Column')).toBeInTheDocument();
    });

    it('should render multiple flat columns', () => {
      const columns = [
        mockFlatColumn,
        {
          ...mockFlatColumn,
          name: 'column_2',
          displayName: 'Column 2',
          fullyQualifiedName: 'test.table.column_2',
        },
        {
          ...mockFlatColumn,
          name: 'column_3',
          displayName: 'Column 3',
          fullyQualifiedName: 'test.table.column_3',
        },
      ];

      render(
        <NestedColumnsSection
          columns={columns as Column[]}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(screen.getByText('Simple Column')).toBeInTheDocument();
      expect(screen.getByText('Column 2')).toBeInTheDocument();
      expect(screen.getByText('Column 3')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render nested columns with children', () => {
      render(
        <NestedColumnsSection
          columns={[mockNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(screen.getByText('Nested Struct')).toBeInTheDocument();
      expect(screen.getByText('Field 1')).toBeInTheDocument();
      expect(screen.getByText('Field 2')).toBeInTheDocument();
    });

    it('should render deeply nested column hierarchy', () => {
      render(
        <NestedColumnsSection
          columns={[mockDeeplyNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(screen.getByText('Deeply Nested')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
    });

    it('should display correct count for parent columns only', () => {
      render(
        <NestedColumnsSection
          columns={[mockNestedColumn, mockFlatColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      // Should show 2 (parent columns only, not children)
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onColumnClick when a flat column is clicked', () => {
      render(
        <NestedColumnsSection
          columns={[mockFlatColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      const columnLink = screen.getByText('Simple Column');
      const clickable =
        columnLink.closest('[role="button"]') || columnLink.parentElement;
      (clickable as HTMLElement)?.click();

      expect(mockOnColumnClick).toHaveBeenCalledTimes(1);
      expect(mockOnColumnClick).toHaveBeenCalledWith(mockFlatColumn);
    });

    it('should call onColumnClick when a nested column is clicked', () => {
      render(
        <NestedColumnsSection
          columns={[mockNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      const parentLink = screen.getByText('Nested Struct');
      const clickable =
        parentLink.closest('[role="button"]') || parentLink.parentElement;
      (clickable as HTMLElement)?.click();

      expect(mockOnColumnClick).toHaveBeenCalledTimes(1);
      expect(mockOnColumnClick).toHaveBeenCalledWith(mockNestedColumn);
    });

    it('should call onColumnClick when a child column is clicked', () => {
      render(
        <NestedColumnsSection
          columns={[mockNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      const childLink = screen.getByText('Field 1');
      const clickable =
        childLink.closest('[role="button"]') || childLink.parentElement;
      (clickable as HTMLElement)?.click();

      expect(mockOnColumnClick).toHaveBeenCalledTimes(1);
      expect(mockOnColumnClick).toHaveBeenCalledWith(
        mockNestedColumn.children![0]
      );
    });

    it('should call onColumnClick for deeply nested columns', () => {
      render(
        <NestedColumnsSection
          columns={[mockDeeplyNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      const deepLink = screen.getByText('Level 3');
      const clickable =
        deepLink.closest('[role="button"]') || deepLink.parentElement;
      (clickable as HTMLElement)?.click();

      expect(mockOnColumnClick).toHaveBeenCalledTimes(1);
      expect(mockOnColumnClick).toHaveBeenCalledWith(
        mockDeeplyNestedColumn.children![0].children![0].children![0]
      );
    });

    it('should allow clicking multiple different columns', () => {
      render(
        <NestedColumnsSection
          columns={[mockNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      const nestedStructLink = screen.getByText('Nested Struct');
      const clickable1 =
        nestedStructLink.closest('[role="button"]') ||
        nestedStructLink.parentElement;
      (clickable1 as HTMLElement)?.click();

      const field1Link = screen.getByText('Field 1');
      const clickable2 =
        field1Link.closest('[role="button"]') || field1Link.parentElement;
      (clickable2 as HTMLElement)?.click();

      const field2Link = screen.getByText('Field 2');
      const clickable3 =
        field2Link.closest('[role="button"]') || field2Link.parentElement;
      (clickable3 as HTMLElement)?.click();

      expect(mockOnColumnClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('Column Name Display', () => {
    it('should display displayName when available', () => {
      render(
        <NestedColumnsSection
          columns={[mockFlatColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(screen.getByText('Simple Column')).toBeInTheDocument();
    });

    it('should display name when displayName is not available', () => {
      const columnWithoutDisplayName = {
        ...mockFlatColumn,
        displayName: undefined,
      };
      render(
        <NestedColumnsSection
          columns={[columnWithoutDisplayName as Column]}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(screen.getByText('simple_column')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle columns with empty children array', () => {
      const columnWithEmptyChildren = {
        ...mockFlatColumn,
        children: [],
      };

      render(
        <NestedColumnsSection
          columns={[columnWithEmptyChildren]}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(screen.getByText('Simple Column')).toBeInTheDocument();
    });

    it('should handle mixed nested and flat columns', () => {
      const mixedColumns = [mockFlatColumn, mockNestedColumn];

      render(
        <NestedColumnsSection
          columns={mixedColumns}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(screen.getByText('Simple Column')).toBeInTheDocument();
      expect(screen.getByText('Nested Struct')).toBeInTheDocument();
      expect(screen.getByText('Field 1')).toBeInTheDocument();
      expect(screen.getByText('Field 2')).toBeInTheDocument();
    });

    it('should handle columns without fullyQualifiedName', () => {
      const columnWithoutFQN = {
        name: 'test_column',
        dataType: 'string',
      };

      const { container } = render(
        <NestedColumnsSection
          columns={[columnWithoutFQN as Column]}
          onColumnClick={mockOnColumnClick}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have clickable elements with proper structure', () => {
      render(
        <NestedColumnsSection
          columns={[mockFlatColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      const link = screen.getByText('Simple Column');

      expect(link.closest('a')).toBeInTheDocument();
    });

    it('should render column icons for all columns', () => {
      render(
        <NestedColumnsSection
          columns={[mockNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      // Verify all columns are rendered (parent + 2 children)
      expect(screen.getByText('Nested Struct')).toBeInTheDocument();
      expect(screen.getByText('Field 1')).toBeInTheDocument();
      expect(screen.getByText('Field 2')).toBeInTheDocument();
    });
  });

  describe('Complex Nested Structures', () => {
    it('should render complex nested structure with mixed levels', () => {
      render(
        <NestedColumnsSection
          columns={[mockComplexNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      // Verify all levels are rendered
      expect(screen.getByText('Complex Struct')).toBeInTheDocument();
      expect(screen.getByText('Simple Field')).toBeInTheDocument();
      expect(screen.getByText('Nested Level 1')).toBeInTheDocument();
      expect(screen.getByText('Nested Field A')).toBeInTheDocument();
      expect(screen.getByText('Nested Level 2')).toBeInTheDocument();
      expect(screen.getByText('Deep Field')).toBeInTheDocument();
      expect(screen.getByText('Another Simple Field')).toBeInTheDocument();
    });

    it('should handle array of structs with nested metadata', () => {
      render(
        <NestedColumnsSection
          columns={[mockArrayOfStructs]}
          onColumnClick={mockOnColumnClick}
        />
      );

      // Verify all levels are rendered
      expect(screen.getByText('Array of Structs')).toBeInTheDocument();
      expect(screen.getByText('Struct Element')).toBeInTheDocument();
      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('Metadata')).toBeInTheDocument();
      expect(screen.getByText('Created At')).toBeInTheDocument();
      expect(screen.getByText('Updated At')).toBeInTheDocument();
    });

    it('should allow clicking on complex nested structure fields', () => {
      render(
        <NestedColumnsSection
          columns={[mockComplexNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      // Click on deep nested field
      const deepFieldLink = screen.getByText('Deep Field');
      const clickable =
        deepFieldLink.closest('[role="button"]') || deepFieldLink.parentElement;
      (clickable as HTMLElement)?.click();

      expect(mockOnColumnClick).toHaveBeenCalledTimes(1);
      expect(mockOnColumnClick).toHaveBeenCalledWith(
        mockComplexNestedColumn.children![1].children![1].children![0]
      );
    });

    it('should handle multiple complex nested columns', () => {
      render(
        <NestedColumnsSection
          columns={[mockComplexNestedColumn, mockArrayOfStructs]}
          onColumnClick={mockOnColumnClick}
        />
      );

      // Verify count badge shows correct number of parent columns
      expect(screen.getByText('2')).toBeInTheDocument();

      // Verify both structures are rendered
      expect(screen.getByText('Complex Struct')).toBeInTheDocument();
      expect(screen.getByText('Array of Structs')).toBeInTheDocument();
      expect(screen.getByText('Deep Field')).toBeInTheDocument();
      expect(screen.getByText('Created At')).toBeInTheDocument();
    });

    it('should render sibling fields at same nesting level correctly', () => {
      render(
        <NestedColumnsSection
          columns={[mockComplexNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      // Both siblings at level 1 should be rendered
      expect(screen.getByText('Simple Field')).toBeInTheDocument();
      expect(screen.getByText('Another Simple Field')).toBeInTheDocument();

      // Both siblings within nested level should be rendered
      expect(screen.getByText('Nested Field A')).toBeInTheDocument();
      expect(screen.getByText('Nested Level 2')).toBeInTheDocument();
    });

    it('should handle clicking on intermediate nested levels', () => {
      render(
        <NestedColumnsSection
          columns={[mockComplexNestedColumn]}
          onColumnClick={mockOnColumnClick}
        />
      );

      // Click on intermediate nested level (not leaf node)
      const nestedLevel1Link = screen.getByText('Nested Level 1');
      const clickable1 =
        nestedLevel1Link.closest('[role="button"]') ||
        nestedLevel1Link.parentElement;
      (clickable1 as HTMLElement)?.click();

      expect(mockOnColumnClick).toHaveBeenCalledTimes(1);
      expect(mockOnColumnClick).toHaveBeenCalledWith(
        mockComplexNestedColumn.children![1]
      );

      jest.clearAllMocks();

      // Click on deeper intermediate level
      const nestedLevel2Link = screen.getByText('Nested Level 2');
      const clickable2 =
        nestedLevel2Link.closest('[role="button"]') ||
        nestedLevel2Link.parentElement;
      (clickable2 as HTMLElement)?.click();

      expect(mockOnColumnClick).toHaveBeenCalledTimes(1);
      expect(mockOnColumnClick).toHaveBeenCalledWith(
        mockComplexNestedColumn.children![1].children![1]
      );
    });

    it('should handle array type columns with nested structures', () => {
      render(
        <NestedColumnsSection
          columns={[mockArrayOfStructs]}
          onColumnClick={mockOnColumnClick}
        />
      );

      // Click on metadata timestamp field
      const createdAtLink = screen.getByText('Created At');
      const clickable =
        createdAtLink.closest('[role="button"]') || createdAtLink.parentElement;
      (clickable as HTMLElement)?.click();

      expect(mockOnColumnClick).toHaveBeenCalledTimes(1);
      expect(mockOnColumnClick).toHaveBeenCalledWith(
        mockArrayOfStructs.children![0].children![1].children![0]
      );
    });
  });
});
