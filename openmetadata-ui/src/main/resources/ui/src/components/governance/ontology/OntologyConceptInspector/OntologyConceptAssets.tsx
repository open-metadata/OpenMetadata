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
  Card,
  ConfirmPopover,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { EntityReference } from '../../../../generated/type/entityReference';
import {
  AssetBinding,
  AssetType,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import { useOntologyAssetLinking } from '../../../../hooks/governance/ontology/useOntologyAssetLinking';
import { useOntologyAssetUnlink } from '../../../../hooks/governance/ontology/useOntologyAssetUnlink';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { useAnchoredConfirm } from '../../../../hooks/popover/useAnchoredConfirm';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getOntologyAssetPath,
  getUnlinkDescription,
  NATIVE_BINDING_ASSET_TYPES,
} from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import OntologyDataAssetPicker from '../../../OntologyExplorer/OntologyDataAssetPicker';
import {
  InspectorEmptyText,
  InspectorSectionHeading,
} from '../../../OntologyExplorer/OntologyInspectorSection';
import OntologyColumnMappingStep, {
  ColumnMappingProperty,
} from './OntologyColumnMappingStep';
import { ConceptEmptyState, ConceptSection } from './OntologyConceptSection';

interface OntologyConceptAssetsProps {
  conceptId: string;
  conceptName: string;
  canEdit: boolean;
  /** The concept's bindable properties; without them no column step is offered. */
  properties?: readonly ColumnMappingProperty[];
  presentation: { kind: 'edit' } | { kind: 'view'; onOpenData: () => void };
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
  conceptName,
  canEdit,
  properties = [],
  presentation,
}: OntologyConceptAssetsProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const bindings = useOntologyConceptBindings(conceptId);
  const unlink = useAnchoredConfirm<{
    binding: AssetBinding;
    conceptId: string;
    name: string;
  }>();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [bindAssets, setBindAssets] = useState<EntityReference[]>();
  const [page, setPage] = useState(0);
  const linking = useOntologyAssetLinking(conceptId, bindings);
  const unlinkAsset = useOntologyAssetUnlink(bindings, conceptName);
  const assets = bindings.data?.assets ?? [];
  const visiblePage = Math.min(
    page,
    Math.max(0, Math.ceil(assets.length / 10) - 1)
  );

  const canLink = canEdit && bindings.isSuccess;

  const renderPicker = () => {
    if (!canEdit || (isAiMode && !isPickerOpen && !bindAssets)) {
      return null;
    }
    if (bindAssets) {
      return (
        <OntologyColumnMappingStep
          assets={bindAssets}
          conceptId={conceptId}
          conceptName={conceptName}
          key={bindAssets.map(({ id }) => id).join()}
          properties={properties}
          onClose={() => setBindAssets(undefined)}
        />
      );
    }

    return isPickerOpen ? (
      <OntologyDataAssetPicker
        native={{
          assetTypes: NATIVE_BINDING_ASSET_TYPES,
          concept: { name: conceptName },
          isDisabled: !bindings.editableSnapshot,
          linkedIds: assets.map((asset) => asset.assetId),
          saveAssets: linking.saveAssets,
        }}
        onCancel={() => {
          linking.cancel();
          setIsPickerOpen(false);
        }}
        onSave={(linked) => {
          setIsPickerOpen(false);
          const tables = linked.filter(
            (asset) => asset.type === EntityType.TABLE
          );
          if (tables.length > 0 && properties.length > 0) {
            setBindAssets(tables);
          }
        }}
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

  const renderStatus = () => (
    <>
      {unlink.target && (
        <ConfirmPopover
          {...unlink.popoverProps}
          cancelText={t('label.cancel')}
          confirmText={t('label.unlink')}
          data-testid="ontology-unlink"
          description={getUnlinkDescription(unlink.target.binding, t)}
          isConfirmDisabled={
            !canEdit ||
            !bindings.editableSnapshot ||
            unlink.target.conceptId !== conceptId
          }
          title={t('message.ontology-unlink-asset-title', {
            asset: unlink.target.name,
            concept: conceptName,
          })}
          onConfirm={async () => {
            if (
              !canEdit ||
              !bindings.editableSnapshot ||
              !unlink.target ||
              unlink.target.conceptId !== conceptId
            ) {
              return false;
            }

            return unlinkAsset(unlink.target.binding);
          }}
        />
      )}
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
    </>
  );

  const visibleAssets =
    presentation.kind === 'view'
      ? assets.slice(0, 3)
      : assets.slice(visiblePage * 10, (visiblePage + 1) * 10);

  const renderAssetList = () =>
    assets.length > 0 ? (
      <Card className="tw:divide-y tw:divide-secondary">
        {visibleAssets.map((binding) => {
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
              {canEdit &&
              properties.length > 0 &&
              binding.assetType === AssetType.Table ? (
                <Button
                  color="link-color"
                  data-testid={`ontology-native-asset-bind-columns-${binding.assetId}`}
                  isDisabled={!bindings.editableSnapshot}
                  size="xs"
                  onPress={() => setBindAssets([binding.asset])}>
                  {t('label.ontology-bind-columns')}
                </Button>
              ) : null}
              {canEdit ? (
                <ButtonUtility
                  data-testid={`ontology-native-asset-remove-${binding.assetId}`}
                  icon={Trash01}
                  isDisabled={!bindings.editableSnapshot}
                  size="xs"
                  tooltip={t('label.remove-entity', {
                    entity: getEntityName(binding.asset),
                  })}
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    if (bindings.editableSnapshot) {
                      unlink.open(
                        {
                          binding,
                          conceptId,
                          name: getEntityName(binding.asset),
                        },
                        event.currentTarget
                      );
                    }
                  }}
                />
              ) : null}
            </Box>
          );
        })}
      </Card>
    ) : null;

  const renderPager = () =>
    presentation.kind === 'edit' && assets.length > 10 ? (
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
    ) : null;

  const renderMoreAssets = () =>
    presentation.kind === 'view' && assets.length > 3 ? (
      <Button
        color="link-color"
        data-testid="ontology-assets-more"
        size="sm"
        onPress={presentation.onOpenData}>
        {t('label.ontology-more-assets', { count: assets.length - 3 })}
      </Button>
    ) : null;

  const renderAiSection = () => (
    <ConceptSection
      addLabel={t('label.link-entity', { entity: t('label.asset') })}
      addTestId="ontology-native-link-assets"
      count={assets.length}
      testId="ontology-native-assets"
      title={t('label.data-asset-plural')}
      onAdd={
        canLink && !isPickerOpen ? () => setIsPickerOpen(true) : undefined
      }>
      {renderPicker()}
      {renderStatus()}
      {assets.length === 0 && bindings.isSuccess ? (
        <ConceptEmptyState
          hint={t('message.ontology-current-catalog-links')}
          title={t('label.no-entity', {
            entity: t('label.data-asset-plural'),
          })}
        />
      ) : (
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.ontology-current-catalog-links')}
        </Typography>
      )}
      {renderAssetList()}
      {renderMoreAssets()}
      {renderPager()}
    </ConceptSection>
  );

  if (isAiMode) {
    return renderAiSection();
  }

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
      {renderStatus()}
      {renderAssetList()}
      {assets.length === 0 && bindings.isSuccess ? (
        <InspectorEmptyText>
          {t('message.no-data-available')}
        </InspectorEmptyText>
      ) : null}
      {renderMoreAssets()}
      {renderPager()}
      {renderPicker()}
    </Box>
  );
};

export default OntologyConceptAssets;
