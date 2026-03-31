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
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import EntitySummaryPanel from '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import AssetsTabs from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import GlossaryTermTab from '../../components/Glossary/GlossaryTermTab/GlossaryTermTab.component';
import OntologyExplorer from '../../components/OntologyExplorer/OntologyExplorer';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { PageType } from '../../generated/system/ui/page';
import { getCountBadge } from '../../utils/CommonUtils';
import i18n from '../i18next/LocalUtil';
import { GlossaryTermDetailPageTabProps } from './GlossaryTermClassBase';

export const getGlossaryTermDetailPageTabs = (
  props: GlossaryTermDetailPageTabProps
): TabProps[] => {
  const {
    glossaryTerm,
    activeTab,
    isVersionView,
    assetCount,
    feedCount,
    permissions,
    assetPermissions,
    viewCustomPropertiesPermission,
    previewAsset,
    assetTabRef,
    tabLabelMap,
    handleAssetClick,
    handleAssetSave,
    getEntityFeedCount,
    refreshActiveGlossaryTerm,
    setAssetModalVisible,
    setPreviewAsset,
  } = props;

  return [
    {
      label: (
        <div data-testid="overview">
          {tabLabelMap[EntityTabs.OVERVIEW] ?? i18n.t('label.overview')}
        </div>
      ),
      key: EntityTabs.OVERVIEW,
      children: <GenericTab type={PageType.GlossaryTerm} />,
    },
    ...(isVersionView
      ? []
      : [
          {
            label: (
              <div data-testid="terms">
                {tabLabelMap[EntityTabs.GLOSSARY_TERMS] ??
                  i18n.t('label.glossary-term-plural')}
                <span className="p-l-xs ">
                  {getCountBadge(
                    glossaryTerm.childrenCount || 0,
                    '',
                    activeTab === EntityTabs.GLOSSARY_TERMS
                  )}
                </span>
              </div>
            ),
            key: EntityTabs.GLOSSARY_TERMS,
            children: (
              <GlossaryTermTab
                className="p-md glossary-term-table-container"
                isGlossary={false}
              />
            ),
          },
          {
            label: (
              <div data-testid="assets">
                {tabLabelMap[EntityTabs.ASSETS] ?? i18n.t('label.asset-plural')}
                <span className="p-l-xs">
                  {getCountBadge(
                    assetCount ?? 0,
                    '',
                    activeTab === EntityTabs.ASSETS
                  )}
                </span>
              </div>
            ),
            key: EntityTabs.ASSETS,
            children: (
              <ResizablePanels
                className="h-full glossary-term-resizable-panel"
                firstPanel={{
                  className: 'glossary-term-resizable-panel-container',
                  children: (
                    <AssetsTabs
                      assetCount={assetCount}
                      entityFqn={glossaryTerm.fullyQualifiedName ?? ''}
                      isSummaryPanelOpen={Boolean(previewAsset)}
                      permissions={assetPermissions}
                      ref={assetTabRef}
                      onAddAsset={() => setAssetModalVisible(true)}
                      onAssetClick={handleAssetClick}
                      onRemoveAsset={handleAssetSave}
                    />
                  ),
                  flex: 0.7,
                  minWidth: 700,
                  wrapInCard: false,
                }}
                hideSecondPanel={!previewAsset}
                pageTitle={i18n.t('label.glossary-term')}
                secondPanel={{
                  children: previewAsset && (
                    <EntitySummaryPanel
                      entityDetails={previewAsset}
                      handleClosePanel={() => setPreviewAsset(undefined)}
                      highlights={{
                        'tag.name': [glossaryTerm.fullyQualifiedName ?? ''],
                      }}
                      key={
                        previewAsset.details.id ??
                        previewAsset.details.fullyQualifiedName
                      }
                      panelPath="glossary-term-assets-tab"
                    />
                  ),
                  className:
                    'entity-summary-resizable-right-panel-container glossary-term-resizable-panel-container',
                  flex: 0.3,
                  minWidth: 400,
                  wrapInCard: false,
                }}
              />
            ),
          },
          {
            label: (
              <TabsLabel
                count={feedCount.totalCount}
                id={EntityTabs.ACTIVITY_FEED}
                isActive={activeTab === EntityTabs.ACTIVITY_FEED}
                name={
                  tabLabelMap[EntityTabs.ACTIVITY_FEED] ??
                  i18n.t('label.activity-feed-and-task-plural')
                }
              />
            ),
            key: EntityTabs.ACTIVITY_FEED,
            children: (
              <ActivityFeedTab
                entityType={EntityType.GLOSSARY_TERM}
                feedCount={feedCount}
                hasGlossaryReviewer={
                  glossaryTerm.reviewers !== undefined &&
                  glossaryTerm.reviewers.length > 0
                }
                layoutType={ActivityFeedLayoutType.THREE_PANEL}
                owners={glossaryTerm.owners}
                onFeedUpdate={getEntityFeedCount}
                onUpdateEntityDetails={refreshActiveGlossaryTerm}
              />
            ),
          },
          {
            label: (
              <TabsLabel
                id={EntityTabs.RELATIONS_GRAPH}
                name={
                  tabLabelMap[EntityTabs.RELATIONS_GRAPH] ??
                  i18n.t('label.relations-graph')
                }
              />
            ),
            key: EntityTabs.RELATIONS_GRAPH,
            children: (
              <OntologyExplorer height="100%" scope="term" showHeader={false} />
            ),
          },
          {
            label: (
              <TabsLabel
                id={EntityTabs.CUSTOM_PROPERTIES}
                name={
                  tabLabelMap[EntityTabs.CUSTOM_PROPERTIES] ??
                  i18n.t('label.custom-property-plural')
                }
              />
            ),
            key: EntityTabs.CUSTOM_PROPERTIES,
            children: glossaryTerm && (
              <CustomPropertyTable<EntityType.GLOSSARY_TERM>
                entityType={EntityType.GLOSSARY_TERM}
                hasEditAccess={
                  !isVersionView &&
                  (permissions.EditAll || permissions.EditCustomFields)
                }
                hasPermission={viewCustomPropertiesPermission}
                isVersionView={isVersionView}
              />
            ),
          },
        ]),
  ];
};
