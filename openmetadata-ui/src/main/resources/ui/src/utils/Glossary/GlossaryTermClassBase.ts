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
import React, { createElement } from 'react';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import DataQualityDashboard from '../../components/DataQuality/DataQualityDashboard/DataQualityDashboard.component';
import { EntityDetailsObjectInterface } from '../../components/Explore/ExplorePage.interface';
import { AssetsTabRef } from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs } from '../../enums/entity.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { FeedCounts } from '../../interface/feed.interface';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import i18n from '../i18next/LocalUtil';
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
    const baseTabs = getGlossaryTermDetailPageTabs(props);

    if (props.isVersionView) {
      return baseTabs;
    }

    const dqTab: TabProps = {
      label: createElement(TabsLabel, {
        id: EntityTabs.DATA_OBSERVABILITY,
        name: i18n.t('label.data-observability'),
      }),
      key: EntityTabs.DATA_OBSERVABILITY,
      children: createElement(DataQualityDashboard, {
        isGovernanceView: true,
        className: 'data-quality-governance-tab-wrapper',
        hiddenFilters: ['glossaryTerms'],
        initialFilters: props.glossaryTerm.fullyQualifiedName
          ? { glossaryTerms: [props.glossaryTerm.fullyQualifiedName] }
          : undefined,
      }),
    };

    return [...baseTabs, dqTab];
  }

  public getGlossaryTermDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.OVERVIEW,
      EntityTabs.GLOSSARY_TERMS,
      EntityTabs.ASSETS,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.CUSTOM_PROPERTIES,
      EntityTabs.DATA_OBSERVABILITY,
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
