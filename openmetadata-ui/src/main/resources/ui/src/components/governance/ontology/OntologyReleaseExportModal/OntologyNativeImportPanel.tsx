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
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateOntologyChangeSet } from '../../../../generated/api/data/createOntologyChangeSet';
import { Format } from '../../../../generated/api/data/previewNativeOntologyImport';
import type { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyChangeSetState } from '../../../../generated/entity/data/ontologyChangeSet';
import {
  applyOntologyChangeSet,
  createOntologyChangeSet,
  getOntologyChangeSet,
  previewNativeOntologyImport,
} from '../../../../rest/ontologyAPI';
import { detectOntologyImportFormat } from '../../../../utils/OntologyImportUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { useOntologyEditLease } from '../../../OntologyExplorer/hooks/useOntologyEditLease';

interface OntologyNativeImportPanelProps {
  readonly canImport: boolean;
  readonly ontology: Ontology;
  readonly onApplied: () => void;
}

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

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
}: OntologyNativeImportPanelProps) => {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<CreateOntologyChangeSet>();
  const [draftId, setDraftId] = useState<string>();
  const [shouldApply, setShouldApply] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string>();
  const lease = useOntologyEditLease({
    isActive: Boolean(draftId),
    resourceId: draftId,
    resourceType: 'ontologyChangeSet',
  });

  const finishApply = useCallback(
    (state: OntologyChangeSetState) => {
      if (state === OntologyChangeSetState.Applied) {
        showSuccessToast(t('label.ontology-applied'));
        onApplied();
      } else {
        setError(t('server.unexpected-error'));
      }
    },
    [onApplied, t]
  );

  useEffect(() => {
    if (!shouldApply || !draftId || !lease.isOwned || !lease.lock) {
      return;
    }
    setShouldApply(false);
    setIsBusy(true);
    const token = {
      sessionId: lease.lock.sessionId,
      version: lease.lock.version,
    };
    applyOntologyChangeSet(draftId, { lease: token })
      .then((result) => finishApply(result.state))
      .catch(async (applyError: unknown) => {
        try {
          const draft = await getOntologyChangeSet(draftId);
          if (draft.state === OntologyChangeSetState.Applied) {
            finishApply(draft.state);

            return;
          }
        } catch {
          // Keep the draft ID so a retry can check its state again.
        }
        setError(t('server.unexpected-error'));
        showErrorToast(
          isAxiosError(applyError) ? applyError : t('server.unexpected-error')
        );
      })
      .finally(() => setIsBusy(false));
  }, [draftId, finishApply, lease.isOwned, lease.lock, shouldApply, t]);

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    setPreview(undefined);
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

  const handleApply = async () => {
    if (!preview?.operations?.length || isBusy || !canImport) {
      return;
    }
    setError(undefined);
    setIsBusy(true);
    try {
      if (draftId) {
        const draft = await getOntologyChangeSet(draftId);
        if (draft.state === OntologyChangeSetState.Applied) {
          finishApply(draft.state);

          return;
        }
        if (
          draft.state !== OntologyChangeSetState.Draft &&
          draft.state !== OntologyChangeSetState.ApplyFailed
        ) {
          setError(t('server.unexpected-error'));

          return;
        }
      } else {
        const draft = await createOntologyChangeSet(preview);
        setDraftId(draft.id);
      }
      setShouldApply(true);
    } catch (applyError) {
      setError(t('server.unexpected-error'));
      showErrorToast(
        isAxiosError(applyError) ? applyError : t('server.unexpected-error')
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
            {preview.operations.map((operation) => {
              const definition =
                operation.concept ?? operation.property ?? operation.axiom;

              return (
                <li key={operation.id}>
                  {definition?.displayName ?? definition?.name ?? operation.id}
                  {' · '}
                  {operation.operationType}
                </li>
              );
            })}
          </ul>
        ) : (
          <Alert variant="gray">{t('label.no-changes-to-save')}</Alert>
        )}
      </Box>
    );
  };

  const renderFilePicker = () => {
    if (draftId) {
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

  const renderLeaseStatus = () => {
    if (!draftId) {
      return null;
    }
    if (lease.state === 'acquiring') {
      return <Typography role="status">{t('label.loading')}</Typography>;
    }
    if (lease.state === 'contended' || lease.state === 'lost') {
      return (
        <Box direction="col" gap={2}>
          <Alert variant="warning">
            {t('message.native-ontology-import-lease-unavailable')}
          </Alert>
          <Button color="secondary" onPress={lease.retry}>
            {t('label.retry')}
          </Button>
        </Box>
      );
    }

    return null;
  };

  const isApplyDisabled = () => {
    if (!canImport || !preview?.operations?.length || isBusy) {
      return true;
    }

    return Boolean(draftId && !lease.isOwned);
  };

  return (
    <Box direction="col" gap={4}>
      <Typography color="secondary" size="text-sm">
        {t('message.native-ontology-import-help')}
      </Typography>
      {renderFilePicker()}
      {fileName && <Typography>{fileName}</Typography>}
      {renderPreview()}
      {error && <Alert variant="error">{error}</Alert>}
      {renderLeaseStatus()}
      <Button
        color="primary"
        data-testid="ontology-native-import-apply"
        isDisabled={isApplyDisabled()}
        isLoading={isBusy}
        onPress={() => void handleApply()}>
        {draftId ? t('label.retry') : t('label.import')}
      </Button>
    </Box>
  );
};

export default OntologyNativeImportPanel;
