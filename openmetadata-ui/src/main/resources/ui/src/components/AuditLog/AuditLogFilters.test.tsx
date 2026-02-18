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

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DateRangeObject } from 'Models';
import { AuditLogActiveFilter } from '../../types/auditLogs.interface';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import AuditLogFilters from './AuditLogFilters.component';

const mockOnFiltersChange = jest.fn();

const defaultProps = {
  activeFilters: [] as AuditLogActiveFilter[],
  onFiltersChange: mockOnFiltersChange,
};

let capturedHandleDateRangeChange: (dateRange: DateRangeObject) => void;

jest.mock('../common/DatePickerMenu/DatePickerMenu.component', () =>
  jest.fn().mockImplementation(
    ({
      handleDateRangeChange,
    }: {
      handleDateRangeChange: (dateRange: DateRangeObject) => void;
    }) => {
      capturedHandleDateRangeChange = handleDateRangeChange;

      return (
        <div data-testid="date-picker-menu">
          <button
            data-testid="time-preset-trigger"
            onClick={() =>
              handleDateRangeChange({
                startTs: Date.now() - 86400000,
                endTs: Date.now(),
                key: 'yesterday',
                title: 'Yesterday',
              })
            }>
            Yesterday
          </button>
        </div>
      );
    }
  )
);

const capturedOnChange: Record<
  string,
  (values: SearchDropdownOption[], key: string) => void
> = {};
const capturedOnGetInitialOptions: Record<string, (key: string) => void> = {};

jest.mock('../SearchDropdown/SearchDropdown', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        label,
        searchKey,
        onChange,
        selectedKeys,
        onGetInitialOptions,
      }: {
        label: string;
        searchKey: string;
        onChange: (values: SearchDropdownOption[], key: string) => void;
        selectedKeys: SearchDropdownOption[];
        onGetInitialOptions: (key: string) => void;
      }) => {
        capturedOnChange[searchKey] = onChange;
        capturedOnGetInitialOptions[searchKey] = onGetInitialOptions;

        return (
          <div data-testid={`${searchKey}-filter`}>
            <span data-testid={`${searchKey}-label`}>{label}</span>
            <span data-testid={`${searchKey}-selected-count`}>
              {selectedKeys?.length ?? 0}
            </span>
            <button
              data-testid={`${searchKey}-open`}
              onClick={() =>
                onGetInitialOptions && onGetInitialOptions(searchKey)
              }>
              Open
            </button>
          </div>
        );
      }
    )
);

const mockSearchQuery = jest.fn().mockResolvedValue({
  hits: {
    hits: [
      {
        _source: {
          id: 'user-1',
          name: 'test_user',
          displayName: 'Test User',
        },
      },
    ],
    total: { value: 1 },
  },
});

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));

jest.mock('../../rest/botsAPI', () => ({
  getBots: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'bot-1',
        name: 'ingestion-bot',
        displayName: 'Ingestion Bot',
      },
    ],
    paging: { total: 1 },
  }),
}));

jest.mock('../../utils/APIUtils', () => ({
  formatUsersResponse: jest
    .fn()
    .mockImplementation((hits: { _source: unknown }[]) =>
      hits.map((h) => h._source)
    ),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation(
      (entity: { displayName?: string; name?: string }) =>
        entity.displayName || entity.name
    ),
}));

