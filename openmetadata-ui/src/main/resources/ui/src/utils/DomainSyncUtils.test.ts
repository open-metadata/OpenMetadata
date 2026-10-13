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
import { EntityReference } from '../generated/entity/type';
import { getDomainsContentKey } from './DomainSyncUtils';

const domain = (over: Partial<EntityReference> = {}): EntityReference =>
  ({
    id: 'id-1',
    type: 'domain',
    name: 'finance',
    fullyQualifiedName: 'finance',
    displayName: 'Finance',
    href: 'http://host/api/v1/domains/id-1',
    ...over,
  } as EntityReference);

describe('getDomainsContentKey', () => {
  it('returns an equal key for two distinct arrays with the same content', () => {
    // A fresh array reference on every context re-render must not change the key
    // — that is what keeps the open domain picker from being remounted.
    expect(getDomainsContentKey([domain()])).toBe(
      getDomainsContentKey([domain()])
    );
  });

  it('returns the same key for the empty list regardless of reference', () => {
    expect(getDomainsContentKey([])).toBe(getDomainsContentKey([]));
  });

  it('changes the key when a render-relevant field changes', () => {
    expect(getDomainsContentKey([domain()])).not.toBe(
      getDomainsContentKey([domain({ displayName: 'Finance & Risk' })])
    );
    expect(getDomainsContentKey([domain()])).not.toBe(
      getDomainsContentKey([domain({ inherited: true })])
    );
    expect(getDomainsContentKey([domain()])).not.toBe(
      getDomainsContentKey([domain({ fullyQualifiedName: 'finance.risk' })])
    );
  });

  it('is order-sensitive so a reordered list is treated as changed', () => {
    const a = domain({ id: 'id-1', fullyQualifiedName: 'a', name: 'a' });
    const b = domain({ id: 'id-2', fullyQualifiedName: 'b', name: 'b' });

    expect(getDomainsContentKey([a, b])).not.toBe(getDomainsContentKey([b, a]));
  });
});
