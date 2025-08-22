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

import { Typography } from 'antd';
import classNames from 'classnames';
import { memo, useDeferredValue, useMemo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { getServiceIcon } from '../../../utils/TableUtils';
import './nodes.less';

interface OutputNodeData {
  node: {
    id: string;
    name: string;
    fullyQualifiedName: string;
    entityType: string;
    displayName?: string;
  };
  isEditMode?: boolean;
}

const OutputNode = memo<NodeProps<OutputNodeData>>(
  ({ data, selected, isConnectable }) => {
    // Use React 18's useDeferredValue for non-urgent updates
    const deferredData = useDeferredValue(data);

    const displayName = useMemo(
      () => deferredData.node?.displayName || deferredData.node?.name || '',
      [deferredData.node]
    );

    const icon = useMemo(
      () => getServiceIcon(deferredData.node as SourceType),
      [deferredData.node]
    );

    const nodeClasses = useMemo(
      () =>
        classNames('lineage-node-v1', 'output-node', {
          selected: selected,
          'edit-mode': deferredData.isEditMode,
        }),
      [selected, deferredData.isEditMode]
    );

    return (
      <div
        className={nodeClasses}
        data-testid={`output-node-${deferredData.node?.id}`}>
        <Handle
          className="lineage-handle-v1"
          id="target"
          isConnectable={isConnectable}
          position={Position.Left}
          type="target"
        />

        <div className="node-content">
          <div className="node-icon">{icon}</div>
          <div className="node-info">
            <Typography.Text className="node-name" ellipsis={{ tooltip: true }}>
              {displayName}
            </Typography.Text>
            <Typography.Text className="node-type" type="secondary">
              {deferredData.node?.entityType}
            </Typography.Text>
          </div>
        </div>
      </div>
    );
  },
  // Custom comparison to prevent re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.data.node?.id === nextProps.data.node?.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.isConnectable === nextProps.isConnectable &&
      prevProps.data.isEditMode === nextProps.data.isEditMode
    );
  }
);

OutputNode.displayName = 'OutputNode';

export default OutputNode;
