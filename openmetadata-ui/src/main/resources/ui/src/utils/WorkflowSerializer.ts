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

import type { Edge, Node } from 'reactflow';
import { MarkerType } from 'reactflow';
import { ConditionValue } from '../constants/WorkflowBuilder.constants';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';
import { Event } from '../generated/governance/workflows/elements/triggers/eventBasedEntityTrigger';
import {
  TriggerObject,
  Type,
  WorkflowDefinition,
} from '../generated/governance/workflows/workflowDefinition';
import {
  BackendEdge,
  BackendNode,
  NodeData,
  NodePosition,
} from '../interface/WorkflowTypes.interface';

const getUINodeType = (backendType: string, backendSubType: string): string => {
  if (
    backendType === NodeType.StartEvent ||
    backendSubType === NodeSubType.StartEvent
  ) {
    return NodeType.StartEvent;
  }
  if (
    backendType === NodeType.EndEvent ||
    backendSubType === NodeSubType.EndEvent
  ) {
    return NodeType.EndEvent;
  }
  if (backendType === NodeType.AutomatedTask) {
    // Every NodeSubType under AutomatedTask maps to the same UI node type, so
    // the subtype itself doesn't change the result.
    return NodeType.AutomatedTask;
  }
  if (backendType === NodeType.UserTask) {
    return NodeType.UserTask;
  }

  return NodeType.AutomatedTask;
};

const generateNodePositions = (
  nodes: BackendNode[],
  edges: BackendEdge[]
): Map<string, NodePosition> => {
  const positions = new Map<string, NodePosition>();
  const visited = new Set<string>();

  // Find start nodes
  const startNodes = nodes.filter(
    (node) =>
      node.type === NodeType.StartEvent ||
      node.subType === NodeSubType.StartEvent
  );

  const adjacencyList = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!adjacencyList.has(edge.from)) {
      adjacencyList.set(edge.from, []);
    }
    const existingEdges = adjacencyList.get(edge.from);
    if (existingEdges) {
      existingEdges.push(edge.to);
    }
  });

  const HORIZONTAL_SPACING = 350;
  const VERTICAL_SPACING = 150;

  let currentLevel = 0;
  let nodesInCurrentLevel: string[] = [];

  if (startNodes.length > 0) {
    nodesInCurrentLevel = startNodes.map((node) => node.name);
  } else {
    nodesInCurrentLevel = [nodes[0]?.name].filter(Boolean);
  }

  while (nodesInCurrentLevel.length > 0) {
    const nextLevelNodes: string[] = [];

    nodesInCurrentLevel.forEach((nodeName, index) => {
      if (!visited.has(nodeName)) {
        const x = currentLevel * HORIZONTAL_SPACING;
        const y =
          (index - (nodesInCurrentLevel.length - 1) / 2) * VERTICAL_SPACING;

        positions.set(nodeName, { x, y });
        visited.add(nodeName);

        // Add children to next level
        const children = adjacencyList.get(nodeName) || [];
        children.forEach((child) => {
          if (!visited.has(child) && !nextLevelNodes.includes(child)) {
            nextLevelNodes.push(child);
          }
        });
      }
    });

    nodesInCurrentLevel = nextLevelNodes;
    currentLevel++;
  }

  // Position any remaining unvisited nodes
  nodes.forEach((node, index) => {
    if (!positions.has(node.name)) {
      positions.set(node.name, {
        x: currentLevel * HORIZONTAL_SPACING,
        y: index * VERTICAL_SPACING,
      });
    }
  });

  return positions;
};

const convertBackendNodeToReactFlow = (
  backendNode: BackendNode,
  position: NodePosition
): Node => {
  const nodeType = getUINodeType(backendNode.type, backendNode.subType);

  return {
    id: backendNode.name,
    type: nodeType,
    position,
    data: {
      name: backendNode.name,
      label: backendNode.displayName || backendNode.name,
      displayName: backendNode.displayName,
      description: backendNode.description,
      subType: backendNode.subType,
      action: backendNode.displayName || backendNode.name,
      config: backendNode.config,
      input: backendNode.input,
      inputNamespaceMap: backendNode.inputNamespaceMap,
      output: backendNode.output,
      branches: backendNode.branches,
    } as NodeData,
  };
};

