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

import { Button } from 'antd';
import { EntityLineageNodeType, EntityType } from 'enums/entity.enum';
import { get } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { EntityReference } from '../../generated/type/entityReference';
import { getDataLabel } from '../../utils/EntityLineageUtils';
import { getEntityIcon } from '../../utils/TableUtils';

interface LineageNodeLabelProps {
  node: EntityReference;
  onNodeExpand?: (isExpanded: boolean, node: EntityReference) => void;
  isExpanded?: boolean;
}

const TableExpandButton = ({
  node,
  onNodeExpand,
  isExpanded,
}: LineageNodeLabelProps) => {
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
      className="custom-node-expand-button p-0"
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

const EntityLabel = ({ node }: LineageNodeLabelProps) => {
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
}: LineageNodeLabelProps) => {
  return (
    <>
      <TableExpandButton
        isExpanded={isExpanded}
        node={node}
        onNodeExpand={onNodeExpand}
      />
      <p className="flex items-center m-0 p-y-sm">
        <EntityLabel node={node} />
      </p>
    </>
  );
};

export default LineageNodeLabel;
