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
import React, { FC } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { EntityReference } from '../../../generated/entity/type';
import { TagSource } from '../../../generated/type/tagLabel';
import entityRightPanelClassBase from '../../../utils/EntityRightPanelClassBase';
import DataProductsContainer from '../../DataProductsContainer/DataProductsContainer.component';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';

interface EntityRightPanelProps {
  dataProducts: EntityReference[];
  editTagPermission: boolean;
  entityType: EntityType;
  entityFQN: string;
  entityId: string;
  selectedTags: EntityTags[];
  beforeSlot?: React.ReactNode;
  showTaskHandler?: boolean;
  showDataProductContainer?: boolean;
  afterSlot?: React.ReactNode;
  domain?: EntityReference;
  onTagSelectionChange?: (selectedTags: EntityTags[]) => Promise<void>;
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void;
}

const EntityRightPanel: FC<EntityRightPanelProps> = ({
  domain,
  dataProducts,
  entityFQN,
  entityType,
  selectedTags,
  editTagPermission,
  onTagSelectionChange,
  onThreadLinkSelect,
  beforeSlot,
  afterSlot,
  entityId,
  showTaskHandler = true,
  showDataProductContainer = true,
}) => {
  const KnowledgeArticles =
    entityRightPanelClassBase.getKnowLedgeArticlesWidget();

  return (
    <>
      {beforeSlot}
      <Space className="w-full" direction="vertical" size="large">
        {showDataProductContainer && (
          <DataProductsContainer
            activeDomain={domain}
            dataProducts={dataProducts}
            hasPermission={false}
          />
        )}

        <TagsContainerV2
          displayType={DisplayType.READ_MORE}
          entityFqn={entityFQN}
          entityType={entityType}
          permission={editTagPermission}
          selectedTags={selectedTags}
          showTaskHandler={showTaskHandler}
          tagType={TagSource.Classification}
          onSelectionChange={onTagSelectionChange}
          onThreadLinkSelect={onThreadLinkSelect}
        />

        <TagsContainerV2
          displayType={DisplayType.READ_MORE}
          entityFqn={entityFQN}
          entityType={entityType}
          permission={editTagPermission}
          selectedTags={selectedTags}
          showTaskHandler={showTaskHandler}
          tagType={TagSource.Glossary}
          onSelectionChange={onTagSelectionChange}
          onThreadLinkSelect={onThreadLinkSelect}
        />
        {KnowledgeArticles && (
          <KnowledgeArticles entityId={entityId} entityType={entityType} />
        )}
      </Space>
      {afterSlot}
    </>
  );
};

export default EntityRightPanel;
