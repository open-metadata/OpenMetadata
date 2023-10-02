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
import { get } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getBreadcrumbsFromFqn } from '../../../utils/EntityUtils';
import { getEntityIcon } from '../../../utils/TableUtils';
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
            className="m-b-0 d-block text-left text-grey-muted w-56"
            data-testid="entity-header-name"
            ellipsis={{ tooltip: true }}>
            {node.name}
          </Typography.Text>
          <Typography.Text
            className="m-b-0 d-block text-left entity-header-display-name text-md font-medium w-56"
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
  const { t } = useTranslation();
  const breadcrumbs = getBreadcrumbsFromFqn(node.fullyQualifiedName ?? '');

  return (
    <div className="w-72">
      <div className="m-0 p-x-md p-y-xs">
        <Space
          wrap
          align="start"
          className="lineage-breadcrumb m-b-xs w-full"
          size={4}>
          {breadcrumbs.map((breadcrumb, index) => (
            <React.Fragment key={index}>
              <Typography.Text
                className="text-grey-muted lineage-breadcrumb-item"
                ellipsis={{ tooltip: true }}>
                {breadcrumb.name}
              </Typography.Text>
              {index !== breadcrumbs.length - 1 && (
                <Typography.Text className="text-xss">
                  {t('label.slash-symbol')}
                </Typography.Text>
              )}
            </React.Fragment>
          ))}
        </Space>
        <div className="flex items-center">
          <EntityLabel node={node} />
        </div>
      </div>
    </div>
  );
};

export default LineageNodeLabelV1;
