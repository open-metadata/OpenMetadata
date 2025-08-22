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

interface DefaultNodeData {
  node: {
    id: string;
    name: string;
    fullyQualifiedName: string;
    entityType: string;
    displayName?: string;
  };
  isRootNode?: boolean;
  isEditMode?: boolean;
  isNewNode?: boolean;
  label?: React.ReactNode;
}

const DefaultNode = memo<NodeProps<DefaultNodeData>>(
  ({ data, selected, isConnectable }) => {
    // Use React 18's useDeferredValue for non-urgent updates
    const deferredData = useDeferredValue(data);

    // Memoize computed values
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
        classNames('lineage-node-v1', 'default-node', {
          'root-node': deferredData.isRootNode,
          selected: selected,
          'edit-mode': deferredData.isEditMode,
          'new-node': deferredData.isNewNode,
        }),
      [
        deferredData.isRootNode,
        selected,
        deferredData.isEditMode,
        deferredData.isNewNode,
      ]
    );

    // Show custom label if provided (for new nodes)
    if (deferredData.label) {
      return <div className={nodeClasses}>{deferredData.label}</div>;
    }

    return (
      <div
        className={nodeClasses}
        data-testid={`node-${deferredData.node?.id}`}>
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

        <Handle
          className="lineage-handle-v1"
          id="source"
          isConnectable={isConnectable}
          position={Position.Right}
          type="source"
        />
      </div>
    );
  },
  // Custom comparison function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
      prevProps.data.node?.id === nextProps.data.node?.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.isConnectable === nextProps.isConnectable &&
      prevProps.data.isEditMode === nextProps.data.isEditMode &&
      prevProps.data.isNewNode === nextProps.data.isNewNode &&
      prevProps.data.isRootNode === nextProps.data.isRootNode
    );
  }
);

DefaultNode.displayName = 'DefaultNode';

export default DefaultNode;
