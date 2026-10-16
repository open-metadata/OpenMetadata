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
import {
  Badge,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { useControlledState } from '@react-stately/utils';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../generated/entity/type';
import {
  getGlossaryTermAssets,
  removeAssetsFromGlossaryTerm,
} from '../../rest/glossaryAPI';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import Fqn from '../../utils/Fqn';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import OntologyDataAssetPicker from './OntologyDataAssetPicker';
import {
  InspectorList,
  InspectorRemoveButton,
  InspectorRow,
  InspectorSection,
  InspectorSectionHeading,
} from './OntologyInspectorSection';
import { isValidUUID } from './utils/graphBuilders';

export const DATA_ASSET_PAGE_SIZE = 10;

export interface OntologyConceptDataAssetsProps {
  readonly initialCount?: number;
  readonly isEditMode: boolean;
  readonly term?: GlossaryTerm | null;
  readonly termId: string;
  /** Lets the parent drawer open the asset picker, e.g. from its "Add more details" chips. */
  readonly isPickerOpen?: boolean;
  readonly onAssetsChange?: () => void;
  readonly onPickerOpenChange?: (isOpen: boolean) => void;
  readonly onTotalChange?: (total: number) => void;
}

const getAssetName = (asset: EntityReference): string =>
  asset.displayName ?? asset.name ?? asset.fullyQualifiedName ?? asset.id;

// The containers above the asset, e.g. "service › database › schema".
const getAssetPath = (asset: EntityReference): string | undefined => {
  const parents = asset.fullyQualifiedName
    ? Fqn.split(asset.fullyQualifiedName).slice(0, -1)
    : [];

  return parents.length > 0 ? parents.join(' › ') : undefined;
};

const ASSET_BADGE_COLORS: Record<string, 'indigo' | 'blue-light'> = {
  table: 'indigo',
  tableColumn: 'blue-light',
};

// An empty section is offered from the drawer's "Add more details" instead,
// unless its picker is open.
const isEmptySection = (total: number, loaded: number, hasPicker: boolean) =>
  total === 0 && loaded === 0 && !hasPicker;

export const OntologyConceptDataAssets = ({
  initialCount = 0,
  isEditMode,
  term,
  termId,
  isPickerOpen: controlledIsPickerOpen,
  onAssetsChange,
  onPickerOpenChange,
  onTotalChange,
}: OntologyConceptDataAssetsProps) => {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<EntityReference[]>([]);
  const [total, setTotal] = useState(initialCount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useControlledState(
    controlledIsPickerOpen,
    false,
    onPickerOpenChange
  );
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
    onTotalChange?.(total);
  }, [onTotalChange, total]);

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
  }, [reloadAfterEdit, setIsPickerOpen]);

  const termFqn = term?.fullyQualifiedName;
  const remainingCount = total - assets.length;

  const picker =
    isPickerOpen && term ? (
      <OntologyDataAssetPicker
        term={term}
        onCancel={() => setIsPickerOpen(false)}
        onSave={handleAssetsAdded}
      />
    ) : null;

  if (isEmptySection(total, assets.length, Boolean(picker))) {
    return null;
  }

  const renderAssetRow = (asset: EntityReference) => {
    const assetName = getAssetName(asset);
    const assetPath = getAssetPath(asset);

    return (
      <InspectorRow key={asset.id} testId={`authoring-asset-${asset.id}`}>
        <Box
          align="center"
          className="tw:size-8 tw:shrink-0 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary"
          justify="center">
          <img
            alt=""
            className="tw:size-4 tw:object-contain"
            height={16}
            src={serviceUtilClassBase.getServiceTypeLogo({
              entityType: asset.type,
            })}
            width={16}
          />
        </Box>
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <Typography
            ellipsis
            className="tw:text-primary"
            size="text-sm"
            weight="medium">
            {assetName}
          </Typography>
          {assetPath ? (
            <Typography ellipsis className="tw:text-tertiary" size="text-xs">
              {assetPath}
            </Typography>
          ) : null}
        </Box>
        <Badge
          className="tw:shrink-0"
          color={ASSET_BADGE_COLORS[asset.type] ?? 'gray'}
          size="sm"
          type="pill-color">
          {entityUtilClassBase.getFormattedEntityType(asset.type)}
        </Badge>
        {isEditMode ? (
          <InspectorRemoveButton
            isDisabled={removingAssetId !== undefined}
            label={t('label.remove-entity', { entity: assetName })}
            testId={`authoring-remove-asset-${asset.id}`}
            onRemove={() => handleRemove(asset)}
          />
        ) : null}
      </InspectorRow>
    );
  };

  return (
    <InspectorSection testId="authoring-data-assets">
      <InspectorSectionHeading
        addTestId="authoring-add-data-assets"
        count={total}
        label={t('label.data-asset-plural')}
        onAdd={isEditMode && termFqn ? () => setIsPickerOpen(true) : undefined}
      />
      {assets.length > 0 ? (
        <InspectorList>{assets.map(renderAssetRow)}</InspectorList>
      ) : null}
      {remainingCount > 0 ? (
        <Button
          className="tw:self-start"
          color="link-color"
          data-testid="authoring-more-assets"
          isDisabled={isLoadingMore}
          size="sm"
          onClick={handleLoadMore}>
          {isLoadingMore
            ? t('label.loading')
            : t('label.show-count-more', { count: remainingCount })}
        </Button>
      ) : null}
      {picker}
    </InspectorSection>
  );
};
