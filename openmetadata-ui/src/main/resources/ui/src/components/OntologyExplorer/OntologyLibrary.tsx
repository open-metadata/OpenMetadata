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
  ButtonUtility,
  Card,
  PageHeader,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  BookOpen01,
  RefreshCcw01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useCallback, useEffect, useState } from 'react';
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

interface OntologyLibraryProps {
  canInstall?: boolean;
  installedPacks?: OntologyPackInstallation[];
  onClose?: () => void;
  onOpenGlossary?: (glossaryName: string) => void;
}

const EMPTY_INSTALLATIONS: OntologyPackInstallation[] = [];

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

  let libraryBody: JSX.Element;
  if (isLoading) {
    libraryBody = (
      <Card data-testid="ontology-library-loading" size="lg">
        <Card.Content>
          <Typography as="p" className="tw:text-tertiary" size="text-sm">
            {t('label.loading')}
          </Typography>
        </Card.Content>
      </Card>
    );
  } else if (hasLoadError) {
    libraryBody = (
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
    );
  } else if (selectedPack) {
    libraryBody = (
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
    );
  } else {
    libraryBody = (
      <OntologyLibraryCatalogue
        installations={installations}
        packs={packs}
        onSelect={handleSelectPack}
      />
    );
  }

  return (
    <section
      aria-labelledby="ontology-library-title"
      className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:bg-tertiary tw:font-body tw:antialiased"
      data-testid="ontology-library">
      <PageHeader
        actions={
          <>
            <Badge
              color="success"
              data-testid="ontology-library-installed-count"
              size="sm"
              type="pill-color">
              {`${installedCount} ${t('label.installed-lowercase')}`}
            </Badge>
            <ButtonUtility
              aria-label={t('label.close')}
              color="tertiary"
              data-testid="ontology-library-close"
              icon={XClose}
              size="sm"
              onClick={onClose}
            />
          </>
        }
        className="tw:shrink-0 tw:rounded-none! tw:border-x-0! tw:border-t-0!"
        density="compact"
        icon={BookOpen01}
        subtitle={t('message.ontology-library-description')}
        title={
          <Typography
            ellipsis
            as="h3"
            className="tw:min-w-0"
            id="ontology-library-title"
            size="text-xl"
            weight="semibold">
            {sentenceCaseLibraryTitle}
          </Typography>
        }
      />

      <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-6">
        <div className="tw:mx-auto tw:max-w-[1040px]">{libraryBody}</div>
      </div>
    </section>
  );
};

export default OntologyLibrary;
