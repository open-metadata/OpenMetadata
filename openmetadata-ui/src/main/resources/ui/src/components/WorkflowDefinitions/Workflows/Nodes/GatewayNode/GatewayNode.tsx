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
import { ForkOutlined } from '@ant-design/icons';
import { Space, Typography } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Node, Position } from 'reactflow';
import { getEntityName } from '../../../../../utils/EntityUtils';
import { useWorkflowStore } from '../../useWorkflowStore';
import './gateway-node.less';

const GatewayNode = ({ data }: Node['data']) => {
  const { t } = useTranslation();
  const { setDrawerVisible, setSelectedNode, selectedNode } =
    useWorkflowStore();

  const isActive = useMemo(() => {
    return selectedNode?.name === data.name;
  }, [selectedNode, data?.name]);

  const handleNodeClick = () => {
    setSelectedNode(data);
    setDrawerVisible(true);
  };

  return (
    <div
      className={classNames('gateway-node', { active: isActive })}
      onClick={handleNodeClick}>
      <div className="gateway-node-header">
        <ForkOutlined style={{ fontSize: '24px' }} />
        <Space className="m-l-xs" direction="vertical" size={0}>
          <Typography.Text className="text-grey-muted gateway-node-action">
            {t('label.gateway')}
          </Typography.Text>
          <Typography.Text strong>{getEntityName(data)}</Typography.Text>
        </Space>
      </div>
      <Handle isConnectable={false} position={Position.Bottom} type="source" />
      <Handle isConnectable={false} position={Position.Top} type="target" />
    </div>
  );
};

export default GatewayNode;
