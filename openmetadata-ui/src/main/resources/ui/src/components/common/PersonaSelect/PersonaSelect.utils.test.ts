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
import { Persona } from '../../../generated/entity/teams/persona';
import { EntityReference } from '../../../generated/entity/type';
import {
    entityRefToTreeNode,
    personasToTreeNodes
} from './PersonaSelect.utils';

describe('PersonaSelect.utils', () => {
  describe('entityRefToTreeNode', () => {
    it('maps a reference to a leaf node keyed by fqn', () => {
      const ref = {
        id: 'id-1',
        type: 'persona',
        name: 'p1',
        fullyQualifiedName: 'p1',
        displayName: 'Persona One',
      } as EntityReference;

      expect(entityRefToTreeNode(ref)).toEqual({
        id: 'p1',
        value: 'p1',
        label: 'Persona One',
        data: ref,
        isLeaf: true,
      });
    });

    it('falls back to name then id when fqn is absent', () => {
      const node = entityRefToTreeNode({
        id: 'id-2',
        type: 'persona',
        name: 'p2',
      } as EntityReference);

      expect(node.id).toBe('p2');
      expect(node.value).toBe('p2');
    });
  });

  describe('personasToTreeNodes', () => {
    it('maps every persona to a leaf node', () => {
      const personas = [
        { id: 'id-1', name: 'p1', fullyQualifiedName: 'p1', displayName: 'P1' },
        { id: 'id-2', name: 'p2', fullyQualifiedName: 'p2', displayName: 'P2' },
      ] as Persona[];

      const nodes = personasToTreeNodes(personas);

      expect(nodes).toHaveLength(2);
      expect(nodes[0]).toMatchObject({ id: 'p1', label: 'P1', isLeaf: true });
      expect(nodes[1]).toMatchObject({ id: 'p2', label: 'P2', isLeaf: true });
    });

    it('returns an empty array for no personas', () => {
      expect(personasToTreeNodes([])).toEqual([]);
    });
  });
});
