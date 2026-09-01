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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { searchData } from '../../../../../rest/miscAPI';
import React from 'react';
import TaskAssigneeSelect from './TaskAssigneeSelect';

const mockSearchData = searchData as jest.MockedFunction<typeof searchData>;

jest.mock('../../../../../rest/miscAPI', () => ({
  searchData: jest.fn(),
}));

jest.mock('enums/entity.enum', () => ({
  EntityType: { TEAM: 'team', USER: 'user' },
}));

jest.mock('enums/search.enum', () => ({
  SearchIndex: { TEAM: 'team_search_index', USER: 'user_search_index' },
}));

const searchIndexOf = (call: unknown[]) => call[6];

jest.mock('utils/APIUtils', () => ({
  formatUsersResponse: (hits: { _source: unknown }[]) =>
    hits.map((hit) => hit._source),
}));

jest.mock('utils/EntityReferenceUtils', () => ({
  getEntityReferenceListFromEntities: (
    entities: { id: string; name: string }[],
    type: string
  ) => entities.map((entity) => ({ ...entity, type })),
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Autocomplete: Object.assign(
    ({
      items,
      label,
      placeholder,
      hint,
      onItemInserted,
      onItemCleared,
      onSearchChange,
      selectedItems,
    }: {
      items: { id: string; label: string }[];
      label: string;
      placeholder: string;
      hint?: string;
      onItemInserted: (key: string) => void;
      onItemCleared: (key: string) => void;
      onSearchChange: (text: string) => void;
      selectedItems: { id: string; label: string }[];
    }) => (
      <div data-testid="task-action-assignee">
        <span>{label}</span>
        <span>{placeholder}</span>
        {hint && <span data-testid="assignee-hint">{hint}</span>}
        <span data-testid="assignee-selected">
          {selectedItems.map((item) => item.label).join(',')}
        </span>
        <input
          aria-label="assignee-search"
          data-testid="assignee-search"
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {items.map((item) => (
          <button
            data-testid={`assignee-option-${item.id}`}
            key={item.id}
            onClick={() => onItemInserted(item.id)}>
            {item.label}
          </button>
        ))}
        <button
          aria-label="assignee-clear"
          data-testid="assignee-clear"
          onClick={() => onItemCleared('')}
        />
      </div>
    ),
    { Item: ({ children }: { children?: React.ReactNode }) => <>{children}</> }
  ),
}));

jest.mock('@untitledui/icons', () => ({ User03: () => null }), {
  virtual: true,
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const searchResponse = (hits: { id: string; name: string }[]) =>
  ({
    data: { hits: { hits: hits.map((hit) => ({ _source: hit })) } },
  } as never);

describe('TaskAssigneeSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchData.mockResolvedValue(
      searchResponse([{ id: 'u1', name: 'bob' }])
    );
  });

  it('lists users only — a task is reassigned to a person, not a team', async () => {
    await act(async () => {
      render(<TaskAssigneeSelect onChange={jest.fn()} />);
    });

    expect(screen.getByTestId('assignee-option-u1')).toHaveTextContent('bob');
    expect(mockSearchData).toHaveBeenCalledTimes(1);
    expect(searchIndexOf(mockSearchData.mock.calls[0])).toBe(
      'user_search_index'
    );
    // Bots are never assignable.
    expect(mockSearchData.mock.calls[0][3]).toBe('isBot:false');
  });

  it('reports the picked assignee as an entity reference', async () => {
    const onChange = jest.fn();
    await act(async () => {
      render(<TaskAssigneeSelect onChange={onChange} />);
    });

    fireEvent.click(screen.getByTestId('assignee-option-u1'));

    expect(onChange).toHaveBeenCalledWith({
      id: 'u1',
      name: 'bob',
      type: 'user',
    });
  });

  it('clears the selection', async () => {
    const onChange = jest.fn();
    await act(async () => {
      render(
        <TaskAssigneeSelect
          selected={{ id: 'u1', type: 'user', name: 'bob' }}
          onChange={onChange}
        />
      );
    });

    expect(screen.getByTestId('assignee-selected')).toHaveTextContent('bob');

    fireEvent.click(screen.getByTestId('assignee-clear'));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('empties the options when the search fails', async () => {
    mockSearchData.mockReset();
    mockSearchData.mockRejectedValue(new Error('offline'));

    await act(async () => {
      render(<TaskAssigneeSelect onChange={jest.fn()} />);
    });

    expect(screen.queryByTestId('assignee-option-u1')).not.toBeInTheDocument();
    // Still usable: the field renders, just with nothing to pick.
    expect(screen.getByTestId('task-action-assignee')).toBeInTheDocument();
  });

  it('keeps only the newest search result when an earlier one lands late', async () => {
    // mockClear keeps queued once-implementations; reset drops the beforeEach queue.
    mockSearchData.mockReset();
    let resolveFirst!: (value: unknown) => void;
    mockSearchData
      // Initial load: a request that never settles until we say so.
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }) as never
      )
      .mockResolvedValueOnce(searchResponse([{ id: 'u2', name: 'carol' }]));

    render(<TaskAssigneeSelect onChange={jest.fn()} />);

    fireEvent.change(screen.getByTestId('assignee-search'), {
      target: { value: 'ops' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('assignee-option-u2')).toBeInTheDocument()
    );

    await act(async () => {
      resolveFirst(searchResponse([{ id: 'stale', name: 'Stale User' }]));
    });

    expect(
      screen.queryByTestId('assignee-option-stale')
    ).not.toBeInTheDocument();
  });
});
