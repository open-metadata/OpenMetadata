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
  FileTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateOntologyChangeSet } from '../../../../generated/api/data/createOntologyChangeSet';
import { Format } from '../../../../generated/api/data/previewNativeOntologyImport';
import type { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyChangeSetApply } from '../../../../hooks/governance/ontology/useOntologyChangeSetApply';
import { previewNativeOntologyImport } from '../../../../rest/ontologyAPI';
import { detectOntologyImportFormat } from '../../../../utils/OntologyImportUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';

interface OntologyNativeImportPanelProps {
  readonly canImport: boolean;
  readonly ontology: Ontology;
  readonly onApplied: () => void;
  readonly onBusyChange?: (isBusy: boolean) => void;
}

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const PREVIEW_PAGE_SIZE = 25;

const formatFromFile = (name: string, content: string): Format => {
  if (name.toLowerCase().endsWith('.jsonld')) {
    return Format.Jsonld;
  }

  return {
    ntriples: Format.Ntriples,
    rdfxml: Format.Rdfxml,
    turtle: Format.Turtle,
  }[detectOntologyImportFormat(name, content)];
};

const OntologyNativeImportPanel = ({
  canImport,
  ontology,
  onApplied,
  onBusyChange,
}: OntologyNativeImportPanelProps) => {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<CreateOntologyChangeSet>();
  const [previewPage, setPreviewPage] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string>();
  const apply = useOntologyChangeSetApply({
    canApply: canImport,
    onApplied: () => {
      showSuccessToast(t('label.ontology-applied'));
      onApplied();
    },
  });

  const isImportBusy = isBusy || apply.status.kind === 'busy';
  useEffect(() => {
    onBusyChange?.(isImportBusy);
  }, [isImportBusy, onBusyChange]);

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    setPreview(undefined);
    setPreviewPage(0);
    setError(undefined);
    if (file.size > MAX_IMPORT_BYTES) {
      setError(t('message.file-size-exceeded', { size: '10 MB' }));

      return;
    }
    setIsBusy(true);
    try {
      const content = await file.text();
      const result = await previewNativeOntologyImport(ontology.id, {
        data: content,
        format: formatFromFile(file.name, content),
      });
      setPreview(result);
    } catch (previewError) {
      setError(t('server.unexpected-error'));
      showErrorToast(
        isAxiosError(previewError) ? previewError : t('server.unexpected-error')
      );
    } finally {
      setIsBusy(false);
    }
  };

  const renderPreview = () => {
    if (!preview) {
      return null;
    }

    return (
      <Box direction="col" gap={2}>
        <Typography>
          {preview.operations?.length ?? 0} {t('label.change-plural')}
        </Typography>
        {preview.operations?.length ? (
          <ul
            className="tw:m-0 tw:max-h-64 tw:overflow-auto tw:pl-5"
            data-testid="ontology-native-import-preview">
            {preview.operations
              .slice(
                previewPage * PREVIEW_PAGE_SIZE,
                (previewPage + 1) * PREVIEW_PAGE_SIZE
              )
              .map((operation) => {
                const definition =
                  operation.concept ?? operation.property ?? operation.axiom;

                return (
                  <li key={operation.id}>
                    {definition?.displayName ??
                      definition?.name ??
                      operation.id}
                    {' · '}
                    {t(operation.targetId ? 'label.updated' : 'label.added')}
                  </li>
                );
              })}
          </ul>
        ) : (
          <Alert variant="gray">{t('message.no-changes-to-save')}</Alert>
        )}
        {Boolean(preview.operations?.length) && (
          <Box gap={2}>
            <Button
              color="secondary"
              isDisabled={previewPage === 0}
              size="sm"
              onPress={() => setPreviewPage((page) => page - 1)}>
              {t('label.previous')}
            </Button>
            <Button
              color="secondary"
              isDisabled={
                (previewPage + 1) * PREVIEW_PAGE_SIZE >=
                (preview.operations?.length ?? 0)
              }
              size="sm"
              onPress={() => setPreviewPage((page) => page + 1)}>
              {t('label.next')}
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  const renderFilePicker = () => {
    if (apply.configurationLocked) {
      return null;
    }

    return (
      <FileTrigger
        acceptedFileTypes={['.ttl', '.rdf', '.owl', '.nt', '.xml', '.jsonld']}
        onSelect={(files) => void handleFile(files)}>
        <Button
          color="secondary"
          data-testid="ontology-native-import-file"
          isDisabled={!canImport || isBusy}>
          {t('label.choose-file')}
        </Button>
      </FileTrigger>
    );
  };

  const isApplying = isImportBusy || apply.status.kind === 'applied';

  return (
    <Box direction="col" gap={4}>
      <Typography color="secondary" size="text-sm">
        {t('message.native-ontology-import-help')}
      </Typography>
      {renderFilePicker()}
      {fileName && <Typography>{fileName}</Typography>}
      {renderPreview()}
      {error && <Alert variant="error">{error}</Alert>}
      {apply.status.kind === 'blocked' && (
        <Alert variant="error">{apply.status.message}</Alert>
      )}
      <Button
        color="primary"
        data-testid="ontology-native-import-apply"
        isDisabled={!canImport || !preview?.operations?.length || isApplying}
        isLoading={isImportBusy}
        onPress={() => {
          if (preview) {
            void (apply.configurationLocked
              ? apply.retry()
              : apply.start(preview));
          }
        }}>
        {apply.configurationLocked ? t('label.retry') : t('label.import')}
      </Button>
    </Box>
  );
};

export default OntologyNativeImportPanel;
