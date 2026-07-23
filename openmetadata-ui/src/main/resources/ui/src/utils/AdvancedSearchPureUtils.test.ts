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
import { Bucket } from 'Models';
import { EntityType } from '../enums/entity.enum';
import { getOptionsFromAggregationBucket } from './AdvancedSearchPureUtils';

const buckets = [
  { key: 'table', doc_count: 1734 },
  { key: 'tableColumn', doc_count: 21500 },
  { key: EntityType.INGESTION_PIPELINE, doc_count: 5 },
] as Bucket[];

describe('getOptionsFromAggregationBucket', () => {
  it('returns an empty array when buckets is falsy', () => {
    expect(
      getOptionsFromAggregationBucket(undefined as unknown as Bucket[])
    ).toEqual([]);
  });

  it('uses the raw bucket key as label when no formatter is provided', () => {
    const result = getOptionsFromAggregationBucket([
      { key: 'tableColumn', doc_count: 21500 },
    ] as Bucket[]);

    expect(result).toEqual([
      { key: 'tableColumn', label: 'tableColumn', count: 21500 },
    ]);
  });

  it('applies the label formatter to produce human-readable labels', () => {
    const formatter = (key: string) =>
      key === 'tableColumn' ? 'Column' : 'Table';

    const result = getOptionsFromAggregationBucket(
      [
        { key: 'table', doc_count: 1734 },
        { key: 'tableColumn', doc_count: 21500 },
      ] as Bucket[],
      formatter
    );

    expect(result).toEqual([
      { key: 'table', label: 'Table', count: 1734 },
      { key: 'tableColumn', label: 'Column', count: 21500 },
    ]);
  });

  it('keeps the original key while formatting only the label', () => {
    const [option] = getOptionsFromAggregationBucket(
      [{ key: 'tableColumn', doc_count: 1 }] as Bucket[],
      () => 'Column'
    );

    expect(option.key).toBe('tableColumn');
    expect(option.label).toBe('Column');
  });

  it('excludes aggregation keys that should not appear as quick filters', () => {
    const result = getOptionsFromAggregationBucket(buckets);

    expect(
      result.some((option) => option.key === EntityType.INGESTION_PIPELINE)
    ).toBe(false);
  });

  it('defaults count to 0 when doc_count is missing', () => {
    const [option] = getOptionsFromAggregationBucket([
      { key: 'table' },
    ] as Bucket[]);

    expect(option.count).toBe(0);
  });
});
