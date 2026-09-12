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
  GraphData,
  GraphNode,
  KnowledgeGraphEdge,
  KnowledgeGraphMode,
  KnowledgeGraphPresentation,
  MappingCoverage,
} from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import {
  getGraphRelationCategory,
  normalizeRelationKey,
  RelationCategory,
  toSentenceCase,
} from '../../components/KnowledgeGraph/KnowledgeGraph.relations';
import Fqn from '../Fqn';
import { identifyGraphEdges } from '../KnowledgeGraph.utils';

export const isConceptNode = (node: GraphNode) =>
  ['glossaryterm', 'concept', 'term'].includes(node.type.toLowerCase());

export const isCoverageNode = (node: GraphNode) =>
  [
    'table',
    'column',
    'dashboard',
    'dashboarddatamodel',
    'pipeline',
    'topic',
    'container',
    'searchindex',
    'mlmodel',
    'apiendpoint',
    'metric',
    'glossaryterm',
    'concept',
    'term',
  ].includes(node.type.toLowerCase());

export const getGraphNodeLabel = (node: GraphNode) => {
  if (node.type.toLowerCase() !== 'column') {
    return node.label;
  }
  const fqn = node.fullyQualifiedName ?? node.label.replace(/^column:\s*/i, '');

  return Fqn.split(fqn).slice(-1)[0] ?? node.label;
};

const mappingPredicates = new Set([
  'hasglossaryterm',
  'hasglossary',
  'hastag',
  'taggedwith',
  'realizes',
  'realizedby',
  'hasrealization',
  'represents',
  'mappedto',
  'ismappedto',
]);

