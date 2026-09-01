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

import { EntityType } from '../enums/entity.enum';
import { getQueryFilterToIncludeDomain } from './DomainFilterUtils';

describe('getQueryFilterToIncludeDomain', () => {
  const domainFqn = 'Domain.A';
  const dataProductFqn = 'Domain.A.DataProduct1';

  const getMustClauses = (
    ...args: Parameters<typeof getQueryFilterToIncludeDomain>
  ) => getQueryFilterToIncludeDomain(...args).query.bool.must;

  it('should scope results to the domain by default', () => {
    const must = getMustClauses(domainFqn, dataProductFqn);

    expect(must).toContainEqual({
      term: { 'domains.fullyQualifiedName': domainFqn },
    });
  });

  it('should scope results to the domain when domain is required', () => {
    const must = getMustClauses(domainFqn, dataProductFqn, true);

    expect(must).toContainEqual({
      term: { 'domains.fullyQualifiedName': domainFqn },
    });
  });

  it('should not scope results to the domain when domain is not required', () => {
    const must = getMustClauses(domainFqn, dataProductFqn, false);

    expect(must).not.toContainEqual({
      term: { 'domains.fullyQualifiedName': domainFqn },
    });
  });

  it('should use a single term when a one-element domain array is given', () => {
    const must = getMustClauses([domainFqn], dataProductFqn, true);

    expect(must).toContainEqual({
      term: { 'domains.fullyQualifiedName': domainFqn },
    });
  });

  it('should use a terms query when the Data Product spans multiple domains', () => {
    const domains = ['Domain.A', 'Domain.B'];
    const must = getMustClauses(domains, dataProductFqn, true);

    expect(must).toContainEqual({
      terms: { 'domains.fullyQualifiedName': domains },
    });
    expect(must).not.toContainEqual({
      term: { 'domains.fullyQualifiedName': 'Domain.A, Domain.B' },
    });
  });

  it('should not add a domain clause when the domain list is empty', () => {
    const must = getMustClauses([], dataProductFqn, true);

    expect(must.some((clause) => 'term' in clause || 'terms' in clause)).toBe(
      false
    );
  });

  it('should always exclude the already assigned data product and non-assignable entity types', () => {
    [true, false].forEach((requireDomain) => {
      const must = getMustClauses(domainFqn, dataProductFqn, requireDomain);

      expect(must).toContainEqual({
        bool: {
          must_not: [
            {
              term: { 'dataProducts.fullyQualifiedName': dataProductFqn },
            },
          ],
        },
      });
      expect(must).toContainEqual({
        bool: {
          must_not: [
            {
              terms: {
                entityType: [
                  EntityType.DATA_PRODUCT,
                  EntityType.TEST_SUITE,
                  EntityType.QUERY,
                  EntityType.TEST_CASE,
                  EntityType.TABLE_COLUMN,
                ],
              },
            },
          ],
        },
      });
    });
  });
});
