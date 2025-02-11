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
import { Domain, DomainType } from '../generated/entity/domains/domain';
import { getDomainOptions, isDomainExist } from '../utils/DomainUtils';

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
});
