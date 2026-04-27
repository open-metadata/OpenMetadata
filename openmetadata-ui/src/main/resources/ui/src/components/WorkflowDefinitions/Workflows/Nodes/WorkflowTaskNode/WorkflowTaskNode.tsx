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
import { Space, Typography } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { Handle, Node, Position } from 'reactflow';
import { getEntityName } from '../../../../../utils/EntityUtils';
import { ReactComponent as TaskIcon } from '../../../../assets/svg/workflow-task.svg';
import { useWorkflowStore } from '../../useWorkflowStore';
import './task-node.less';

const WorkflowTaskNode = ({ data }: Node['data']) => {
  const { setDrawerVisible, setSelectedNode, selectedNode } =
    useWorkflowStore();

  const isActive = useMemo(() => {
    return selectedNode?.name === data.name;
  }, [selectedNode]);

  const handleNodeClick = () => {
    setSelectedNode(data);
    setDrawerVisible(true);
  };

  const taskHeading = data.config.rules ? 'CHECK' : 'ACTION';

  return (
    <div
      className={classNames('task-node', { active: isActive })}
      onClick={handleNodeClick}>
      <div className="task-node-header">
        <TaskIcon height={30} width={30} />
        <Space className="m-l-xs" direction="vertical" size={0}>
          <Typography.Text className="text-grey-muted">
            {taskHeading}
          </Typography.Text>
          <Typography.Text strong>{getEntityName(data)}</Typography.Text>
        </Space>
      </div>
      <Handle isConnectable={false} position={Position.Bottom} type="source" />
      <Handle isConnectable={false} position={Position.Top} type="target" />
    </div>
  );
};

export default WorkflowTaskNode;
