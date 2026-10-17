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
  Grid,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { OntologyPackInstallResult } from '../../generated/api/data/ontologyPackInstallResult';
import { OntologyPackManifest } from '../../generated/api/data/ontologyPackManifest';
import { selectedModuleTotals } from './OntologyLibrary.utils';
import { OntologyPackIcon } from './OntologyLibraryCatalogue';

export type OntologyLibraryAction = 'dry-run' | 'install';

const MAIN_COLUMN_SPAN = 14;
const SIDE_COLUMN_SPAN = 10;
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
    <Card
      aria-label={t('message.ontology-pack-graph-preview', { pack: pack.name })}
      className="tw:relative tw:h-80"
      data-testid="ontology-pack-graph-preview"
      role="img"
      variant="muted">
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
      <Box
        align="center"
        className="tw:absolute tw:top-1/2 tw:left-1/2 tw:size-24 tw:-translate-1/2 tw:rounded-full tw:border-4 tw:border-utility-brand-200 tw:bg-brand-solid"
        justify="center">
        <Typography
          className="tw:text-primary_on-brand"
          size="text-md"
          weight="semibold">
          {pack.abbreviation}
        </Typography>
      </Box>
      {nodes.map(({ module, isSelected, x, y }) => (
        // Backed by the card surface so the translucent dark-mode tint hides the edge.
        <Box
          className="tw:absolute tw:-translate-1/2 tw:rounded-full tw:bg-primary_alt"
          key={module.id}
          style={{ left: `${x}%`, top: `${y}%` }}>
          <Badge
            color={isSelected ? 'brand' : 'gray'}
            size="md"
            type="pill-color">
            {module.name}
          </Badge>
        </Box>
      ))}
    </Card>
  );
};

interface OntologyLibraryDetailProps {
  activeAction?: OntologyLibraryAction;
  canInstall: boolean;
  installedResult?: OntologyPackInstallResult;
  installedVersion?: string;
  pack: OntologyPackManifest;
  previewResult?: OntologyPackInstallResult;
  selectedModuleIds: string[];
  targetGlossaryName: string;
  onBack: () => void;
  onInstall: () => void;
  onModuleChange: (moduleId: string, isSelected: boolean) => void;
  onOpenGlossary: () => void;
  onPreview: () => void;
  onTargetGlossaryChange: (name: string) => void;
}

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

