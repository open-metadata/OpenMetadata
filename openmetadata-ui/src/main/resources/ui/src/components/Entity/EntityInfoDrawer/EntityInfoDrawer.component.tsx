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

import { CloseOutlined } from '@ant-design/icons';
import { Col, Drawer, Row } from 'antd';
import { cloneDeep, get } from 'lodash';
import { EntityDetailUnion } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { TagLabel } from '../../../generated/type/tagLabel';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { DataAssetSummaryPanel } from '../../DataAssetSummaryPanel/DataAssetSummaryPanel';
import EntityHeaderTitle from '../EntityHeaderTitle/EntityHeaderTitle.component';
import './entity-info-drawer.less';
import { LineageDrawerProps } from './EntityInfoDrawer.interface';

const EntityInfoDrawer = ({
  show,
  onCancel,
  selectedNode,
}: LineageDrawerProps) => {
  const [entityDetail, setEntityDetail] = useState<EntityDetailUnion>(
    {} as EntityDetailUnion
  );

  const breadcrumbs = useMemo(
    () =>
      searchClassBase.getEntityBreadcrumbs(
        selectedNode,
        selectedNode.entityType as EntityType,
        true
      ),
    [selectedNode]
  );

  const icon = useMemo(() => {
    const serviceType = get(selectedNode, 'serviceType', '');

    return serviceType ? (
      <img
        className="h-9"
        src={serviceUtilClassBase.getServiceTypeLogo(selectedNode)}
      />
    ) : null;
  }, [selectedNode]);

  useEffect(() => {
    const node = cloneDeep(selectedNode);
    // Since selectedNode is a source object, modify the tags to contain tier information
    node.tags = [
      ...(node.tags ?? []),
      ...(node.tier ? [node.tier as TagLabel] : []),
    ];

    setEntityDetail(node);
  }, [selectedNode]);

  return (
    <Drawer
      destroyOnClose
      className="entity-panel-container"
      closable={false}
      extra={
        <CloseOutlined
          data-testid="entity-panel-close-icon"
          onClick={onCancel}
        />
      }
      getContainer={false}
      headerStyle={{ padding: 16 }}
      mask={false}
      open={show}
      style={{ position: 'absolute' }}
      title={
        <Row gutter={[0, 0]}>
          {selectedNode.entityType === EntityType.TABLE && (
            <Col span={24}>
              <TitleBreadcrumb titleLinks={breadcrumbs} />
            </Col>
          )}

          <Col span={24}>
            <EntityHeaderTitle
              showOnlyDisplayName
              className="w-max-350"
              deleted={selectedNode.deleted}
              displayName={selectedNode.displayName}
              icon={icon}
              link={entityUtilClassBase.getEntityLink(
                selectedNode.entityType ?? '',
                selectedNode.fullyQualifiedName ?? ''
              )}
              name={selectedNode.name}
              serviceName={selectedNode.service?.type ?? ''}
              showName={false}
            />
          </Col>
        </Row>
      }>
      <DataAssetSummaryPanel
        isDomainVisible
        isLineageView
        dataAsset={entityDetail}
        entityType={selectedNode.entityType as EntityType}
      />
    </Drawer>
  );
};

export default EntityInfoDrawer;
