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
import { mostCommonFieldValue } from './OnboardingAssistance.utils';

describe('sibling assistance', () => {
  it('offers the convention only once two siblings agree', () => {
    const sources = [
      { owners: [{ id: '1', name: 'ana', displayName: 'Ana' }] },
      { owners: [{ id: '1', name: 'ana', displayName: 'Ana' }] },
      { owners: [{ id: '2', name: 'ben', displayName: 'Ben' }] },
    ];

    expect(mostCommonFieldValue(sources, 'owners')).toEqual({
      count: 2,
      label: 'Ana',
      total: 3,
      value: sources[0].owners,
    });
    expect(mostCommonFieldValue(sources.slice(1), 'owners')).toBeUndefined();
  });

  it('reads a nested custom property and ignores assets that left it empty', () => {
    const sources = [
      { extension: { accessGroup: 'DATA-MKTG-RO' } },
      { extension: { accessGroup: 'DATA-MKTG-RO' } },
      { extension: {} },
      {},
    ];

    expect(mostCommonFieldValue(sources, 'extension.accessGroup')).toEqual({
      count: 2,
      label: 'DATA-MKTG-RO',
      total: 4,
      value: 'DATA-MKTG-RO',
    });
  });

  it('treats the same references in a different order as the same answer', () => {
    const sources = [
      {
        experts: [
          { id: 'a', name: 'a' },
          { id: 'b', name: 'b' },
        ],
      },
      {
        experts: [
          { id: 'b', name: 'b' },
          { id: 'a', name: 'a' },
        ],
      },
    ];

    expect(mostCommonFieldValue(sources, 'experts')?.count).toBe(2);
  });
});
