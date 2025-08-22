/*
 *  Copyright 2024 Collate.
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

import { Col, Row, Space, Typography } from 'antd';
import { memo, useMemo } from 'react';
import { ReactComponent as IconDBTModel } from '../../assets/svg/dbt-model.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/ic-delete.svg';
import { EntityType } from '../../enums/entity.enum';
import { ModelType, Table } from '../../generated/entity/data/table';
import { getEntityName } from '../../utils/EntityUtils';
import { getServiceIcon } from '../../utils/TableUtils';
import '../Entity/EntityLineage/lineage-node-label.less';

interface LineageNodeLabelV1WrapperProps {
  node: any;
}

const LineageNodeLabelV1Wrapper = memo(({ node }: LineageNodeLabelV1WrapperProps) => {
  const displayName = getEntityName(node);
  
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
    <div className="lineage-node-label">
      <Row className="items-center" wrap={false}>
        <Col className="d-flex items-center" flex="auto">
          <div className="d-flex entity-button-icon m-r-xs">
            {getServiceIcon(node)}
          </div>
          <Space align="start" direction="vertical" size={0}>
            <Typography.Text
              className="m-b-0 d-block text-left text-grey-muted w-54"
              data-testid="entity-header-name"
              ellipsis={{ tooltip: true }}>
              {node.name}
            </Typography.Text>
            <Typography.Text
              className="m-b-0 d-block text-left entity-header-display-name text-md font-medium w-54"
              data-testid="entity-header-display-name"
              ellipsis={{ tooltip: true }}>
              {displayName}
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
      </Row>
    </div>
  );
});

LineageNodeLabelV1Wrapper.displayName = 'LineageNodeLabelV1Wrapper';

export default LineageNodeLabelV1Wrapper;