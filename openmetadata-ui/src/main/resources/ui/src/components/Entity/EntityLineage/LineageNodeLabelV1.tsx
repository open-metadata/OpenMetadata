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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDBTModel } from '../../../assets/svg/dbt-model.svg';
import { EntityType } from '../../../enums/entity.enum';
import { ModelType, Table } from '../../../generated/entity/data/table';
import {
  getBreadcrumbsFromFqn,
  getEntityName,
} from '../../../utils/EntityUtils';
import { getServiceIcon } from '../../../utils/TableUtils';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import './lineage-node-label.less';

interface LineageNodeLabelProps {
  node: SourceType;
}

const EntityLabel = ({ node }: Pick<LineageNodeLabelProps, 'node'>) => {
  const showDbtIcon = useMemo(() => {
    return (
      node.entityType === EntityType.TABLE &&
      (node as Table)?.dataModel?.modelType === ModelType.Dbt
    );
  }, [node]);

  return (
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
            {getEntityName(node)}
          </Typography.Text>
        </Space>
        {showDbtIcon && (
          <div className="m-r-xs" data-testid="dbt-icon">
            <IconDBTModel />
          </div>
        )}
      </Col>
    </Row>
  );
};

const LineageNodeLabelV1 = ({ node }: Pick<LineageNodeLabelProps, 'node'>) => {
  const { t } = useTranslation();
  const breadcrumbs = getBreadcrumbsFromFqn(node.fullyQualifiedName ?? '');

  return (
    <div className="w-76">
      <div className="m-0 p-x-md p-y-xs">
        <div className="d-flex gap-2 items-center m-b-xs">
          <Space
            wrap
            align="start"
            className="lineage-breadcrumb w-full"
            size={4}>
            {breadcrumbs.map((breadcrumb, index) => (
              <React.Fragment key={breadcrumb.name}>
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
        </div>
        <EntityLabel node={node} />
      </div>
    </div>
  );
};

export default LineageNodeLabelV1;
