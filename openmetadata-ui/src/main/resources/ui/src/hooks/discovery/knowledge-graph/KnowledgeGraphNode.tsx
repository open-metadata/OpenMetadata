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

import type { NodeData } from '@antv/g6';
import { ComponentType } from 'react';
import { CustomNodeProps } from '../../../interface/discovery/knowledge-graph.interface';
import { getNodeRenderKey } from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';

interface KnowledgeGraphNodeProps {
  nodeData: NodeData;
  Component: ComponentType<CustomNodeProps>;
  onSelect: (id: string, keyboard: boolean) => void;
  onHoverStart: (id: string) => void;
  onHoverEnd: () => void;
  onExpand: (id: string) => void;
}

/**
 * G6 calls the `component` prop of a `react-node` with the raw `NodeData`,
 * so this component wraps the callbacks the canvas hook exposes and passes
 * them through to the injected `Component`. Extracting it out of the hook
 * removes a `useCallback`-heavy closure and makes the node renderer testable
 * on its own.
 */
const KnowledgeGraphNode = ({
  nodeData,
  Component,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onExpand,
}: Readonly<KnowledgeGraphNodeProps>) => (
  <Component
    nodeData={nodeData}
    nodeRenderKey={getNodeRenderKey(nodeData)}
    onBlur={onHoverEnd}
    onExpand={() => onExpand(nodeData.id)}
    onFocus={() => onHoverStart(nodeData.id)}
    onSelect={(keyboard) => onSelect(nodeData.id, keyboard)}
  />
);

export default KnowledgeGraphNode;
