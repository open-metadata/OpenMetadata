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
import { Handle, HandleProps, NodeProps, Position } from 'reactflow';
import './load-more-node.less';

const getHandle = (
  isConnectable: HandleProps['isConnectable'],
  id?: string
) => {
  return (
    <>
      <Handle
        className="load-more-handle"
        id={id}
        isConnectable={isConnectable}
        position={Position.Left}
        type="target"
      />
      <Handle
        className="load-more-handle"
        id={id}
        isConnectable={isConnectable}
        position={Position.Right}
        type="source"
      />
    </>
  );
};

const LoadMoreNode = (props: NodeProps) => {
  const { data } = props;
  const { node } = data;

  return (
    <div className="load-more-node w-76" data-testid="node-label">
      {getHandle(false)}
      {node.displayName ?? node.name}
    </div>
  );
};

export default LoadMoreNode;