describe('AuditLogFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(capturedOnChange).forEach((k) => delete capturedOnChange[k]);
    Object.keys(capturedOnGetInitialOptions).forEach(
      (k) => delete capturedOnGetInitialOptions[k]
    );
  });

  it('should render the time picker and all filter dropdowns', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    expect(screen.getByTestId('audit-log-filters')).toBeInTheDocument();
    expect(screen.getByTestId('date-picker-menu')).toBeInTheDocument();
    expect(screen.getByTestId('user-filter')).toBeInTheDocument();
    expect(screen.getByTestId('bot-filter')).toBeInTheDocument();
    expect(screen.getByTestId('entityType-filter')).toBeInTheDocument();
  });

  it('should call onFiltersChange when a time preset is selected', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const now = Date.now();
    await act(async () => {
      capturedHandleDateRangeChange({
        startTs: now - 86400000,
        endTs: now,
        key: 'yesterday',
        title: 'Yesterday',
      });
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'time',
          value: expect.objectContaining({
            key: 'yesterday',
            startTs: expect.any(Number),
            endTs: expect.any(Number),
          }),
        }),
      ]),
      expect.objectContaining({
        startTs: expect.any(Number),
        endTs: expect.any(Number),
      })
    );
  });

  it('should call onFiltersChange when a custom time range is selected', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    const startTs = 1700000000000;
    const endTs = 1700086400000;

    await act(async () => {
      capturedHandleDateRangeChange({
        startTs,
        endTs,
        key: 'customRange',
        title: '2023-11-14 -> 2023-11-15',
      });
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'time',
          value: expect.objectContaining({
            key: 'customRange',
            startTs,
            endTs,
          }),
        }),
      ]),
      expect.objectContaining({ startTs, endTs })
    );
  });

  it('should call onFiltersChange when an entity type is selected', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    await act(async () => {
      capturedOnChange['entityType'](
        [{ key: 'table', label: 'Table' }],
        'entityType'
      );
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'entityType',
          value: expect.objectContaining({
            key: 'table',
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

  it('should show selected count for user and bot filters', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    expect(screen.getByTestId('user-selected-count')).toHaveTextContent('0');
    expect(screen.getByTestId('bot-selected-count')).toHaveTextContent('0');
  });

  it('should replace existing time filter when a new preset is selected', async () => {
    const activeFilters: AuditLogActiveFilter[] = [
      {
        category: 'time',
        categoryLabel: 'Time',
        value: {
          key: 'yesterday',
          label: 'Yesterday',
          value: 'yesterday',
        },
      },
    ];

    await act(async () => {
      render(<AuditLogFilters {...defaultProps} activeFilters={activeFilters} />);
    });

    const now = Date.now();
    await act(async () => {
      capturedHandleDateRangeChange({
        startTs: now - 7 * 86400000,
        endTs: now,
        key: 'last7days',
        title: 'Last 7 Days',
      });
    });

    const calls = mockOnFiltersChange.mock.calls;
    const lastCall = calls[calls.length - 1];
    const timeFilters = lastCall[0].filter(
      (f: AuditLogActiveFilter) => f.category === 'time'
    );

    expect(timeFilters).toHaveLength(1);
    expect(timeFilters[0].value.key).toBe('last7days');
  });

  it('should handle multiple filters from different categories', async () => {
    const now = Date.now();
    const activeFilters: AuditLogActiveFilter[] = [
      {
        category: 'time',
        categoryLabel: 'Time',
        value: {
          key: 'yesterday',
          label: 'Yesterday',
          value: 'yesterday',
          startTs: now - 86400000,
          endTs: now,
        },
      },
    ];

    await act(async () => {
      render(<AuditLogFilters {...defaultProps} activeFilters={activeFilters} />);
    });

    await act(async () => {
      capturedOnChange['entityType'](
        [{ key: 'table', label: 'Table' }],
        'entityType'
      );
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ category: 'time' }),
        expect.objectContaining({ category: 'entityType' }),
      ]),
      expect.objectContaining({
        startTs: expect.any(Number),
        endTs: expect.any(Number),
        entityType: 'table',
      })
    );
  });

  it('should fetch users when user dropdown is opened', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('user-open'));
    });

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '',
          pageNumber: 1,
          pageSize: 10,
          searchIndex: 'user_search_index',
          queryFilter: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                must: expect.arrayContaining([
                  expect.objectContaining({
                    term: { isBot: 'false' },
                  }),
                ]),
              }),
            }),
          }),
        })
      );
    });
  });

  it('should fetch bots when bot dropdown is opened', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('bot-open'));
    });

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '',
          pageNumber: 1,
          pageSize: 10,
          searchIndex: 'user_search_index',
          queryFilter: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                must: expect.arrayContaining([
                  expect.objectContaining({
                    term: { isBot: 'true' },
                  }),
                ]),
              }),
            }),
          }),
        })
      );
    });
  });

  it('should call onFiltersChange with user filter and actorType USER', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    await act(async () => {
      capturedOnChange['user'](
        [{ key: 'test_user', label: 'Test User' }],
        'user'
      );
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'user',
          value: expect.objectContaining({
            value: 'test_user',
          }),
        }),
      ]),
      expect.objectContaining({
        userName: 'test_user',
        actorType: 'USER',
      })
    );
  });

  it('should call onFiltersChange with bot filter and actorType BOT', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    await act(async () => {
      capturedOnChange['bot'](
        [{ key: 'ingestion-bot', label: 'Ingestion Bot' }],
        'bot'
      );
    });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'bot',
          value: expect.objectContaining({
            value: 'ingestion-bot',
          }),
        }),
      ]),
      expect.objectContaining({
        userName: 'ingestion-bot',
        actorType: 'BOT',
      })
    );
  });

  it('should ensure user and bot filters result in correct actor params', async () => {
    await act(async () => {
      render(<AuditLogFilters {...defaultProps} />);
    });

    await act(async () => {
      capturedOnChange['user'](
        [{ key: 'test_user', label: 'Test User' }],
        'user'
      );
    });

    const userCall =
      mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1];

    expect(userCall[1]).toMatchObject({
      userName: 'test_user',
      actorType: 'USER',
    });

    await act(async () => {
      capturedOnChange['bot'](
        [{ key: 'ingestion-bot', label: 'Ingestion Bot' }],
        'bot'
      );
    });

    const botCall =
      mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1];

    expect(botCall[1]).toMatchObject({
      userName: 'ingestion-bot',
      actorType: 'BOT',
    });
  });
});
