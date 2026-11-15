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
import {
  buildDataPickerGroups,
  DataPickerConcept,
  readDataPick,
  rememberDataPick,
} from './OntologyDataConceptPick.utils';

const concepts: DataPickerConcept[] = [
  { id: 'a', name: 'Account', assetCount: 2 },
  { id: 'p', name: 'Patient', assetCount: 9 },
  { id: 'v', name: 'Visit' },
  { id: 'd', name: 'Doctor', assetCount: 0 },
];

describe('buildDataPickerGroups', () => {
  it('lists concepts with data by asset count and the rest after them', () => {
    const groups = buildDataPickerGroups(concepts, [], '');

    expect(groups.recent).toEqual([]);
    expect(groups.withData.map((item) => item.name)).toEqual([
      'Patient',
      'Account',
    ]);
    expect(groups.withoutData.map((item) => item.name)).toEqual([
      'Doctor',
      'Visit',
    ]);
  });

  it('puts the recent picks first and leaves them out of the other groups', () => {
    const groups = buildDataPickerGroups(concepts, ['a', 'v', 'gone'], '');

    expect(groups.recent.map((item) => item.name)).toEqual([
      'Account',
      'Visit',
    ]);
    expect(groups.withData.map((item) => item.name)).toEqual(['Patient']);
    expect(groups.withoutData.map((item) => item.name)).toEqual(['Doctor']);
  });

  it('keeps only matches, ignoring case, and drops the recent group while searching', () => {
    const groups = buildDataPickerGroups(concepts, ['a'], 'ac');

    expect(groups.recent).toEqual([]);
    expect(groups.withData.map((item) => item.name)).toEqual(['Account']);
    expect(groups.withoutData).toEqual([]);
  });
});

describe('remembered pick', () => {
  beforeEach(() => localStorage.clear());

  it('restores the pick of the same ontology only', () => {
    rememberDataPick('ont-1', 'p');

    expect(readDataPick('ont-1')).toEqual({
      selectedId: 'p',
      recentIds: ['p'],
    });
    expect(readDataPick('ont-2')).toEqual({ recentIds: [] });
  });

  it('keeps the three latest distinct picks, newest first', () => {
    ['a', 'p', 'v', 'd', 'a'].forEach((id) => rememberDataPick('ont-1', id));

    expect(readDataPick('ont-1').recentIds).toEqual(['a', 'd', 'v']);
  });

  it('forgets the selection but keeps the recents when cleared', () => {
    rememberDataPick('ont-1', 'p');
    rememberDataPick('ont-1', undefined);

    expect(readDataPick('ont-1')).toEqual({ recentIds: ['p'] });
  });

  it('reads an empty pick when storage holds something else', () => {
    localStorage.setItem('os-dataBy', '{not json');

    expect(readDataPick('ont-1')).toEqual({ recentIds: [] });
  });
});
