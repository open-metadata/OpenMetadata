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
import { Handle, NodeProps, Position } from 'reactflow';
import '../custom-node.less';
import './temp-table-node.less';

const TempTableNode = (props: NodeProps) => {
  const { data } = props;
  const { node } = data;

  return (
    <div className="temp-table-node" data-testid="temp-table-node-label">
      <Handle
        className="lineage-node-handle"
        id={node.id}
        isConnectable={false}
        position={Position.Left}
        type="target"
      />
      <Handle
        className="lineage-node-handle"
        id={node.id}
        isConnectable={false}
        position={Position.Right}
        type="source"
      />
      <div className="temp-table-node-name">
        {node.displayName ?? node.name}
      </div>
    </div>
  );
};

export default TempTableNode;
