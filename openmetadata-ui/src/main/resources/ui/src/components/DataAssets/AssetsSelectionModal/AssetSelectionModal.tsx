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
import { Dialog, Modal, ModalOverlay } from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import './asset-selection-model.style.less';
import AssetSelectionContentBody from './AssetSelectionContentBody';
import AssetSelectionFooter from './AssetSelectionFooter';
import { AssetSelectionModalProps } from './AssetSelectionModal.interface';
import { useAssetSelectionState } from './useAssetSelectionState';

export const AssetSelectionModal = ({
  entityFqn,
  onCancel,
  onSave,
  open,
  type = AssetsOfEntity.GLOSSARY,
  queryFilter,
  emptyPlaceHolderText,
}: AssetSelectionModalProps) => {
  const { t } = useTranslation();

  const state = useAssetSelectionState({
    entityFqn,
    onCancel,
    onSave,
    open,
    type,
    variant: 'modal',
    queryFilter,
  });

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onCancel?.()}>
      <Modal className="asset-selection-modal">
        <Dialog
          data-testid="asset-selection-modal"
          title={t('label.add-entity', { entity: t('label.asset-plural') })}
          width={675}
          onClose={onCancel}>
          <Dialog.Content className="tw:max-h-[70vh] tw:overflow-hidden">
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
              handleQuickFiltersValueSelect={
                state.handleQuickFiltersValueSelect
              }
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
          </Dialog.Content>
          <Dialog.Footer>
            <AssetSelectionFooter
              errorCount={state.failedStatus?.failedRequest?.length ?? 0}
              hasAssetJobResponse={!isUndefined(state.assetJobResponse)}
              isLoading={state.isLoading}
              isSaveLoading={state.isSaveLoading}
              selectedCount={state.selectedItems?.size ?? 0}
              onCancel={onCancel}
              onSave={state.onSaveAction}
            />
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
