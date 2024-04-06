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
import { DomainType } from '../generated/entity/domains/domain';
import { getDomainOptions } from '../utils/DomainUtils';

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
