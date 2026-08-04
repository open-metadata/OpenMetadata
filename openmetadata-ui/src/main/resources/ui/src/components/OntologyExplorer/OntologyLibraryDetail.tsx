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
  Button,
  Card,
  Checkbox,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowLeft, ArrowRight, ArrowUpRight } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { OntologyPackInstallResult } from '../../generated/api/data/ontologyPackInstallResult';
import { OntologyPackManifest } from '../../generated/api/data/ontologyPackManifest';
import { selectedModuleTotals } from './OntologyLibrary.utils';

export type OntologyLibraryAction = 'dry-run' | 'install';

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
  const canPreview =
    pack.bundled &&
    selectedModuleIds.length > 0 &&
    targetGlossaryName.trim().length > 0;

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-6"
      data-testid="ontology-pack-detail">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-4">
        <Button
          color="tertiary"
          data-testid="ontology-library-back"
          iconLeading={ArrowLeft}
          size="sm"
          onPress={onBack}>
          {t('label.back')}
        </Button>
        {installedResult || installedVersion ? (
          <Badge color="success" size="sm" type="pill-color">
            {t('label.installed')} ·{' '}
            {installedResult?.version ?? installedVersion}
          </Badge>
        ) : null}
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-6">
          <Card size="lg">
            <Card.Content className="tw:flex tw:flex-col tw:gap-4">
              <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
                <Badge color="brand" size="lg" type="color">
                  {pack.abbreviation}
                </Badge>
                <Badge color="gray" size="sm" type="pill-color">
                  {pack.standard}
                </Badge>
              </div>
              <div className="tw:flex tw:flex-col tw:gap-1">
                <Typography as="h2" size="display-xs" weight="semibold">
                  {pack.name}
                </Typography>
                <Typography as="p" className="tw:text-tertiary" size="text-sm">
                  {pack.description}
                </Typography>
              </div>
              <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-4">
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
                <Typography
                  as="span"
                  className="tw:text-tertiary"
                  size="text-xs">
                  {t('label.version')} {pack.version}
                </Typography>
              </div>
            </Card.Content>
          </Card>

          <Card size="lg">
            <Card.Header
              subtitle={t('message.ontology-pack-preview-description')}
              title={t('label.graph-preview')}
            />
            <Card.Content>
              <div
                aria-label={t('message.ontology-pack-graph-preview', {
                  pack: pack.name,
                })}
                className="tw:flex tw:min-h-56 tw:flex-col tw:items-center tw:justify-center tw:gap-6 tw:rounded-xl tw:bg-secondary tw:p-6"
                data-testid="ontology-pack-graph-preview"
                role="img">
                <div className="tw:grid tw:size-20 tw:place-items-center tw:rounded-full tw:bg-brand-solid tw:text-center tw:text-sm tw:font-semibold tw:text-white tw:shadow-lg">
                  {pack.abbreviation}
                </div>
                <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-3">
                  {pack.modules.map((module) => (
                    <span
                      className={
                        selectedModuleIds.includes(module.id)
                          ? 'tw:rounded-full tw:bg-brand-primary tw:px-3 tw:py-1.5 tw:text-xs tw:font-medium tw:text-brand-secondary'
                          : 'tw:rounded-full tw:bg-primary tw:px-3 tw:py-1.5 tw:text-xs tw:font-medium tw:text-disabled tw:outline-1 tw:-outline-offset-1 tw:outline-disabled'
                      }
                      key={module.id}>
                      {module.name}
                    </span>
                  ))}
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>

        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-6">
          <Card size="lg">
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
              {pack.modules.map((module) => (
                <Checkbox
                  data-testid={`ontology-module-${module.id}`}
                  hint={
                    module.dependencies.length > 0
                      ? t('message.ontology-pack-module-dependencies', {
                          modules: module.dependencies.join(', '),
                        })
                      : module.description
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
              <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:border-t tw:border-secondary tw:pt-4">
                <div className="tw:rounded-lg tw:bg-secondary tw:p-3">
                  <Typography
                    as="p"
                    className="tw:text-tertiary"
                    size="text-xs">
                    {t('label.concept-plural')}
                  </Typography>
                  <Typography
                    as="p"
                    data-testid="ontology-pack-concept-count"
                    size="text-lg"
                    weight="semibold">
                    {totals.concepts}
                  </Typography>
                </div>
                <div className="tw:rounded-lg tw:bg-secondary tw:p-3">
                  <Typography
                    as="p"
                    className="tw:text-tertiary"
                    size="text-xs">
                    {t('label.relation-plural')}
                  </Typography>
                  <Typography
                    as="p"
                    data-testid="ontology-pack-relationship-count"
                    size="text-lg"
                    weight="semibold">
                    {totals.relationships}
                  </Typography>
                </div>
              </div>
            </Card.Content>
          </Card>

          {pack.bundled && canInstall ? (
            <Card size="lg">
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

                <div className="tw:flex tw:justify-end tw:gap-3">
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
                </div>
              </Card.Content>
            </Card>
          ) : pack.bundled ? (
            <Alert
              title={t('message.no-permission-for-action')}
              variant="warning"
            />
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default OntologyLibraryDetail;
