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
  Box,
  Button,
  Card,
  Checkbox,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
} from '@openmetadata/ui-core-components/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyPackInstallResult } from '../../generated/api/data/ontologyPackInstallResult';
import { OntologyPackManifest } from '../../generated/api/data/ontologyPackManifest';
import { selectedModuleTotals } from './OntologyLibrary.utils';
import { OntologyPackIcon } from './OntologyLibraryCatalogue';

export type OntologyLibraryAction = 'dry-run' | 'install';

const GRAPH_RADIUS_PERCENT = 36;

const getModuleNodePosition = (index: number, total: number) => {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;

  return {
    x: 50 + GRAPH_RADIUS_PERCENT * Math.cos(angle),
    y: 50 + GRAPH_RADIUS_PERCENT * Math.sin(angle),
  };
};

interface OntologyPackGraphPreviewProps {
  pack: OntologyPackManifest;
  selectedModuleIds: string[];
}

const OntologyPackGraphPreview = ({
  pack,
  selectedModuleIds,
}: OntologyPackGraphPreviewProps) => {
  const { t } = useTranslation();
  const nodes = pack.modules.map((module, index) => ({
    module,
    isSelected: selectedModuleIds.includes(module.id),
    ...getModuleNodePosition(index, pack.modules.length),
  }));

  return (
    <Box
      aria-label={t('message.ontology-pack-graph-preview', { pack: pack.name })}
      className="tw:relative tw:h-60 tw:w-full"
      data-testid="ontology-pack-graph-preview"
      role="img">
      <svg
        aria-hidden="true"
        className="tw:absolute tw:inset-0 tw:size-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100">
        {nodes.map(({ module, isSelected, x, y }) => (
          <line
            className={
              isSelected
                ? 'tw:text-utility-brand-300'
                : 'tw:text-utility-gray-300'
            }
            key={module.id}
            stroke="currentColor"
            vectorEffect="non-scaling-stroke"
            x1={50}
            x2={x}
            y1={50}
            y2={y}
          />
        ))}
      </svg>
      <Box className="tw:absolute tw:top-1/2 tw:left-1/2 tw:-translate-1/2">
        <Badge color="brand" size="lg" type="color">
          {pack.abbreviation}
        </Badge>
      </Box>
      {nodes.map(({ module, isSelected, x, y }) => (
        <Box
          className="tw:absolute tw:-translate-1/2"
          key={module.id}
          style={{ left: `${x}%`, top: `${y}%` }}>
          <Badge
            color={isSelected ? 'brand' : 'gray'}
            size="md"
            tooltip={module.name}
            type="color">
            {module.name}
          </Badge>
        </Box>
      ))}
    </Box>
  );
};

interface OntologyLibraryDetailBaseProps {
  pack: OntologyPackManifest;
  selectedModuleIds: string[];
  onBack: () => void;
  onModuleChange: (moduleId: string, isSelected: boolean) => void;
}

type OntologyLibraryDetailProps = OntologyLibraryDetailBaseProps &
  (
    | {
        native: {
          installPanel: ReactNode;
          canSelectModules: boolean;
          isBusy: boolean;
        };
      }
    | {
        native?: never;
        activeAction?: OntologyLibraryAction;
        canInstall: boolean;
        installedResult?: OntologyPackInstallResult;
        previewResult?: OntologyPackInstallResult;
        targetGlossaryName: string;
        onInstall: () => void;
        onOpenGlossary: () => void;
        onPreview: () => void;
        onTargetGlossaryChange: (name: string) => void;
      }
  );

interface OntologyLibraryInstallPanelProps {
  activeAction?: OntologyLibraryAction;
  canInstall: boolean;
  canPreview: boolean;
  installedResult?: OntologyPackInstallResult;
  pack: OntologyPackManifest;
  previewResult?: OntologyPackInstallResult;
  targetGlossaryName: string;
  onInstall: () => void;
  onOpenGlossary: () => void;
  onPreview: () => void;
  onTargetGlossaryChange: (name: string) => void;
}