const predicateKey = (edge: KnowledgeGraphEdge) =>
  (edge.relationType ?? edge.label)
    .split(/[/#:]/)
    .pop()
    ?.replace(/\s/g, '')
    .toLowerCase() ?? '';

const isMappingPredicate = (predicate: string) =>
  mappingPredicates.has(
    predicate.split(/[/#:]/).pop()?.replace(/\s/g, '').toLowerCase() ?? ''
  );

/** Reads every predicate as a phrase, the way the design labels edges. */
export const sentenceCaseGraphLabels = (
  data: GraphData | null
): GraphData | null =>
  data && {
    ...data,
    edges: data.edges.map((edge) => {
      const label = toSentenceCase(edge.label);

      return label === edge.label ? edge : { ...edge, label };
    }),
  };

export const isMappingEdge = (
  edge: KnowledgeGraphEdge,
  nodes: Map<string, GraphNode>
) => {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);

  return Boolean(
    from &&
      to &&
      isConceptNode(from) !== isConceptNode(to) &&
      mappingPredicates.has(predicateKey(edge))
  );
};

export const getMappingCoverage = (
  data: GraphData,
  inspectedIds?: Set<string>
) => {
  const nodes = new Map(data.nodes.map((node) => [node.id, node]));
  const mapped = new Set<string>();
  data.edges.forEach((edge) => {
    if (isMappingEdge(edge, nodes)) {
      mapped.add(edge.from);
      mapped.add(edge.to);
    }
  });

  const status = (id: string): MappingCoverage => {
    if (mapped.has(id)) {
      return 'mapped';
    }
    if (data.truncated || (inspectedIds && !inspectedIds.has(id))) {
      return 'unknown';
    }

    return 'unmapped';
  };

  return new Map<string, MappingCoverage>(
    data.nodes.filter(isCoverageNode).map((node) => [node.id, status(node.id)])
  );
};

/**
 * Level 1 · Entity shows the entity's own profile: who owns it, where it lives
 * and how it is governed. Lineage, quality, business concepts and social
 * relations describe neighbours in their own right and arrive at level 2.
 */
export const ENTITY_LEVEL_FAMILIES: RelationCategory[] = [
  'ownership',
  'structure',
  'governance',
];

/**
 * Narrows a depth-1 traversal to the entity's profile for level 1. In the
 * ontology mode the profile of a concept is the assets mapped onto it and its
 * declared properties, never the neighbouring concepts.
 */
export const restrictToEntityLevel = (
  data: GraphData | null,
  rootId: string,
  mode: KnowledgeGraphMode
): GraphData | null => {
  if (!data) {
    return null;
  }
  const nodes = new Map(data.nodes.map((node) => [node.id, node]));
  const nodeTypes = new Map(data.nodes.map((node) => [node.id, node.type]));
  const isProfileEdge = (edge: KnowledgeGraphEdge, other: GraphNode) => {
    const category = getGraphRelationCategory(edge, nodeTypes);
    if (mode === 'ontology') {
      return isMappingEdge(edge, nodes) || category === 'structure';
    }

    return ENTITY_LEVEL_FAMILIES.includes(category) && !isConceptNode(other);
  };
  const edges = data.edges.filter((edge) => {
    const other = nodes.get(edge.from === rootId ? edge.to : edge.from);

    return Boolean(
      (edge.from === rootId || edge.to === rootId) &&
        other &&
        isProfileEdge(edge, other)
    );
  });
  const ids = new Set([
    rootId,
    ...edges.flatMap((edge) => [edge.from, edge.to]),
  ]);

  return {
    ...data,
    edges,
    nodes: data.nodes.filter((node) => ids.has(node.id)),
  };
};

export const filterGraphPresentation = (
  data: GraphData | null,
  rootId: string,
  excludedFamilies: RelationCategory[],
  coverage: Map<string, MappingCoverage>,
  coverageMode: string
): GraphData | null => {
  if (!data) {
    return null;
  }
  const nodeTypes = new Map(data.nodes.map((node) => [node.id, node.type]));
  const edges = data.edges.filter(
    (edge) =>
      !excludedFamilies.includes(getGraphRelationCategory(edge, nodeTypes))
  );
  const connected = new Set([
    rootId,
    ...edges.flatMap((edge) => [edge.from, edge.to]),
  ]);
  const matchesCoverage = (node: GraphNode) =>
    node.id === rootId ||
    !isCoverageNode(node) ||
    !['mapped', 'unmapped'].includes(coverageMode) ||
    coverage.get(node.id) === coverageMode;
  const nodes = data.nodes.filter(
    (node) =>
      (!excludedFamilies.length || connected.has(node.id)) &&
      matchesCoverage(node)
  );
  const visible = new Set(nodes.map((node) => node.id));

  return {
    ...data,
    nodes: nodes.map((node) => ({ ...node, label: getGraphNodeLabel(node) })),
    edges: edges.filter(
      (edge) => visible.has(edge.from) && visible.has(edge.to)
    ),
  };
};

export const annotateGraphCoverage = (
  data: GraphData,
  coverage: Map<string, MappingCoverage>,
  rootId: string,
  highlight: boolean
): GraphData => ({
  ...data,
  nodes: data.nodes.map((node) => {
    if (!node.presentation || (!highlight && node.id !== rootId)) {
      return node;
    }
    const members = node.presentation.members ?? [node];
    const statuses = members.map((member) => coverage.get(member.id));
    const status = statuses.includes('unmapped') ? 'unmapped' : statuses[0];

    return {
      ...node,
      presentation: { ...node.presentation, coverage: status },
    };
  }),
});

export const getGraphDistances = (data: GraphData, rootId: string) => {
  const adjacency = new Map(
    data.nodes.map((node) => [node.id, [] as string[]])
  );
  data.edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to);
    adjacency.get(edge.to)?.push(edge.from);
  });
  const levels = new Map([[rootId, 1]]);
  const queue = [rootId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const next of adjacency.get(id) ?? []) {
      if (!levels.has(next)) {
        levels.set(next, (levels.get(id) ?? 1) + 1);
        queue.push(next);
      }
    }
  }

  return levels;
};

