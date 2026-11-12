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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Download01 } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyReleaseExport } from '../../../../hooks/governance/ontology/useOntologyReleaseExport';
import { useOntologyReleaseShacl } from '../../../../hooks/governance/ontology/useOntologyReleaseShacl';
import {
  NATIVE_EXPORT_EXTENSIONS,
  NATIVE_EXPORT_MEDIA_TYPES,
  ONTOLOGY_RELEASE_EXPORT_DEFAULTS,
} from '../../../../rest/ontologyExport.constants';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { downloadFile } from '../../../../utils/Export/ExportUtils';
import OntologyReleaseExportContent from './OntologyReleaseExportContent';
import { resolveExportFormat } from './OntologyReleaseExportModal.constants';
import { OntologyReleaseExportSelection } from './OntologyReleaseExportModal.types';
import {
  resolveContentOptions,
  resolveContentState,
  resolveExportFileName,
  resolveScopeOptions,
} from './OntologyReleaseExportModal.utils';
import OntologyTransferDialogHeader from './OntologyTransferDialogHeader';

interface OntologyReleaseExportModalProps {
  readonly ontology: Ontology;
  readonly onClose: () => void;
}

const OntologyReleaseExportModal = ({
  ontology,
  onClose,
}: OntologyReleaseExportModalProps) => {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<OntologyReleaseExportSelection>({
    card: 'rdfxml',
    options: ONTOLOGY_RELEASE_EXPORT_DEFAULTS,
    skosXl: false,
  });
  const [scopeChoice, setScopeChoice] = useState<string>();
  const format = resolveExportFormat(selection.card, selection.skosXl);
  const contentOptions = resolveContentOptions(selection);
  const {
    activeRelease,
    content,
    error,
    isDraft,
    isError,
    isPreviewLoading,
    isScopesLoading,
    release,
    releases,
    retry,
    scopeKey,
  } = useOntologyReleaseExport(
    ontology.id,
    format,
    contentOptions,
    scopeChoice
  );
  const shacl = useOntologyReleaseShacl(release?.id);
  const isGateBlocking =
    selection.options.shaclGate && shacl.report?.valid === false;
  const contentState = resolveContentState({
    content,
    error,
    isError,
    isPreviewLoading,
    isScopesLoading,
    retry,
  });
  const scopes = resolveScopeOptions(releases, activeRelease?.id, {
    active: t('label.active'),
    draft: t('label.current-draft'),
    draftHint: t('message.ontology-export-draft-hint'),
    releaseHint: t('message.ontology-export-release-hint'),
    releaseName: (candidate) =>
      candidate.semanticVersion
        ? `${getEntityName(candidate)} · v${candidate.semanticVersion}`
        : getEntityName(candidate),
  });
  const fileName = resolveExportFileName(
    getEntityName(ontology),
    NATIVE_EXPORT_EXTENSIONS[format],
    isDraft ? undefined : release,
    activeRelease?.id
  );

  const handleExport = () => {
    if (!content || isGateBlocking) {
      return;
    }
    if (isDraft || !release) {
      downloadFile(content, fileName, NATIVE_EXPORT_MEDIA_TYPES[format]);
      onClose();

      return;
    }
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
          downloadFile(file, fileName, NATIVE_EXPORT_MEDIA_TYPES[format]);
          onClose();
        },
      }
    );
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
          data-testid="ontology-release-export-dialog"
          dividers="scroll"
          width={680}
          onClose={onClose}>
          <OntologyTransferDialogHeader
            icon={Download01}
            subtitle={getEntityName(ontology)}
            title={t('label.export-ontology-title')}
            onClose={onClose}
          />
          <Dialog.Content>
            <OntologyReleaseExportContent
              activeRelease={activeRelease}
              isDraft={isDraft}
              isShaclRunning={shacl.isRunning}
              scopeKey={scopeKey}
              scopes={scopes}
              selection={selection}
              shaclReport={shacl.report}
              state={contentState}
              onRunShacl={shacl.run}
              onScopeChange={setScopeChoice}
              onSelectionChange={setSelection}
            />
          </Dialog.Content>
          <Dialog.Footer>
            <Typography
              className="tw:mr-auto tw:self-center tw:break-all"
              color="secondary"
              data-testid="ontology-export-file-name"
              size="text-sm">
              {fileName}
            </Typography>
            <Button
              color="secondary"
              data-testid="ontology-release-export-cancel"
              onPress={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="ontology-run-release-export"
              iconLeading={Download01}
              isDisabled={!content || isError || isGateBlocking}
              isLoading={isPreviewLoading || shacl.isDownloading}
              onPress={handleExport}>
              {t('label.download')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyReleaseExportModal;
