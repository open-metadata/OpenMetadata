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
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import {
  getOptionsFromAggregationBucket,
  getQuickFilterSourceFields,
  hydrateQuickFilterLabels,
} from './AdvancedSearchPureUtils';

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

      const [option] = getOptionsFromAggregationBucket([bucket], 'tier.tagFQN');

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

    it('leaves the bucket key alone rather than labelling it with a sibling value', () => {
      const bucket = {
        key: 'pii.sensitive',
        doc_count: 1,
        'top_hits#top': {
          hits: {
            hits: [
              {
                // The bucket's own value is missing from this document, so any
                // element picked here would be a different tag.
                _source: { tags: [{ tagFQN: 'Tier.Tier1' }] },
              },
            ],
          },
        },
      } as unknown as Bucket;

      const [option] = getOptionsFromAggregationBucket([bucket], 'tags.tagFQN');

      expect(option.label).toBe('pii.sensitive');
    });

    it('leaves the bucket key alone when a string-array holds only other values', () => {
      const bucket = {
        key: 'aaron johnson',
        doc_count: 1,
        'top_hits#top': {
          hits: { hits: [{ _source: { ownerDisplayName: ['Bob Smith'] } }] },
        },
      } as unknown as Bucket;

      const [option] = getOptionsFromAggregationBucket(
        [bucket],
        'ownerDisplayName'
      );

      expect(option.label).toBe('aaron johnson');
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

describe('getQuickFilterSourceFields', () => {
  it('resolves the shared source path for a field that does not pin one', () => {
    expect(
      getQuickFilterSourceFields({
        key: EntityFields.GLOSSARY_TERMS,
        label: 'label.glossary-term-plural',
      })
    ).toBe('glossaryTags');
  });

  it('prefers the path pinned on the field', () => {
    expect(
      getQuickFilterSourceFields({
        key: EntityFields.OWNERS,
        label: 'label.owner-plural',
        sourceFields: 'owners.displayName',
      })
    ).toBe('owners.displayName');
  });

  it('returns undefined for a field aggregated in its original case', () => {
    expect(
      getQuickFilterSourceFields({
        key: EntityFields.ENTITY_TYPE,
        label: 'label.entity-type-plural',
      })
    ).toBeUndefined();
  });
});

describe('hydrateQuickFilterLabels', () => {
  const glossaryFilter = {
    key: EntityFields.GLOSSARY_TERMS,
    label: 'label.glossary-term-plural',
    value: [
      {
        key: 'enterprise business glossary.advanced shipment notification',
        label: 'enterprise business glossary.advanced shipment notification',
      },
    ],
  };

  it('restores the original casing of a selected value from the listed rows', () => {
    const [field] = hydrateQuickFilterLabels(
      [glossaryFilter],
      [
        {
          glossaryTags: [
            'Enterprise Business Glossary.Advanced Shipment Notification',
          ],
        },
      ]
    );

    expect(field.value?.[0]).toEqual({
      key: 'enterprise business glossary.advanced shipment notification',
      label: 'Enterprise Business Glossary.Advanced Shipment Notification',
    });
  });

  it('resolves a path that crosses an array of objects', () => {
    const [field] = hydrateQuickFilterLabels(
      [
        {
          key: EntityFields.TAG,
          label: 'label.tag',
          value: [{ key: 'pii.sensitive', label: 'pii.sensitive' }],
        },
      ],
      [{ tags: [{ tagFQN: 'Tier.Tier1' }, { tagFQN: 'PII.Sensitive' }] }]
    );

    expect(field.value?.[0].label).toBe('PII.Sensitive');
  });

  it('keeps the field identity when no row carries the selected value', () => {
    const fields = [glossaryFilter];
    const result = hydrateQuickFilterLabels(fields, [
      { glossaryTags: ['Some.Other Term'] },
    ]);

    expect(result[0]).toBe(glossaryFilter);
  });

  it('skips rows that are not objects', () => {
    const [field] = hydrateQuickFilterLabels(
      [glossaryFilter],
      [
        null,
        'not-a-row',
        {
          glossaryTags: [
            'Enterprise Business Glossary.Advanced Shipment Notification',
          ],
        },
      ]
    );

    expect(field.value?.[0].label).toBe(
      'Enterprise Business Glossary.Advanced Shipment Notification'
    );
  });

  it('keeps the field identity when there are no rows to read from', () => {
    const fields = [glossaryFilter];

    expect(hydrateQuickFilterLabels(fields, [])[0]).toBe(glossaryFilter);
  });

  it('leaves a label already resolved by the dropdown untouched', () => {
    const resolved = {
      key: EntityFields.GLOSSARY_TERMS,
      label: 'label.glossary-term-plural',
      value: [
        {
          key: 'enterprise business glossary.advanced shipment notification',
          label: 'Enterprise Business Glossary.Advanced Shipment Notification',
        },
      ],
    };

    expect(
      hydrateQuickFilterLabels(
        [resolved],
        [{ glossaryTags: ['SHOUTED.VALUE'] }]
      )[0]
    ).toBe(resolved);
  });

  it('leaves a field aggregated in its original case untouched', () => {
    const fields = [
      {
        key: EntityFields.ENTITY_TYPE,
        label: 'label.entity-type-plural',
        value: [{ key: 'table', label: 'table' }],
      },
    ];

    expect(hydrateQuickFilterLabels(fields, [{ entityType: 'Table' }])[0]).toBe(
      fields[0]
    );
  });
});