const compareNodes = (left: GraphNode, right: GraphNode) =>
  left.label.localeCompare(right.label) || left.id.localeCompare(right.id);

interface GraphParent {
  edge: KnowledgeGraphEdge;
  anchor: string;
}

interface GraphGroup {
  members: GraphNode[];
  predicate: string;
  relationType: string;
  direction: 'in' | 'out';
  anchor: string;
  priority: number;
}

const RELATION_GROUP_PRIORITY: Record<string, number> = {
  hasowner: 1,
  hasglossaryterm: 1,
  hasfollower: 1,
  has: 3,
  contains: 3,
  hastag: 3,
  hastier: 3,
  hascertification: 3,
  mappedto: 3,
  wasattributedto: 3,
};

const structuralParent = (
  predicate: string,
  edge: KnowledgeGraphEdge,
  node: GraphNode,
  anchor?: GraphNode
) => {
  if (
    ['hascolumn', 'hastier', 'hascertification'].includes(predicate) &&
    edge.to === node.id
  ) {
    return true;
  }

  return (
    predicate.startsWith('belongsto') ||
    (predicate === 'contains' &&
      ['table', 'databaseschema', 'database', 'testsuite'].includes(
        anchor?.type.toLowerCase() ?? ''
      ))
  );
};

const parentPriority = (
  { edge }: GraphParent,
  node: GraphNode,
  anchor?: GraphNode
) => {
  const predicate = normalizeRelationKey(edge.relationType ?? edge.label);
  if (anchor && isConceptNode(node) && isConceptNode(anchor)) {
    return edge.to === node.id ? 0 : 1;
  }
  if (structuralParent(predicate, edge, node, anchor)) {
    return 0;
  }

  return RELATION_GROUP_PRIORITY[predicate] ?? (edge.from === node.id ? 2 : 1);
};

const getParentCandidates = (data: GraphData, levels: Map<string, number>) => {
  const candidates = new Map<string, GraphParent[]>();
  data.edges.forEach((edge) => {
    for (const [id, anchor] of [
      [edge.from, edge.to],
      [edge.to, edge.from],
    ]) {
      if ((levels.get(id) ?? 0) === (levels.get(anchor) ?? 0) + 1) {
        const parents = candidates.get(id) ?? [];
        parents.push({ edge, anchor });
        candidates.set(id, parents);
      }
    }
  });

  return candidates;
};

const getParents = (data: GraphData, levels: Map<string, number>) => {
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const candidates = getParentCandidates(data, levels);

  return new Map(
    data.nodes.flatMap((node) => {
      const parent = candidates
        .get(node.id)
        ?.sort(
          (a, b) =>
            parentPriority(a, node, byId.get(a.anchor)) -
              parentPriority(b, node, byId.get(b.anchor)) ||
            JSON.stringify([
              a.anchor,
              a.edge.relationType ?? a.edge.label,
              a.edge.from,
            ]).localeCompare(
              JSON.stringify([
                b.anchor,
                b.edge.relationType ?? b.edge.label,
                b.edge.from,
              ])
            )
        )[0];

      return parent ? [[node.id, parent] as const] : [];
    })
  );
};

const canGroupNode = (
  node: GraphNode,
  rootId: string,
  connections: GraphParent[]
) => {
  const distinguished = connections.some(
    ({ edge }) =>
      edge.to === node.id &&
      ['hastier', 'hascertification'].includes(
        normalizeRelationKey(edge.relationType ?? edge.label)
      )
  );

  return node.id !== rootId && !isConceptNode(node) && !distinguished;
};

