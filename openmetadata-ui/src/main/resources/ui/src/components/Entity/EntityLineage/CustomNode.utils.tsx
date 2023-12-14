/*
 *  Copyright 2023 Collate.
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
import { Button } from 'antd';
import classNames from 'classnames';
import React, { Fragment } from 'react';
import { Handle, HandleProps, HandleType, Position } from 'reactflow';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-outlined.svg';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import {
  LineagePos,
  LoadingNodeState,
  SelectedNode,
} from './EntityLineage.interface';

export const getHandle = (
  node: EntityReference,
  nodeType: string,
  isConnectable: HandleProps['isConnectable'],
  isLeafNode: boolean,
  isNodeLoading: LoadingNodeState,
  className?: string,
  onSelect?: (state: boolean, value: SelectedNode) => void,
  loadNodeHandler?: (node: EntityReference, pos: LineagePos) => void
) => {
  if (nodeType === EntityLineageNodeType.OUTPUT) {
    return (
      <>
        {getHandleByType(isConnectable, Position.Left, 'target', className)}
        {generateExpandButton(
          isLeafNode,
          node,
          isNodeLoading,
          'to',
          nodeType,
          onSelect,
          loadNodeHandler
        )}
      </>
    );
  } else if (nodeType === EntityLineageNodeType.INPUT) {
    return (
      <>
        {generateExpandButton(
          isLeafNode,
          node,
          isNodeLoading,
          'from',
          nodeType,
          onSelect,
          loadNodeHandler
        )}
        {getHandleByType(isConnectable, Position.Right, 'source', className)}
      </>
    );
  } else if (nodeType === EntityLineageNodeType.NOT_CONNECTED) {
    return null;
  } else {
    return (
      <>
        {getHandleByType(isConnectable, Position.Left, 'target', className)}
        {getHandleByType(isConnectable, Position.Right, 'source', className)}
      </>
    );
  }
};

const generateExpandButton = (
  isLeaf: boolean,
  node: EntityReference,
  isNodeLoading: LoadingNodeState,
  direction: LineagePos,
  nodeType: EntityLineageNodeType,
  onSelect?: (state: boolean, value: SelectedNode) => void,
  loadNodeHandler?: (node: EntityReference, pos: LineagePos) => void
) => {
  // const isLoading = node.id.includes(isNodeLoading.id as string);
  const isLoading = false;

  if (isLeaf && !isLoading) {
    return (
      <Button
        className={classNames(
          'absolute lineage-node-handle flex-center',
          {
            'react-flow__handle-right':
              nodeType === EntityLineageNodeType.OUTPUT,
          },
          {
            'react-flow__handle-left': nodeType === EntityLineageNodeType.INPUT,
          }
        )}
        icon={<PlusIcon className="lineage-expand-icon" />}
        shape="circle"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(false, {} as SelectedNode);
          if (node) {
            loadNodeHandler?.(
              {
                ...node,
                fullyQualifiedName: getEncodedFqn(
                  node.fullyQualifiedName ?? ''
                ),
              },
              direction
            );
          }
        }}
      />
    );
  }

  return null;
};

export const getColumnHandle = (
  nodeType: string,
  isConnectable: HandleProps['isConnectable'],
  className?: string,
  id?: string
) => {
  if (nodeType === EntityLineageNodeType.NOT_CONNECTED) {
    return null;
  } else {
    return (
      <Fragment>
        {getHandleByType(isConnectable, Position.Left, 'target', className, id)}
        {getHandleByType(
          isConnectable,
          Position.Right,
          'source',
          className,
          id
        )}
      </Fragment>
    );
  }
};

export const getHandleByType = (
  isConnectable: HandleProps['isConnectable'],
  position: Position,
  type: HandleType,
  className?: string,
  id?: string
) => {
  return (
    <Handle
      className={className}
      id={id}
      isConnectable={isConnectable}
      position={position}
      type={type}
    />
  );
};