const OntologyLibraryInstallPanel = ({
  activeAction,
  canInstall,
  canPreview,
  installedResult,
  pack,
  previewResult,
  targetGlossaryName,
  onInstall,
  onOpenGlossary,
  onPreview,
  onTargetGlossaryChange,
}: OntologyLibraryInstallPanelProps) => {
  const { t } = useTranslation();

  if (pack.bundled && canInstall) {
    return (
      <Card size="md">
        <Card.Header
          subtitle={t('message.ontology-pack-install-description')}
          title={t('label.install-to-new-glossary')}
        />
        <Card.Content className="tw:flex tw:flex-col tw:gap-4">
          <Input
            inputDataTestId="ontology-pack-target-glossary"
            label={t('label.glossary-name')}
            placeholder={t('message.ontology-pack-glossary-placeholder')}
            value={targetGlossaryName}
            onChange={onTargetGlossaryChange}
          />

          {previewResult ? (
            <Alert
              title={t('message.ontology-pack-dry-run-success')}
              variant="success">
              {t('message.ontology-pack-import-counts', {
                concepts: previewResult.conceptCount,
                relationships: previewResult.relationshipCount,
              })}
            </Alert>
          ) : null}

          {installedResult ? (
            <Alert
              rightContent={
                <Button
                  color="secondary-success"
                  data-testid="ontology-pack-open-graph"
                  iconTrailing={ArrowRight}
                  size="sm"
                  onPress={onOpenGlossary}>
                  {t('label.open-graph')}
                </Button>
              }
              title={t('message.ontology-pack-installed-success')}
              variant="success">
              {installedResult.targetGlossaryName}
            </Alert>
          ) : null}

          <Box gap={3} justify="end">
            <Button
              color="secondary"
              data-testid="ontology-pack-dry-run"
              isDisabled={!canPreview || Boolean(activeAction)}
              isLoading={activeAction === 'dry-run'}
              size="sm"
              onPress={onPreview}>
              {t('label.dry-run')}
            </Button>
            <Button
              color="primary"
              data-testid="ontology-pack-install"
              isDisabled={!previewResult || Boolean(activeAction)}
              isLoading={activeAction === 'install'}
              size="sm"
              onPress={onInstall}>
              {t('label.install')}
            </Button>
          </Box>
        </Card.Content>
      </Card>
    );
  }

  if (pack.bundled) {
    return (
      <Alert title={t('message.no-permission-for-action')} variant="warning" />
    );
  }

  return (
    <Alert
      rightContent={
        <Button
          color="secondary"
          href={pack.sourceUrl}
          iconTrailing={ArrowUpRight}
          rel="noreferrer"
          size="sm"
          target="_blank">
          {t('label.source')}
        </Button>
      }
      title={t('message.ontology-pack-external-title')}
      variant="warning">
      {t('message.ontology-pack-external-description')}
    </Alert>
  );
};