interface ConditionStyle {
  label: string;
  color: string;
  fill: string;
}

const KNOWN_CONDITION_STYLES: Record<string, ConditionStyle> = {
  true: { label: ConditionValue.TRUE, color: '#039855', fill: '#D1FADF' },
  approve: { label: ConditionValue.APPROVE, color: '#039855', fill: '#D1FADF' },
  reject: { label: ConditionValue.REJECT, color: '#D92D20', fill: '#FEE4E2' },
  false: { label: ConditionValue.FALSE, color: '#EAB308', fill: '#FEF0C7' },
};

const DEFAULT_CONDITION_STYLE: Omit<ConditionStyle, 'label'> = {
  color: '#2563EB',
  fill: '#EFF6FF',
};

const getConditionStyle = (condition: string): ConditionStyle =>
  KNOWN_CONDITION_STYLES[condition] ?? {
    label: condition,
    ...DEFAULT_CONDITION_STYLE,
  };

const getEdgeConditionData = (
  condition: string
): {
  conditions: [{ field: string; operator: string; value: string }];
  condition: string;
} => {
  const value =
    condition === 'true' || condition === 'false'
      ? condition.toUpperCase()
      : condition;

  return {
    conditions: [{ field: 'result', operator: 'equals', value }],
    condition,
  };
};

const convertBackendEdgeToReactFlow = (
  backendEdge: BackendEdge,
  index: number
): Edge => {
  const condition = backendEdge.condition;
  const isConditional = Boolean(condition && condition.trim() !== '');

  let edgeStyle = {};
  let labelStyle = {};
  let labelBgStyle = {};
  let label = '';

  if (isConditional && condition) {
    const style = getConditionStyle(condition);
    label = style.label;
    edgeStyle = { strokeWidth: 2 };
    labelStyle = {
      color: style.color,
      fontSize: '14px',
      fontWeight: 600,
      letterSpacing: '1px',
      cursor: 'pointer',
    };
    labelBgStyle = {
      fill: style.fill,
      fillOpacity: 1,
      stroke: '#FFF',
      strokeWidth: 2,
      rx: 5,
      ry: 5,
    };
  }

  return {
    id: `${backendEdge.from}-${backendEdge.to}-${index}`,
    source: backendEdge.from,
    target: backendEdge.to,
    type: 'straight',
    label,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: '#A4A7AE',
    },
    style: {
      stroke: '#A4A7AE',
      strokeWidth: 2,
      ...edgeStyle,
    },
    labelStyle,
    labelBgStyle,
    labelBgPadding: [4, 8] as [number, number],
    data:
      isConditional && condition ? getEdgeConditionData(condition) : undefined,
  };
};

const findAllPredecessors = (
  targetId: string,
  edges: BackendEdge[]
): string[] => {
  const predecessors = new Set<string>();
  const visited = new Set<string>();

  // Build reverse adjacency list (who points to whom)
  const reverseAdjList = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!reverseAdjList.has(edge.to)) {
      reverseAdjList.set(edge.to, []);
    }
    reverseAdjList.get(edge.to)?.push(edge.from);
  });

  // BFS backwards from target
  const queue = [targetId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const parents = reverseAdjList.get(currentId) || [];
    for (const parent of parents) {
      predecessors.add(parent);
      if (!visited.has(parent)) {
        queue.push(parent);
      }
    }
  }

  return Array.from(predecessors);
};

const MIGRATE_ALWAYS_UPDATED_BY = new Set([
  'global',
  'ApproveGlossaryTerm',
  'ApprovalForUpdates',
]);

