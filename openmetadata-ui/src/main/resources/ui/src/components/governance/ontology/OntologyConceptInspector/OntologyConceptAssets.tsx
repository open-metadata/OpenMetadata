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
  Alert,
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { EntityReference } from '../../../../generated/type/entityReference';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { NativeBindingBatchOutcome } from '../../../../interface/governance/ontology/ontologyConceptBindings.types';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getOntologyAssetPath,
  getOntologyBindingWriteMessage,
  NATIVE_BINDING_ASSET_TYPES,
} from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyDataAssetPicker from '../../../OntologyExplorer/OntologyDataAssetPicker';
import {
  InspectorEmptyText,
  InspectorSectionHeading,
} from '../../../OntologyExplorer/OntologyInspectorSection';

interface OntologyConceptAssetsProps {
  conceptId: string;
  canEdit: boolean;
}

const OntologyAssetLinks = ({ asset }: { asset: EntityReference }) => {
  const { t } = useTranslation();
  const path = getOntologyAssetPath(asset);
  const { canViewSampleData } = useEntityPermissions(
    ResourceEntity.TABLE,
    { id: asset.id },
    { enabled: asset.type === EntityType.TABLE, deleted: asset.deleted }
  );

  return (
    <Box direction="col" gap={1}>
      {path ? (
        <Link to={path}>{getEntityName(asset)}</Link>
      ) : (
        <Typography size="text-sm">{getEntityName(asset)}</Typography>
      )}
      {asset.type === EntityType.TABLE &&
      asset.fullyQualifiedName &&
      canViewSampleData ? (
        <Link
          to={getEntityDetailsPath(
            EntityType.TABLE,
            asset.fullyQualifiedName,
            EntityTabs.SAMPLE_DATA
          )}>
          {t('label.sample-data')}
        </Link>
      ) : null}
    </Box>
  );
};