const OntologyLibraryDetail = (props: OntologyLibraryDetailProps) => {
  const { pack, selectedModuleIds, onBack, onModuleChange } = props;
  const installedResult = props.native ? undefined : props.installedResult;
  const canSelectModules = props.native
    ? props.native.canSelectModules
    : props.canInstall;
  const { t } = useTranslation();
  const totals = selectedModuleTotals(pack, selectedModuleIds);
  const moduleNames = new Map(
    pack.modules.map((module) => [module.id, module.name])
  );
  const canPreview =
    pack.bundled &&
    selectedModuleIds.length > 0 &&
    !props.native &&
    props.targetGlossaryName.trim().length > 0;

  return (
    <Box data-testid="ontology-pack-detail" direction="col" gap={5}>
      <Box align="center" gap={4} justify="between">
        <Button
          color="secondary"
          data-testid="ontology-library-back"
          iconLeading={ArrowLeft}
          isDisabled={props.native?.isBusy}
          size="sm"
          onPress={onBack}>
          {t('label.back-to-library')}
        </Button>
        {installedResult && (
          <Badge color="success" size="sm" type="pill-color">
            {t('label.installed')} · {installedResult.version}
          </Badge>
        )}
      </Box>
      <Box align="center" gap={3}>
        <OntologyPackIcon pack={pack} />
        <Box className="tw:min-w-0" direction="col" gap={1}>
          <Typography
            aria-level={3}
            role="heading"
            size="text-xl"
            weight="semibold">
            {pack.name}
          </Typography>
          <Typography color="secondary" size="text-sm">
            {pack.description}
          </Typography>
        </Box>
      </Box>
      <Box className="tw:lg:flex-row" direction="col" gap={5}>
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <Card size="md">
            <Card.Content>
              <Box direction="col" gap={4}>
                <Typography color="secondary" size="text-xs" weight="medium">
                  {t('label.graph-preview')}
                </Typography>
                <OntologyPackGraphPreview
                  pack={pack}
                  selectedModuleIds={selectedModuleIds}
                />
                <Typography color="secondary" size="text-xs">
                  {t('message.ontology-pack-preview-description')}
                </Typography>
                <Typography color="secondary" size="text-xs" weight="medium">
                  {t('label.module-plural')}
                </Typography>
                <Box direction="col" gap={2}>
                  {pack.modules.map((module) => (
                    <Card
                      color={
                        selectedModuleIds.includes(module.id)
                          ? 'brand'
                          : 'default'
                      }
                      key={module.id}
                      size="sm">
                      <Card.Content>
                        <Box align="start" gap={3} justify="between">
                          <Checkbox
                            className="tw:flex-1"
                            data-testid={`ontology-module-${module.id}`}
                            hint={
                              module.dependencies.length > 0
                                ? t(
                                    'message.ontology-pack-module-dependencies',
                                    {
                                      modules: module.dependencies
                                        .map((id) => moduleNames.get(id) ?? id)
                                        .join(', '),
                                    }
                                  )
                                : undefined
                            }
                            isDisabled={!canSelectModules || !pack.bundled}
                            isSelected={selectedModuleIds.includes(module.id)}
                            label={module.name}
                            onChange={(isSelected) =>
                              onModuleChange(module.id, isSelected)
                            }
                          />
                          <Typography
                            className="tw:shrink-0"
                            color="secondary"
                            size="text-xs">
                            {module.conceptCount}{' '}
                            {t('label.concept-plural').toLocaleLowerCase()}
                          </Typography>
                        </Box>
                      </Card.Content>
                    </Card>
                  ))}
                </Box>
                <Box align="center" gap={4} wrap="wrap">
                  <Button
                    color="link-color"
                    href={pack.sourceUrl}
                    iconTrailing={ArrowUpRight}
                    rel="noreferrer"
                    size="sm"
                    target="_blank">
                    {t('label.source')}
                  </Button>
                  <Button
                    color="link-color"
                    href={pack.licenseUrl}
                    iconTrailing={ArrowUpRight}
                    rel="noreferrer"
                    size="sm"
                    target="_blank">
                    {t('label.license')}
                  </Button>
                  <Typography color="secondary" size="text-xs">
                    {pack.license}
                  </Typography>
                  <Typography color="secondary" size="text-xs">
                    {t('label.version')} {pack.version}
                  </Typography>
                </Box>
              </Box>
            </Card.Content>
          </Card>
        </Box>
        <Box
          className="tw:min-w-0 tw:w-full tw:lg:w-80 tw:lg:shrink-0"
          direction="col">
          {props.native ? (
            props.native.installPanel
          ) : (
            <Box direction="col" gap={4}>
              <Box gap={3}>
                <Typography data-testid="ontology-pack-concept-count">
                  {totals.concepts} {t('label.concept-plural')}
                </Typography>
                <Typography data-testid="ontology-pack-relationship-count">
                  {totals.relationships} {t('label.relation-plural')}
                </Typography>
              </Box>
              <OntologyLibraryInstallPanel
                activeAction={props.activeAction}
                canInstall={props.canInstall}
                canPreview={canPreview}
                installedResult={installedResult}
                pack={pack}
                previewResult={props.previewResult}
                targetGlossaryName={props.targetGlossaryName}
                onInstall={props.onInstall}
                onOpenGlossary={props.onOpenGlossary}
                onPreview={props.onPreview}
                onTargetGlossaryChange={props.onTargetGlossaryChange}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default OntologyLibraryDetail;
