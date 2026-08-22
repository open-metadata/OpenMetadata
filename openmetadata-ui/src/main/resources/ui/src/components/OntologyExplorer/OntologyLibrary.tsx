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
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { BookOpen01, RefreshCcw01, XClose } from '@untitledui/icons';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { InstallOntologyPack } from '../../generated/api/data/installOntologyPack';
import { OntologyPackInstallResult } from '../../generated/api/data/ontologyPackInstallResult';
import { OntologyPackManifest } from '../../generated/api/data/ontologyPackManifest';
import { OntologyPackInstallation } from '../../generated/type/ontologyPackInstallation';
import { installOntologyPack, listOntologyPacks } from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  defaultModuleIds,
  updateModuleSelection,
} from './OntologyLibrary.utils';
import OntologyLibraryCatalogue from './OntologyLibraryCatalogue';
import OntologyLibraryDetail, {
  OntologyLibraryAction,
} from './OntologyLibraryDetail';
import { ONTOLOGY_STUDIO_STYLE } from './OntologyStudio.styles';

interface OntologyLibraryProps {
  canInstall?: boolean;
  installedPacks?: OntologyPackInstallation[];
  onClose?: () => void;
  onOpenGlossary?: (glossaryName: string) => void;
}

const EMPTY_INSTALLATIONS: OntologyPackInstallation[] = [];
const LIBRARY_ICON_CLASS =
  'tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:rounded-[9px] ' +
  'tw:bg-[linear-gradient(160deg,var(--color-utility-blue-light-500),var(--color-bg-brand-solid))] tw:text-white';
const INSTALLED_COUNT_CLASS =
  'tw:inline-flex tw:shrink-0 tw:items-center tw:rounded-full tw:border ' +
  'tw:border-utility-success-200 tw:bg-utility-success-50 tw:px-[11px] tw:py-1 ' +
  'tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-utility-success-700';

