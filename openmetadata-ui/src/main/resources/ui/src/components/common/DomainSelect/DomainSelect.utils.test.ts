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
import { EntityType } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import {
  buildDomainSearchQuery,
  domainsToTreeNodes,
  domainToTreeNode,
  entityReferencesToTreeNodes,
  treeNodesToEntityReferences,
} from './DomainSelect.utils';

const leafDomain = {
  id: 'd1',
  name: 'Engineering',
  displayName: 'Engineering',
  fullyQualifiedName: 'Engineering',
  childrenCount: 0,
} as Domain;

const parentDomain = {
  id: 'd2',
  name: 'Finance',
  displayName: 'Finance',
  fullyQualifiedName: 'Finance',
  childrenCount: 3,
} as Domain;

const preloadedParent = {
  id: 'd3',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  childrenCount: 1,
  children: [
    {
      id: 'd3a',
      name: 'EMEA',
      fullyQualifiedName: 'Sales.EMEA',
      childrenCount: 0,
    },
  ],
} as unknown as Domain;

describe('DomainSelect.utils', () => {
  describe('domainToTreeNode', () => {
    it('should map a leaf domain with no lazy loading', () => {
      const node = domainToTreeNode(leafDomain);

      expect(node.id).toBe('Engineering');
      expect(node.value).toBe('Engineering');
      expect(node.label).toBe('Engineering');
      expect(node.isLeaf).toBe(true);
      expect(node.lazyLoad).toBe(false);
      expect(node.children).toBeUndefined();
      expect(node.data).toMatchObject({
        id: 'd1',
        type: EntityType.DOMAIN,
        fullyQualifiedName: 'Engineering',
      });
    });

    it('should mark a domain with unloaded subdomains as lazy and not a leaf', () => {
      const node = domainToTreeNode(parentDomain);

      expect(node.isLeaf).toBe(false);
      expect(node.lazyLoad).toBe(true);
      expect(node.children).toBeUndefined();
    });

    it('should map preloaded children eagerly without lazy loading', () => {
      const node = domainToTreeNode(preloadedParent);

      expect(node.isLeaf).toBe(false);
      expect(node.lazyLoad).toBe(false);
      expect(node.children).toHaveLength(1);
      expect(node.children?.[0].id).toBe('Sales.EMEA');
      expect(node.children?.[0].isLeaf).toBe(true);
    });

    it('should fall back to name when displayName is absent for the label', () => {
      const node = domainToTreeNode(preloadedParent);

      expect(node.label).toBe('Sales');
    });
  });

  describe('domainsToTreeNodes', () => {
    it('should map a list of domains', () => {
      const nodes = domainsToTreeNodes([leafDomain, parentDomain]);

      expect(nodes).toHaveLength(2);
      expect(nodes.map((n) => n.id)).toEqual(['Engineering', 'Finance']);
    });
  });

  describe('entityReferencesToTreeNodes', () => {
    it('should map assigned domain references to selected nodes', () => {
      const refs: EntityReference[] = [
        {
          id: 'd1',
          type: 'domain',
          name: 'Engineering',
          displayName: 'Engineering',
          fullyQualifiedName: 'Engineering',
        },
      ];

      const nodes = entityReferencesToTreeNodes(refs);

      expect(nodes).toEqual([
        {
          id: 'Engineering',
          value: 'Engineering',
          label: 'Engineering',
          data: refs[0],
        },
      ]);
    });
  });

  describe('treeNodesToEntityReferences', () => {
    const ref: EntityReference = {
      id: 'd1',
      type: 'domain',
      name: 'Engineering',
      fullyQualifiedName: 'Engineering',
    };

    it('should return an empty array for null', () => {
      expect(treeNodesToEntityReferences(null)).toEqual([]);
    });

    it('should unwrap a single selected node', () => {
      expect(
        treeNodesToEntityReferences({
          id: 'Engineering',
          value: 'Engineering',
          label: 'Engineering',
          data: ref,
        })
      ).toEqual([ref]);
    });

    it('should drop nodes without data or marked non-selectable', () => {
      const result = treeNodesToEntityReferences([
        { id: 'a', value: 'a', label: 'A', data: ref },
        { id: 'b', value: 'b', label: 'B' },
        { id: 'c', value: 'c', label: 'C', data: ref, allowSelection: false },
      ]);

      expect(result).toEqual([ref]);
    });
  });

  describe('buildDomainSearchQuery', () => {
    it('should escape and encode reserved characters', () => {
      expect(buildDomainSearchQuery('Finance & Ops')).not.toContain(' ');
    });

    it('should return an empty string for an empty term', () => {
      expect(buildDomainSearchQuery('')).toBe('');
    });
  });
});
