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

  it('uses the raw bucket key as label when no sourceFields is provided', () => {
    const result = getOptionsFromAggregationBucket([
      { key: 'tableColumn', doc_count: 21500 },
    ] as Bucket[]);

    expect(result).toEqual([
      { key: 'tableColumn', label: 'tableColumn', count: 21500 },
    ]);
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

  describe('sourceFields - top_hits label extraction', () => {
    it('reads label from flat _source field when sourceFields is set', () => {
      const bucket = {
        key: 'john doe',
        doc_count: 3,
        'top_hits#top': {
          hits: { hits: [{ _source: { ownerDisplayName: 'John Doe' } }] },
        },
      } as unknown as Bucket;

      const [option] = getOptionsFromAggregationBucket(
        [bucket],
        'ownerDisplayName'
      );

      expect(option.key).toBe('john doe');
      expect(option.label).toBe('John Doe');
    });

    it('reads label from nested single-object _source path', () => {
      const bucket = {
        key: 'tier.tier1',
        doc_count: 2,
        'top_hits#top': {
          hits: {
            hits: [{ _source: { tier: { tagFQN: 'Tier.Tier1' } } }],
          },
        },
      } as unknown as Bucket;

      const [option] = getOptionsFromAggregationBucket(
        [bucket],
        'tier.tagFQN'
      );

      expect(option.key).toBe('tier.tier1');
      expect(option.label).toBe('Tier.Tier1');
    });

    it('matches the correct array element by bucket key (not always [0])', () => {
      const bucket = {
        key: 'my domain',
        doc_count: 1,
        'top_hits#top': {
          hits: {
            hits: [
              {
                _source: {
                  domains: [
                    { displayName: 'Other Domain' },
                    { displayName: 'My Domain' },
                  ],
                },
              },
            ],
          },
        },
      } as unknown as Bucket;

      const [option] = getOptionsFromAggregationBucket(
        [bucket],
        'domains.displayName'
      );

      expect(option.key).toBe('my domain');
      expect(option.label).toBe('My Domain');
    });

    it('falls back to bucket key when no top_hits data is present', () => {
      const bucket = {
        key: 'my domain',
        doc_count: 1,
      } as unknown as Bucket;

      const [option] = getOptionsFromAggregationBucket(
        [bucket],
        'domains.displayName'
      );

      expect(option.key).toBe('my domain');
      expect(option.label).toBe('my domain');
    });

    it('reads label from string-array _source field (ownerDisplayName pattern)', () => {
      const bucket = {
        key: 'aaron johnson',
        doc_count: 1,
        'top_hits#top': {
          hits: {
            hits: [{ _source: { ownerDisplayName: ['Aaron Johnson'] } }],
          },
        },
      } as unknown as Bucket;

      const [option] = getOptionsFromAggregationBucket(
        [bucket],
        'ownerDisplayName'
      );

      expect(option.key).toBe('aaron johnson');
      expect(option.label).toBe('Aaron Johnson');
    });

    it('picks the matching entry from a multi-value string-array by bucket key', () => {
      const bucket = {
        key: 'aaron johnson',
        doc_count: 1,
        'top_hits#top': {
          hits: {
            hits: [
              {
                _source: {
                  ownerDisplayName: ['Bob Smith', 'Aaron Johnson'],
                },
              },
            ],
          },
        },
      } as unknown as Bucket;

      const [option] = getOptionsFromAggregationBucket(
        [bucket],
        'ownerDisplayName'
      );

      expect(option.key).toBe('aaron johnson');
      expect(option.label).toBe('Aaron Johnson');
    });
  });
});
