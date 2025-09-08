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
import { Space } from 'antd';
import { EntityTags } from 'Models';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { TagSource } from '../../../generated/type/tagLabel';
import { useFqn } from '../../../hooks/useFqn';
import { PartitionedKeys } from '../../../pages/TableDetailsPageV1/PartitionedKeys/PartitionedKeys.component';
import entityRightPanelClassBase from '../../../utils/EntityRightPanelClassBase';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import type {
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from '../../common/CustomPropertyTable/CustomPropertyTable.interface';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import DataProductsContainer from '../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
import { EntityRightPanelTab } from './EntityRightPanelVerticalNav';

interface EntityRightPanelContentProps<T extends ExtentionEntitiesKeys> {
  activeTab: EntityRightPanelTab;
  editTagPermission: boolean;
  editGlossaryTermsPermission: boolean;
  entityType: EntityType;
  selectedTags: EntityTags[];
  beforeSlot?: React.ReactNode;
  showTaskHandler?: boolean;
  showDataProductContainer?: boolean;
  afterSlot?: React.ReactNode;
  onTagSelectionChange?: (selectedTags: EntityTags[]) => Promise<void>;
  viewAllPermission?: boolean;
  customProperties?: ExtentionEntities[T];
  editCustomAttributePermission?: boolean;
  editDataProductPermission?: boolean;
  onDataProductUpdate?: (dataProducts: DataProduct[]) => Promise<void>;
}

const EntityRightPanelContent = <T extends ExtentionEntitiesKeys>({
  activeTab,
  entityType,
  selectedTags,
  editTagPermission,
  editGlossaryTermsPermission,
  onTagSelectionChange,
  beforeSlot,
  afterSlot,
  showTaskHandler = true,
  showDataProductContainer = true,
  viewAllPermission,
  customProperties,
  editCustomAttributePermission,
  editDataProductPermission,
  onDataProductUpdate,
}: EntityRightPanelContentProps<T>) => {
  const { t } = useTranslation();
  const KnowledgeArticles =
    entityRightPanelClassBase.getKnowLedgeArticlesWidget();
  const { fqn: entityFQN } = useFqn();
  const { data } = useGenericContext<{
    domains: EntityReference[];
    dataProducts: EntityReference[];
    id: string;
  }>();

  const { domains, dataProducts, id: entityId } = data ?? {};

  const renderOverviewContent = () => (
    <>
      {beforeSlot}
      <Space className="w-full" direction="vertical" size="large">
        {showDataProductContainer && (
          <div data-testid="KnowledgePanel.DataProducts">
            <DataProductsContainer
              newLook
              activeDomains={domains}
              dataProducts={dataProducts}
              hasPermission={editDataProductPermission ?? false}
              onSave={onDataProductUpdate}
            />
          </div>
        )}

        <div data-testid="KnowledgePanel.Tags">
          <TagsContainerV2
            newLook
            displayType={DisplayType.READ_MORE}
            entityFqn={entityFQN}
            entityType={entityType}
            permission={editTagPermission}
            selectedTags={selectedTags}
            showTaskHandler={showTaskHandler}
            tagType={TagSource.Classification}
            onSelectionChange={onTagSelectionChange}
          />
        </div>

        <div data-testid="KnowledgePanel.GlossaryTerms">
          <TagsContainerV2
            newLook
            displayType={DisplayType.READ_MORE}
            entityFqn={entityFQN}
            entityType={entityType}
            permission={editGlossaryTermsPermission}
            selectedTags={selectedTags}
            showTaskHandler={showTaskHandler}
            tagType={TagSource.Glossary}
            onSelectionChange={onTagSelectionChange}
          />
        </div>
        {KnowledgeArticles && (
          <KnowledgeArticles entityId={entityId} entityType={entityType} />
        )}
      </Space>
      {afterSlot}
    </>
  );

  const renderSchemaContent = () => (
    <div className="entity-right-panel-tab-content">
      <PartitionedKeys />
      {/* Add more schema-related content here */}
    </div>
  );

  const renderLineageContent = () => (
    <div className="entity-right-panel-tab-content">
      {/* Add lineage content here */}
      <div className="text-center text-grey-muted p-lg">
        {t('label.lineage')}
      </div>
    </div>
  );

  const renderDataQualityContent = () => (
    <div className="entity-right-panel-tab-content">
      {/* Add data quality content here */}
      <div className="text-center text-grey-muted p-lg">
        {t('label.data-quality')}
      </div>
    </div>
  );

  const renderCustomPropertiesContent = () => (
    <div className="entity-right-panel-tab-content">
      {customProperties && (
        <CustomPropertyTable<T>
          isRenderedInRightPanel
          entityType={entityType as T}
          hasEditAccess={Boolean(editCustomAttributePermission)}
          hasPermission={Boolean(viewAllPermission)}
          maxDataCap={5}
        />
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case EntityRightPanelTab.OVERVIEW:
        return renderOverviewContent();
      case EntityRightPanelTab.SCHEMA:
        return renderSchemaContent();
      case EntityRightPanelTab.LINEAGE:
        return renderLineageContent();
      case EntityRightPanelTab.DATA_QUALITY:
        return renderDataQualityContent();
      case EntityRightPanelTab.CUSTOM_PROPERTIES:
        return renderCustomPropertiesContent();
      default:
        return renderOverviewContent();
    }
  };

  return <div className="entity-right-panel-content">{renderContent()}</div>;
};

export default EntityRightPanelContent;
