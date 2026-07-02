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
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { SearchDropdownOption } from '../../../components/SearchDropdown/SearchDropdown.interface';
import { EntityReference } from '../../../generated/type/entityReference';
import {
  getEndOfDayInMillis,
  getStartOfDayInMillis,
} from '../../../utils/date-time/DateTimeUtils';
import {
  DqFilterDescriptor,
  useDataQualityDashboardFilters,
} from './useDataQualityDashboardFilters';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSearchQuery = jest.fn().mockResolvedValue({ hits: { hits: [] } });

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));

const option = (key: string): SearchDropdownOption => ({ key, label: key });

const findSearch = (filters: DqFilterDescriptor[], searchKey: string) => {
  const descriptor = filters.find(
    (filter) => filter.type === 'search' && filter.searchKey === searchKey
  );
  if (descriptor?.type !== 'search') {
    throw new Error(`No search filter for ${searchKey}`);
  }

  return descriptor;
};

const findOwner = (filters: DqFilterDescriptor[]) => {
  const descriptor = filters.find((filter) => filter.type === 'owner');
  if (descriptor?.type !== 'owner') {
    throw new Error('No owner filter');
  }

  return descriptor;
};

// Settles the mount-time default option fetches so their state updates do not
// leak past the test as act() warnings.
const renderFilters = async (
  props: Parameters<typeof useDataQualityDashboardFilters>[0] = {}
) => {
  const rendered = renderHook(() => useDataQualityDashboardFilters(props));
  await act(async () => {
    await Promise.resolve();
  });

  return rendered;
};

describe('useDataQualityDashboardFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits every filter descriptor in a stable order by default', async () => {
    const { result } = await renderFilters();

    expect(result.current.filters.map((filter) => filter.key)).toEqual([
      'owner',
      'tier',
      'certification',
      'tag',
      'glossaryTerm',
      'dataProduct',
    ]);
    expect(result.current.showFilterBar).toBe(true);
    expect(result.current.hasVisibleFilters).toBe(true);
  });

  it('omits filters listed in hiddenFilters', async () => {
    const { result } = await renderFilters({ hiddenFilters: ['tier', 'tags'] });

    expect(result.current.filters.map((filter) => filter.key)).toEqual([
      'owner',
      'certification',
      'glossaryTerm',
      'dataProduct',
    ]);
  });

  it('reports no visible filters when all are hidden', async () => {
    const { result } = await renderFilters({
      hiddenFilters: [
        'owner',
        'tier',
        'certification',
        'tags',
        'glossaryTerms',
        'dataProducts',
      ],
    });

    expect(result.current.filters).toHaveLength(0);
    expect(result.current.hasVisibleFilters).toBe(false);
  });

  it('hides the filter bar when hideFilterBar is set', async () => {
    const { result } = await renderFilters({ hideFilterBar: true });

    expect(result.current.showFilterBar).toBe(false);
  });

  it('seeds chartFilter from initialFilters', async () => {
    const { result } = await renderFilters({
      initialFilters: { tier: ['Tier.Gold'] },
    });

    expect(result.current.chartFilter.tier).toEqual(['Tier.Gold']);
  });

  it('maps a search selection into chartFilter and flags active filters', async () => {
    const { result } = await renderFilters();

    act(() => {
      findSearch(result.current.filters, 'tier').searchProps.onChange([
        option('Tier.Gold'),
      ]);
    });

    expect(result.current.chartFilter.tier).toEqual(['Tier.Gold']);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('maps an owner selection into chartFilter.ownerFqn', async () => {
    const { result } = await renderFilters();

    act(() => {
      findOwner(result.current.filters).onChange([
        { id: '1', type: 'user', name: 'john' },
      ]);
    });

    expect(result.current.chartFilter.ownerFqn).toBe('john');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('merges glossary terms into defaultFilters tags and drops the raw key', async () => {
    const { result } = await renderFilters();

    act(() => {
      findSearch(result.current.filters, 'tag').searchProps.onChange([
        option('PII.Sensitive'),
      ]);
    });
    act(() => {
      findSearch(result.current.filters, 'glossaryTerms').searchProps.onChange([
        option('Glossary.Term'),
      ]);
    });

    expect(result.current.chartFilter.glossaryTerms).toEqual(['Glossary.Term']);
    expect(result.current.defaultFilters.tags).toEqual([
      'PII.Sensitive',
      'Glossary.Term',
    ]);
    expect(result.current.defaultFilters.glossaryTerms).toBeUndefined();
  });

  it('exposes the active selection through pieChartFilters', async () => {
    const { result } = await renderFilters();

    act(() => {
      findSearch(result.current.filters, 'tier').searchProps.onChange([
        option('Tier.Gold'),
      ]);
    });

    expect(result.current.pieChartFilters.tier).toEqual(['Tier.Gold']);
  });

  it('clears every selection while preserving the date range', async () => {
    const { result } = await renderFilters();
    const { startTs, endTs } = result.current.chartFilter;

    act(() => {
      findSearch(result.current.filters, 'tier').searchProps.onChange([
        option('Tier.Gold'),
      ]);
    });
    act(() => {
      findOwner(result.current.filters).onChange([
        { id: '1', type: 'user', name: 'john' } as EntityReference,
      ]);
    });

    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.chartFilter).toEqual({ startTs, endTs });
    expect(
      findSearch(result.current.filters, 'tier').searchProps.selectedKeys
    ).toEqual([]);
  });

  it('normalizes a new date range to start/end of day', async () => {
    const { result } = await renderFilters();
    const startTs = 1700000000000;
    const endTs = 1700600000000;

    act(() => {
      result.current.onDateRangeChange({ startTs, endTs, key: 'custom' });
    });

    expect(result.current.chartFilter.startTs).toBe(
      getStartOfDayInMillis(startTs)
    );
    expect(result.current.chartFilter.endTs).toBe(getEndOfDayInMillis(endTs));
    expect(result.current.dateRange).toEqual({
      startTs: result.current.chartFilter.startTs,
      endTs: result.current.chartFilter.endTs,
    });
  });
});
