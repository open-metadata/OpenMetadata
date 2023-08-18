/*
 *  Copyright 2022 Collate.
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

import React, { CSSProperties, Fragment, useEffect } from 'react';
import {
  Handle,
  HandleProps,
  NodeProps,
  Position,
  useUpdateNodeInternals,
} from 'reactflow';

const handleStyles: CSSProperties = {
  width: '20%',
  height: '100%',
  borderRadius: '3px',
  position: 'absolute',
  background: 'transparent',
  border: 'none',
};

const leftHandleStyle: CSSProperties = {
  ...handleStyles,
  left: -1,
};

const rightHandleStyle: CSSProperties = {
  ...handleStyles,
  right: -1,
};

const getHandle = (
  isConnectable: HandleProps['isConnectable'],
  id?: string
) => {
  return (
    <Fragment>
      <Handle
        id={id}
        isConnectable={isConnectable}
        position={Position.Left}
        style={leftHandleStyle}
        type="target"
      />
      <Handle
        id={id}
        isConnectable={isConnectable}
        position={Position.Right}
        style={rightHandleStyle}
        type="source"
      />
    </Fragment>
  );
};

const LoadMoreNode = (props: NodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const { data, isConnectable, id } = props;
  /* eslint-disable-next-line */
  const { label, isEditMode, isExpanded } = data;

  useEffect(() => {
    updateNodeInternals(id);
  }, [isEditMode, isExpanded]);

  return (
    <div className="load-more-node" data-testid="node-label">
      {getHandle(isConnectable)}
      {label}
    </div>
  );
};

export default LoadMoreNode;