const getGroupCandidates = (
  nodes: GraphNode[],
  level: number,
  rootId: string,
  parents: Map<string, GraphParent[]>,
  visibleParent: Map<string, string>,
  byId: Map<string, GraphNode>
) => {
  const candidates = new Map<string, GraphGroup>();
  for (const node of nodes) {
    const connections = parents.get(node.id) ?? [];
    if (!canGroupNode(node, rootId, connections)) {
      continue;
    }
    for (const parent of connections) {
      const { edge } = parent;
      const anchor = visibleParent.get(parent.anchor) ?? parent.anchor;
      const relationType = edge.relationType ?? edge.label;
      const direction = edge.from === node.id ? 'in' : 'out';
      const key =
        'kg:group:' +
        JSON.stringify([anchor, relationType, direction, node.type, level]);
      const group: GraphGroup = candidates.get(key) ?? {
        members: [],
        predicate: edge.label,
        relationType,
        direction,
        anchor,
        priority: parentPriority(parent, node, byId.get(parent.anchor)),
      };
      if (!group.members.some((member) => member.id === node.id)) {
        group.members.push({ ...node, label: getGraphNodeLabel(node) });
      }
      candidates.set(key, group);
    }
  }

  return candidates;
};

const getGroups = (
  data: GraphData,
  levels: Map<string, number>,
  rootId: string
) => {
  const groups = new Map<string, GraphGroup>();
  const visibleParent = new Map<string, string>();
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const parents = getParentCandidates(data, levels);
  const byLevel = new Map<number, GraphNode[]>();
  data.nodes.forEach((node) => {
    const level = levels.get(node.id) ?? 3;
    const nodes = byLevel.get(level) ?? [];
    nodes.push(node);
    byLevel.set(level, nodes);
  });
  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    const candidates = getGroupCandidates(
      byLevel.get(level) ?? [],
      level,
      rootId,
      parents,
      visibleParent,
      byId
    );
    // Prefer structural branches, then the largest shared relationship, independently of input order.
    [...candidates]
      .sort(
        ([aId, a], [bId, b]) =>
          a.priority - b.priority ||
          b.members.length - a.members.length ||
          aId.localeCompare(bId)
      )
      .forEach(([id, group]) => {
        const members = group.members.filter(
          (node) => !visibleParent.has(node.id)
        );
        if (members.length >= 3) {
          groups.set(id, { ...group, members });
          members.forEach((node) => visibleParent.set(node.id, id));
        }
      });
  }

  return groups;
};

/**
 * Which cards sit above or below the subject instead of in a side lane.
 * A concept (the ontology view) keeps the design's arrangement: the assets
 * mapped onto it dock above, its declared properties dock below, whether or
 * not there are enough of them to bundle. Around an asset only bundles dock:
 * tags above; columns, queries and followers below.
 */
type DockSide = 'top' | 'bottom' | undefined;

const conceptDockSide = (type: string, predicate: string): DockSide => {
  if (type === 'property') {
    return 'bottom';
  }

  return isMappingPredicate(predicate) ? 'top' : undefined;
};

const bundleDockSide = (type: string, predicate: string): DockSide => {
  if (['tag', 'classification'].includes(type)) {
    return 'top';
  }
  const follows = ['hasfollower', 'followedby'].includes(
    normalizeRelationKey(predicate)
  );

  return ['column', 'query', 'property'].includes(type) || follows
    ? 'bottom'
    : undefined;
};

const dockSide = (
  node: GraphNode,
  parent: GraphParent | undefined,
  conceptRoot: boolean
): DockSide => {
  const presentation = node.presentation;
  if (!presentation || presentation.level !== 2) {
    return undefined;
  }
  const type = node.type.toLowerCase();
  const predicate =
    presentation.relationType ??
    parent?.edge.relationType ??
    parent?.edge.label ??
    '';
  const conceptSide = conceptRoot
    ? conceptDockSide(type, predicate)
    : undefined;
  if (conceptSide || !presentation.members) {
    return conceptSide;
  }

  return bundleDockSide(type, predicate);
};

