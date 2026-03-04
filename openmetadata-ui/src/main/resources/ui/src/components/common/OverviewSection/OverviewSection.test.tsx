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

// Mock CommonEntitySummaryInfoV1 component
jest.mock('./CommonEntitySummaryInfoV1', () => {
  return jest
    .fn()
    .mockImplementation(({ entityInfo, excludedItems = [], componentType }) => {
      const filteredInfo = entityInfo.filter(
        (item: { name: string; visible?: string[] }) => {
          if (excludedItems.includes(item.name)) {
            return false;
          }

          return !componentType || (item.visible ?? []).includes(componentType);
        }
      );

      return (
        <div className="overview-section">
          {filteredInfo.map((info: { name: string; value: unknown }) => (
            <div className="overview-row" key={info.name}>
              <span
                className="overview-label"
                data-testid={`${info.name}-label`}>
                {info.name}
              </span>
              <span
                className="overview-value text-grey-body"
                data-testid={`${info.name}-value`}>
                {String(info.value)}
              </span>
            </div>
          ))}
        </div>
      );
    });
});

const entityInfoV1 = [
  { name: 'Type', value: 'Table', visible: ['explore'] },
  { name: 'Rows', value: 1000, visible: ['explore'] },
  { name: 'Columns', value: 15, visible: ['explore'] },
  { name: 'Queries', value: 250, visible: ['explore'] },
  { name: 'Incidents', value: 3, visible: ['explore'] },
];

