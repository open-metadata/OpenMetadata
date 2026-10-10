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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import FQNListSelect, { resolveWildcardFqns } from './FQNListSelect.component';

jest.mock('../../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));
jest.mock('../../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));
const api = jest.fn().mockResolvedValue([
  { value: 'service.schema', label: 'service.schema.*' },
  { value: 'service.schema.table', label: 'service.schema.table' },
]);
const Controlled = () => {
  const [value, setValue] = useState<string[]>([]);

  return (
    <>
      <FQNListSelect
        api={api}
        placeholder="FQN"
        searchIndex={SearchIndex.TABLE}
        value={value}
        onChange={setValue}
      />
      <output data-testid="saved-value">{JSON.stringify(value)}</output>
    </>
  );
};

describe('FQNListSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches exact typed labels and saves the selected FQN without wildcard decoration', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Controlled />);
    const input = screen.getByRole('combobox', { name: 'FQN' });
    await user.type(input, 'service.schema.*');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(api).toHaveBeenLastCalledWith('service.schema.*');
    expect(screen.getByTestId('saved-value')).toHaveTextContent('[]');

    await user.click(screen.getByRole('option', { name: 'service.schema.*' }));

    expect(screen.getByTestId('saved-value')).toHaveTextContent(
      '["service.schema"]'
    );
    expect(screen.getByTestId('fqn-tag-service.schema')).toHaveTextContent(
      'service.schema'
    );
  });

  it('resolves saved ancestors outside the first result page and updates changed form values', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              entityType: 'databaseSchema',
              fullyQualifiedName: 'service.schema',
            },
          },
        ],
      },
    });
    const { rerender } = render(
      <FQNListSelect
        api={api}
        containerEntities={['databaseSchema']}
        placeholder="FQN"
        searchIndex={[SearchIndex.TABLE, SearchIndex.DATABASE_SCHEMA]}
        value={['service.schema']}
      />
    );

    expect(await screen.findByText('service.schema.*')).toBeInTheDocument();

    rerender(
      <FQNListSelect
        api={api}
        placeholder="FQN"
        searchIndex={SearchIndex.TABLE}
        value={['service.schema.table']}
      />
    );

    expect(await screen.findByText('service.schema.table')).toBeInTheDocument();
    expect(screen.queryByText('service.schema.*')).not.toBeInTheDocument();
  });
});

const mockSearchQuery = searchQuery as jest.Mock;

describe('resolveWildcardFqns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns only the FQNs whose entityType is a container type', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              fullyQualifiedName: 'svc',
              entityType: 'databaseService',
            },
          },
          {
            _source: {
              fullyQualifiedName: 'svc.db.schema.tbl',
              entityType: 'table',
            },
          },
        ],
      },
    });

    const result = await resolveWildcardFqns(
      ['svc', 'svc.db.schema.tbl'],
      SearchIndex.TABLE,
      ['databaseService', 'database', 'databaseSchema']
    );

    expect(result).toEqual(['svc']);
  });

  it('queries the exact-match "fullyQualifiedName" field, not a ".keyword" subfield', async () => {
    mockSearchQuery.mockResolvedValue({ hits: { hits: [] } });

    await resolveWildcardFqns(['svc'], SearchIndex.TABLE, ['databaseService']);

    const filter = JSON.stringify(mockSearchQuery.mock.calls[0][0].queryFilter);

    expect(filter).toContain('"fullyQualifiedName":"svc"');
    expect(filter).not.toContain('fullyQualifiedName.keyword');
  });

  it('does not call search when fqns or containerEntities are empty', async () => {
    expect(
      await resolveWildcardFqns([], SearchIndex.TABLE, ['databaseService'])
    ).toEqual([]);
    expect(await resolveWildcardFqns(['svc'], SearchIndex.TABLE, [])).toEqual(
      []
    );
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });

  it('returns an empty list when the search fails', async () => {
    mockSearchQuery.mockRejectedValue(new Error('boom'));

    expect(
      await resolveWildcardFqns(['svc'], SearchIndex.TABLE, ['databaseService'])
    ).toEqual([]);
  });
});
