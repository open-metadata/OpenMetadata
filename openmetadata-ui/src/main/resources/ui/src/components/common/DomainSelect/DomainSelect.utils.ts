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
import type { TreeSelectNode } from '@openmetadata/ui-core-components';
import { EntityType } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityReferenceUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringUtils';

/**
 * Map a Domain (from the hierarchy/search APIs) to a TreeSelect node carrying
 * its EntityReference. A domain with `childrenCount > 0` but no `children`
 * loaded yet is marked `lazyLoad` so the TreeSelect fetches its subdomains on
 * expand; search results arrive with `children` already nested, so those are
 * mapped eagerly and not lazy-loaded.
 */
export function domainToTreeNode(
  domain: Domain
): TreeSelectNode<EntityReference> {
  const childrenCount = domain.childrenCount ?? 0;
  const loadedChildren = (domain.children ?? []) as unknown as Domain[];
  const hasLoadedChildren = loadedChildren.length > 0;
  const id = domain.fullyQualifiedName ?? domain.name;

  return {
    id,
    value: id,
    label: getEntityName(domain),
    data: getEntityReferenceFromEntity<Domain>(domain, EntityType.DOMAIN),
    isLeaf: childrenCount === 0 && !hasLoadedChildren,
    lazyLoad: childrenCount > 0 && !hasLoadedChildren,
    children: hasLoadedChildren
      ? loadedChildren.map(domainToTreeNode)
      : undefined,
  };
}

export function domainsToTreeNodes(
  domains: Domain[]
): TreeSelectNode<EntityReference>[] {
  return domains.map(domainToTreeNode);
}

/**
 * Map the currently-assigned domains (EntityReference[]) into the TreeSelect
 * `value` shape. Preserves the reference in `data` for round-tripping.
 */
export function entityReferencesToTreeNodes(
  domains: EntityReference[]
): TreeSelectNode<EntityReference>[] {
  return domains.map((domain) => {
    const id = domain.fullyQualifiedName ?? domain.name ?? domain.id;

    return {
      id,
      value: id,
      label: getEntityName(domain),
      data: domain,
    };
  });
}

/**
 * Extract the selected domains (EntityReference[]) from a TreeSelect onChange
 * payload, dropping non-selectable nodes (e.g. group headers).
 */
export function treeNodesToEntityReferences(
  nodes:
    | TreeSelectNode<EntityReference>
    | TreeSelectNode<EntityReference>[]
    | null
): EntityReference[] {
  if (!nodes) {
    return [];
  }

  const nodeArray = Array.isArray(nodes) ? nodes : [nodes];

  return nodeArray
    .filter((node) => node.data && node.allowSelection !== false)
    .map((node) => node.data as EntityReference);
}

/**
 * Escape + encode a raw search term for the domain search API, matching the
 * escaping the legacy domain tree used.
 */
export function buildDomainSearchQuery(searchTerm: string): string {
  return getEncodedFqn(escapeESReservedCharacters(searchTerm));
}
