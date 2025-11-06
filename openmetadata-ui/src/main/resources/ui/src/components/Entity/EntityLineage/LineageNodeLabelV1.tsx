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

import { Box, Button } from '@mui/material';
import { Col, Space, Typography } from 'antd';
import classNames from 'classnames';
import { capitalize } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDBTModel } from '../../../assets/svg/dbt-model.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as MappingIcon } from '../../../assets/svg/node-mapping.svg';
import { EntityType } from '../../../enums/entity.enum';
import { ModelType, Table } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityTypeIcon, getServiceIcon } from '../../../utils/TableUtils';
import { SourceType } from '../../SearchedData/SearchedData.interface';

interface LineageNodeLabelProps {
  node: SourceType;
  isColumnsListExpanded?: boolean;
  toggleColumnsList?: () => void;
}

interface LineageNodeLabelPropsExtended
  extends Omit<LineageNodeLabelProps, 'node'> {
  node: LineageNodeLabelProps['node'] & {
    serviceType?: string;
    columnNames?: string[];
  };
}

const EntityLabel = ({ node }: LineageNodeLabelPropsExtended) => {
  const { showDeletedIcon, showDbtIcon } = useMemo(() => {
    return {
      showDbtIcon:
        node.entityType === EntityType.TABLE &&
        (node as Table)?.dataModel?.modelType === ModelType.Dbt &&
        (node as Table)?.dataModel?.resourceType?.toLowerCase() !== 'seed',
      showDeletedIcon: node.deleted ?? false,
    };
  }, [node]);

  return (
    <Col className="items-center entity-label-container">
      <Col className="d-flex items-center" flex="auto">
        <div className="d-flex entity-service-icon m-r-xs">
          {getServiceIcon(node)}
        </div>
        <Space align="start" direction="vertical" size={0}>
          <Space
            align="start"
            className="entity-header-name"
            direction="horizontal"
            size={6}>
            <Typography.Text className="m-b-0 d-flex text-left text-grey-muted node-service-type">
              {node.serviceType}
            </Typography.Text>
            {getEntityTypeIcon(node.entityType)}
            <Typography.Text className="m-b-0 d-flex text-left text-grey-muted node-entity-type">
              {capitalize(node.entityType)}
            </Typography.Text>
          </Space>
          <Typography.Text
            className="m-b-0 d-block text-left entity-header-display-name text-md font-medium w-54"
            data-testid="entity-header-display-name"
            ellipsis={{ tooltip: true }}>
            {getEntityName(node)}
          </Typography.Text>
        </Space>
        {!showDeletedIcon && showDbtIcon && (
          <div className="m-r-xs" data-testid="dbt-icon">
            <IconDBTModel />
          </div>
        )}
        {showDeletedIcon && (
          <div className="flex-center p-xss custom-node-deleted-icon">
            <div className="d-flex text-danger" data-testid="node-deleted-icon">
              <DeleteIcon height={16} width={16} />
            </div>
          </div>
        )}
      </Col>
    </Col>
  );
};

const EntityFooter = ({
  isColumnsListExpanded,
  node,
  toggleColumnsList,
}: LineageNodeLabelPropsExtended) => {
  const { t } = useTranslation();

  const columnsCount = node.columnNames?.length ?? 0;
  const columnsInfoDropdownLabel = `${columnsCount} ${t(
    columnsCount === 1 ? 'label.column' : 'label.column-plural'
  )}`;

  const handleClickColumnInfoDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleColumnsList?.();
  };

  const handleClickNodeMapping = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Box className="flex justify-between entity-footer">
      <Button
        className={classNames(
          'columns-info-dropdown-label',
          isColumnsListExpanded ? 'expanded' : 'collapsed'
        )}
        variant="outlined"
        onClick={handleClickColumnInfoDropdown}>
        {columnsInfoDropdownLabel}
      </Button>
      <MappingIcon className="mapping-icon" onClick={handleClickNodeMapping} />
    </Box>
  );
};

const LineageNodeLabelV1 = ({
  node,
  isColumnsListExpanded,
  toggleColumnsList,
}: LineageNodeLabelProps) => {
  return (
    <Box className="custom-node-label-container m-0">
      <EntityLabel node={node} />
      <EntityFooter
        isColumnsListExpanded={isColumnsListExpanded}
        node={node}
        toggleColumnsList={toggleColumnsList}
      />
    </Box>
  );
};

export default LineageNodeLabelV1;
