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
import { capitalize, isEmpty, uniqueId } from 'lodash';
import React, { FC, HTMLAttributes } from 'react';
import { Node } from 'reactflow';
import { ReactComponent as DragIconDotted } from '../../assets/svg/dots-six-bold.svg';
import { entityData } from '../../constants/Lineage.constants';
import SVGIcons from '../../utils/SvgUtils';

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
    <div className="tw-flex tw-flex-col tw-mb-5 tw-items-center">
      <div
        className={classNames(
          'tw-border tw-p-2 tw-border-main tw-flex tw-justify-between tw-w-16 tw-rounded tw-shadow-lg tw-bg-body-hover',
          {
            'tw-cursor-not-allowed tw-opacity-50': !draggable,
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
          <SVGIcons alt={type} icon={`${type}-grey`} width="14" />
        </span>
        <span>
          <Icon
            className="drag-icon"
            component={DragIconDotted}
            rotate={90}
            style={{ color: '#7147E8', fontSize: '18px', fontWeight: 'bold' }}
          />
        </span>
      </div>
      <p className="tw-text-grey-body tw-text-center tw-text-xs tw-pt-1.5">
        {capitalize(`${label}s`)}
      </p>
    </div>
  );
};

const EntityLineageSidebar: FC<SidebarProps> = ({ show, newAddedNode }) => {
  return (
    <div className={classNames('entity-lineage sidebar', { open: show })}>
      <div className="tw-flex tw-flex-col tw-mt-3">
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
