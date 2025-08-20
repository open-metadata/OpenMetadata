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

import Icon from '@ant-design/icons';
import { Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty, uniqueId } from 'lodash';
import { FC, HTMLAttributes } from 'react';
import { Node } from 'reactflow';
import DragIconDotted from '../../../assets/svg/dots-six-bold.svg?react';
import { entityData } from '../../../constants/Lineage.constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import searchClassBase from '../../../utils/SearchClassBase';
import './entity-lineage-sidebar.less';

interface SidebarProps extends HTMLAttributes<HTMLDivElement> {
  show: boolean;
  newAddedNode?: Node;
}

interface EntityNodeProps extends HTMLAttributes<HTMLDivElement> {
  type: string;
  label: string;
}

const EntityNode: FC<EntityNodeProps> = ({ type, label, draggable }) => {
  const { theme } = useApplicationStore();
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className=" m-b-sm text-center">
      <div
        className={classNames('sidebar-icon-container', {
          'cursor-not-allowed opacity-50': !draggable,
        })}
        data-testid={`${type}-draggable-icon`}
        draggable={draggable}
        style={{ ...(draggable && { cursor: 'grab' }) }}
        onDragStart={(event) => onDragStart(event, type)}>
        <span
          className="d-flex"
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}>
          {searchClassBase.getEntityIcon(type ?? '')}
        </span>
        <span className="d-flex m-l-xs">
          <Icon
            component={DragIconDotted}
            rotate={90}
            style={{
              color: theme.primaryColor,
            }}
          />
        </span>
      </div>
      <Typography.Text className="text-grey-body text-xs p-t-xs">
        {label}
      </Typography.Text>
    </div>
  );
};

const EntityLineageSidebar: FC<SidebarProps> = ({ show, newAddedNode }) => {
  return (
    <div
      className={classNames('entity-lineage sidebar', {
        open: show,
      })}>
      {entityData.map((d) => (
        <EntityNode
          draggable={isEmpty(newAddedNode)}
          key={uniqueId()}
          label={d.label}
          type={d.type}
        />
      ))}
    </div>
  );
};

export default EntityLineageSidebar;
