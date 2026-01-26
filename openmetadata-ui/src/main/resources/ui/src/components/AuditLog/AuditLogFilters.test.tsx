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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AuditLogActiveFilter } from '../../types/auditLogs.interface';
import AuditLogFilters from './AuditLogFilters.component';

const mockOnFiltersChange = jest.fn();

const defaultProps = {
  activeFilters: [] as AuditLogActiveFilter[],
  onFiltersChange: mockOnFiltersChange,
};

jest.mock('../../rest/miscAPI', () => ({
  searchData: jest.fn().mockResolvedValue({
    data: {
      hits: {
        hits: [
          {
            _source: {
              id: 'user-1',
              name: 'test_user',
              displayName: 'Test User',
              email: 'test@example.com',
              entityType: 'user',
            },
          },
          {
            _source: {
              id: 'user-2',
              name: 'admin_user',
              displayName: 'Admin User',
              email: 'admin@example.com',
              entityType: 'user',
            },
          },
        ],
        total: { value: 2 },
      },
    },
  }),
}));

jest.mock('../../rest/botsAPI', () => ({
  getBots: jest.fn().mockResolvedValue({
    data: [
      { id: 'bot-1', name: 'ingestion-bot', displayName: 'Ingestion Bot' },
      { id: 'bot-2', name: 'lineage-bot', displayName: 'Lineage Bot' },
    ],
    paging: { total: 2 },
  }),
}));

jest.mock('../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockImplementation(({ name, displayName }) => (
    <div data-name={name} data-testid="filter-profile-picture">
      {displayName || name}
    </div>
  ))
);

jest.mock('../../utils/TableUtils', () => ({
  getEntityIcon: jest
    .fn()
    .mockImplementation((entityType: string) => (
      <span data-testid={`entity-icon-${entityType}`} />
    )),
}));

