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
import classNames from 'classnames';
import { PRIMERY_COLOR } from 'constants/constants';
import { entityData } from 'constants/Lineage.constants';
import { capitalize, isEmpty, uniqueId } from 'lodash';
import React, { FC, HTMLAttributes } from 'react';
import { Node } from 'reactflow';
import { getEntityIcon } from 'utils/TableUtils';
import { ReactComponent as DragIconDotted } from '../../assets/svg/dots-six-bold.svg';
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
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="d-flex flex-col  items-center">
      <div
        className={classNames(
          'sidebar-icon-container flex-center  d-flex justify-between',
          {
            'cursor-not-allowed opacity-50': !draggable,
          }
        )}
        draggable={draggable}
        style={{ ...(draggable && { cursor: 'grab' }) }}
        onDragStart={(event) => onDragStart(event, `${label}-default`)}>
        <span
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}>
          {getEntityIcon(type || '')}
        </span>
        <span className="d-flex">
          <Icon
            className="drag-icon"
            component={DragIconDotted}
            rotate={90}
            style={{
              color: PRIMERY_COLOR,
              fontSize: '18px',
              fontWeight: 'bold',
            }}
          />
        </span>
      </div>
      <p className="text-grey-body text-center text-xs">
        {capitalize(`${label}s`)}
      </p>
    </div>
  );
};

const EntityLineageSidebar: FC<SidebarProps> = ({ show, newAddedNode }) => {
  return (
    <div className={classNames('entity-lineage sidebar', { open: show })}>
      <div className="d-flex flex-col">
        {entityData.map((d) => (
          <EntityNode
            draggable={isEmpty(newAddedNode)}
            key={uniqueId()}
            label={d.label}
            type={d.type}
          />
        ))}
      </div>
    </div>
  );
};

export default EntityLineageSidebar;
