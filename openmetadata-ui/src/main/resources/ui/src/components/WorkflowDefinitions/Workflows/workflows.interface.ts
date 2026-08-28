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
import { Edge, Node } from 'reactflow';
import { StartEvent } from '../../../generated/governance/workflows/elements/nodes/startEvent/startEvent';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';

export interface WorkflowState {
  workflowDefinition: WorkflowDefinition | undefined;
  initialised: boolean;
  defaultNodes: Node[];
  defaultEdges: Edge[];
  drawerVisible: boolean;
  isEditMode: boolean;
  selectedNode: StartEvent | undefined;
  setWorkflowDefinition: (
    workflowDefinition: WorkflowDefinition | undefined
  ) => void;
  setInitialised: (initialised: boolean) => void;
  setDefaultNodes: (nodes: Node[]) => void;
  setDefaultEdges: (edges: Edge[]) => void;
  setDrawerVisible: (visible: boolean) => void;
  setSelectedNode: (node: StartEvent | undefined) => void;
  setNodesEdgesData: (data: {
    nodes: Node[];
    edges: Edge[];
    init: boolean;
  }) => void;
}

export interface WorkflowNodeData {
  /**
   * Description of the Node.
   */
  description?: string;
  /**
   * Display Name that identifies this Node.
   */
  displayName?: string;
  /**
   * Name that identifies this Node.
   */
  name?: string;
  subType?: string;
  type?: string;
}
