/*
 *  Copyright 2024 Collate.
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
import { Domain, DomainType } from '../generated/entity/domains/domain';
import {
  getDomainOptions,
  getQueryFilterToIncludeDomain,
  isDomainExist,
} from '../utils/DomainUtils';

describe('getDomainOptions function', () => {
  const domains = [
    {
      id: '1',
      name: 'Domain 1',
      fullyQualifiedName: 'domain1',
      description: 'test',
      domainType: DomainType.Aggregate,
    },
  ];

  it('should return an array of ItemType objects', () => {
    const result = getDomainOptions(domains);

    expect(Array.isArray(result)).toBeTruthy();
    expect(result).toHaveLength(2);

    result.forEach((item) => {
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('key');
    });
  });
});

describe('isDomainExist', () => {
  it('should return true if domain fqn matches directly', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
    } as Domain;

    expect(isDomainExist(domain, 'parent')).toBe(true);
  });

  it('should return true if domain fqn exists in children', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      children: [
        {
          id: '2',
          name: 'Child',
          fullyQualifiedName: 'parent.child',
        },
      ],
    } as Domain;

    expect(isDomainExist(domain, 'parent.child')).toBe(true);
  });

  it('should return true if domain fqn exists in nested children', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      description: 'test',
      domainType: DomainType.Aggregate,
      children: [
        {
          id: '2',
          name: 'Child',
          fullyQualifiedName: 'parent.child',
          children: [
            {
              id: '3',
              name: 'GrandChild',
              fullyQualifiedName: 'parent.child.grandchild',
            },
          ],
        },
      ],
    } as unknown as Domain;

    expect(isDomainExist(domain, 'parent.child.grandchild')).toBe(true);
  });

  it('should return false if domain fqn does not exist', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      children: [
        {
          id: '2',
          name: 'Child',
          fullyQualifiedName: 'parent.child',
        },
      ],
    } as Domain;

    expect(isDomainExist(domain, 'nonexistent')).toBe(false);
  });

  it('should handle domain without children', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      children: [],
      description: 'test',
      domainType: DomainType.Aggregate,
    } as unknown as Domain;

    expect(isDomainExist(domain, 'parent.child')).toBe(false);
  });

  it('should handle domain with description and type', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      description: 'test description',
      domainType: DomainType.Aggregate,
      children: [
        {
          id: '2',
          name: 'Child',
          fullyQualifiedName: 'parent.child',
          children: [
            {
              id: '3',
              name: 'GrandChild',
              fullyQualifiedName: 'parent.child.grandchild',
            },
          ],
        },
      ],
    } as unknown as Domain;

    expect(isDomainExist(domain, 'parent.child.grandchild')).toBe(true);
  });

  describe('getQueryFilterToIncludeDomain', () => {
    it('should return correct query filter structure with domain and data product fqns', () => {
      const domainFqn = 'testDomain';
      const dataProductFqn = 'testDataProduct';

      const result = getQueryFilterToIncludeDomain(domainFqn, dataProductFqn);

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              {
                term: {
                  'domains.fullyQualifiedName': domainFqn,
                },
              },
              {
                bool: {
                  must_not: [
                    {
                      term: {
                        'dataProducts.fullyQualifiedName': dataProductFqn,
                      },
                    },
                  ],
                },
              },
              {
                bool: {
                  must_not: [
                    {
                      terms: {
                        entityType: [
                          EntityType.DATA_PRODUCT,
                          EntityType.TEST_SUITE,
                          EntityType.QUERY,
                          EntityType.TEST_CASE,
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    });

    it('should create filter with nested domain fqn', () => {
      const domainFqn = 'parent.child.grandchild';
      const dataProductFqn = 'product.subproduct';

      const result = getQueryFilterToIncludeDomain(domainFqn, dataProductFqn);

      const firstMust = result.query.bool.must[0] as {
        term: { 'domains.fullyQualifiedName': string };
      };

      expect(firstMust.term['domains.fullyQualifiedName']).toBe(domainFqn);

      const secondMust = result.query.bool.must[1] as {
        bool: {
          must_not: Array<{
            term: { 'dataProducts.fullyQualifiedName': string };
          }>;
        };
      };

      expect(
        secondMust.bool.must_not[0].term['dataProducts.fullyQualifiedName']
      ).toBe(dataProductFqn);
    });

    it('should exclude specific entity types', () => {
      const domainFqn = 'testDomain';
      const dataProductFqn = 'testDataProduct';

      const result = getQueryFilterToIncludeDomain(domainFqn, dataProductFqn);

      const thirdMust = result.query.bool.must[2] as {
        bool: {
          must_not: Array<{
            terms: { entityType: EntityType[] };
          }>;
        };
      };
      const excludedEntityTypes = thirdMust.bool.must_not[0].terms.entityType;

      expect(excludedEntityTypes).toContain(EntityType.DATA_PRODUCT);
      expect(excludedEntityTypes).toContain(EntityType.TEST_SUITE);
      expect(excludedEntityTypes).toContain(EntityType.QUERY);
      expect(excludedEntityTypes).toContain(EntityType.TEST_CASE);
      expect(excludedEntityTypes).toHaveLength(4);
    });

    it('should handle empty string parameters', () => {
      const domainFqn = '';
      const dataProductFqn = '';

      const result = getQueryFilterToIncludeDomain(domainFqn, dataProductFqn);

      const firstMust = result.query.bool.must[0] as {
        term: { 'domains.fullyQualifiedName': string };
      };

      expect(firstMust.term['domains.fullyQualifiedName']).toBe('');

      const secondMust = result.query.bool.must[1] as {
        bool: {
          must_not: Array<{
            term: { 'dataProducts.fullyQualifiedName': string };
          }>;
        };
      };

      expect(
        secondMust.bool.must_not[0].term['dataProducts.fullyQualifiedName']
      ).toBe('');
    });
  });
});