const OntologyLibraryDetail = ({
  activeAction,
  canInstall,
  installedResult,
  installedVersion,
  pack,
  previewResult,
  selectedModuleIds,
  targetGlossaryName,
  onBack,
  onInstall,
  onModuleChange,
  onOpenGlossary,
  onPreview,
  onTargetGlossaryChange,
}: OntologyLibraryDetailProps) => {
  const { t } = useTranslation();
  const totals = selectedModuleTotals(pack, selectedModuleIds);
  const moduleNames = new Map(
    pack.modules.map((module) => [module.id, module.name])
  );
  const canPreview =
    pack.bundled &&
    selectedModuleIds.length > 0 &&
    targetGlossaryName.trim().length > 0;

  return (
    <Box data-testid="ontology-pack-detail" direction="col" gap={5}>
      <Box align="center" gap={4} justify="between">
        <Button
          color="link-gray"
          data-testid="ontology-library-back"
          iconLeading={ArrowLeft}
          size="sm"
          onPress={onBack}>
          {t('label.back-to-library')}
        </Button>
        {installedResult || installedVersion ? (
          <Badge color="success" size="sm" type="pill-color">
            {t('label.installed')} ·{' '}
            {installedResult?.version ?? installedVersion}
          </Badge>
        ) : null}
      </Box>

      <Grid gap="5">
        <Grid.Item span={MAIN_COLUMN_SPAN}>
          <Box direction="col" gap={5}>
            <Card size="md">
              <Card.Content className="tw:flex tw:flex-col tw:gap-3">
                <Box gap={2} wrap="wrap">
                  <Badge color="gray" size="sm" type="pill-color">
                    {pack.abbreviation}
                  </Badge>
                  <Badge color="gray" size="sm" type="pill-color">
                    {pack.standard}
                  </Badge>
                </Box>
                <Box gap={3}>
                  <OntologyPackIcon pack={pack} />
                  <Box className="tw:min-w-0" direction="col" gap={1}>
                    <Typography
                      aria-level={3}
                      className="tw:text-primary"
                      role="heading"
                      size="text-lg"
                      weight="semibold">
                      {pack.name}
                    </Typography>
                    <Typography className="tw:text-tertiary" size="text-sm">
                      {pack.description}
                    </Typography>
                  </Box>
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
                    {t('label.license')}: {pack.license}
                  </Button>
                  <Typography className="tw:text-tertiary" size="text-sm">
                    {t('label.version')} {pack.version}
                  </Typography>
                </Box>
              </Card.Content>
            </Card>

            <Card size="md">
              <Card.Header
                subtitle={t('message.ontology-pack-preview-description')}
                title={t('label.graph-preview')}
              />
              <Card.Content>
                <OntologyPackGraphPreview
                  pack={pack}
                  selectedModuleIds={selectedModuleIds}
                />
              </Card.Content>
            </Card>
          </Box>
        </Grid.Item>

        <Grid.Item span={SIDE_COLUMN_SPAN}>
          <Box direction="col" gap={5}>
            <Card size="md">
              <Card.Header
                extra={
                  <Badge color="brand" size="sm" type="pill-color">
                    {selectedModuleIds.length} {t('label.selected-lowercase')}
                  </Badge>
                }
                subtitle={t('message.ontology-pack-module-description')}
                title={t('label.module-plural')}
              />
              <Card.Content className="tw:flex tw:flex-col tw:gap-4">
                <Box
                  className="tw:divide-y tw:divide-secondary"
                  direction="col">
                  {pack.modules.map((module) => (
                    <Checkbox
                      className="tw:py-3"
                      data-testid={`ontology-module-${module.id}`}
                      hint={
                        <>
                          {module.description}
                          {module.dependencies.length > 0 ? (
                            <Typography
                              className="tw:block tw:text-quaternary"
                              size="text-sm">
                              {t('message.ontology-pack-module-dependencies', {
                                modules: module.dependencies
                                  .map((id) => moduleNames.get(id) ?? id)
                                  .join(', '),
                              })}
                            </Typography>
                          ) : null}
                        </>
                      }
                      isDisabled={!canInstall || !pack.bundled}
                      isSelected={selectedModuleIds.includes(module.id)}
                      key={module.id}
                      label={module.name}
                      onChange={(isSelected) =>
                        onModuleChange(module.id, isSelected)
                      }
                    />
                  ))}
                </Box>
                <Grid gap="3">
                  <Grid.Item span={12}>
                    <Card size="sm" variant="muted">
                      <Card.Content className="tw:py-3">
                        <Typography className="tw:text-tertiary" size="text-xs">
                          {t('label.concept-plural')}
                        </Typography>
                        <Typography
                          className="tw:block"
                          data-testid="ontology-pack-concept-count"
                          size="text-lg"
                          weight="semibold">
                          {totals.concepts}
                        </Typography>
                      </Card.Content>
                    </Card>
                  </Grid.Item>
                  <Grid.Item span={12}>
                    <Card size="sm" variant="muted">
                      <Card.Content className="tw:py-3">
                        <Typography className="tw:text-tertiary" size="text-xs">
                          {t('label.relation-plural')}
                        </Typography>
                        <Typography
                          className="tw:block"
                          data-testid="ontology-pack-relationship-count"
                          size="text-lg"
                          weight="semibold">
                          {totals.relationships}
                        </Typography>
                      </Card.Content>
                    </Card>
                  </Grid.Item>
                </Grid>
              </Card.Content>
            </Card>

            <OntologyLibraryInstallPanel
              activeAction={activeAction}
              canInstall={canInstall}
              canPreview={canPreview}
              installedResult={installedResult}
              pack={pack}
              previewResult={previewResult}
              targetGlossaryName={targetGlossaryName}
              onInstall={onInstall}
              onOpenGlossary={onOpenGlossary}
              onPreview={onPreview}
              onTargetGlossaryChange={onTargetGlossaryChange}
            />
          </Box>
        </Grid.Item>
      </Grid>
    </Box>
  );
};

export default OntologyLibraryDetail;