const OntologyConceptAssets = ({
  conceptId,
  canEdit,
}: OntologyConceptAssetsProps) => {
  const { t } = useTranslation();
  const bindings = useOntologyConceptBindings(conceptId);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const batch = useRef<AbortController>();
  useEffect(() => () => batch.current?.abort(), [conceptId]);
  const assets = bindings.data?.assets ?? [];
  const visiblePage = Math.min(
    page,
    Math.max(0, Math.ceil(assets.length / 10) - 1)
  );
  const saveAssets = async (
    selected: EntityReference[]
  ): Promise<NativeBindingBatchOutcome> => {
    const run = new AbortController();
    batch.current?.abort();
    batch.current = run;
    const completedIds: string[] = [];
    let current = bindings.editableSnapshot;
    for (const [index, asset] of selected.entries()) {
      const assetType = NATIVE_BINDING_ASSET_TYPES.find(
        (type) => type === asset.type
      );
      if (run.signal.aborted || !current || !assetType) {
        return {
          completedIds,
          remaining: selected.slice(index),
          stop: 'not-ready',
        };
      }
      if (
        current.assets.some(
          (item) => item.assetId === asset.id && item.assetType === assetType
        )
      ) {
        completedIds.push(asset.id);

        continue;
      }
      const result = await bindings.replaceAsset({
        expectedRevision: current.revision,
        asset: { assetType, assetId: asset.id, columns: [] },
      });
      if (result.kind !== 'confirmed') {
        return {
          completedIds,
          remaining: selected.slice(index),
          stop: result.kind,
        };
      }
      completedIds.push(asset.id);
      if (result.read.kind === 'unavailable') {
        return {
          completedIds,
          remaining: selected.slice(index + 1),
          stop: 'read-unavailable',
        };
      }
      current = result.read.snapshot;
    }

    return { completedIds, remaining: [], stop: 'none' };
  };

  const renderPicker = () => {
    if (!canEdit) {
      return null;
    }

    return isPickerOpen ? (
      <OntologyDataAssetPicker
        native={{
          assetTypes: NATIVE_BINDING_ASSET_TYPES,
          isDisabled: !bindings.editableSnapshot,
          linkedIds: assets.map((asset) => asset.assetId),
          saveAssets,
        }}
        onCancel={() => {
          batch.current?.abort();
          setIsPickerOpen(false);
        }}
        onSave={() => setIsPickerOpen(false)}
      />
    ) : (
      <Button
        color="secondary"
        data-testid="ontology-native-link-assets"
        iconLeading={Plus}
        isDisabled={!bindings.editableSnapshot}
        size="xs"
        onPress={() => setIsPickerOpen(true)}>
        {t('label.add-entity', { entity: t('label.data-asset-plural') })}
      </Button>
    );
  };

  return (
    <Box
      className="tw:py-1"
      data-testid="ontology-native-assets"
      direction="col"
      gap={2}>
      <InspectorSectionHeading
        count={assets.length}
        label={t('label.data-asset-plural')}
      />
      <Typography color="secondary" size="text-xs">
        {t('message.ontology-current-catalog-links')}
      </Typography>
      {bindings.isPending ? (
        <Typography role="status">{t('label.loading')}</Typography>
      ) : null}
      {bindings.readState === 'unavailable' ? (
        <Alert variant="error">
          {t('message.ontology-binding-read-unavailable')}
          <Button
            color="link-color"
            size="sm"
            onPress={() => void bindings.retryRead().catch(() => undefined)}>
            {t('label.retry')}
          </Button>
        </Alert>
      ) : null}
      {assets.length > 0 ? (
        <Box
          className="tw:divide-y tw:divide-secondary tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary tw:bg-surface"
          direction="col">
          {assets
            .slice(visiblePage * 10, (visiblePage + 1) * 10)
            .map((binding) => {
              return (
                <Box
                  align="center"
                  className="tw:min-h-12 tw:px-3 tw:py-2"
                  gap={3}
                  key={`${binding.assetType}:${binding.assetId}`}>
                  <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
                    <OntologyAssetLinks asset={binding.asset} />
                    <Typography ellipsis color="secondary" size="text-xs">
                      {binding.asset.fullyQualifiedName}
                    </Typography>
                    <Typography color="secondary" size="text-xs">
                      {binding.assetType} ·{' '}
                      {t('label.ontology-column-binding-count', {
                        count: binding.columns.length,
                      })}
                    </Typography>
                  </Box>
                  {canEdit ? (
                    <ButtonUtility
                      color="tertiary"
                      data-testid={`ontology-native-asset-remove-${binding.assetId}`}
                      icon={Trash01}
                      isDisabled={!bindings.editableSnapshot}
                      size="xs"
                      tooltip={t('label.remove-entity', {
                        entity: getEntityName(binding.asset),
                      })}
                      onClick={async () => {
                        if (bindings.editableSnapshot) {
                          const result = await bindings.removeAsset({
                            assetType: binding.assetType,
                            assetId: binding.assetId,
                            expectedRevision:
                              bindings.editableSnapshot.revision,
                          });
                          const notify =
                            result.kind === 'confirmed'
                              ? showSuccessToast
                              : showErrorToast;
                          notify(t(getOntologyBindingWriteMessage(result)));
                        }
                      }}
                    />
                  ) : null}
                </Box>
              );
            })}
        </Box>
      ) : null}
      {assets.length === 0 && bindings.isSuccess ? (
        <InspectorEmptyText>
          {t('message.no-data-available')}
        </InspectorEmptyText>
      ) : null}
      {assets.length > 10 ? (
        <Box gap={2}>
          <Button
            color="secondary"
            isDisabled={visiblePage === 0}
            size="xs"
            onPress={() => setPage(visiblePage - 1)}>
            {t('label.previous')}
          </Button>
          <Button
            color="secondary"
            isDisabled={(visiblePage + 1) * 10 >= assets.length}
            size="xs"
            onPress={() => setPage(visiblePage + 1)}>
            {t('label.next')}
          </Button>
        </Box>
      ) : null}
      {renderPicker()}
    </Box>
  );
};

export default OntologyConceptAssets;
