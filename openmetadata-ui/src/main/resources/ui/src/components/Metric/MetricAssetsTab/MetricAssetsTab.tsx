/*
 *  Copyright 2026 Collate.
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
import { useMemo, useState } from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { AssetsOfEntity } from '../../../enums/Assets.enum';
import { Metric } from '../../../generated/entity/data/metric';
import { getMetricAssetsQueryFilter } from '../../../utils/MetricEntityUtils/MetricPureUtils';
import Loader from '../../common/Loader/Loader';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import EntitySummaryPanel from '../../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import AssetsTabs from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.component';

export interface MetricAssetsTabProps {
  metric: Metric;
  assetIds?: string[];
  isLoading: boolean;
  permissions: OperationPermission;
  onAddAsset: () => void;
  onRemoveAsset: () => void;
}

export const MetricAssetsTab = ({
  metric,
  assetIds,
  isLoading,
  permissions,
  onAddAsset,
  onRemoveAsset,
}: MetricAssetsTabProps) => {
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();

  const queryFilter = useMemo(
    () => getMetricAssetsQueryFilter(assetIds ?? []),
    [assetIds]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      className="h-full glossary-term-resizable-panel"
      firstPanel={{
        className: 'glossary-term-resizable-panel-container',
        children: (
          <AssetsTabs
            assetCount={assetIds?.length ?? 0}
            entityFqn={metric.fullyQualifiedName ?? ''}
            isEntityDeleted={metric.deleted}
            isSummaryPanelOpen={Boolean(previewAsset)}
            permissions={permissions}
            queryFilter={queryFilter}
            type={AssetsOfEntity.METRIC}
            onAddAsset={onAddAsset}
            onAssetClick={setPreviewAsset}
            onRemoveAsset={onRemoveAsset}
          />
        ),
        flex: 0.7,
        minWidth: 700,
        wrapInCard: false,
      }}
      hideSecondPanel={!previewAsset}
      secondPanel={{
        children: previewAsset && (
          <EntitySummaryPanel
            entityDetails={previewAsset}
            handleClosePanel={() => setPreviewAsset(undefined)}
            key={
              previewAsset.details.id ?? previewAsset.details.fullyQualifiedName
            }
          />
        ),
        className:
          'entity-summary-resizable-right-panel-container glossary-term-resizable-panel-container',
        flex: 0.3,
        minWidth: 400,
        wrapInCard: false,
      }}
    />
  );
};
