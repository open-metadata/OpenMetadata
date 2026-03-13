/*
 *  Copyright 2025 Collate.
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
import React from 'react';
import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import { EntityDetailsObjectInterface } from '../../components/Explore/ExplorePage.interface';
import { AssetsTabRef } from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs } from '../../enums/entity.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { FeedCounts } from '../../interface/feed.interface';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import { getGlossaryTermDetailPageTabs } from './GlossaryTermUtils';

export interface GlossaryTermDetailPageTabProps {
  glossaryTerm: GlossaryTerm;
  activeTab: EntityTabs;
  isVersionView: boolean;
  assetCount: number;
  feedCount: FeedCounts;
  permissions: OperationPermission;
  assetPermissions: OperationPermission;
  viewCustomPropertiesPermission: boolean;
  previewAsset?: EntityDetailsObjectInterface;
  assetTabRef: React.RefObject<AssetsTabRef>;
  tabLabelMap: Record<string, string>;
  handleAssetClick: (asset?: EntityDetailsObjectInterface) => void;
  handleAssetSave: () => void;
  getEntityFeedCount: () => void;
  refreshActiveGlossaryTerm?: () => void;
  setAssetModalVisible: (visible: boolean) => void;
  setPreviewAsset: (asset?: EntityDetailsObjectInterface) => void;
}

class GlossaryTermClassBase {
  public getGlossaryTermDetailPageTabs(
    props: GlossaryTermDetailPageTabProps
  ): TabProps[] {
    return getGlossaryTermDetailPageTabs(props);
  }

  public getGlossaryTermDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.OVERVIEW,
      EntityTabs.GLOSSARY_TERMS,
      EntityTabs.ASSETS,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: [],
      editable: false,
    }));
  }
}

const glossaryTermClassBase = new GlossaryTermClassBase();

export { GlossaryTermClassBase };
export default glossaryTermClassBase;