const OntologyLibrary = ({
  canInstall = false,
  installedPacks,
  onClose,
  onOpenGlossary,
}: OntologyLibraryProps) => {
  const { t } = useTranslation();
  const [packs, setPacks] = useState<OntologyPackManifest[]>([]);
  const [installations, setInstallations] = useState<
    OntologyPackInstallation[]
  >(installedPacks ?? EMPTY_INSTALLATIONS);
  const [selectedPack, setSelectedPack] = useState<OntologyPackManifest>();
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [targetGlossaryName, setTargetGlossaryName] = useState('');
  const [previewResult, setPreviewResult] =
    useState<OntologyPackInstallResult>();
  const [installedResult, setInstalledResult] =
    useState<OntologyPackInstallResult>();
  const [activeAction, setActiveAction] = useState<OntologyLibraryAction>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  const loadPacks = useCallback(async () => {
    setIsLoading(true);
    setHasLoadError(false);

    try {
      const catalogue = await listOntologyPacks();
      setPacks(catalogue.packs);
    } catch (error) {
      setHasLoadError(true);
      showErrorToast(
        error instanceof Error ? error.message : t('server.unexpected-error')
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPacks();
  }, [loadPacks]);

  useEffect(() => {
    setInstallations(installedPacks ?? EMPTY_INSTALLATIONS);
  }, [installedPacks]);

  useEffect(() => {
    if (!onClose) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const clearImportResults = useCallback(() => {
    setPreviewResult(undefined);
    setInstalledResult(undefined);
  }, []);

  const handleSelectPack = useCallback((pack: OntologyPackManifest) => {
    setSelectedPack(pack);
    setSelectedModuleIds(defaultModuleIds(pack));
    setTargetGlossaryName('');
    setPreviewResult(undefined);
    setInstalledResult(undefined);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedPack(undefined);
    setSelectedModuleIds([]);
    setTargetGlossaryName('');
    setPreviewResult(undefined);
    setInstalledResult(undefined);
  }, []);

  const handleModuleChange = useCallback(
    (moduleId: string, isSelected: boolean) => {
      if (canInstall && selectedPack) {
        setSelectedModuleIds((currentIds) =>
          updateModuleSelection(selectedPack, currentIds, moduleId, isSelected)
        );
        clearImportResults();
      }
    },
    [clearImportResults, selectedPack]
  );

  const handleTargetGlossaryChange = useCallback(
    (name: string) => {
      setTargetGlossaryName(name);
      clearImportResults();
    },
    [clearImportResults]
  );

  const executeInstall = useCallback(
    async (dryRun: boolean) => {
      if (canInstall && selectedPack) {
        const action: OntologyLibraryAction = dryRun ? 'dry-run' : 'install';
        const request: InstallOntologyPack = {
          dryRun,
          moduleIds: selectedModuleIds,
          targetGlossaryName: targetGlossaryName.trim(),
        };
        setActiveAction(action);

        try {
          const result = await installOntologyPack(selectedPack.id, request);
          if (dryRun) {
            setPreviewResult(result);
            setInstalledResult(undefined);
          } else {
            setInstalledResult(result);
            const installation = result.installation;
            if (installation) {
              setInstallations((current) => [
                ...current.filter(
                  (currentInstallation) =>
                    currentInstallation.packId !== installation.packId
                ),
                installation,
              ]);
            }
            showSuccessToast(t('message.ontology-pack-installed-success'));
          }
        } catch (error) {
          showErrorToast(
            error instanceof Error
              ? error.message
              : t('server.unexpected-error')
          );
        } finally {
          setActiveAction(undefined);
        }
      }
    },
    [canInstall, selectedModuleIds, selectedPack, t, targetGlossaryName]
  );

  const handleOpenGlossary = useCallback(() => {
    if (installedResult) {
      onOpenGlossary?.(installedResult.targetGlossaryName);
    }
  }, [installedResult, onOpenGlossary]);

  const libraryTitle = t('label.ontology-library');
  const sentenceCaseLibraryTitle = `${libraryTitle.charAt(0)}${libraryTitle
    .slice(1)
    .toLocaleLowerCase()}`;
  const installedCount = new Set(
    installations.map((installation) => installation.packId)
  ).size;

  return createPortal(
    <div
      aria-labelledby="ontology-library-title"
      aria-modal="true"
      className="tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-10000 tw:flex tw:min-h-0 tw:flex-col tw:bg-tertiary tw:font-body tw:antialiased"
      data-testid="ontology-library"
      role="dialog"
      style={{ ...ONTOLOGY_STUDIO_STYLE, top: 'var(--ant-navbar-height)' }}>
      <header className="tw:flex tw:h-16 tw:shrink-0 tw:items-center tw:gap-[13px] tw:border-b tw:border-secondary tw:bg-primary tw:px-6">
        <span className={LIBRARY_ICON_CLASS}>
          <BookOpen01 aria-hidden="true" className="tw:size-[18px]" />
        </span>
        <div className="tw:min-w-0 tw:flex-1">
          <h1
            className="tw:m-0 tw:font-body tw:text-[15px] tw:leading-normal tw:font-bold tw:text-primary"
            id="ontology-library-title">
            {sentenceCaseLibraryTitle}
          </h1>
          <p className="tw:m-0 tw:font-body tw:text-xs tw:leading-normal tw:font-normal tw:text-quaternary">
            {t('message.ontology-library-description')}
          </p>
        </div>
        <span
          className={INSTALLED_COUNT_CLASS}
          data-testid="ontology-library-installed-count">
          {installedCount} {t('label.installed-lowercase')}
        </span>
        <Button
          aria-label={t('label.close')}
          className="tw:size-8! tw:rounded-lg! tw:border tw:border-secondary tw:p-0! tw:shadow-none! tw:before:hidden tw:after:outline-0!"
          color="secondary"
          data-testid="ontology-library-close"
          iconLeading={
            <XClose className="tw:size-[17px] tw:text-fg-quaternary_hover" />
          }
          size="xs"
          onPress={onClose}
        />
      </header>

      <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-6">
        <div className="tw:mx-auto tw:max-w-[1040px]">
          {isLoading ? (
            <Card data-testid="ontology-library-loading" size="lg">
              <Card.Content>
                <Typography as="p" className="tw:text-tertiary" size="text-sm">
                  {t('label.loading')}
                </Typography>
              </Card.Content>
            </Card>
          ) : hasLoadError ? (
            <Alert
              rightContent={
                <Button
                  color="secondary"
                  iconLeading={RefreshCcw01}
                  size="sm"
                  onPress={() => void loadPacks()}>
                  {t('label.retry')}
                </Button>
              }
              title={t('message.ontology-library-load-error')}
              variant="error"
            />
          ) : selectedPack ? (
            <OntologyLibraryDetail
              activeAction={activeAction}
              canInstall={canInstall}
              installedResult={installedResult}
              installedVersion={
                installations.find(
                  (installation) => installation.packId === selectedPack.id
                )?.version
              }
              pack={selectedPack}
              previewResult={previewResult}
              selectedModuleIds={selectedModuleIds}
              targetGlossaryName={targetGlossaryName}
              onBack={handleBack}
              onInstall={() => void executeInstall(false)}
              onModuleChange={handleModuleChange}
              onOpenGlossary={handleOpenGlossary}
              onPreview={() => void executeInstall(true)}
              onTargetGlossaryChange={handleTargetGlossaryChange}
            />
          ) : (
            <OntologyLibraryCatalogue
              installations={installations}
              packs={packs}
              onSelect={handleSelectPack}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OntologyLibrary;
