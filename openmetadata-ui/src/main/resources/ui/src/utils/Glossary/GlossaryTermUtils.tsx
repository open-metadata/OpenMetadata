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
import { kebabCase } from 'lodash';
import { lazy, useEffect } from 'react';
import { ActivityFeedLayoutType } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import type { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import { useGlossaryStore } from '../../components/Glossary/useGlossary.store';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import { PageType } from '../../generated/system/ui/page';
import { getCountBadge } from '../../utils/EntityDisplayPureUtils';
import i18n from '../i18next/LocalUtil';
import type { GlossaryTermDetailPageTabProps } from './GlossaryTermClassBase';

const TabsLabel = withSuspenseFallback(
  lazy(() => import('../../components/common/TabsLabel/TabsLabel.component'))
);

const ActivityFeedTab = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component'
    ).then((module) => ({ default: module.ActivityFeedTab }))
  )
);

const GenericTab = withSuspenseFallback(
  lazy(() =>
    import('../../components/Customization/GenericTab/GenericTab').then(
      (module) => ({ default: module.GenericTab })
    )
  )
);

const AssetsTabs = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component'
      )
  )
);

const GlossaryTermTab = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Glossary/GlossaryTermTab/GlossaryTermTab.component'
      )
  )
);

const OntologyExplorer = withSuspenseFallback(
  lazy(() => import('../../components/OntologyExplorer/OntologyExplorer'))
);

const ResizablePanels = withSuspenseFallback(
  lazy(() => import('../../components/common/ResizablePanels/ResizablePanels'))
);

const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/common/CustomPropertyTable/CustomPropertyTable'
    ).then((module) => ({ default: module.CustomPropertyTable }))
  )
) as <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component'
      )
  )
);

interface GlossaryTermChildrenCountBadgeProps {
  fqn?: string;
  initialCount?: number;
  isActive?: boolean;
}

// Renders the direct-children count with the same entityStatus filter the Terms
// table applies, so the tab badge always matches what the table actually lists
// instead of the unfiltered, all-descendants `childrenCount` field. Kept inline
// here rather than as its own component file since this tab label is its only
// usage site; the fetch/filter logic itself lives in useGlossary.store's
// fetchChildrenCount, shared with GlossaryDetails (Glossary root page).
const GlossaryTermChildrenCountBadge = ({
  fqn,
  initialCount,
  isActive,
}: GlossaryTermChildrenCountBadgeProps) => {
  const {
    childrenCounts,
    fetchChildrenCount,
    termsStatusFilter,
    termsSearchTerm,
  } = useGlossaryStore();

  useEffect(() => {
    if (!fqn) {
      return;
    }
    fetchChildrenCount(fqn);
  }, [fqn, termsStatusFilter, termsSearchTerm, fetchChildrenCount]);

  const count = fqn
    ? childrenCounts[fqn] ?? initialCount ?? 0
    : initialCount ?? 0;

  return <>{getCountBadge(count, '', isActive)}</>;
};

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

  // Draft / In Review terms can still reach Approved, so use the actionable
  // Terminal states (Rejected, Deprecated, Archived,
  // will not, so use status-neutral copy that does not promise approval.
  const glossaryTermStatus = glossaryTerm.entityStatus ?? EntityStatus.Approved;
  const isTermPendingApproval =
    glossaryTermStatus === EntityStatus.Draft ||
    glossaryTermStatus === EntityStatus.InReview;
  const assetsAddDisabledKey = isTermPendingApproval
    ? 'message.assets-add-disabled-term-status'
    : 'message.assets-add-restricted-term-status';
  const assetsAddDisabledMessage =
    glossaryTermStatus === EntityStatus.Approved
      ? undefined
      : i18n.t(assetsAddDisabledKey, {
          status: i18n.t(`label.${kebabCase(glossaryTermStatus)}`, {
            defaultValue: glossaryTermStatus,
          }),
        });

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
                  <GlossaryTermChildrenCountBadge
                    fqn={glossaryTerm.fullyQualifiedName}
                    initialCount={glossaryTerm.childrenCount}
                    isActive={activeTab === EntityTabs.GLOSSARY_TERMS}
                  />
                </span>
              </div>
            ),
            key: EntityTabs.GLOSSARY_TERMS,
            children: (
              <GlossaryTermTab
                className="glossary-term-table-container"
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
                      addDisabledMessage={assetsAddDisabledMessage}
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
            children: <OntologyExplorer height="100%" scope="term" />,
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