const relationshipSide = (
  node: GraphNode,
  parent?: GraphParent
): 'left' | 'right' => {
  const predicate = normalizeRelationKey(
    parent?.edge.relationType ?? parent?.edge.label ?? ''
  );
  if (predicate === 'upstream') {
    return parent?.edge.to === node.id ? 'left' : 'right';
  }
  if (predicate === 'downstream') {
    return parent?.edge.to === node.id ? 'right' : 'left';
  }
  if (['mappedto', 'realizes', 'hasglossaryterm'].includes(predicate)) {
    return 'left';
  }

  return parent?.edge.from === node.id ? 'left' : 'right';
};

const nodeSide = (node: GraphNode, parent?: GraphParent): 'left' | 'right' => {
  const type = node.type.toLowerCase();
  if (
    [
      'domain',
      'dataproduct',
      'tag',
      'classification',
      'glossaryterm',
      'concept',
      'term',
      'certification',
    ].includes(type)
  ) {
    return 'right';
  }
  if (
    [
      'user',
      'team',
      'pipeline',
      'databaseschema',
      'database',
      'databaseservice',
      'testcase',
      'testsuite',
    ].includes(type)
  ) {
    return 'left';
  }

  return relationshipSide(node, parent);
};

const laneOrder = (node: GraphNode) => {
  const order = [
    'team',
    'user',
    'database',
    'databaseservice',
    'databaseschema',
    'pipeline',
    'domain',
    'dataproduct',
    'tag',
    'certification',
    'glossaryterm',
    'concept',
    'term',
    'table',
    'dashboard',
    'testsuite',
    'testcase',
  ];
  const index = order.indexOf(node.type.toLowerCase());

  return index < 0 ? order.length : index;
};

const assignPositions = (
  nodes: GraphNode[],
  parents: Map<string, GraphParent>,
  rootId: string
) => {
  const lanes = new Map<string, GraphNode[]>();
  const root = nodes.find((node) => node.id === rootId);
  const conceptRoot = Boolean(root && isConceptNode(root));
  const dock = (node: GraphNode) =>
    dockSide(
      node,
      parents.get(node.presentation?.members?.[0].id ?? node.id),
      conceptRoot
    );
  const groups = nodes.filter((node) => dock(node));
  nodes.forEach((node) => {
    if (!node.presentation || node.id === rootId || node.presentation.groupId) {
      return;
    }
    const member = node.presentation.members?.[0] ?? node;
    const side = dock(node) ?? nodeSide(member, parents.get(member.id));
    node.presentation.side = side;
    if (side === 'top' || side === 'bottom') {
      return;
    }
    const key = JSON.stringify([node.presentation.level, side]);
    const lane = lanes.get(key) ?? [];
    lane.push(node);
    lanes.set(key, lane);
  });
  lanes.forEach((lane, key) => {
    const [level, side] = JSON.parse(key) as [number, 'left' | 'right'];
    lane.sort((a, b) => laneOrder(a) - laneOrder(b) || compareNodes(a, b));
    let y =
      -lane.reduce(
        (height, node) => height + (node.presentation?.size[1] ?? 58) + 34,
        -34
      ) / 2;
    lane.forEach((node) => {
      if (node.presentation) {
        node.presentation.position = {
          x: (side === 'left' ? -1 : 1) * (350 + (level - 2) * 380),
          y: y + node.presentation.size[1] / 2,
        };
        y += node.presentation.size[1] + 34;
      }
    });
  });
  const direct = nodes.filter(
    (node) =>
      node.presentation?.level === 2 &&
      !node.presentation.groupId &&
      !groups.includes(node)
  );
  const bottomY = Math.max(
    300,
    ...direct.map(
      (node) =>
        (node.presentation?.position.y ?? 0) +
        (node.presentation?.size[1] ?? 58) / 2 +
        100
    )
  );
  const dockOrder: Record<string, number> = {
    user: 0,
    column: 1,
    query: 2,
    property: 1,
  };
  for (const side of ['top', 'bottom'] as const) {
    const row = groups
      .filter((node) => dock(node) === side)
      .sort(
        (a, b) =>
          (dockOrder[a.type] ?? 3) - (dockOrder[b.type] ?? 3) ||
          compareNodes(a, b)
      );
    row.forEach((node, index) => {
      if (node.presentation) {
        node.presentation.position = {
          x: (index - (row.length - 1) / 2) * 268,
          y: side === 'top' ? -300 : bottomY,
        };
      }
    });
  }
};

