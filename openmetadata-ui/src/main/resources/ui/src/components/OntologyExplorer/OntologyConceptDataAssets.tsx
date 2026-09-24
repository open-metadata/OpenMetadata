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
import { Button, ButtonUtility } from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../generated/entity/type';
import {
  getGlossaryTermAssets,
  removeAssetsFromGlossaryTerm,
} from '../../rest/glossaryAPI';
import { getQueryFilterToExcludeTerm } from '../../utils/GlossaryPureUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { AssetSelectionModal } from '../DataAssets/AssetsSelectionModal/AssetSelectionModal';
import { AssetsOfEntity } from '../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import {
  InspectorAddButton,
  InspectorSectionHeading,
} from './OntologyInspectorSection';
import { isValidUUID } from './utils/graphBuilders';

export const DATA_ASSET_PAGE_SIZE = 10;

export interface OntologyConceptDataAssetsProps {
  readonly initialCount?: number;
  readonly isEditMode: boolean;
  readonly term?: GlossaryTerm | null;
  readonly termId: string;
  readonly onAssetsChange?: () => void;
}

const getAssetName = (asset: EntityReference): string =>
  asset.displayName ?? asset.name ?? asset.fullyQualifiedName ?? asset.id;

export const OntologyConceptDataAssets = ({
  initialCount = 0,
  isEditMode,
  term,
  termId,
  onAssetsChange,
}: OntologyConceptDataAssetsProps) => {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<EntityReference[]>([]);
  const [total, setTotal] = useState(initialCount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [removingAssetId, setRemovingAssetId] = useState<string>();
  // A reload after an edit supersedes any page request still in flight.
  const latestRequestRef = useRef(0);

  const loadPage = useCallback(
    async (offset: number, signal?: AbortSignal) => {
      latestRequestRef.current += 1;
      const requestId = latestRequestRef.current;
      const response = await getGlossaryTermAssets(
        termId,
        DATA_ASSET_PAGE_SIZE,
        offset,
        signal
      );
      if (requestId !== latestRequestRef.current) {
        return;
      }
      setAssets((loaded) =>
        offset === 0 ? response.data : [...loaded, ...response.data]
      );
      setTotal(response.paging.total);
    },
    [termId]
  );

  useEffect(() => {
    const controller = new AbortController();
    setAssets([]);
    setTotal(initialCount);
    if (isValidUUID(termId)) {
      loadPage(0, controller.signal).catch(() => {
        if (!controller.signal.aborted) {
          setAssets([]);
        }
      });
    }

    return () => controller.abort();
  }, [initialCount, loadPage, termId]);

  const reloadAfterEdit = useCallback(async () => {
    onAssetsChange?.();
    try {
      await loadPage(0);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [loadPage, onAssetsChange]);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      await loadPage(assets.length);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingMore(false);
    }
  }, [assets.length, loadPage]);

  const handleRemove = useCallback(
    async (asset: EntityReference) => {
      if (!term) {
        return;
      }
      setRemovingAssetId(asset.id);
      try {
        await removeAssetsFromGlossaryTerm(term, [
          { id: asset.id, type: asset.type },
        ]);
        await reloadAfterEdit();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setRemovingAssetId(undefined);
      }
    },
    [reloadAfterEdit, term]
  );

  const handleAssetsAdded = useCallback(async () => {
    setIsPickerOpen(false);
    await reloadAfterEdit();
  }, [reloadAfterEdit]);

  const termFqn = term?.fullyQualifiedName;
  const remainingCount = total - assets.length;

  return (
    <section data-testid="authoring-data-assets">
      <InspectorSectionHeading
        count={total}
        label={t('label.data-asset-plural')}
      />
      <div className="tw:flex tw:flex-col tw:gap-[7px]">
        {assets.map((asset) => {
          const assetName = getAssetName(asset);

          return (
            <div
              className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:px-2.5 tw:py-2"
              data-testid={`authoring-asset-${asset.id}`}
              key={asset.id}>
              <img
                alt={asset.type}
                className="tw:size-3.5 tw:shrink-0 tw:object-contain"
                height={14}
                src={serviceUtilClassBase.getServiceTypeLogo({
                  entityType: asset.type,
                })}
                width={14}
              />
              <div className="tw:min-w-0 tw:flex-1">
                <div className="tw:truncate tw:font-mono tw:text-xs tw:leading-normal tw:font-medium tw:text-primary">
                  {assetName}
                </div>
                <div className="tw:truncate tw:font-body tw:text-[10px] tw:leading-normal tw:font-normal tw:text-quaternary">
                  {asset.type}
                </div>
              </div>
              {isEditMode ? (
                <ButtonUtility
                  data-testid={`authoring-remove-asset-${asset.id}`}
                  icon={XClose}
                  isDisabled={removingAssetId !== undefined}
                  size="xs"
                  tooltip={t('label.remove-entity', { entity: assetName })}
                  onClick={() => handleRemove(asset)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {remainingCount > 0 ? (
        <Button
          noTextPadding
          className={classNames(
            'tw:mt-2 tw:w-full tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-2.5 tw:py-2',
            'tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-brand-tertiary'
          )}
          color="tertiary"
          data-testid="authoring-more-assets"
          isDisabled={isLoadingMore}
          onClick={handleLoadMore}>
          {isLoadingMore ? (
            t('label.loading')
          ) : (
            <>
              +{remainingCount} {t('label.more-lowercase')}{' '}
              {t('label.data-asset-lowercase-plural')}
            </>
          )}
        </Button>
      ) : null}
      {isEditMode ? (
        <InspectorAddButton
          isDisabled={!termFqn}
          label={t('label.add-entity', {
            entity: t('label.data-asset-plural'),
          })}
          testId="authoring-add-data-assets"
          onClick={() => setIsPickerOpen(true)}
        />
      ) : null}
      {isPickerOpen && termFqn ? (
        <AssetSelectionModal
          open
          entityFqn={termFqn}
          queryFilter={getQueryFilterToExcludeTerm(termFqn)}
          type={AssetsOfEntity.GLOSSARY}
          onCancel={() => setIsPickerOpen(false)}
          onSave={handleAssetsAdded}
        />
      ) : null}
    </section>
  );
};
