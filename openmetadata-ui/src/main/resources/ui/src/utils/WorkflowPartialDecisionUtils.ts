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
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';

export const PARTIAL_APPROVE = 'partialApprove';
export const PARTIAL_REJECT = 'partialReject';

interface SavedNode {
  name: string;
  subType?: string;
  config?: Record<string, unknown>;
}

interface SavedEdge {
  from: string;
  to: string;
  condition?: string;
}

const LOOPS = [
  { condition: PARTIAL_APPROVE, action: 'commit', suffix: 'PartialCommit' },
  { condition: PARTIAL_REJECT, action: 'discard', suffix: 'PartialDiscard' },
];

const isPartialEdge = (edge: SavedEdge) =>
  edge.condition === PARTIAL_APPROVE || edge.condition === PARTIAL_REJECT;

const loopStep = (approval: string, name: string, action: string) => ({
  type: NodeType.AutomatedTask,
  subType: NodeSubType.ResolvePendingChangeTask,
  name,
  displayName: name,
  config: { action },
  input: ['relatedEntity', 'updatedBy'],
  inputNamespaceMap: { relatedEntity: 'global', updatedBy: approval },
  output: [],
});

const uniqueName = (base: string, taken: Set<string>) => {
  let name = base;
  for (let i = 2; taken.has(name); i++) {
    name = `${base}${i}`;
  }
  taken.add(name);

  return name;
};

// Adds the commit and discard steps an approval step that allows partial decisions loops through,
// for the loops it does not have yet.
const addLoops = (approval: string, nodes: SavedNode[], edges: SavedEdge[]) => {
  const taken = new Set(nodes.map((node) => node.name));
  const added: ReturnType<typeof loopStep>[] = [];
  const addedEdges: SavedEdge[] = [];
  LOOPS.filter(
    ({ condition }) =>
      !edges.some(
        (edge) => edge.from === approval && edge.condition === condition
      )
  ).forEach(({ condition, action, suffix }) => {
    const name = uniqueName(`${approval}${suffix}`, taken);
    added.push(loopStep(approval, name, action));
    addedEdges.push({ from: approval, to: name, condition });
    addedEdges.push({ from: name, to: approval });
  });

  return { added, addedEdges };
};

// The loop steps of an approval step that no longer allows partial decisions: the steps its partial
// edges lead to that nothing else leads to.
const orphanedLoopSteps = (approval: string, edges: SavedEdge[]) => {
  const partialTargets = edges
    .filter((edge) => edge.from === approval && isPartialEdge(edge))
    .map((edge) => edge.to);

  return new Set(
    partialTargets.filter(
      (target) =>
        !edges.some(
          (edge) =>
            edge.to === target &&
            !(edge.from === approval && isPartialEdge(edge))
        )
    )
  );
};

// A workflow holds changes when a commit or discard step is reached other than through a partial
// decision loop; the loops of an approval step do not make a workflow hold changes on their own.
const holdsChanges = (nodes: SavedNode[], edges: SavedEdge[]) => {
  const resolveSteps = new Set(
    nodes
      .filter((node) => node.subType === NodeSubType.ResolvePendingChangeTask)
      .map((node) => node.name)
  );

  return edges.some(
    (edge) => resolveSteps.has(edge.to) && !isPartialEdge(edge)
  );
};

/**
 * Makes each approval step's partial decision loops match its setting: a step that allows partial
 * decisions gets a partialApprove edge to a commit step and a partialReject edge to a discard step,
 * both looping back to it; a step that does not loses those edges and the steps only they lead to.
 * In a workflow that does not hold changes no step allows partial decisions.
 */
export const syncPartialDecisionLoops = <N extends SavedNode>(
  nodes: N[],
  edges: SavedEdge[]
): { nodes: (N | ReturnType<typeof loopStep>)[]; edges: SavedEdge[] } => {
  let syncedNodes: (N | ReturnType<typeof loopStep>)[] = [...nodes];
  let syncedEdges = [...edges];
  const holds = holdsChanges(nodes, edges);
  nodes
    .filter((node) => node.subType === NodeSubType.UserApprovalTask)
    .forEach((node) => {
      if (holds && node.config?.allowPartialDecisions === true) {
        const { added, addedEdges } = addLoops(
          node.name,
          syncedNodes,
          syncedEdges
        );
        syncedNodes = [...syncedNodes, ...added];
        syncedEdges = [...syncedEdges, ...addedEdges];
      } else {
        const orphaned = orphanedLoopSteps(node.name, syncedEdges);
        syncedNodes = syncedNodes.filter((n) => !orphaned.has(n.name));
        syncedEdges = syncedEdges.filter(
          (edge) =>
            !(edge.from === node.name && isPartialEdge(edge)) &&
            !orphaned.has(edge.from) &&
            !orphaned.has(edge.to)
        );
      }
    });

  return { nodes: syncedNodes, edges: syncedEdges };
};
