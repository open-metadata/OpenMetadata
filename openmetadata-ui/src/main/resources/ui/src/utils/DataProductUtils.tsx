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
import { noop } from 'lodash';
import { ReactComponent as DefaultDataProductIcon } from '../assets/svg/ic-data-product.svg';
import ActivityFeedProvider from '../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import ResizablePanels from '../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import EntitySummaryPanel from '../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../components/Explore/ExplorePage.interface';
import AssetsTabs, {
  AssetsTabRef,
} from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import { Operation } from '../generated/entity/policies/policy';
import { PageType } from '../generated/system/ui/page';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { t } from './i18next/LocalUtil';
import { getPrioritizedEditPermission } from './PermissionsUtils';

export interface DataProductDetailPageTabProps {
  dataProduct: DataProduct;
  isVersionsView: boolean;
  dataProductPermission: OperationPermission;
  assetCount: number;
  activeTab: EntityTabs;
  assetTabRef: React.RefObject<AssetsTabRef>;
  previewAsset?: EntityDetailsObjectInterface;
  setPreviewAsset: (asset?: EntityDetailsObjectInterface) => void;
  setAssetModalVisible: (visible: boolean) => void;
  handleAssetClick: (asset?: EntityDetailsObjectInterface) => void;
  handleAssetSave: () => void;
  feedCount: FeedCounts;
  getEntityFeedCount: () => void;
  labelMap?: Record<EntityTabs, string>;
}

/**
 * Get data product icon based on optional icon URL
 * Matches the DomainUtils pattern for consistency
 * @param iconURL - Optional icon URL
 * @returns JSX element representing the icon
 */
export const getDataProductIconByUrl = (iconURL?: string) => {
  if (iconURL) {
    return (
      <img
        alt="data product icon"
        className="data-product-icon-url"
        src={iconURL}
      />
    );
  }

  return <DefaultDataProductIcon className="data-product-default-icon" />;
};

export const getDataProductWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  return (
    <CommonWidgets
      entityType={EntityType.DATA_PRODUCT}
      showTaskHandler={false}
      widgetConfig={widgetConfig}
    />
  );
};

export const getDataProductDetailTabs = ({
  dataProduct,
  isVersionsView,
  dataProductPermission,
  assetCount,
  activeTab,
  assetTabRef,
  previewAsset,
  setPreviewAsset,
  setAssetModalVisible,
  handleAssetClick,
  handleAssetSave,
  feedCount,
  getEntityFeedCount,
  labelMap,
}: DataProductDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          id={EntityTabs.DOCUMENTATION}
          name={
            labelMap?.[EntityTabs.DOCUMENTATION] ?? t('label.documentation')
          }
        />
      ),
      key: EntityTabs.DOCUMENTATION,
      children: <GenericTab type={PageType.DataProduct} />,
    },
    ...(!isVersionsView
      ? [
          {
            label: (
              <TabsLabel
                count={feedCount.totalCount}
                id={EntityTabs.ACTIVITY_FEED}
                isActive={activeTab === EntityTabs.ACTIVITY_FEED}
                name={
                  labelMap?.[EntityTabs.ACTIVITY_FEED] ??
                  t('label.activity-feed-and-task-plural')
                }
              />
            ),
            key: EntityTabs.ACTIVITY_FEED,
            children: (
              <ActivityFeedProvider>
                <ActivityFeedTab
                  refetchFeed
                  entityFeedTotalCount={feedCount.totalCount}
                  entityType={EntityType.DATA_PRODUCT}
                  feedCount={feedCount}
                  layoutType={ActivityFeedLayoutType.THREE_PANEL}
                  owners={dataProduct.owners}
                  onFeedUpdate={getEntityFeedCount}
                  onUpdateEntityDetails={noop}
                />
              </ActivityFeedProvider>
            ),
          },
          {
            label: (
              <TabsLabel
                count={assetCount ?? 0}
                id={EntityTabs.ASSETS}
                isActive={activeTab === EntityTabs.ASSETS}
                name={labelMap?.[EntityTabs.ASSETS] ?? t('label.asset-plural')}
              />
            ),
            key: EntityTabs.ASSETS,
            children: (
              <ResizablePanels
                className="h-full domain-height-with-resizable-panel"
                firstPanel={{
                  className: 'domain-resizable-panel-container',
                  wrapInCard: false,
                  children: (
                    <AssetsTabs
                      assetCount={assetCount}
                      entityFqn={dataProduct.fullyQualifiedName}
                      isSummaryPanelOpen={false}
                      permissions={dataProductPermission}
                      ref={assetTabRef}
                      type={AssetsOfEntity.DATA_PRODUCT}
                      onAddAsset={() => setAssetModalVisible(true)}
                      onAssetClick={handleAssetClick}
                      onRemoveAsset={handleAssetSave}
                    />
                  ),
                  minWidth: 800,
                  flex: 0.87,
                }}
                hideSecondPanel={!previewAsset}
                pageTitle={t('label.data-product')}
                secondPanel={{
                  wrapInCard: false,
                  children: previewAsset && (
                    <EntitySummaryPanel
                      entityDetails={previewAsset}
                      handleClosePanel={() => setPreviewAsset(undefined)}
                    />
                  ),
                  minWidth: 400,
                  flex: 0.13,
                  className:
                    'entity-summary-resizable-right-panel-container domain-resizable-panel-container',
                }}
              />
            ),
          },
        ]
      : []),
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={
            labelMap?.[EntityTabs.CUSTOM_PROPERTIES] ??
            t('label.custom-property-plural')
          }
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: (
        <CustomPropertyTable<EntityType.DATA_PRODUCT>
          entityType={EntityType.DATA_PRODUCT}
          hasEditAccess={
            getPrioritizedEditPermission(
              dataProductPermission,
              Operation.EditCustomFields
            ) && !isVersionsView
          }
          hasPermission={dataProductPermission.ViewAll}
          isVersionView={isVersionsView}
        />
      ),
    },
  ];
};