const positionExpandedMembers = (groups: GraphNode[], members: GraphNode[]) => {
  groups.forEach((group) => {
    const position = group.presentation;
    if (!position) {
      return;
    }
    const preview = members.filter(
      (node) => node.presentation?.groupId === group.id
    );
    preview.forEach((node, index) => {
      if (!node.presentation) {
        return;
      }
      const row = Math.floor(index / 3),
        column = index % 3;
      node.presentation.side = position.side;
      if (position.side === 'top' || position.side === 'bottom') {
        node.presentation.position = {
          x:
            position.position.x +
            (column - (Math.min(3, preview.length) - 1) / 2) * 238,
          y:
            position.position.y +
            (position.side === 'top' ? -1 : 1) *
              (position.size[1] / 2 + 76 + row * 84),
        };
      } else {
        node.presentation.position = {
          x:
            position.position.x +
            (position.side === 'left' ? -1 : 1) * (278 + column * 238),
          y: position.position.y + row * 84,
        };
      }
    });
  });
};

const displayedEndpoint = (
  edge: KnowledgeGraphEdge,
  endpoint: 'from' | 'to',
  projection: {
    memberGroup: Map<string, string>;
    revealed: Map<string, string>;
    groups: Map<string, GraphGroup>;
  }
) => {
  const { memberGroup, revealed, groups } = projection;
  const id = edge[endpoint];
  const other = edge[endpoint === 'from' ? 'to' : 'from'];
  const group = memberGroup.get(id);
  const otherGroup = groups.get(memberGroup.get(other) ?? '');
  // A nested bundle stays attached to its parent summary when previews open.
  if (group && otherGroup?.anchor === group) {
    return group;
  }

  return revealed.has(id) ? id : group ?? id;
};

const expandedConnector = (
  edge: KnowledgeGraphEdge,
  from: string,
  to: string,
  revealed: Map<string, string>,
  groups: Map<string, GraphGroup>
) => {
  const sourceGroup = revealed.get(edge.from);
  if (sourceGroup && groups.get(sourceGroup)?.anchor === to) {
    return { from: edge.from, to: sourceGroup };
  }
  const targetGroup = revealed.get(edge.to);
  if (targetGroup && groups.get(targetGroup)?.anchor === from) {
    return { from: targetGroup, to: edge.to };
  }

  return null;
};

const projectPresentationEdges = (
  source: GraphData,
  memberGroup: Map<string, string>,
  revealed: Map<string, string>,
  groups: Map<string, GraphGroup>,
  nodeTypes: Map<string, string>
) => {
  const projected: KnowledgeGraphEdge[] = [];
  const previews: KnowledgeGraphEdge[] = [];
  const bundles = new Map<string, KnowledgeGraphEdge>();
  identifyGraphEdges(source.edges).forEach((edge) => {
    const projection = { memberGroup, revealed, groups };
    let from = displayedEndpoint(edge, 'from', projection);
    let to = displayedEndpoint(edge, 'to', projection);
    const preview = expandedConnector(edge, from, to, revealed, groups);
    if (preview) {
      previews.push({
        ...edge,
        ...preview,
        id: 'kg:preview:' + edge.id,
        members: [edge],
        presentationOnly: true,
      });
      from = memberGroup.get(edge.from) ?? edge.from;
      to = memberGroup.get(edge.to) ?? edge.to;
    }
    const category = getGraphRelationCategory(edge, nodeTypes);
    if (from === edge.from && to === edge.to) {
      projected.push({ ...edge, category });

      return;
    }
    const id =
      'kg:bundle:' +
      JSON.stringify([from, to, edge.relationType ?? edge.label, category]);
    const bundle = bundles.get(id);
    if (bundle) {
      bundle.members?.push(edge);
    } else {
      const next = { ...edge, id, from, to, category, members: [edge] };
      bundles.set(id, next);
      projected.push(next);
    }
  });

  return projected.concat(previews);
};

