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
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { BulkOperationResult } from '../../../../generated/type/bulkOperationResult';
import { EntityReference } from '../../../../generated/type/entityReference';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getOntologyAssetPath,
  NATIVE_BINDING_ASSET_TYPES,
} from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import OntologyDataAssetPicker from '../../../OntologyExplorer/OntologyDataAssetPicker';
import {
  InspectorEmptyText,
  InspectorList,
  InspectorRemoveButton,
  InspectorRow,
  InspectorSection,
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
  const assets = bindings.data?.assets ?? [];
  const visiblePage = Math.min(
    page,
    Math.max(0, Math.ceil(assets.length / 10) - 1)
  );
  const saveAssets = async (
    selected: EntityReference[]
  ): Promise<BulkOperationResult> => {
    const failedRequest: NonNullable<BulkOperationResult['failedRequest']> = [];
    let current = bindings.data;
    for (const asset of selected) {
      const assetType = NATIVE_BINDING_ASSET_TYPES.find(
        (type) => type === asset.type
      );
      if (!current || !assetType) {
        failedRequest.push({
          request: asset,
          message: t('server.unexpected-error'),
        });

        continue;
      }
      if (
        current.assets.some(
          (item) => item.assetId === asset.id && item.assetType === assetType
        )
      ) {
        continue;
      }
      try {
        current = await bindings.update.mutateAsync({
          id: conceptId,
          request: {
            expectedRevision: current.revision,
            asset: { assetType, assetId: asset.id, columns: [] },
          },
        });
      } catch {
        failedRequest.push({
          request: asset,
          message: t('message.temporary-error-try-reloading'),
        });
      }
    }

    return { failedRequest };
  };

  const renderPicker = () => {
    if (!canEdit || !bindings.isSuccess) {
      return null;
    }

    return isPickerOpen ? (
      <OntologyDataAssetPicker
        native={{
          assetTypes: NATIVE_BINDING_ASSET_TYPES,
          linkedIds: assets.map((asset) => asset.assetId),
          saveAssets,
        }}
        onCancel={() => setIsPickerOpen(false)}
        onPartialSave={() => void bindings.refetch()}
        onSave={() => setIsPickerOpen(false)}
      />
    ) : (
      <Button
        color="secondary"
        data-testid="ontology-native-link-assets"
        iconLeading={Plus}
        size="xs"
        onPress={() => setIsPickerOpen(true)}>
        {t('label.add-entity', { entity: t('label.data-asset-plural') })}
      </Button>
    );
  };

  return (
    <InspectorSection testId="ontology-native-assets">
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
      {bindings.isError ? (
        <Alert variant="error">
          {t('message.temporary-error-try-reloading')}
          <Button
            color="link-color"
            size="sm"
            onPress={() => void bindings.refetch()}>
            {t('label.retry')}
          </Button>
        </Alert>
      ) : null}
      {assets.length > 0 ? (
        <InspectorList>
          {assets
            .slice(visiblePage * 10, (visiblePage + 1) * 10)
            .map((binding) => {
              return (
                <InspectorRow key={`${binding.assetType}:${binding.assetId}`}>
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
                    <InspectorRemoveButton
                      isDisabled={
                        bindings.remove.isPending || bindings.update.isPending
                      }
                      label={t('label.remove-entity', {
                        entity: getEntityName(binding.asset),
                      })}
                      testId={`ontology-native-asset-remove-${binding.assetId}`}
                      onRemove={() => {
                        if (bindings.data) {
                          void bindings.remove
                            .mutateAsync({
                              id: conceptId,
                              assetType: binding.assetType,
                              assetId: binding.assetId,
                              revision: bindings.data.revision,
                            })
                            .catch(() => undefined);
                        }
                      }}
                    />
                  ) : null}
                </InspectorRow>
              );
            })}
        </InspectorList>
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
    </InspectorSection>
  );
};

export default OntologyConceptAssets;
