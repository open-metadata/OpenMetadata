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

import { Space } from 'antd';
import classNames from 'classnames';
import { CSSProperties, Fragment } from 'react';
import { Handle, HandleType, NodeProps, Position } from 'reactflow';
import { EntityLineageNodeType } from '../../../../enums/entity.enum';
import './task-node.style.less';

const handleStyles = {
  opacity: 0,
  height: '1px',
  width: '1px',
};

const renderHandle = (position: Position, isConnectable: boolean) => {
  const styles = { ...handleStyles } as CSSProperties;
  let type: HandleType;
  if (position === Position.Left) {
    type = 'target';
    styles.left = '10px';
  } else {
    type = 'source';
    styles.right = '10px';
  }

  return (
    <Handle
      isConnectable={isConnectable}
      position={position}
      style={styles}
      type={type}
    />
  );
};

const getHandle = (nodeType: string, isConnectable: boolean) => {
  if (nodeType === EntityLineageNodeType.OUTPUT) {
    return renderHandle(Position.Left, isConnectable);
  } else if (nodeType === EntityLineageNodeType.INPUT) {
    return renderHandle(Position.Right, isConnectable);
  } else {
    return (
      <Fragment>
        {renderHandle(Position.Left, isConnectable)}
        {renderHandle(Position.Right, isConnectable)}
      </Fragment>
    );
  }
};

const TaskNode = (props: NodeProps) => {
  const { data, type, isConnectable } = props;
  const { label, taskStatus } = data;

  return (
    <div
      className="task-node relative nowheel border rounded-6 p-x-sm"
      data-testid="task-node-container">
      {getHandle(type, isConnectable)}
      {/* Node label could be simple text or reactNode */}
      <Space className="p-x-sm p-y-sm w-full" data-testid="node-label">
        <div
          className={classNames(
            'custom-node-label',
            taskStatus ? taskStatus : 'bg-primary'
          )}
          data-testid="node-label-status"
        />
        {label}
      </Space>
    </div>
  );
};

export default TaskNode;
