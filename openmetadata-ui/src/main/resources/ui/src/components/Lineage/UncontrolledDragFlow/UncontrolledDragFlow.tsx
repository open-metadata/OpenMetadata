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
import ReactFlow, { Node, OnNodesChange, ReactFlowProps } from 'reactflow';
import { useUncontrolledNodeDrag } from '../../../hooks/lineage/useUncontrolledNodeDrag';

interface UncontrolledDragFlowProps extends ReactFlowProps {
  nodes: Node[];
  onNodesChange: OnNodesChange;
}

/**
 * `<ReactFlow>` whose node drags stay inside React Flow until the drop.
 * The drag handler needs the flow store, so it must render inside the
 * caller's `ReactFlowProvider` rather than above it.
 */
const UncontrolledDragFlow = ({
  nodes,
  onNodesChange,
  ...props
}: UncontrolledDragFlowProps) => {
  const flow = useUncontrolledNodeDrag(nodes, onNodesChange);

  return (
    <ReactFlow
      {...props}
      nodes={flow.nodes}
      onNodesChange={flow.onNodesChange}
    />
  );
};

export default UncontrolledDragFlow;
