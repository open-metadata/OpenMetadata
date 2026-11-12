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
  ButtonUtility,
  ConfirmPopover,
  Typography,
} from '@openmetadata/ui-core-components';
import { LinkExternal01, XClose } from '@openmetadata/ui-core-components/icons';
import { KeyboardEvent, ReactElement, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetBinding } from '../../../../generated/type/ontologyConceptBindingsResponse';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import { getUnlinkDescription } from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { OntologyNode } from '../../../OntologyExplorer/OntologyExplorer.interface';

interface AssetUnlinkConfirmProps {
  readonly assetName: string;
  readonly binding: AssetBinding;
  readonly children?: ReactElement;
  readonly conceptName: string;
  readonly isOpen?: boolean;
  readonly triggerRef?: RefObject<Element | null>;
  readonly onOpenChange?: (isOpen: boolean) => void;
  readonly onUnlink: (binding: AssetBinding) => Promise<boolean>;
  readonly onUnlinked?: () => void;
}

/** The one confirmation for unlinking an asset, from the panel or from a card's menu. */
export const AssetUnlinkConfirm = ({
  assetName,
  binding,
  children,
  conceptName,
  isOpen,
  triggerRef,
  onOpenChange,
  onUnlink,
  onUnlinked,
}: AssetUnlinkConfirmProps) => {
  const { t } = useTranslation();

  return (
    <ConfirmPopover
      cancelText={t('label.cancel')}
      confirmText={t('label.unlink')}
      data-testid="ontology-unlink"
      description={getUnlinkDescription(binding, t)}
      isOpen={isOpen}
      title={t('message.ontology-unlink-asset-title', {
        asset: assetName,
        concept: conceptName,
      })}
      triggerRef={triggerRef}
      onConfirm={async () => {
        const isUnlinked = await onUnlink(binding);
        if (isUnlinked) {
          onUnlinked?.();
        }

        return isUnlinked;
      }}
      onOpenChange={onOpenChange}>
      {children}
    </ConfirmPopover>
  );
};

// Stops above the canvas's bottom toolbar so Open asset is never covered.
const PANEL_CLASS = [
  'tw:absolute tw:top-16 tw:right-3.5 tw:bottom-20 tw:z-20 tw:flex tw:w-80 tw:flex-col tw:gap-4',
  'tw:overflow-y-auto tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-4 tw:shadow-lg',
].join(' ');

interface OntologyDataAssetPanelProps {
  /** The bound asset with its columns, once the concept's bindings have loaded. */
  readonly binding?: AssetBinding;
  readonly conceptName: string;
  readonly canBindColumns?: boolean;
  readonly canUnlink: boolean;
  /** The row the person clicked, shown while the bindings are still loading. */
  readonly node: OntologyNode;
  readonly onBindColumns?: () => void;
  readonly onClose: () => void;
  readonly onOpenAsset: () => void;
  readonly onUnlink: (binding: AssetBinding) => Promise<boolean>;
}

/** The asset detail of Data mode. It stays in the Studio; opening the asset is a separate action. */
const OntologyDataAssetPanel = ({
  binding,
  conceptName,
  canBindColumns = false,
  canUnlink,
  node,
  onBindColumns,
  onClose,
  onOpenAsset,
  onUnlink,
}: OntologyDataAssetPanelProps) => {
  const { t } = useTranslation();
  const asset = binding?.asset ?? node.entityRef;
  const name = asset ? getEntityName(asset) : node.label;
  const columns = binding?.columns ?? [];

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    // The panel only listens for Escape bubbling up from its own controls.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      aria-label={name}
      className={PANEL_CLASS}
      data-testid="ontology-data-asset-panel"
      onKeyDown={handleKeyDown}>
      <Box align="start" gap={2} justify="between">
        <Box className="tw:min-w-0" direction="col" gap={1}>
          <Typography
            as="h3"
            className="not-prose tw:m-0"
            data-testid="ontology-data-asset-panel-name"
            size="text-md"
            weight="semibold">
            {name}
          </Typography>
          <Typography
            color="secondary"
            data-testid="ontology-data-asset-panel-fqn"
            size="text-xs">
            {asset?.fullyQualifiedName}
          </Typography>
        </Box>
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-data-asset-panel-close"
          icon={XClose}
          size="xs"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </Box>
      <Box align="center" gap={2} wrap="wrap">
        {asset?.type ? (
          <Badge color="blue" size="sm" type="pill-color">
            {entityUtilClassBase.getFormattedEntityType(asset.type)}
          </Badge>
        ) : null}
        {node.serviceLabel ? (
          <Typography color="secondary" size="text-xs">
            {node.serviceLabel}
          </Typography>
        ) : null}
      </Box>
      <Box
        className="tw:border-t tw:border-secondary tw:pt-4"
        direction="col"
        gap={2}>
        <Typography size="text-sm" weight="semibold">
          {t('label.bound-column-count', { count: columns.length })}
        </Typography>
        {columns.length === 0 ? (
          <Typography
            color="secondary"
            data-testid="ontology-data-asset-panel-no-columns"
            size="text-xs">
            {t('message.ontology-asset-no-bound-columns', {
              concept: conceptName,
            })}
          </Typography>
        ) : null}
        <ul
          className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-1.5 tw:p-0"
          data-testid="ontology-data-asset-panel-columns">
          {columns.map((column) => (
            <li
              className="tw:flex tw:items-baseline tw:justify-between tw:gap-2"
              key={column.columnPath.join('.')}>
              <Typography
                ellipsis
                className="tw:font-mono"
                size="text-xs"
                weight="medium">
                {column.columnPath.join('.')}
              </Typography>
              <Typography
                ellipsis
                color={column.state === 'resolved' ? 'secondary' : 'danger'}
                size="text-xs">
                {column.property ? getEntityName(column.property) : '—'}
              </Typography>
            </li>
          ))}
        </ul>
        {canBindColumns ? (
          <Button
            color="link-color"
            data-testid="ontology-data-asset-bind-columns"
            size="sm"
            onPress={onBindColumns}>
            {t('label.ontology-bind-columns')}
          </Button>
        ) : null}
      </Box>
      <Box className="tw:mt-auto" direction="col" gap={2}>
        {canUnlink && binding ? (
          <AssetUnlinkConfirm
            assetName={name}
            binding={binding}
            conceptName={conceptName}
            onUnlink={onUnlink}
            onUnlinked={onClose}>
            <Button
              className="tw:w-full"
              color="secondary-destructive"
              data-testid="ontology-data-asset-unlink"
              size="sm">
              {t('label.unlink')}
            </Button>
          </AssetUnlinkConfirm>
        ) : null}
        <Button
          className="tw:w-full"
          color="primary"
          data-testid="ontology-data-asset-open"
          iconTrailing={LinkExternal01}
          size="md"
          onPress={onOpenAsset}>
          {t('label.open-asset')}
        </Button>
      </Box>
    </aside>
  );
};

export default OntologyDataAssetPanel;
