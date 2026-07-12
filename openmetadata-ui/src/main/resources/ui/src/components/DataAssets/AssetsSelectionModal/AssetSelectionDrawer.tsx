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
import { SlideoutMenu, Typography } from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import AssetSelectionContentBody from './AssetSelectionContentBody';
import AssetSelectionFooter from './AssetSelectionFooter';
import { useAssetSelectionState } from './useAssetSelectionState';

interface AssetSelectionDrawerProps {
  entityFqn: string;
  open: boolean;
  type?: AssetsOfEntity;
  queryFilter?: QueryFilterInterface;
  emptyPlaceHolderText?: string;
  infoBannerText?: string;
  onSave?: () => void;
  onCancel: () => void;
  title?: string;
}

export const AssetSelectionDrawer = ({
  entityFqn,
  open,
  type = AssetsOfEntity.GLOSSARY,
  queryFilter,
  emptyPlaceHolderText,
  infoBannerText,
  onSave,
  onCancel,
  title,
}: AssetSelectionDrawerProps) => {
  const { t } = useTranslation();

  const handleSave = useCallback(() => {
    onSave?.();
    onCancel();
  }, [onSave, onCancel]);

  const state = useAssetSelectionState({
    entityFqn,
    type,
    queryFilter,
    open,
    variant: 'drawer',
    onSave: handleSave,
    onCancel,
  });

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onCancel();
      }
    },
    [onCancel]
  );

  return (
    <SlideoutMenu
      data-testid="asset-selection-modal"
      isOpen={open}
      width={670}
      onOpenChange={handleOpenChange}>
      <SlideoutMenu.Header data-testid="drawer-header" onClose={onCancel}>
        <Typography as="h4" data-testid="drawer-heading">
          {title ?? t('label.add-entity', { entity: t('label.asset-plural') })}
        </Typography>
      </SlideoutMenu.Header>
      <SlideoutMenu.Content className="tw:overflow-hidden">
        {open && (
          <AssetSelectionContentBody
            aggregations={state.aggregations}
            assetJobResponse={state.assetJobResponse}
            cancelDomainAssetMove={state.cancelDomainAssetMove}
            clearFilters={state.clearFilters}
            confirmDomainAssetMove={state.confirmDomainAssetMove}
            dryRunWarnings={state.dryRunWarnings}
            emptyPlaceHolderText={emptyPlaceHolderText}
            exportJob={state.exportJob}
            failedStatus={state.failedStatus}
            filters={state.filters}
            getErrorStatusAndMessage={state.getErrorStatusAndMessage}
            handleCardClick={state.handleCardClick}
            handleQuickFiltersValueSelect={state.handleQuickFiltersValueSelect}
            infoBannerText={infoBannerText}
            isLoading={state.isLoading}
            isSaveLoading={state.isSaveLoading}
            items={state.items}
            quickFilterQuery={state.quickFilterQuery}
            search={state.search}
            selectedItems={state.selectedItems}
            setSearch={state.setSearch}
            totalCount={state.totalCount}
            onScroll={state.onScroll}
            onSelectAll={state.onSelectAll}
          />
        )}
      </SlideoutMenu.Content>
      <SlideoutMenu.Footer>
        <AssetSelectionFooter
          errorCount={state.failedStatus?.failedRequest?.length ?? 0}
          hasAssetJobResponse={!isUndefined(state.assetJobResponse)}
          isLoading={state.isLoading}
          isSaveLoading={state.isSaveLoading}
          selectedCount={state.selectedItems?.size ?? 0}
          onCancel={onCancel}
          onSave={state.onSaveAction}
        />
      </SlideoutMenu.Footer>
    </SlideoutMenu>
  );
};
