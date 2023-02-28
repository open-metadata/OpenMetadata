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

import classNames from 'classnames';
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
  borderLeft: '5px solid #d9ceee',
  left: -1,
};

const rightHandleStyle: CSSProperties = {
  ...handleStyles,
  borderRight: '5px solid #d9ceee',
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
  const { data, isConnectable, selected, id } = props;
  /* eslint-disable-next-line */
  const { label, isEditMode, isExpanded, isTraced } = data;

  useEffect(() => {
    updateNodeInternals(id);
  }, [isEditMode, isExpanded]);

  return (
    <div className="nowheel custom-node load-more-node">
      {/* Node label could be simple text or reactNode */}
      <div
        className={classNames(
          'custom-node-header',
          selected || data.selected
            ? 'custom-node-header-active'
            : 'custom-node-header-normal',
          { 'custom-node-header-tracing': isTraced }
        )}
        data-testid="node-label">
        {getHandle(isConnectable)}
        {label}{' '}
      </div>
    </div>
  );
};

export default LoadMoreNode;
