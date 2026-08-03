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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import type { EntityReference } from '../../../generated/entity/type';
import { searchQuery } from '../../../rest/searchAPI';
import MetricReferencePicker from './MetricReferencePicker';

jest.mock('../../../rest/searchAPI');

const renderPicker = (
  selected: EntityReference[] = [],
  onChange = jest.fn(),
  override: Partial<ComponentProps<typeof MetricReferencePicker>> = {}
) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <MetricReferencePicker
        label="label.reviewer-plural"
        searchIndexes={[SearchIndex.USER, SearchIndex.TEAM]}
        selected={selected}
        onChange={onChange}
        {...override}
      />
    </QueryClientProvider>
  );

describe('MetricReferencePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          {
            _index: 'user_search_index',
            _source: {
              id: 'reviewer-id',
              name: 'reviewer',
              displayName: 'Metric Reviewer',
              fullyQualifiedName: 'reviewer',
            },
          },
        ],
        total: { value: 1 },
      },
    });
  });

  it('searches a bounded user/team collection and selects a result', async () => {
    const onChange = jest.fn();
    renderPicker([], onChange);

    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'label.search-entity',
      }),
      { target: { value: 'reviewer' } }
    );
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Metric Reviewer' })
    );

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'reviewer-id',
        type: 'user',
      }),
    ]);

    await waitFor(() =>
      expect(searchQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pageNumber: 1,
          pageSize: 20,
          query: 'reviewer',
          searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
        })
      )
    );
  });

  it('renders selected values and supports keyboard-compatible removal', async () => {
    const onChange = jest.fn();
    const selected = [{ id: 'reviewer-id', name: 'reviewer', type: 'user' }];
    renderPicker(selected, onChange);

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Metric Reviewer',
    });

    expect(screen.getByText('reviewer')).toBeInTheDocument();

    fireEvent.keyDown(checkbox, { key: ' ' });
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows a retryable error and a loading announcement', async () => {
    let rejectSearch: (error: Error) => void = () => undefined;
    (searchQuery as jest.Mock).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectSearch = reject;
      })
    );
    renderPicker();

    expect(
      screen.getByRole('status', { name: 'label.loading' })
    ).toBeInTheDocument();

    rejectSearch(new Error('search failed'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.try-again' }));
    await waitFor(() => expect(searchQuery).toHaveBeenCalledTimes(2));
  });

  it('pages through bounded search results', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [],
        total: { value: 41 },
      },
    });
    renderPicker();

    fireEvent.click(await screen.findByTestId('metric-reference-next'));

    await waitFor(() =>
      expect(searchQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNumber: 2, pageSize: 20 })
      )
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('status', { name: 'label.loading' })
      ).not.toBeInTheDocument()
    );

    expect(screen.getByText(/label.page 2 \/ 3/)).toBeInTheDocument();
  });

  it('supports filtered, FQN-keyed single selection', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          {
            _index: 'tag_search_index',
            _source: {
              id: 'tier-id',
              name: 'Tier2',
              fullyQualifiedName: 'Tier.Tier2',
            },
          },
          {
            _index: 'tag_search_index',
            _source: {
              id: 'pii-id',
              name: 'Sensitive',
              fullyQualifiedName: 'PII.Sensitive',
            },
          },
        ],
        total: { value: 2 },
      },
    });
    const onChange = jest.fn();
    renderPicker(
      [
        {
          fullyQualifiedName: 'Tier.Tier1',
          id: 'Tier.Tier1',
          name: 'Tier1',
          type: 'tag',
        },
      ],
      onChange,
      {
        identityField: 'fullyQualifiedName',
        maxSelections: 1,
        optionFilter: (reference) =>
          reference.fullyQualifiedName?.startsWith('Tier.') ?? false,
        searchIndexes: [SearchIndex.TAG],
      }
    );

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Tier2' }));

    expect(
      screen.queryByRole('checkbox', { name: 'Sensitive' })
    ).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        fullyQualifiedName: 'Tier.Tier2',
        id: 'Tier.Tier2',
      }),
    ]);
  });

  it('disables search and choices while its parent mutation is pending', async () => {
    renderPicker([], jest.fn(), { isDisabled: true });

    expect(
      screen.getByRole('textbox', { name: 'label.search-entity' })
    ).toBeDisabled();
    expect(
      await screen.findByRole('checkbox', { name: 'Metric Reviewer' })
    ).toBeDisabled();
  });
});
