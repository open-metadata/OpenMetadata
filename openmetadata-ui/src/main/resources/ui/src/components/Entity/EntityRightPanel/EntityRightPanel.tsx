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
import { EntityTags } from 'Models';
import React, { useState } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import type {
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from '../../common/CustomPropertyTable/CustomPropertyTable.interface';
import './EntityRightPanel.less';
import EntityRightPanelContent from './EntityRightPanelContent';
import EntityRightPanelVerticalNav, {
  EntityRightPanelTab,
} from './EntityRightPanelVerticalNav';
interface EntityRightPanelProps<T extends ExtentionEntitiesKeys> {
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
  entityDetails?: React.ReactNode;
}

const EntityRightPanel = <T extends ExtentionEntitiesKeys>({
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
  entityDetails,
}: EntityRightPanelProps<T>) => {
  const [activeTab, setActiveTab] = useState<EntityRightPanelTab>(
    EntityRightPanelTab.OVERVIEW
  );

  const handleTabChange = (tab: EntityRightPanelTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="entity-right-panel-container">
      <EntityRightPanelContent
        activeTab={activeTab}
        afterSlot={afterSlot}
        beforeSlot={beforeSlot}
        customProperties={customProperties}
        editCustomAttributePermission={editCustomAttributePermission}
        editDataProductPermission={editDataProductPermission}
        editGlossaryTermsPermission={editGlossaryTermsPermission}
        editTagPermission={editTagPermission}
        entityDetails={entityDetails}
        entityType={entityType}
        selectedTags={selectedTags}
        showDataProductContainer={showDataProductContainer}
        showTaskHandler={showTaskHandler}
        viewAllPermission={viewAllPermission}
        onDataProductUpdate={onDataProductUpdate}
        onTagSelectionChange={onTagSelectionChange}
      />
      <EntityRightPanelVerticalNav
        activeTab={activeTab}
        entityType={entityType}
        onTabChange={handleTabChange}
      />
    </div>
  );
};

export default EntityRightPanel;
