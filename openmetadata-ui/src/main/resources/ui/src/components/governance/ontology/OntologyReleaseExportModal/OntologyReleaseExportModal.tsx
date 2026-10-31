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
  Box,
  Button,
  CloseButton,
  Dialog,
  FeaturedIcon,
  Modal,
  ModalOverlay,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Download01,
  SwitchVertical01,
} from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { Heading } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyReleaseExport } from '../../../../hooks/governance/ontology/useOntologyReleaseExport';
import { useOntologyReleaseShacl } from '../../../../hooks/governance/ontology/useOntologyReleaseShacl';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  NATIVE_EXPORT_EXTENSIONS,
  NATIVE_EXPORT_MEDIA_TYPES,
  ONTOLOGY_RELEASE_EXPORT_DEFAULTS,
} from '../../../../rest/ontologyExport.constants';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { downloadFile } from '../../../../utils/Export/ExportUtils';
import OntologyNativeImportPanel from './OntologyNativeImportPanel';
import OntologyReleaseExportContent from './OntologyReleaseExportContent';
import {
  resolveExportFormat,
  resolvePreviewFormat,
} from './OntologyReleaseExportModal.constants';
import { OntologyReleaseExportSelection } from './OntologyReleaseExportModal.types';
import {
  resolveContentOptions,
  resolveContentState,
} from './OntologyReleaseExportModal.utils';

interface OntologyReleaseExportModalProps {
  readonly ontology: Ontology;
  readonly onClose: () => void;
  readonly canImport?: boolean;
  readonly onApplied?: () => void;
}

const OntologyReleaseExportModal = ({
  ontology,
  onClose,
  canImport = false,
  onApplied,
}: OntologyReleaseExportModalProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const [isImportBusy, setIsImportBusy] = useState(false);
  const [selection, setSelection] = useState<OntologyReleaseExportSelection>({
    card: 'rdfxml',
    options: ONTOLOGY_RELEASE_EXPORT_DEFAULTS,
    skosXl: false,
  });
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const format = resolveExportFormat(selection.card, selection.skosXl);
  const contentOptions = resolveContentOptions(selection);
  const {
    content,
    isActiveReleaseLoading,
    isError,
    isPreviewLoading,
    release,
    retry,
  } = useOntologyReleaseExport(
    ontology.id,
    resolvePreviewFormat(format),
    contentOptions
  );
  const shacl = useOntologyReleaseShacl(release?.id);
  const isGateBlocking =
    selection.options.shaclGate && shacl.report?.valid === false;
  const contentState = resolveContentState({
    content,
    isActiveReleaseLoading,
    isError,
    isPreviewLoading,
    release,
    retry,
  });

  const handleClose = () => {
    if (!isImportBusy) {
      onClose();
    }
  };

  const handleExport = () => {
    if (isImportBusy || !release || isGateBlocking) {
      return;
    }
    const safeName = ontology.name.replaceAll(/[^a-zA-Z0-9-_]/g, '_');
    shacl.download(
      {
        format,
        options: { ...contentOptions, shaclGate: selection.options.shaclGate },
      },
      {
        onSuccess: (file) => {
          if (file === undefined) {
            return;
          }
          downloadFile(
            file,
            `${safeName}-release-${release.releaseRevision}.${NATIVE_EXPORT_EXTENSIONS[format]}`,
            NATIVE_EXPORT_MEDIA_TYPES[format]
          );
          handleClose();
        },
      }
    );
  };

  const tabList = (
    <Tabs.List
      aria-label={t('label.import-export')}
      size="sm"
      type="button-border">
      <Tabs.Item
        data-testid="ontology-native-export-tab"
        id="export"
        isDisabled={isImportBusy}
        label={t('label.export')}
      />
      <Tabs.Item
        data-testid="ontology-native-import-tab"
        id="import"
        isDisabled={isImportBusy}
        label={t('label.import')}
      />
    </Tabs.List>
  );

  const closeButton = (
    <CloseButton
      className="tw:ml-auto tw:shrink-0"
      isDisabled={isImportBusy}
      label={t('label.close')}
      onPress={handleClose}
    />
  );

  const renderExportButton = (className?: string) => (
    <Button
      className={className}
      color="primary"
      data-testid="ontology-run-release-export"
      iconLeading={Download01}
      isDisabled={isImportBusy || !content || isError || isGateBlocking}
      isLoading={isPreviewLoading || shacl.isDownloading}
      onPress={handleExport}>
      {t('label.export')}
    </Button>
  );

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isImportBusy}
      isKeyboardDismissDisabled={isImportBusy}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      }}>
      <Modal>
        <Dialog dividers="scroll" width={820} onClose={handleClose}>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => {
              if (!isImportBusy && (key === 'export' || key === 'import')) {
                setActiveTab(key);
              }
            }}>
            {isAiMode ? (
              <Dialog.Header className="tw:flex tw:flex-wrap tw:items-center tw:gap-4">
                <FeaturedIcon
                  color="brand"
                  icon={SwitchVertical01}
                  radius="lg"
                  shape="square"
                  size="md"
                  theme="light"
                />
                <Box className="tw:min-w-0 tw:flex-1" direction="col">
                  <Heading
                    className="tw:m-0 tw:text-md tw:font-semibold tw:text-primary"
                    slot="title">
                    {t('label.import-export-ontology')}
                  </Heading>
                  <Typography
                    className="tw:break-words"
                    color="secondary"
                    size="text-sm">
                    {release
                      ? `${getEntityName(ontology)} · ${t(
                          'label.active'
                        )}: ${getEntityName(release)}`
                      : getEntityName(ontology)}
                  </Typography>
                </Box>
                {tabList}
                {closeButton}
              </Dialog.Header>
            ) : (
              <Dialog.Header
                className="tw:flex tw:flex-wrap tw:items-center tw:gap-3"
                title={t('label.import-export-ontology')}>
                <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
                  <Typography className="tw:break-words" size="text-sm">
                    {getEntityName(ontology)}
                  </Typography>
                  {release && (
                    <Typography
                      className="tw:break-words"
                      color="secondary"
                      size="text-xs">
                      {`${t('label.active')}: ${getEntityName(release)}`}
                    </Typography>
                  )}
                </Box>
                {tabList}
                {closeButton}
              </Dialog.Header>
            )}
            <Dialog.Content>
              <Tabs.Panel id="export">
                <OntologyReleaseExportContent
                  isShaclRunning={shacl.isRunning}
                  selection={selection}
                  shaclReport={shacl.report}
                  state={contentState}
                  onRunShacl={shacl.run}
                  onSelectionChange={setSelection}
                />
              </Tabs.Panel>
              <Tabs.Panel id="import">
                <OntologyNativeImportPanel
                  canImport={canImport}
                  ontology={ontology}
                  onApplied={() => {
                    onApplied?.();
                    onClose();
                  }}
                  onBusyChange={setIsImportBusy}
                />
              </Tabs.Panel>
            </Dialog.Content>
            {isAiMode ? (
              <Dialog.Footer>
                <Button
                  color="secondary"
                  data-testid="ontology-release-export-cancel"
                  isDisabled={isImportBusy}
                  onPress={handleClose}>
                  {t('label.cancel')}
                </Button>
                {activeTab === 'export' && renderExportButton()}
              </Dialog.Footer>
            ) : (
              <Dialog.Footer>
                {activeTab === 'export' && renderExportButton('tw:mr-auto')}
              </Dialog.Footer>
            )}
          </Tabs>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyReleaseExportModal;
