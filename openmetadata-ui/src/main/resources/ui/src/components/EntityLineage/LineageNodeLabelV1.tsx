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

import { Col, Row, Space, Typography } from 'antd';
import { EntityLineageNodeType } from 'enums/entity.enum';
import { get } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityIcon } from '../../utils/TableUtils';
import './lineage-node-label.less';

interface LineageNodeLabelProps {
  node: EntityReference;
}

const EntityLabel = ({ node }: Pick<LineageNodeLabelProps, 'node'>) => {
  const { t } = useTranslation();
  if (node.type === EntityLineageNodeType.LOAD_MORE) {
    return (
      <div>
        <span>{t('label.load-more')}</span>
        <span className="load-more-node-sizes p-x-xs">{`(${get(
          node,
          'pagination_data.childrenLength'
        )})`}</span>
      </div>
    );
  }

  return (
    <Row className="items-center" wrap={false}>
      <Col>
        <div className="entity-button-icon m-r-xs">
          {getEntityIcon(node.type || '')}
        </div>
      </Col>
      <Col>
        <Space align="start" direction="vertical" size={0}>
          <Typography.Text
            className="m-b-0 d-block text-grey-muted"
            data-testid="entity-header-name">
            {node.name}
          </Typography.Text>
          <Typography.Text
            className="m-b-0 d-block entity-header-display-name text-md font-medium w-48"
            data-testid="entity-header-display-name"
            ellipsis={{ tooltip: true }}>
            {node.displayName || node.name}
          </Typography.Text>
        </Space>
      </Col>
    </Row>
  );
};

const LineageNodeLabelV1 = ({ node }: { node: EntityReference }) => {
  return (
    <div className="d-flex w-72">
      <div className="flex items-center m-0 p-md">
        <EntityLabel node={node} />
      </div>
    </div>
  );
};

export default LineageNodeLabelV1;
