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
import { searchQuery } from '../../../../../rest/searchAPI';
import { fetchTagOptions } from './conditionBuilderValueFetchers';

jest.mock('../../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const hit = (fullyQualifiedName: string, displayName: string) => ({
  _source: { fullyQualifiedName, name: displayName, displayName },
});

describe('fetchTagOptions', () => {
  it('keeps same-named tags from different classifications apart', async () => {
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          hit('PII.Sensitive', 'Sensitive'),
          hit('Personal.Sensitive', 'Sensitive'),
          hit('Tier.Group.Tier1', 'Tier1'),
        ],
      },
    });

    await expect(fetchTagOptions('sens')).resolves.toEqual([
      { value: 'PII.Sensitive', label: 'Sensitive', supportingText: 'PII' },
      {
        value: 'Personal.Sensitive',
        label: 'Sensitive',
        supportingText: 'Personal',
      },
      {
        value: 'Tier.Group.Tier1',
        label: 'Tier1',
        supportingText: 'Tier.Group',
      },
    ]);
  });

  it('returns no options when the search fails', async () => {
    (searchQuery as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(fetchTagOptions('')).resolves.toEqual([]);
  });
});
