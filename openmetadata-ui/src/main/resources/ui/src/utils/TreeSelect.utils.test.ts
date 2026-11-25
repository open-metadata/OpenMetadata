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
import {
  getTreeSelectValue,
  getTreeSelectValues,
  toTreeSelectNodes,
} from './TreeSelect.utils';
const nodes = toTreeSelectNodes([
  {
    value: 'all',
    title: 'All',
    children: [
      { value: 'a', title: 'A' },
      { value: 'b', title: 'B' },
    ],
  },
]);

it('expands persisted parent selections and condenses checked descendants for the API', () => {
  const selection = getTreeSelectValue(nodes, ['all']);

  expect(selection.map((node) => node.id)).toEqual(['all', 'a', 'b']);
  expect(getTreeSelectValues(selection)).toEqual(['all']);
});

it('keeps independent child selections and clearing intact', () => {
  expect(getTreeSelectValues(getTreeSelectValue(nodes, ['b']))).toEqual(['b']);
  expect(getTreeSelectValues(null)).toEqual([]);
});
