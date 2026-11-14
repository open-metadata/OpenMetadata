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
  Badge,
  BadgeColors,
  Box,
  Button,
  ButtonUtility,
  Card,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Database01,
  Table,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { upperFirst } from 'lodash';
import { FC, ReactNode, useEffect, useRef, useState } from 'react';
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
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getOntologyAssetPath,
  getUnlinkDescription,
  NATIVE_BINDING_ASSET_TYPES,
} from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { humanizeName } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import InlineEmptyPlaceholder from '../../../common/EmptyPlaceholder/InlineEmptyPlaceholder';
import Loader from '../../../common/Loader/Loader';
import OntologyDataAssetPicker from '../../../OntologyExplorer/OntologyDataAssetPicker';
import OntologyColumnMappingStep, {
  ColumnMappingProperty,
} from './OntologyColumnMappingStep';
import {
  getAssetPath,
  pinToTopOfScrollParent,
} from './OntologyConceptInspector.utils';
import { ConceptSection } from './OntologyConceptSection';

interface OntologyConceptAssetsProps {
  conceptId: string;
  conceptName: string;
  canEdit: boolean;
  /** The concept's bindable properties; without them no column step is offered. */
  properties?: readonly ColumnMappingProperty[];
  presentation: { kind: 'edit' } | { kind: 'view' };
  /**
   * Opens the link form and scrolls to it once linking is allowed. The request stays until the
   * form closes, so a remount (Edit swapping in the editor) still opens it.
   */
  isLinkRequested?: boolean;
  onLinkRequestClosed?: () => void;
  /** The asset picked on the Data canvas; its row is highlighted. */
  selectedAssetId?: string;
}

const ASSET_ICONS: Partial<Record<string, FC<{ className?: string }>>> = {
  [AssetType.Table]: Table,
  [AssetType.Topic]: Activity,
};
const ASSET_BADGE_COLORS: Partial<Record<string, BadgeColors>> = {
  [AssetType.Table]: 'blue',
  [AssetType.Topic]: 'orange',
};

