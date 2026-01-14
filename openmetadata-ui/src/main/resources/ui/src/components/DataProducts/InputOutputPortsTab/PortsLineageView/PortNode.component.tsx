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

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import '../../../Entity/EntityLineage/custom-node.less';
import LineageNodeLabelV1 from '../../../Entity/EntityLineage/LineageNodeLabelV1';
import { PortNodeProps } from './PortsLineageView.types';

const PortNode = memo(({ data }: PortNodeProps) => {
  const { port, isInputPort } = data;

  return (
    <div
      className="lineage-node"
      data-testid={`port-node-${port.fullyQualifiedName}`}>
      {isInputPort && (
        <Handle
          className="lineage-node-handle"
          id={port.id}
          position={Position.Right}
          type="source"
        />
      )}
      {!isInputPort && (
        <Handle
          className="lineage-node-handle"
          id={port.id}
          position={Position.Left}
          type="target"
        />
      )}

      <div className="lineage-node-content">
        <div className="label-container">
          <LineageNodeLabelV1 node={port} />
        </div>
      </div>
    </div>
  );
});

PortNode.displayName = 'PortNode';

export default PortNode;