const defaultProps = {
  entityInfoV1,
  componentType: 'explore',
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
    it('should render all overview items from entityInfoV1', () => {
      render(<OverviewSection {...defaultProps} />);

      expect(screen.getByTestId('Type-label')).toBeInTheDocument();
      expect(screen.getByTestId('Type-value')).toHaveTextContent('Table');
      expect(screen.getByTestId('Rows-label')).toBeInTheDocument();
      expect(screen.getByTestId('Rows-value')).toHaveTextContent('1000');
      expect(screen.getByTestId('Columns-label')).toBeInTheDocument();
      expect(screen.getByTestId('Columns-value')).toHaveTextContent('15');
      expect(screen.getByTestId('Queries-label')).toBeInTheDocument();
      expect(screen.getByTestId('Queries-value')).toHaveTextContent('250');
      expect(screen.getByTestId('Incidents-label')).toBeInTheDocument();
      expect(screen.getByTestId('Incidents-value')).toHaveTextContent('3');
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

    it('should exclude Owners and Tier items via excludedItems prop', () => {
      const infoWithExcluded = [
        { name: 'Type', value: 'Table', visible: ['explore'] },
        { name: 'Owners', value: 'John Doe', visible: ['explore'] },
        { name: 'Tier', value: 'Gold', visible: ['explore'] },
        { name: 'Rows', value: 1000, visible: ['explore'] },
      ];

      render(
        <OverviewSection
          componentType="explore"
          entityInfoV1={infoWithExcluded}
        />
      );

      expect(screen.getByTestId('Type-label')).toBeInTheDocument();
      expect(screen.getByTestId('Rows-label')).toBeInTheDocument();
      expect(screen.queryByTestId('Owners-label')).not.toBeInTheDocument();
      expect(screen.queryByTestId('Tier-label')).not.toBeInTheDocument();
    });

    it('should handle single item', () => {
      const info = [{ name: 'Type', value: 'Table', visible: ['explore'] }];
      render(<OverviewSection componentType="explore" entityInfoV1={info} />);

      expect(screen.getByTestId('Type-label')).toBeInTheDocument();
      expect(screen.getByTestId('Type-value')).toHaveTextContent('Table');
    });
  });

  describe('Data Types', () => {
    it('should render string values correctly', () => {
      const info = [
        { name: 'Name', value: 'Test Table', visible: ['explore'] },
        { name: 'Type', value: 'Table', visible: ['explore'] },
      ];
      render(<OverviewSection componentType="explore" entityInfoV1={info} />);

      expect(screen.getByText('Test Table')).toBeInTheDocument();
      expect(screen.getByText('Table')).toBeInTheDocument();
    });

    it('should render number values correctly', () => {
      const info = [
        { name: 'Count', value: 42, visible: ['explore'] },
        { name: 'Size', value: 0, visible: ['explore'] },
        { name: 'Negative', value: -5, visible: ['explore'] },
      ];
      render(<OverviewSection componentType="explore" entityInfoV1={info} />);

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('-5')).toBeInTheDocument();
    });

    it('should render mixed data types', () => {
      const info = [
        { name: 'Name', value: 'Test Table', visible: ['explore'] },
        { name: 'Count', value: 100, visible: ['explore'] },
        { name: 'Active', value: 'Yes', visible: ['explore'] },
        { name: 'Score', value: 95.5, visible: ['explore'] },
      ];
      render(<OverviewSection componentType="explore" entityInfoV1={info} />);

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

      // Assert via DOM to avoid brittle prop shape checks on mock component
      expect(screen.getByTestId('section-title')).toHaveTextContent(
        'label.overview'
      );

      const editButton = screen.getByTestId('edit-button');

      expect(editButton).toBeInTheDocument();
      expect(() => fireEvent.click(editButton)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle items with empty labels', () => {
      const info = [
        { name: '', value: 'Value 1', visible: ['explore'] },
        { name: 'Label 2', value: 'Value 2', visible: ['explore'] },
      ];
      render(<OverviewSection componentType="explore" entityInfoV1={info} />);

      expect(screen.getByText('Value 1')).toBeInTheDocument();
      expect(screen.getByTestId('Label 2-value')).toHaveTextContent('Value 2');
    });

    it('should handle items with empty values', () => {
      const info = [
        { name: 'Label 1', value: '', visible: ['explore'] },
        { name: 'Label 2', value: 'Value 2', visible: ['explore'] },
      ];
      render(<OverviewSection componentType="explore" entityInfoV1={info} />);

      expect(screen.getByTestId('Label 1-label')).toBeInTheDocument();
      expect(screen.getByTestId('Label 2-value')).toHaveTextContent('Value 2');
    });

    it('should handle items with special characters in labels', () => {
      const info = [
        { name: 'Label & Value', value: 'Test', visible: ['explore'] },
        { name: 'Label < > " \'', value: 'Test', visible: ['explore'] },
      ];
      render(<OverviewSection componentType="explore" entityInfoV1={info} />);

      expect(screen.getByTestId('Label & Value-value')).toHaveTextContent(
        'Test'
      );
      expect(screen.getByTestId('Label < > " \'-value')).toHaveTextContent(
        'Test'
      );
    });

    it('should handle items with special characters in values', () => {
      const info = [
        { name: 'Name', value: 'Table & Data', visible: ['explore'] },
        { name: 'Description', value: 'Test < > " \'', visible: ['explore'] },
      ];
      render(<OverviewSection componentType="explore" entityInfoV1={info} />);

      expect(screen.getByText('Table & Data')).toBeInTheDocument();
      expect(screen.getByText('Test < > " \'')).toBeInTheDocument();
    });

    it('should handle very long labels and values', () => {
      const longLabel = 'A'.repeat(100);
      const longValue = 'B'.repeat(100);
      const info = [
        { name: longLabel, value: longValue, visible: ['explore'] },
      ];
      render(<OverviewSection componentType="explore" entityInfoV1={info} />);

      expect(screen.getByTestId(`${longLabel}-label`)).toBeInTheDocument();
      expect(screen.getByTestId(`${longLabel}-value`)).toHaveTextContent(
        longValue
      );
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
      const info = Array.from({ length: 100 }, (_, index) => ({
        name: `Label ${index}`,
        value: `Value ${index}`,
        visible: ['explore'],
      }));

      const { container } = render(
        <OverviewSection componentType="explore" entityInfoV1={info} />
      );

      const overviewRows = container.querySelectorAll('.overview-row');

      expect(overviewRows).toHaveLength(100);
    });

    it('should re-render efficiently when props change', () => {
      const { rerender } = render(<OverviewSection {...defaultProps} />);

      expect(screen.getByTestId('Type-value')).toHaveTextContent('Table');

      const newInfo = [
        { name: 'New Label', value: 'New Value', visible: ['explore'] },
      ];
      rerender(
        <OverviewSection componentType="explore" entityInfoV1={newInfo} />
      );

      expect(screen.getByTestId('New Label-value')).toHaveTextContent(
        'New Value'
      );
      expect(screen.queryByTestId('Type-value')).not.toBeInTheDocument();
    });
  });
});