const OntologyAssetLinks = ({
  asset,
  action,
}: {
  asset: EntityReference;
  /** Leads the links line, ahead of Sample Data, e.g. Bind columns. */
  action?: ReactNode;
}) => {
  const { t } = useTranslation();
  const path = getOntologyAssetPath(asset);
  const { canViewSampleData } = useEntityPermissions(
    ResourceEntity.TABLE,
    { id: asset.id },
    { enabled: asset.type === EntityType.TABLE, deleted: asset.deleted }
  );

  const sampleDataLink =
    asset.type === EntityType.TABLE &&
    asset.fullyQualifiedName &&
    canViewSampleData ? (
      <Link
        className="tw:shrink-0 tw:text-sm"
        to={getEntityDetailsPath(
          EntityType.TABLE,
          asset.fullyQualifiedName,
          EntityTabs.SAMPLE_DATA
        )}>
        {t('label.sample-data')}
      </Link>
    ) : null;

  return (
    <Box className="tw:min-w-0 tw:flex-1" direction="col">
      {path ? (
        <Link
          className="tw:truncate tw:text-sm tw:font-medium tw:text-primary"
          to={path}>
          {getEntityName(asset)}
        </Link>
      ) : (
        <Typography ellipsis size="text-sm" weight="medium">
          {getEntityName(asset)}
        </Typography>
      )}
      <Typography ellipsis className="tw:text-tertiary" size="text-sm">
        {getAssetPath(asset.fullyQualifiedName)}
      </Typography>
      {/* Links get their own line, so the path keeps the row's full width. */}
      {sampleDataLink || action ? (
        <Box align="center" className="tw:mt-0.5" gap={3}>
          {action}
          {sampleDataLink}
        </Box>
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
  isLinkRequested,
  onLinkRequestClosed,
  selectedAssetId,
}: OntologyConceptAssetsProps) => {
  const { t } = useTranslation();
  const bindings = useOntologyConceptBindings(conceptId);
  const [unlinkTarget, setUnlinkTarget] = useState<{
    binding: AssetBinding;
    conceptId: string;
    name: string;
  }>();
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [bindAssets, setBindAssets] = useState<EntityReference[]>();
  const [page, setPage] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const linking = useOntologyAssetLinking(conceptId, bindings);
  const unlinkAsset = useOntologyAssetUnlink(bindings, conceptName);
  const assets = bindings.data?.assets ?? [];
  const visiblePage = Math.min(
    page,
    Math.max(0, Math.ceil(assets.length / 10) - 1)
  );

  const canLink = canEdit && bindings.isSuccess;
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isLinkRequested || !canLink) {
      return undefined;
    }
    setIsPickerOpen(true);

    return sectionRef.current
      ? pinToTopOfScrollParent(sectionRef.current)
      : undefined;
  }, [canLink, isLinkRequested]);

  const renderPicker = () => {
    if (!canEdit || (!isPickerOpen && !bindAssets)) {
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

    return (
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
          onLinkRequestClosed?.();
        }}
        onSave={(linked) => {
          setIsPickerOpen(false);
          onLinkRequestClosed?.();
          const tables = linked.filter(
            (asset) => asset.type === EntityType.TABLE
          );
          if (tables.length > 0 && properties.length > 0) {
            setBindAssets(tables);
          }
        }}
      />
    );
  };

  const canUnlink = (target: typeof unlinkTarget) =>
    canEdit &&
    Boolean(bindings.editableSnapshot) &&
    target?.conceptId === conceptId;

  const confirmUnlink = async () => {
    if (isUnlinking || !unlinkTarget || !canUnlink(unlinkTarget)) {
      return;
    }
    setIsUnlinking(true);
    try {
      // false or a rejection keeps the dialog open so the user can retry.
      if ((await unlinkAsset(unlinkTarget.binding)) !== false) {
        setUnlinkTarget(undefined);
      }
    } finally {
      setIsUnlinking(false);
    }
  };

  // A page modal, centred like the delete confirm, rather than a popover on the row's trash button.
  const renderUnlinkModal = () =>
    unlinkTarget ? (
      <ModalOverlay
        isOpen
        isDismissable={!isUnlinking}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isUnlinking) {
            setUnlinkTarget(undefined);
          }
        }}>
        <Modal>
          <Dialog
            data-testid="ontology-unlink"
            dividers="scroll"
            width={400}
            onClose={() => setUnlinkTarget(undefined)}>
            {/* Title and description share the header, so the short prompt reads as one block. */}
            <Dialog.Header
              title={t('message.ontology-unlink-asset-title', {
                asset: unlinkTarget.name,
                concept: conceptName,
              })}>
              <Typography as="p" className="tw:mt-1.5" size="text-sm">
                {getUnlinkDescription(unlinkTarget.binding, t)}
              </Typography>
            </Dialog.Header>
            <Dialog.Footer className="tw:mt-5 tw:sm:mt-5">
              <Button
                color="secondary"
                isDisabled={isUnlinking}
                onPress={() => setUnlinkTarget(undefined)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary-destructive"
                data-testid="ontology-unlink-confirm"
                isDisabled={isUnlinking || !canUnlink(unlinkTarget)}
                isLoading={isUnlinking}
                onPress={() => void confirmUnlink()}>
                {t('label.unlink')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    ) : null;

  const renderStatus = () => (
    <>
      {renderUnlinkModal()}
      {bindings.isPending ? <Loader size="small" /> : null}
      {bindings.readState === 'unavailable' ? (
        <Alert
          rightContent={
            <Button
              color="link-color"
              size="sm"
              onPress={() => void bindings.retryRead().catch(() => undefined)}>
              {t('label.retry')}
            </Button>
          }
          variant="error">
          {t('message.ontology-binding-read-unavailable')}
        </Alert>
      ) : null}
    </>
  );

  // View shows three until the person asks for the rest, which then pages like Edit.
  const isCollapsed = presentation.kind === 'view' && !isExpanded;
  const visibleAssets = isCollapsed
    ? assets.slice(0, 3)
    : assets.slice(visiblePage * 10, (visiblePage + 1) * 10);

  const renderAssetList = () =>
    assets.length > 0 ? (
      <Card className="tw:divide-y tw:divide-secondary">
        {visibleAssets.map((binding) => {
          const Icon = ASSET_ICONS[binding.assetType] ?? Database01;
          const isSelected = binding.assetId === selectedAssetId;

          return (
            <Box
              align="start"
              aria-current={isSelected || undefined}
              className={classNames(
                'tw:min-h-16 tw:px-4 tw:py-3',
                isSelected &&
                  'tw:border-l-2 tw:border-brand tw:bg-brand-primary tw:pl-3.5'
              )}
              data-testid={`ontology-native-asset-row-${binding.assetId}`}
              gap={3}
              key={`${binding.assetType}:${binding.assetId}`}>
              <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-secondary tw:bg-surface">
                <Icon
                  aria-hidden
                  className="tw:size-4 tw:text-fg-brand-primary"
                />
              </span>
              <OntologyAssetLinks
                action={
                  canEdit &&
                  properties.length > 0 &&
                  binding.assetType === AssetType.Table ? (
                    <Button
                      className="tw:shrink-0 tw:font-normal"
                      color="link-color"
                      data-testid={`ontology-native-asset-bind-columns-${binding.assetId}`}
                      isDisabled={!bindings.editableSnapshot}
                      size="sm"
                      onPress={() => setBindAssets([binding.asset])}>
                      {t('label.ontology-bind-columns')}
                    </Button>
                  ) : undefined
                }
                asset={binding.asset}
              />
              <Badge
                className="tw:shrink-0"
                color={ASSET_BADGE_COLORS[binding.assetType] ?? 'gray'}
                size="sm"
                type="pill-color">
                {binding.columns.length > 0
                  ? `${upperFirst(humanizeName(binding.assetType))} · ${t(
                      'label.ontology-column-count',
                      { count: binding.columns.length }
                    )}`
                  : upperFirst(humanizeName(binding.assetType))}
              </Badge>
              {canEdit ? (
                <ButtonUtility
                  data-testid={`ontology-native-asset-remove-${binding.assetId}`}
                  icon={Trash01}
                  isDisabled={!bindings.editableSnapshot}
                  size="xs"
                  tooltip={t('label.remove-entity', {
                    entity: getEntityName(binding.asset),
                  })}
                  onClick={() => {
                    if (bindings.editableSnapshot) {
                      setUnlinkTarget({
                        binding,
                        conceptId,
                        name: getEntityName(binding.asset),
                      });
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
    !isCollapsed && assets.length > 10 ? (
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
        className="tw:self-start"
        color="link-color"
        data-testid="ontology-assets-more"
        iconLeading={isExpanded ? ChevronUp : ChevronDown}
        size="sm"
        onPress={() => {
          setIsExpanded((expanded) => !expanded);
          setPage(0);
        }}>
        {isExpanded
          ? t('label.show-less-lowercase')
          : t('label.show-all-count', { count: assets.length })}
      </Button>
    ) : null;

  const renderAiSection = () => (
    <ConceptSection
      addLabel={t('label.ontology-link-asset')}
      addTestId="ontology-native-link-assets"
      count={assets.length}
      sectionRef={sectionRef}
      testId="ontology-native-assets"
      title={t('label.ontology-data-assets')}
      onAdd={
        canLink && !isPickerOpen ? () => setIsPickerOpen(true) : undefined
      }>
      {renderPicker()}
      {renderStatus()}
      {assets.length === 0 && bindings.isSuccess ? (
        <InlineEmptyPlaceholder
          data-testid="ontology-concept-empty"
          description={t('message.ontology-data-assets-empty-hint')}
          title={t('message.ontology-no-data-assets-yet')}
        />
      ) : (
        <Typography className="tw:-mt-2.5 tw:text-tertiary" size="text-xs">
          {t('message.ontology-current-catalog-links')}
        </Typography>
      )}
      {renderAssetList()}
      {renderMoreAssets()}
      {renderPager()}
    </ConceptSection>
  );

  return renderAiSection();
};

export default OntologyConceptAssets;