/** Bundles are a view over original statements, never new RDF assertions. */
export const buildGraphPresentation = (
  data: GraphData,
  unfiltered: GraphData,
  rootId: string,
  presentation: KnowledgeGraphPresentation,
  expanded: string[],
  focusedNodeId?: string
): { data: GraphData; unfiltered: GraphData } => {
  const levels = getGraphDistances(unfiltered, rootId);
  const parents = getParents(unfiltered, levels);
  const groups =
    presentation === 'balanced'
      ? getGroups(unfiltered, levels, rootId)
      : new Map<string, GraphGroup>();
  const memberGroup = new Map<string, string>();
  const groupNodes: GraphNode[] = [];
  const revealed = new Map<string, string>();
  const previewNodes: GraphNode[] = [];
  groups.forEach((group, id) => {
    group.members.sort(compareNodes);
    group.members.forEach((node) => memberGroup.set(node.id, id));
    const first = group.members[0];
    const isExpanded = expanded.includes(id);
    if (isExpanded) {
      const preview = group.members.slice(0, 6);
      const selected = group.members.find((node) => node.id === focusedNodeId);
      if (selected && !preview.includes(selected)) {
        preview[preview.length - 1] = selected;
      }
      preview.forEach((node) => {
        revealed.set(node.id, id);
        previewNodes.push({
          ...node,
          presentation: {
            level: levels.get(node.id) ?? 3,
            groupId: id,
            size: [212, 58],
            position: { x: 0, y: 0 },
          },
        });
      });
    }
    groupNodes.push({
      id,
      label: first.type,
      type: first.type,
      presentation: {
        level: levels.get(first.id) ?? 3,
        members: group.members,
        predicate: group.predicate,
        relationType: group.relationType,
        direction: group.direction,
        anchorId: group.anchor,
        expanded: isExpanded,
        size: [222, 152],
        position: { x: 0, y: 0 },
      },
    });
  });
  const nodes = unfiltered.nodes
    .filter((node) => !memberGroup.has(node.id))
    .map<GraphNode>((node) => ({
      ...node,
      label: getGraphNodeLabel(node),
      presentation: {
        ...node.presentation,
        level: levels.get(node.id) ?? 3,
        root: node.id === rootId,
        anchorId:
          memberGroup.get(parents.get(node.id)?.anchor ?? '') ??
          parents.get(node.id)?.anchor,
        size: (node.id === rootId ? [252, 80] : [212, 58]) as [number, number],
        position: { x: 0, y: 0 },
      },
    }))
    .concat(groupNodes, previewNodes)
    .sort(compareNodes);
  const nodeTypes = new Map(
    unfiltered.nodes.map((node) => [node.id, node.type])
  );
  const projectEdges = (source: GraphData) =>
    projectPresentationEdges(source, memberGroup, revealed, groups, nodeTypes);
  const allEdges = projectEdges(unfiltered);
  assignPositions(nodes, parents, rootId);
  positionExpandedMembers(groupNodes, previewNodes);
  const visible = new Set(data.nodes.map((node) => node.id));
  const filteredNodes = nodes.flatMap((node) => {
    if (node.presentation?.members) {
      const members = node.presentation.members.filter((member) =>
        visible.has(member.id)
      );

      return members.length
        ? [{ ...node, presentation: { ...node.presentation, members } }]
        : [];
    }

    return visible.has(node.id) ? [node] : [];
  });

  return {
    data: { ...data, nodes: filteredNodes, edges: projectEdges(data) },
    unfiltered: { ...unfiltered, nodes, edges: allEdges },
  };
};
