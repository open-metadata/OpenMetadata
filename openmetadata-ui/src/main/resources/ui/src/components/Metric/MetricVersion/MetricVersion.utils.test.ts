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
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import {
  getMetricVersionField,
  getMetricVersionMetadata,
  getMetricVersionTags,
} from './MetricVersion.utils';

const tag = (tagFQN: string) => ({
  labelType: LabelType.Manual,
  source: TagSource.Classification,
  state: State.Confirmed,
  tagFQN,
});

describe('MetricVersion utils', () => {
  it('uses a changed field value and falls back to the version entity', () => {
    expect(
      getMetricVersionField(
        {
          fieldsUpdated: [
            { name: 'description', oldValue: 'Old', newValue: 'New' },
          ],
        },
        'description',
        'Fallback'
      )
    ).toBe('New');
    expect(getMetricVersionField(undefined, 'description', 'Fallback')).toBe(
      'Fallback'
    );
  });

  it('formats owners, domains, and tier without broad entity registries', () => {
    expect(
      getMetricVersionMetadata({
        owners: [{ id: 'owner', name: 'analytics', type: 'team' }],
        domains: [{ id: 'domain', displayName: 'Finance', type: 'domain' }],
        tier: tag('Tier.Tier1'),
      })
    ).toEqual({
      ownerDisplayName: 'analytics',
      domainDisplayName: 'Finance',
      tierDisplayName: 'Tier1',
    });
  });

  it('removes tier tags from the visible tag list', () => {
    expect(
      getMetricVersionTags({
        id: 'metric',
        name: 'metric',
        tags: [tag('Tier.Tier1'), tag('PII.Sensitive')],
      }).map(({ tagFQN }) => tagFQN)
    ).toEqual(['PII.Sensitive']);
  });
});
