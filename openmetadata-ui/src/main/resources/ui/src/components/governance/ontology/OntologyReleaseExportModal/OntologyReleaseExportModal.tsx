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
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { Download01 } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyReleaseExport } from '../../../../hooks/governance/ontology/useOntologyReleaseExport';
import {
  EXPORT_FORMAT_TO_ACCEPT_HEADER,
  EXPORT_FORMAT_TO_FILE_EXTENSION,
  OntologyExportFormat,
} from '../../../../rest/rdfAPI';
import { downloadFile } from '../../../../utils/Export/ExportUtils';
import OntologyNativeImportPanel from './OntologyNativeImportPanel';
import OntologyReleaseExportContent, {
  OntologyReleaseExportContentState,
} from './OntologyReleaseExportContent';

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
  const [format, setFormat] = useState<OntologyExportFormat>('rdfxml');
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const {
    content,
    isActiveReleaseLoading,
    isError,
    isPreviewLoading,
    release,
    retry,
  } = useOntologyReleaseExport(ontology.id, format);
  let contentState: OntologyReleaseExportContentState;
  if (isActiveReleaseLoading) {
    contentState = { kind: 'loading' };
  } else if (isError) {
    contentState = { kind: 'error', onRetry: retry };
  } else if (!release) {
    contentState = { kind: 'empty' };
  } else {
    contentState = {
      content,
      isPreviewLoading,
      kind: 'ready',
      release,
    };
  }

  const handleExport = () => {
    if (!release || !content) {
      return;
    }
    const safeName = ontology.name.replaceAll(/[^a-zA-Z0-9-_]/g, '_');
    downloadFile(
      content,
      `${safeName}-release-${release.releaseRevision}.${EXPORT_FORMAT_TO_FILE_EXTENSION[format]}`,
      EXPORT_FORMAT_TO_ACCEPT_HEADER[format]
    );
    onClose();
  };

  return (
    <ModalOverlay
      isDismissable
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog
          showCloseButton
          dividers="scroll"
          title={t('label.import-export-ontology')}
          width={820}
          onClose={onClose}>
          <Dialog.Content>
            <Box className="tw:mb-4" gap={2}>
              <Button
                aria-pressed={activeTab === 'export'}
                color="tertiary"
                data-testid="ontology-native-export-tab"
                onPress={() => setActiveTab('export')}>
                {t('label.export')}
              </Button>
              <Button
                aria-pressed={activeTab === 'import'}
                color="tertiary"
                data-testid="ontology-native-import-tab"
                onPress={() => setActiveTab('import')}>
                {t('label.import')}
              </Button>
            </Box>
            {activeTab === 'export' ? (
              <OntologyReleaseExportContent
                format={format}
                ontology={ontology}
                state={contentState}
                onFormatChange={setFormat}
              />
            ) : (
              <OntologyNativeImportPanel
                canImport={canImport}
                ontology={ontology}
                onApplied={() => {
                  onApplied?.();
                  onClose();
                }}
              />
            )}
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" onPress={onClose}>
              {t('label.cancel')}
            </Button>
            {activeTab === 'export' && (
              <Button
                color="primary"
                data-testid="ontology-run-release-export"
                iconLeading={Download01}
                isDisabled={!content || isError}
                isLoading={isPreviewLoading}
                onPress={handleExport}>
                {t('label.export')}
              </Button>
            )}
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyReleaseExportModal;
