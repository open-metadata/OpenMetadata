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
  Dialog,
  FeaturedIcon,
  Modal,
  ModalOverlay,
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
  onClose?: () => void;
  onOpenGlossary?: (glossaryName: string) => void;
}

const LIBRARY_DIALOG_WIDTH = 1120;

const OntologyLibrary = ({
  canInstall = false,
  onClose,
  onOpenGlossary,
}: OntologyLibraryProps) => {
  const { t } = useTranslation();
  const [packs, setPacks] = useState<OntologyPackManifest[]>([]);
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
      <OntologyLibraryCatalogue packs={packs} onSelect={handleSelectPack} />
    );
  }

  return (
    <ModalOverlay
      isDismissable
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose?.();
        }
      }}>
      <Modal>
        <Dialog
          aria-labelledby="ontology-library-title"
          data-testid="ontology-library"
          dividers="scroll"
          width={LIBRARY_DIALOG_WIDTH}>
          <Dialog.Header>
            <Box align="center" gap={3}>
              <FeaturedIcon
                color="brand"
                icon={BookOpen01}
                size="md"
                theme="light"
              />
              <Box className="tw:min-w-0 tw:flex-1" direction="col">
                <Typography
                  aria-level={2}
                  className="tw:text-primary"
                  id="ontology-library-title"
                  role="heading"
                  size="text-md"
                  weight="semibold">
                  {sentenceCaseLibraryTitle}
                </Typography>
                <Typography className="tw:text-tertiary" size="text-sm">
                  {t('message.ontology-library-description')}
                </Typography>
              </Box>
              <ButtonUtility
                data-testid="ontology-library-close"
                icon={XClose}
                size="lg"
                tooltip={t('label.close')}
                onClick={onClose}
              />
            </Box>
          </Dialog.Header>
          <Dialog.Content className="tw:h-[80vh] tw:max-h-none tw:pb-6">
            {libraryBody}
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyLibrary;
