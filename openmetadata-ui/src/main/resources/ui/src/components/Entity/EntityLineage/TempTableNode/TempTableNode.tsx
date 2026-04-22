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
import { useTranslation } from 'react-i18next';
import { Handle, HandleProps, NodeProps, Position } from 'reactflow';
import { EntityType } from '../../../../enums/entity.enum';
import { getServiceIcon } from '../../../../utils/TableUtils';
import './temp-table-node.less';

const getHandle = (
  isConnectable: HandleProps['isConnectable'],
  id?: string
) => {
  return (
    <>
      <Handle
        className="temp-table-handle"
        id={id}
        isConnectable={isConnectable}
        position={Position.Left}
        type="target"
      />
      <Handle
        className="temp-table-handle"
        id={id}
        isConnectable={isConnectable}
        position={Position.Right}
        type="source"
      />
    </>
  );
};

const TempTableNode = (props: NodeProps) => {
  const { data } = props;
  const { node } = data;
  const { t } = useTranslation();

  return (
    <div className="temp-table-node w-76" data-testid="temp-table-node-label">
      {getHandle(false)}
      <div className="temp-table-node-header">
        <span className="temp-table-node-icon">
          {getServiceIcon({ entityType: EntityType.TABLE })}
        </span>
        <span className="temp-table-node-type">
          {t('label.temporary-table')}
        </span>
      </div>
      <div className="temp-table-node-name">
        {node.displayName ?? node.name}
      </div>
    </div>
  );
};

export default TempTableNode;
