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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { EntityType } from '../../../enums/entity.enum';
import { Direction } from '../../../generated/api/data/metricObservability';
import {
  doesMetricAssetAffectHealth,
  getBulkFailureCount,
  getBulkFailureIds,
  normalizeMetricAssetDetails,
  toEntityReference,
} from './MetricAssetsTab.utils';

describe('MetricAssetsTab utilities', () => {
  it('normalizes the asset metadata used by the summary panel', () => {
    const details = normalizeMetricAssetDetails(
      {
        id: 'table-id',
        type: EntityType.TABLE,
        fullyQualifiedName: 'service.database.schema.orders',
      },
      {
        columns: [{ name: 'order_id' }, { displayName: 'Customer' }],
        domains: [{ id: 'domain-id', type: 'domain', name: 'Commerce' }],
        owners: [{ id: 'owner-id', type: 'user', name: 'DataOwner' }],
        tags: [
          { source: 'Classification', tagFQN: 'PII.Sensitive' },
          { source: 'Glossary', tagFQN: 'Commerce.Order' },
          { source: 'Classification', tagFQN: 'Tier.Tier1' },
        ],
        usageSummary: { weeklyStats: { count: 9, percentileRank: 87 } },
      }
    );

    expect(details).toMatchObject({
      columns: ['order_id', 'Customer'],
      containment: ['service', 'database', 'schema'],
      glossaryTerms: ['Commerce.Order'],
      tags: ['PII.Sensitive'],
      tier: 'Tier.Tier1',
      usageCount: 9,
      usagePercentile: 87,
    });
    expect(details.tags).not.toContain('Tier.Tier1');
  });

  it('ignores malformed references and reports partial failures by request id', () => {
    expect(toEntityReference({ id: 'missing-type' })).toBeUndefined();

    const result = {
      failedRequest: [
        { request: { id: 'failed-id' } },
        { request: { name: 'missing-id' } },
      ],
      numberOfRowsFailed: 2,
    };

    expect(getBulkFailureIds(result)).toEqual(new Set(['failed-id']));
    expect(getBulkFailureCount(result)).toBe(2);
  });

  it('uses the server health flag and only falls back to direct upstream tables', () => {
    expect(
      doesMetricAssetAffectHealth({
        affectsHealth: false,
        asset: { id: 'table', type: EntityType.TABLE },
        direction: Direction.Upstream,
      })
    ).toBe(false);
    expect(
      doesMetricAssetAffectHealth({
        asset: { id: 'table', type: EntityType.TABLE },
        direction: Direction.Upstream,
      })
    ).toBe(true);
    expect(
      doesMetricAssetAffectHealth({
        asset: { id: 'dashboard', type: EntityType.DASHBOARD },
        direction: Direction.Upstream,
      })
    ).toBe(false);
  });
});
