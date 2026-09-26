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
import { Domain as DomainIcon } from '@openmetadata/ui-core-components/icons';
import { ReactComponent as SubDomainIcon } from '../../../assets/svg/ic-subdomain.svg';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
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

/**
 * Tag each node with its glyph: root domains get the Domain icon, nested and
 * lazily-loaded children get the distinct sub-domain glyph.
 */
export function withDomainIcon(
  nodes: TreeSelectNode<EntityReference>[],
  isSubDomain = false
): TreeSelectNode<EntityReference>[] {
  return nodes.map((node) => ({
    ...node,
    icon: isSubDomain ? (
      <SubDomainIcon height={16} width={16} />
    ) : (
      <DomainIcon height={16} width={16} />
    ),
    children: node.children
      ? withDomainIcon(node.children, true)
      : node.children,
  }));
}

/**
 * Upper bound on how many domains one level of the picker will pull in. The
 * hierarchy endpoint pages, and a single page silently hid everything past it —
 * for a domain-restricted user that meant an allowed domain outside the first
 * page never appeared at all. Paging is bounded rather than unbounded so a very
 * large catalogue cannot stall the dropdown; past this the user searches.
 */
export const MAX_DOMAIN_NODES = 500;

/**
 * Page through the hierarchy endpoint until the level is exhausted or
 * MAX_DOMAIN_NODES is reached.
 */
export async function fetchAllDomainChildren(
  fetchPage: (
    offset: number,
    pageSize: number
  ) => Promise<{ data?: Domain[]; paging?: { total?: number } }>,
  pageSize: number
): Promise<Domain[]> {
  const collected: Domain[] = [];
  let offset = 0;

  for (;;) {
    const response = await fetchPage(offset, pageSize);
    const page = response?.data ?? [];
    collected.push(...page);

    const total = response?.paging?.total;
    const reachedTotal = total !== undefined && collected.length >= total;

    if (
      page.length < pageSize ||
      reachedTotal ||
      collected.length >= MAX_DOMAIN_NODES
    ) {
      break;
    }

    offset += pageSize;
  }

  return collected.slice(0, MAX_DOMAIN_NODES);
}

/** FQN-set equality, so a no-change Apply does not fire a GET + PATCH. */
export function isSameDomainSelection(
  current: EntityReference[],
  next: EntityReference[]
): boolean {
  if (current.length !== next.length) {
    return false;
  }

  const currentFqns = new Set(current.map((d) => d.fullyQualifiedName));

  return next.every((d) => currentFqns.has(d.fullyQualifiedName));
}

/**
 * Ancestor FQNs of the selected domains, so the tree opens with a selected
 * sub-domain already in view. Without this a nested selection sits collapsed
 * under its parents and reads as unselected until the user expands by hand —
 * the legacy tree seeded `defaultExpandedKeys` from the value for this reason.
 */
export function getSelectedAncestorKeys(selected: EntityReference[]): string[] {
  const keys = new Set<string>();

  selected.forEach(({ fullyQualifiedName }) => {
    if (!fullyQualifiedName) {
      return;
    }

    const parts = fullyQualifiedName.split(FQN_SEPARATOR_CHAR);
    // Every prefix except the node itself is an ancestor to open.
    for (let i = 1; i < parts.length; i++) {
      keys.add(parts.slice(0, i).join(FQN_SEPARATOR_CHAR));
    }
  });

  return [...keys];
}
