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

import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import Loader from 'components/Loader/Loader';
import { EntityLineageNodeType, EntityType } from 'enums/entity.enum';
import { get } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { isLeafNode } from 'utils/EntityUtils';
import { getEncodedFqn } from 'utils/StringsUtils';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { EntityReference } from '../../generated/type/entityReference';
import { getDataLabel } from '../../utils/EntityLineageUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import {
  LeafNodes,
  LineagePos,
  LoadingNodeState,
  SelectedNode,
} from './EntityLineage.interface';

interface LineageNodeLabelProps {
  node: EntityReference;
  onNodeExpand?: (isExpanded: boolean, node: EntityReference) => void;
  isExpanded?: boolean;
  isNodeLoading: LoadingNodeState;
  lineageLeafNodes: LeafNodes;
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void;
  type: string | undefined;
  onSelect: (state: boolean, value: SelectedNode) => void;
}

const TableExpandButton = ({
  node,
  onNodeExpand,
  isExpanded,
}: Pick<LineageNodeLabelProps, 'node' | 'onNodeExpand' | 'isExpanded'>) => {
  if (
    ![EntityType.TABLE, EntityType.DASHBOARD_DATA_MODEL].includes(
      node.type as EntityType
    )
  ) {
    return null;
  }

  return (
    <Button
      ghost
      className="absolute custom-node-expand-button p-0"
      icon={
        <SVGIcons
          alt="plus"
          icon={isExpanded ? Icons.ICON_MINUS : Icons.ICON_PLUS}
          width="16px"
        />
      }
      size="small"
      type="text"
      onClick={(e) => {
        e.stopPropagation();
        onNodeExpand && onNodeExpand(!isExpanded, node);
      }}
    />
  );
};

const EntityLabel = ({ node }: Pick<LineageNodeLabelProps, 'node'>) => {
  const { t } = useTranslation();
  if (node.type === EntityLineageNodeType.LOAD_MORE) {
    return (
      <div className="w-72">
        <span>{t('label.load-more')}</span>
        <span className="load-more-node-sizes p-x-xs">{`(${get(
          node,
          'pagination_data.childrenLength'
        )})`}</span>
      </div>
    );
  }

  return (
    <>
      <span className="m-r-xs">{getEntityIcon(node.type)}</span>
      {getDataLabel(
        node.displayName,
        node.fullyQualifiedName,
        false,
        node.type
      )}
    </>
  );
};

const LineageNodeLabel = ({
  node,
  onNodeExpand,
  isExpanded = false,
  isNodeLoading,
  lineageLeafNodes,
  loadNodeHandler,
  onSelect,
  type,
}: LineageNodeLabelProps) => {
  return (
    <div className="d-flex">
      {type === EntityLineageNodeType.INPUT && (
        <div
          className="tw-pr-2 tw-self-center tw-cursor-pointer "
          onClick={(e) => {
            e.stopPropagation();
            onSelect(false, {} as SelectedNode);
            if (node) {
              loadNodeHandler(
                {
                  ...node,
                  fullyQualifiedName: getEncodedFqn(
                    node.fullyQualifiedName ?? ''
                  ),
                },
                'from'
              );
            }
          }}>
          {!isLeafNode(lineageLeafNodes, node?.id as string, 'from') &&
          !node.id.includes(isNodeLoading.id as string) ? (
            <LeftOutlined className="text-primary m-r-xs" />
          ) : null}
          {isNodeLoading.state &&
          node.id.includes(isNodeLoading.id as string) ? (
            <Loader size="small" type="default" />
          ) : null}
        </div>
      )}
      <TableExpandButton
        isExpanded={isExpanded}
        node={node}
        onNodeExpand={onNodeExpand}
      />
      <p className="flex items-center m-0 p-y-sm">
        <EntityLabel node={node} />
      </p>
      {type === EntityLineageNodeType.OUTPUT && (
        <div
          className="tw-pl-2 tw-self-center tw-cursor-pointer "
          onClick={(e) => {
            e.stopPropagation();
            onSelect(false, {} as SelectedNode);
            if (node) {
              loadNodeHandler(
                {
                  ...node,
                  fullyQualifiedName: getEncodedFqn(
                    node.fullyQualifiedName ?? ''
                  ),
                },
                'to'
              );
            }
          }}>
          {!isLeafNode(lineageLeafNodes, node?.id as string, 'to') &&
          !node.id.includes(isNodeLoading.id as string) ? (
            <RightOutlined className="text-primary m-l-xs" />
          ) : null}
          {isNodeLoading.state &&
          node.id.includes(isNodeLoading.id as string) ? (
            <Loader size="small" type="default" />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default LineageNodeLabel;
