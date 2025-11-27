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
import { Link } from '@mui/material';
import { Card, Col, Drawer, Row, Tooltip } from 'antd';
import { cloneDeep, get } from 'lodash';
import { EntityDetailUnion } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityName,
} from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { stringToHTML } from '../../../utils/StringsUtils';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { DataAssetSummaryPanelV1 } from '../../DataAssetSummaryPanelV1/DataAssetSummaryPanelV1';
import EntityHeaderTitle from '../EntityHeaderTitle/EntityHeaderTitle.component';
import EntityRightPanelVerticalNav from '../EntityRightPanel/EntityRightPanelVerticalNav';
import { EntityRightPanelTab } from '../EntityRightPanel/EntityRightPanelVerticalNav.interface';
import './entity-info-drawer.less';
import { LineageDrawerProps } from './EntityInfoDrawer.interface';

const EntityInfoDrawer = ({
  show,
  onCancel,
  selectedNode,
  useFullPanel = false,
}: LineageDrawerProps) => {
  const { t } = useTranslation();
  const [entityDetail, setEntityDetail] = useState<EntityDetailUnion>(
    {} as EntityDetailUnion
  );
  const [activeTab, setActiveTab] = useState<EntityRightPanelTab>(
    EntityRightPanelTab.OVERVIEW
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

  const entityLink = useMemo(
    () => searchClassBase.getEntityLink(selectedNode),
    [selectedNode]
  );

  const handleOwnerUpdate = useCallback((owners: EntityReference[]) => {
    setEntityDetail((prev: EntityDetailUnion) => ({ ...prev, owners }));
  }, []);

  const handleDomainUpdate = useCallback((domains: EntityReference[]) => {
    setEntityDetail((prev: EntityDetailUnion) => ({ ...prev, domains }));
  }, []);

  const handleTierUpdate = useCallback((updatedTier?: TagLabel) => {
    setEntityDetail((prev: EntityDetailUnion) => {
      const currentTags = prev.tags ?? [];
      const tagsWithoutTier = currentTags.filter(
        (tag: TagLabel) => !tag.tagFQN?.startsWith('Tier.')
      );
      const newTags = updatedTier
        ? [...tagsWithoutTier, updatedTier]
        : tagsWithoutTier;

      return { ...prev, tags: newTags };
    });
  }, []);

  const handleTagsUpdate = useCallback((updatedTags: TagLabel[]) => {
    setEntityDetail((prev: EntityDetailUnion) => {
      const currentTags = prev.tags ?? [];
      const glossaryTags = currentTags.filter(
        (tag: TagLabel) => tag.source === TagSource.Glossary
      );
      const tierTags = currentTags.filter((tag: TagLabel) =>
        tag.tagFQN?.startsWith('Tier.')
      );

      return { ...prev, tags: [...updatedTags, ...glossaryTags, ...tierTags] };
    });
  }, []);

  const handleDataProductsUpdate = useCallback(
    (updatedDataProducts: EntityReference[]) => {
      setEntityDetail((prev: EntityDetailUnion) => ({
        ...prev,
        dataProducts: updatedDataProducts,
      }));
    },
    []
  );

  const handleGlossaryTermsUpdate = useCallback((updatedTags: TagLabel[]) => {
    setEntityDetail((prev: EntityDetailUnion) => ({
      ...prev,
      tags: updatedTags,
    }));
  }, []);

  const handleDescriptionUpdate = useCallback((updatedDescription: string) => {
    setEntityDetail((prev: EntityDetailUnion) => ({
      ...prev,
      description: updatedDescription,
    }));
  }, []);

  useEffect(() => {
    const node = cloneDeep(selectedNode);
    // Since selectedNode is a source object, modify the tags to contain tier information
    node.tags = [
      ...(node.tags ?? []),
      ...(node.tier ? [node.tier as TagLabel] : []),
    ];

    setEntityDetail(node);
  }, [selectedNode]);

  const handleTabChange = useCallback((tab: EntityRightPanelTab) => {
    setActiveTab(tab);
  }, []);

  // Full panel layout (like EntitySummaryPanel)
  const renderFullPanelContent = () => {
    return (
      <div className="entity-summary-panel-container">
        <div className="d-flex gap-2 w-full">
          <Card bordered={false} className="summary-panel-container">
            <Card
              className="content-area"
              style={{ width: '80%', display: 'block' }}>
              <div className="title-section">
                <div className="title-container">
                  <Tooltip
                    mouseEnterDelay={0.5}
                    placement="topLeft"
                    title={selectedNode.name}
                    trigger="hover">
                    <div className="d-flex items-center">
                      <span className="entity-icon">
                        {searchClassBase.getEntityIcon(
                          selectedNode.entityType ?? ''
                        )}
                      </span>
                      <Link
                        className="entity-title-link"
                        data-testid="entity-link"
                        href={entityLink as string}
                        rel="noopener noreferrer"
                        target="_blank"
                        underline="hover">
                        {stringToHTML(getEntityName(selectedNode))}
                      </Link>
                    </div>
                  </Tooltip>
                </div>
              </div>
              <div className="overview-tab-content">
                <DataAssetSummaryPanelV1
                  isDomainVisible
                  isLineageView
                  componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
                  dataAsset={entityDetail}
                  entityType={selectedNode.entityType as EntityType}
                  onDataProductsUpdate={handleDataProductsUpdate}
                  onDescriptionUpdate={handleDescriptionUpdate}
                  onDomainUpdate={handleDomainUpdate}
                  onGlossaryTermsUpdate={handleGlossaryTermsUpdate}
                  onOwnerUpdate={handleOwnerUpdate}
                  onTagsUpdate={handleTagsUpdate}
                  onTierUpdate={handleTierUpdate}
                />
              </div>
            </Card>
          </Card>
          <EntityRightPanelVerticalNav
            activeTab={activeTab}
            entityType={selectedNode.entityType as EntityType}
            onTabChange={handleTabChange}
          />
        </div>
      </div>
    );
  };

  // Drawer layout (legacy, narrow panel)
  const renderDrawerContent = () => {
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
        <DataAssetSummaryPanelV1
          isDomainVisible
          isLineageView
          componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
          dataAsset={entityDetail}
          entityType={selectedNode.entityType as EntityType}
          onDataProductsUpdate={handleDataProductsUpdate}
          onDescriptionUpdate={handleDescriptionUpdate}
          onDomainUpdate={handleDomainUpdate}
          onGlossaryTermsUpdate={handleGlossaryTermsUpdate}
          onOwnerUpdate={handleOwnerUpdate}
          onTagsUpdate={handleTagsUpdate}
          onTierUpdate={handleTierUpdate}
        />
      </Drawer>
    );
  };

  if (!show) {
    return null;
  }

  return useFullPanel ? renderFullPanelContent() : renderDrawerContent();
};

export default EntityInfoDrawer;
