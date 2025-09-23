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
import { fireEvent, render, screen } from '@testing-library/react';
import OverviewSection from './OverviewSection';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

// Mock SectionWithEdit component
jest.mock('../SectionWithEdit/SectionWithEdit', () => {
  return jest
    .fn()
    .mockImplementation(({ children, title, showEditButton, onEdit }) => (
      <div data-testid="section-with-edit">
        <div data-testid="section-title">{title}</div>
        {showEditButton && (
          <button data-testid="edit-button" onClick={onEdit}>
            Edit
          </button>
        )}
        <div data-testid="section-content">{children}</div>
      </div>
    ));
});

const mockOverviewItems = [
  { label: 'Type', value: 'Table' },
  { label: 'Rows', value: 1000 },
  { label: 'Columns', value: 15 },
  { label: 'Queries', value: 250 },
  { label: 'Incidents', value: 3 },
];

const defaultProps = {
  items: mockOverviewItems,
};

describe('OverviewSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      render(<OverviewSection {...defaultProps} />);

      expect(screen.getByTestId('section-with-edit')).toBeInTheDocument();
    });

    it('should render with correct CSS classes', () => {
      const { container } = render(<OverviewSection {...defaultProps} />);

      expect(container.querySelector('.overview-section')).toBeInTheDocument();
    });

    it('should render section title', () => {
      render(<OverviewSection {...defaultProps} />);

      expect(screen.getByTestId('section-title')).toHaveTextContent(
        'label.overview'
      );
    });
  });

  describe('Overview Items Rendering', () => {
    it('should render all overview items', () => {
      render(<OverviewSection {...defaultProps} />);

      expect(screen.getByText('Type:')).toBeInTheDocument();
      expect(screen.getByText('Table')).toBeInTheDocument();
      expect(screen.getByText('Rows:')).toBeInTheDocument();
      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('Columns:')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('Queries:')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('Incidents:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render items with correct structure', () => {
      const { container } = render(<OverviewSection {...defaultProps} />);

      const overviewRows = container.querySelectorAll('.overview-row');

      expect(overviewRows).toHaveLength(5);

      overviewRows.forEach((row) => {
        expect(row.querySelector('.overview-label')).toBeInTheDocument();
        expect(row.querySelector('.overview-value')).toBeInTheDocument();
      });
    });

    it('should render items with correct CSS classes', () => {
      const { container } = render(<OverviewSection {...defaultProps} />);

      const labels = container.querySelectorAll('.overview-label');
      const values = container.querySelectorAll('.overview-value');

      expect(labels).toHaveLength(5);
      expect(values).toHaveLength(5);
    });

    it('should handle empty items array', () => {
      render(<OverviewSection items={[]} />);

      expect(screen.getByTestId('section-with-edit')).toBeInTheDocument();
      expect(screen.getByTestId('section-content')).toBeInTheDocument();
    });

    it('should handle single item', () => {
      const singleItem = [{ label: 'Type', value: 'Table' }];
      render(<OverviewSection items={singleItem} />);

      expect(screen.getByText('Type:')).toBeInTheDocument();
      expect(screen.getByText('Table')).toBeInTheDocument();
    });
  });

  describe('Data Types', () => {
    it('should render string values correctly', () => {
      const stringItems = [
        { label: 'Name', value: 'Test Table' },
        { label: 'Type', value: 'Table' },
      ];
      render(<OverviewSection items={stringItems} />);

      expect(screen.getByText('Test Table')).toBeInTheDocument();
      expect(screen.getByText('Table')).toBeInTheDocument();
    });

    it('should render number values correctly', () => {
      const numberItems = [
        { label: 'Count', value: 42 },
        { label: 'Size', value: 0 },
        { label: 'Negative', value: -5 },
      ];
      render(<OverviewSection items={numberItems} />);

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('-5')).toBeInTheDocument();
    });

    it('should render mixed data types', () => {
      const mixedItems = [
        { label: 'Name', value: 'Test Table' },
        { label: 'Count', value: 100 },
        { label: 'Active', value: 'Yes' },
        { label: 'Score', value: 95.5 },
      ];
      render(<OverviewSection items={mixedItems} />);

      expect(screen.getByText('Test Table')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('95.5')).toBeInTheDocument();
    });
  });

  describe('Edit Button', () => {
    it('should not show edit button by default', () => {
      render(<OverviewSection {...defaultProps} />);

      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });

    it('should show edit button when showEditButton is true', () => {
      render(<OverviewSection {...defaultProps} showEditButton />);

      expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    it('should call onEdit when edit button is clicked', () => {
      const mockOnEdit = jest.fn();
      render(
        <OverviewSection {...defaultProps} showEditButton onEdit={mockOnEdit} />
      );

      const editButton = screen.getByTestId('edit-button');
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    it('should not show edit button when showEditButton is false', () => {
      render(<OverviewSection {...defaultProps} showEditButton={false} />);

      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });

    it('should show edit button but not call onEdit when onEdit is not provided', () => {
      render(<OverviewSection {...defaultProps} showEditButton />);

      const editButton = screen.getByTestId('edit-button');

      expect(editButton).toBeInTheDocument();

      // Should not throw error when clicked without onEdit
      expect(() => fireEvent.click(editButton)).not.toThrow();
    });
  });

  describe('Props Handling', () => {
    it('should pass correct props to SectionWithEdit', () => {
      const mockOnEdit = jest.fn();
      render(
        <OverviewSection {...defaultProps} showEditButton onEdit={mockOnEdit} />
      );

      const SectionWithEdit = jest.requireMock(
        '../SectionWithEdit/SectionWithEdit'
      );

      expect(SectionWithEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          showEditButton: true,
          title: 'label.overview',
          onEdit: mockOnEdit,
          children: expect.any(Object),
        }),
        expect.any(Object)
      );
    });

    it('should handle undefined onEdit prop', () => {
      render(<OverviewSection {...defaultProps} showEditButton />);

      const SectionWithEdit = jest.requireMock(
        '../SectionWithEdit/SectionWithEdit'
      );

      expect(SectionWithEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          showEditButton: true,
          title: 'label.overview',
          onEdit: undefined,
          children: expect.any(Object),
        }),
        expect.any(Object)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle items with empty labels', () => {
      const itemsWithEmptyLabels = [
        { label: '', value: 'Value 1' },
        { label: 'Label 2', value: 'Value 2' },
      ];
      render(<OverviewSection items={itemsWithEmptyLabels} />);

      expect(screen.getByText(':')).toBeInTheDocument(); // Empty label with colon
      expect(screen.getByText('Value 1')).toBeInTheDocument();
      expect(screen.getByText('Label 2:')).toBeInTheDocument();
      expect(screen.getByText('Value 2')).toBeInTheDocument();
    });

    it('should handle items with empty values', () => {
      const itemsWithEmptyValues = [
        { label: 'Label 1', value: '' },
        { label: 'Label 2', value: 'Value 2' },
      ];
      render(<OverviewSection items={itemsWithEmptyValues} />);

      expect(screen.getByText('Label 1:')).toBeInTheDocument();
      expect(screen.getByText('Label 2:')).toBeInTheDocument();
      expect(screen.getByText('Value 2')).toBeInTheDocument();
    });

    it('should handle items with special characters in labels', () => {
      const itemsWithSpecialChars = [
        { label: 'Label & Value', value: 'Test' },
        { label: 'Label < > " \'', value: 'Test' },
      ];
      render(<OverviewSection items={itemsWithSpecialChars} />);

      expect(screen.getByText('Label & Value:')).toBeInTheDocument();
      expect(screen.getByText('Label < > " \':')).toBeInTheDocument();
    });

    it('should handle items with special characters in values', () => {
      const itemsWithSpecialValues = [
        { label: 'Name', value: 'Table & Data' },
        { label: 'Description', value: 'Test < > " \'' },
      ];
      render(<OverviewSection items={itemsWithSpecialValues} />);

      expect(screen.getByText('Table & Data')).toBeInTheDocument();
      expect(screen.getByText('Test < > " \'')).toBeInTheDocument();
    });

    it('should handle very long labels and values', () => {
      const longLabel = 'A'.repeat(100);
      const longValue = 'B'.repeat(100);
      const itemsWithLongContent = [{ label: longLabel, value: longValue }];
      render(<OverviewSection items={itemsWithLongContent} />);

      expect(screen.getByText(`${longLabel}:`)).toBeInTheDocument();
      expect(screen.getByText(longValue)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should render items with proper structure for screen readers', () => {
      const { container } = render(<OverviewSection {...defaultProps} />);

      const overviewRows = container.querySelectorAll('.overview-row');

      expect(overviewRows).toHaveLength(5);

      // Each row should have both label and value
      overviewRows.forEach((row) => {
        const label = row.querySelector('.overview-label');
        const value = row.querySelector('.overview-value');

        expect(label).toBeInTheDocument();
        expect(value).toBeInTheDocument();
      });
    });

    it('should render edit button with proper accessibility', () => {
      const mockOnEdit = jest.fn();
      render(
        <OverviewSection {...defaultProps} showEditButton onEdit={mockOnEdit} />
      );

      const editButton = screen.getByTestId('edit-button');

      expect(editButton).toBeInTheDocument();
      expect(editButton.tagName).toBe('BUTTON');
    });
  });

  describe('Performance', () => {
    it('should handle large number of items efficiently', () => {
      const largeItems = Array.from({ length: 100 }, (_, index) => ({
        label: `Label ${index}`,
        value: `Value ${index}`,
      }));

      const { container } = render(<OverviewSection items={largeItems} />);

      const overviewRows = container.querySelectorAll('.overview-row');

      expect(overviewRows).toHaveLength(100);
    });

    it('should re-render efficiently when props change', () => {
      const { rerender } = render(<OverviewSection {...defaultProps} />);

      expect(screen.getByText('Type:')).toBeInTheDocument();

      const newItems = [{ label: 'New Label', value: 'New Value' }];
      rerender(<OverviewSection items={newItems} />);

      expect(screen.getByText('New Label:')).toBeInTheDocument();
      expect(screen.getByText('New Value')).toBeInTheDocument();
      expect(screen.queryByText('Type:')).not.toBeInTheDocument();
    });
  });
});
