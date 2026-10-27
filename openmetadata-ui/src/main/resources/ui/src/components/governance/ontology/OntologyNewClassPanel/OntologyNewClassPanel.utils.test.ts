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
  MODEL_NODE_MAX_WIDTH,
  NODE_HEIGHT,
} from '../../../OntologyExplorer/utils/graphConfig';
import {
  classLocalName,
  distinctChipValues,
  isValidLocalName,
  placeNewClass,
} from './OntologyNewClassPanel.utils';

it('derives a PascalCase local name from words and trims duplicate chips', () => {
  expect(classLocalName('  Funds Transfer ')).toBe('FundsTransfer');
  expect(classLocalName('funds-transfer')).toBe('FundsTransfer');
  expect(distinctChipValues([' A ', 'A', ' ', 'B'])).toEqual(['A', 'B']);
  expect(isValidLocalName('Bad name')).toBe(false);
});

it('preserves existing positions and places five creations clear of all renderer bounds', () => {
  let positions: Record<string, { x: number; y: number }> = {
    a: { x: 0, y: 0 },
    b: { x: 170, y: 0 },
  };
  const nodes = [{ id: 'a' }, { id: 'b' }];
  for (let i = 0; i < 5; i++) {
    const id = 'new' + i;
    const next = placeNewClass(positions, nodes, id);

    if (!next) {
      throw new Error('Expected complete placement');
    }

    expect(next.a).toEqual(positions.a);

    for (const old of nodes) {
      expect(
        Math.abs(next[id].x - next[old.id].x) > MODEL_NODE_MAX_WIDTH ||
          Math.abs(next[id].y - next[old.id].y) > NODE_HEIGHT
      ).toBe(true);
    }
    positions = next;
    nodes.push({ id });
  }
});

it('waits for layout rather than guessing missing positions', () => {
  expect(placeNewClass({}, [{ id: 'missing' }], 'new')).toBeUndefined();
  expect(placeNewClass({}, [], 'new')).toEqual({
    new: expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
    }),
  });
});
