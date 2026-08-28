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
import { renderHook, waitFor } from '@testing-library/react';
import { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import { getAggregationOptions } from '../utils/ExploreUtils';
import { useQuickFilterLabels } from './useQuickFilterLabels';

jest.mock('../utils/ExploreUtils', () => ({
  getAggregationOptions: jest.fn(),
}));

const mockGetAggregationOptions = getAggregationOptions as jest.Mock;

const TERM_KEY = 'enterprise business glossary.advanced shipment notification';
const TERM_LABEL =
  'Enterprise Business Glossary.Advanced Shipment Notification';

const glossaryFields = (optionKeys: string[]): ExploreQuickFilterField[] => [
  {
    key: EntityFields.GLOSSARY_TERMS,
    label: 'label.glossary-term-plural',
    value: optionKeys.map((key) => ({ key, label: key })),
  },
];

const aggregationResponse = (keys: string[], labels: string[]) => ({
  data: {
    aggregations: {
      [`sterms#${EntityFields.GLOSSARY_TERMS}`]: {
        buckets: keys.map((key, index) => ({
          key,
          doc_count: 1,
          'top_hits#top': {
            hits: { hits: [{ _source: { glossaryTags: [labels[index]] } }] },
          },
        })),
      },
    },
  },
});

const renderQuickFilterLabels = (
  fields: ExploreQuickFilterField[],
  sources: unknown[]
) =>
  renderHook(() =>
    useQuickFilterLabels({ fields, sources, index: SearchIndex.DATA_PRODUCT })
  );

describe('useQuickFilterLabels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('takes the casing from the listed rows without an extra request', async () => {
    const { result } = renderQuickFilterLabels(glossaryFields([TERM_KEY]), [
      { glossaryTags: [TERM_LABEL] },
    ]);

    await waitFor(() =>
      expect(result.current[0].value?.[0].label).toBe(TERM_LABEL)
    );

    expect(mockGetAggregationOptions).not.toHaveBeenCalled();
  });

  it('resolves a value the listed rows cannot explain with one aggregation', async () => {
    mockGetAggregationOptions.mockResolvedValue(
      aggregationResponse([TERM_KEY], [TERM_LABEL])
    );

    // The row on this page carries a sibling value of the same field, so the
    // selected value's casing is not present in the current results.
    const { result } = renderQuickFilterLabels(glossaryFields([TERM_KEY]), [
      { glossaryTags: ['Some Other Glossary.Some Other Term'] },
    ]);

    await waitFor(() =>
      expect(result.current[0].value?.[0].label).toBe(TERM_LABEL)
    );

    expect(mockGetAggregationOptions).toHaveBeenCalledTimes(1);
    expect(mockGetAggregationOptions).toHaveBeenCalledWith(
      SearchIndex.DATA_PRODUCT,
      EntityFields.GLOSSARY_TERMS,
      TERM_KEY,
      '',
      false,
      false,
      undefined,
      false,
      '',
      'glossaryTags'
    );
  });

  it('keeps a resolved label while paging through rows that lack the value', async () => {
    mockGetAggregationOptions.mockResolvedValue(
      aggregationResponse([TERM_KEY], [TERM_LABEL])
    );

    const fields = glossaryFields([TERM_KEY]);
    const { result, rerender } = renderHook(
      ({ sources }: { sources: unknown[] }) =>
        useQuickFilterLabels({
          fields,
          sources,
          index: SearchIndex.DATA_PRODUCT,
        }),
      { initialProps: { sources: [{ glossaryTags: [TERM_LABEL] }] } }
    );

    await waitFor(() =>
      expect(result.current[0].value?.[0].label).toBe(TERM_LABEL)
    );

    rerender({ sources: [{ glossaryTags: ['Unrelated.Value'] }] });

    expect(result.current[0].value?.[0].label).toBe(TERM_LABEL);
    expect(mockGetAggregationOptions).not.toHaveBeenCalled();
  });

  it('keeps the lowercased key when the aggregation cannot resolve it', async () => {
    mockGetAggregationOptions.mockResolvedValue(aggregationResponse([], []));

    const { result } = renderQuickFilterLabels(glossaryFields([TERM_KEY]), []);

    await waitFor(() => expect(mockGetAggregationOptions).toHaveBeenCalled());

    expect(result.current[0].value?.[0].label).toBe(TERM_KEY);
    // A value that resolves to nothing must not be retried in a loop.
    expect(mockGetAggregationOptions).toHaveBeenCalledTimes(1);
  });

  it('keeps the lowercased key when the aggregation request fails', async () => {
    mockGetAggregationOptions.mockRejectedValue(new Error('network'));

    const { result } = renderQuickFilterLabels(glossaryFields([TERM_KEY]), []);

    await waitFor(() => expect(mockGetAggregationOptions).toHaveBeenCalled());

    expect(result.current[0].value?.[0].label).toBe(TERM_KEY);
  });

  it('asks for an unresolvable value once, not on every row change', async () => {
    mockGetAggregationOptions.mockResolvedValue(aggregationResponse([], []));

    const fields = glossaryFields([TERM_KEY]);
    const { rerender } = renderHook(
      ({ sources }: { sources: unknown[] }) =>
        useQuickFilterLabels({
          fields,
          sources,
          index: SearchIndex.DATA_PRODUCT,
        }),
      { initialProps: { sources: [{ glossaryTags: ['Unrelated.Value'] }] } }
    );

    await waitFor(() => expect(mockGetAggregationOptions).toHaveBeenCalled());

    rerender({ sources: [{ glossaryTags: ['Another.Value'] }] });
    rerender({ sources: [] });

    expect(mockGetAggregationOptions).toHaveBeenCalledTimes(1);
  });

  it('does not request anything for a field aggregated in its original case', async () => {
    const { result } = renderQuickFilterLabels(
      [
        {
          key: EntityFields.ENTITY_TYPE,
          label: 'label.entity-type-plural',
          value: [{ key: 'table', label: 'table' }],
        },
      ],
      []
    );

    await waitFor(() => expect(result.current[0].value?.[0].key).toBe('table'));

    expect(mockGetAggregationOptions).not.toHaveBeenCalled();
  });

  it('requests each unresolved value of a multi-select field once', async () => {
    const secondKey = 'enterprise business glossary.purchase order';
    const secondLabel = 'Enterprise Business Glossary.Purchase Order';
    mockGetAggregationOptions.mockImplementation((_index, _key, value) =>
      Promise.resolve(
        value === TERM_KEY
          ? aggregationResponse([TERM_KEY], [TERM_LABEL])
          : aggregationResponse([secondKey], [secondLabel])
      )
    );

    const { result } = renderQuickFilterLabels(
      glossaryFields([TERM_KEY, secondKey]),
      []
    );

    await waitFor(() =>
      expect(result.current[0].value?.map((option) => option.label)).toEqual([
        TERM_LABEL,
        secondLabel,
      ])
    );

    expect(mockGetAggregationOptions).toHaveBeenCalledTimes(2);
  });
});