function shouldMigrateUpdatedBy(
  currentUpdatedBy: string | undefined,
  nodes: BackendNode[],
  allPredecessors: string[]
): boolean {
  if (!currentUpdatedBy) {
    return false;
  }
  if (MIGRATE_ALWAYS_UPDATED_BY.has(currentUpdatedBy)) {
    return true;
  }

  const referencesKnownNode = nodes.some((n) => n.name === currentUpdatedBy);
  const referencesPredecessor = allPredecessors.includes(currentUpdatedBy);

  return !referencesKnownNode || !referencesPredecessor;
}

function isEligibleForUpdatedByMigration(node: BackendNode): boolean {
  const isMigratableSubType =
    node.subType === NodeSubType.SetEntityAttributeTask ||
    node.subType === NodeSubType.RollbackEntityTask;

  return Boolean(isMigratableSubType && node.input?.includes('updatedBy'));
}

function migrateNodeInputNamespace(
  node: BackendNode,
  nodes: BackendNode[],
  edges: BackendEdge[],
  userTasks: BackendNode[]
): BackendNode {
  if (!isEligibleForUpdatedByMigration(node)) {
    return node;
  }

  const currentUpdatedBy = node.inputNamespaceMap?.updatedBy;
  const allPredecessors = findAllPredecessors(node.name, edges);

  if (!shouldMigrateUpdatedBy(currentUpdatedBy, nodes, allPredecessors)) {
    return node;
  }

  // Only use a user task that is actually a predecessor (comes before this node)
  const predecessorUserTask = userTasks.find((userTask) =>
    allPredecessors.includes(userTask.name)
  );

  return {
    ...node,
    inputNamespaceMap: {
      ...node.inputNamespaceMap,
      // Use the actual node name from the workflow, or fall back to 'global'
      // when no predecessor user task exists.
      updatedBy: predecessorUserTask ? predecessorUserTask.name : 'global',
    },
  };
}

const migrateWorkflowInputNamespaceMap = (
  nodes: BackendNode[],
  edges: BackendEdge[]
): BackendNode[] => {
  const userTasks = nodes.filter(
    (n) => n.subType === NodeSubType.UserApprovalTask
  );

  return nodes.map((node) =>
    migrateNodeInputNamespace(node, nodes, edges, userTasks)
  );
};

export const deserializeWorkflow = (
  workflowDefinition: WorkflowDefinition
): {
  nodes: Node[];
  edges: Edge[];
  metadata: {
    name: string;
    displayName: string;
    description: string;
    trigger: TriggerObject;
  };
} => {
  let backendNodes = (workflowDefinition.nodes || []) as BackendNode[];
  const backendEdges = (workflowDefinition.edges || []) as BackendEdge[];

  // Migrate inputNamespaceMap to fix updatedBy references
  backendNodes = migrateWorkflowInputNamespaceMap(backendNodes, backendEdges);

  // Generate positions for all nodes
  const positions = generateNodePositions(backendNodes, backendEdges);

  // Convert nodes
  const reactFlowNodes: Node[] = backendNodes.map((backendNode) => {
    const position = positions.get(backendNode.name) || { x: 0, y: 0 };

    return convertBackendNodeToReactFlow(backendNode, position);
  });

  // Convert edges
  const reactFlowEdges: Edge[] = backendEdges.map((backendEdge, index) =>
    convertBackendEdgeToReactFlow(backendEdge, index)
  );

  // Extract metadata
  const metadata = {
    name: workflowDefinition.name || '',
    displayName: workflowDefinition.displayName || '',
    description: workflowDefinition.description || '',
    trigger:
      workflowDefinition.trigger &&
      typeof workflowDefinition.trigger === 'object' &&
      'type' in workflowDefinition.trigger
        ? (workflowDefinition.trigger as TriggerObject)
        : {
            type: Type.EventBasedEntity,
            config: {
              entityTypes: [],
              events: [Event.Created, Event.Updated],
              filter: {},
            },
          },
  };

  return {
    nodes: reactFlowNodes,
    edges: reactFlowEdges,
    metadata,
  };
};