describe('AuditLogFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the Filters button', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    expect(screen.getByTestId('filters-dropdown')).toBeInTheDocument();
    expect(screen.getByText('label.filter-plural')).toBeInTheDocument();
  });

  it('should open popover and show filter categories when Filters button is clicked', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.filter-audit-logs')).toBeInTheDocument();
      expect(screen.getByText('label.time')).toBeInTheDocument();
      expect(screen.getByText('label.user')).toBeInTheDocument();
      expect(screen.getByText('label.bot')).toBeInTheDocument();
      expect(screen.getByText('label.entity-type')).toBeInTheDocument();
    });
  });

  it('should show time filter options when Time category is selected', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.time')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.time'));
    });

    await waitFor(() => {
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
      expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
      expect(screen.getByText('label.custom-range')).toBeInTheDocument();
    });
  });

  it('should call onFiltersChange when a time filter option is selected', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.time')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.time'));
    });

    await waitFor(() => {
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Yesterday'));
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'time',
          value: expect.objectContaining({
            key: 'yesterday',
            label: 'Yesterday',
          }),
        }),
      ]),
      expect.objectContaining({
        startTs: expect.any(Number),
        endTs: expect.any(Number),
      })
    );
  });

  it('should show entity type options when Entity Type category is selected', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.entity-type')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.entity-type'));
    });

    await waitFor(() => {
      expect(screen.getByText('Table')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Pipeline')).toBeInTheDocument();
    });
  });

  it('should call onFiltersChange when an entity type is selected', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.entity-type')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.entity-type'));
    });

    await waitFor(() => {
      expect(screen.getByText('Table')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Table'));
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'entityType',
          value: expect.objectContaining({
            label: 'Table',
            value: 'table',
          }),
        }),
      ]),
      expect.objectContaining({
        entityType: 'table',
      })
    );
  });

  it('should render active filter tags', async () => {
    const activeFilters: AuditLogActiveFilter[] = [
      {
        category: 'time',
        categoryLabel: 'Time',
        value: { key: 'yesterday', label: 'Yesterday', value: 'yesterday' },
      },
      {
        category: 'entityType',
        categoryLabel: 'Entity Type',
        value: { key: 'table', label: 'Table', value: 'table' },
      },
    ];

    await act(async () => {
      render(
        <AuditLogFilters {...defaultProps} activeFilters={activeFilters} />
      );
    });

    expect(screen.getByTestId('active-filter-time')).toBeInTheDocument();
    expect(screen.getByTestId('active-filter-entityType')).toBeInTheDocument();
    expect(screen.getByText('Time:')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Entity Type:')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
  });

  it('should remove filter when close icon is clicked on filter tag', async () => {
    const activeFilters: AuditLogActiveFilter[] = [
      {
        category: 'time',
        categoryLabel: 'Time',
        value: { key: 'yesterday', label: 'Yesterday', value: 'yesterday' },
      },
    ];

    await act(async () => {
      render(
        <AuditLogFilters {...defaultProps} activeFilters={activeFilters} />
      );
    });

    const filterTag = screen.getByTestId('active-filter-time');
    const closeIcon = filterTag.querySelector('.anticon-close');

    expect(closeIcon).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(closeIcon!);
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith([], {});
  });

  it('should show Back button in value selector and navigate back to categories', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.time')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.time'));
    });

    await waitFor(() => {
      expect(screen.getByText('label.back')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.back'));
    });

    await waitFor(() => {
      expect(screen.getByText('label.time')).toBeInTheDocument();
      expect(screen.getByText('label.user')).toBeInTheDocument();
    });
  });

  it('should show search input for user category', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.user')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.user'));
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('label.search')).toBeInTheDocument();
    });
  });

  it('should show "Active" tag for categories with active filters', async () => {
    const activeFilters: AuditLogActiveFilter[] = [
      {
        category: 'time',
        categoryLabel: 'Time',
        value: { key: 'yesterday', label: 'Yesterday', value: 'yesterday' },
      },
    ];

    await act(async () => {
      render(
        <AuditLogFilters {...defaultProps} activeFilters={activeFilters} />
      );
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.active')).toBeInTheDocument();
    });
  });

  it('should replace existing filter in same category when new value is selected', async () => {
    const activeFilters: AuditLogActiveFilter[] = [
      {
        category: 'time',
        categoryLabel: 'Time',
        value: { key: 'yesterday', label: 'Yesterday', value: 'yesterday' },
      },
    ];

    await act(async () => {
      render(
        <AuditLogFilters {...defaultProps} activeFilters={activeFilters} />
      );
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.time')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.time'));
    });

    await waitFor(() => {
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Last 7 Days'));
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'time',
          value: expect.objectContaining({
            key: 'last7days',
            label: 'Last 7 Days',
          }),
        }),
      ]),
      expect.any(Object)
    );

    // Should only have one time filter (replaced, not added)
    const call = mockOnFiltersChange.mock.calls[0];
    const filters = call[0];
    const timeFilters = filters.filter(
      (f: AuditLogActiveFilter) => f.category === 'time'
    );

    expect(timeFilters).toHaveLength(1);
  });

  it('should show custom range picker when Custom Range is clicked', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.time')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.time'));
    });

    await waitFor(() => {
      expect(screen.getByText('label.custom-range')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.custom-range'));
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('custom-date-range-picker')
      ).toBeInTheDocument();
    });
  });

  it('should display profile pictures for user options', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.user')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.user'));
    });

    await waitFor(() => {
      const profilePictures = screen.getAllByTestId('filter-profile-picture');

      expect(profilePictures.length).toBeGreaterThan(0);
    });
  });

  it('should display bot icons for bot options', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.bot')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.bot'));
    });

    await waitFor(() => {
      const botAvatars = document.querySelectorAll('.ant-avatar');

      expect(botAvatars.length).toBeGreaterThan(0);
    });
  });

  it('should call onFiltersChange when a bot is selected', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.bot')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.bot'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Lineage Bot').length).toBeGreaterThan(0);
    });

    await act(async () => {
      fireEvent.click(screen.getAllByText('Lineage Bot')[0]);
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'bot',
          value: expect.objectContaining({
            label: 'Lineage Bot',
            value: 'lineage-bot',
          }),
        }),
      ]),
      expect.objectContaining({
        userName: 'lineage-bot',
        actorType: 'BOT',
      })
    );
  });

  it('should call onFiltersChange when a user is selected', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.user')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.user'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Admin User').length).toBeGreaterThan(0);
    });

    await act(async () => {
      fireEvent.click(screen.getAllByText('Admin User')[0]);
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'user',
          value: expect.objectContaining({
            label: 'Admin User',
            value: 'admin_user',
          }),
        }),
      ]),
      expect.objectContaining({
        userName: 'admin_user',
        actorType: 'USER',
      })
    );
  });

  it('should display entity type icons for entity type options', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const filtersButton = screen.getByTestId('filters-dropdown');

    await act(async () => {
      fireEvent.click(filtersButton);
    });

    await waitFor(() => {
      expect(screen.getByText('label.entity-type')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.entity-type'));
    });

    await waitFor(() => {
      expect(screen.getByText('Table')).toBeInTheDocument();
      expect(screen.getByTestId('entity-icon-table')).toBeInTheDocument();
    });
  });
});
