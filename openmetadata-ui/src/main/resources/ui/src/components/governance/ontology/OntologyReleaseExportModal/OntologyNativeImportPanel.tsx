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
  FeaturedIcon,
  FileTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Upload01 } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateOntologyChangeSet } from '../../../../generated/api/data/createOntologyChangeSet';
import { Format } from '../../../../generated/api/data/previewNativeOntologyImport';
import type { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyChangeSetApply } from '../../../../hooks/governance/ontology/useOntologyChangeSetApply';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { previewNativeOntologyImport } from '../../../../rest/ontologyAPI';
import { detectOntologyImportFormat } from '../../../../utils/OntologyImportUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';

interface OntologyNativeImportPanelProps {
  readonly canImport: boolean;
  readonly ontology: Ontology;
  readonly onApplied: () => void;
  readonly onBusyChange?: (isBusy: boolean) => void;
}

type ImportOperation = NonNullable<
  CreateOntologyChangeSet['operations']
>[number];

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
  const isAiMode = useIsAiMode();
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

  const pageOperations = (changeSet: CreateOntologyChangeSet) =>
    (changeSet.operations ?? []).slice(
      previewPage * PREVIEW_PAGE_SIZE,
      (previewPage + 1) * PREVIEW_PAGE_SIZE
    );

  const operationName = (operation: ImportOperation) => {
    const definition =
      operation.concept ?? operation.property ?? operation.axiom;

    return definition?.displayName ?? definition?.name ?? operation.id;
  };

  const renderPagination = (changeSet: CreateOntologyChangeSet) =>
    Boolean(changeSet.operations?.length) && (
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
            (changeSet.operations?.length ?? 0)
          }
          size="sm"
          onPress={() => setPreviewPage((page) => page + 1)}>
          {t('label.next')}
        </Button>
      </Box>
    );

  const renderAiPreview = () => {
    if (!preview) {
      return null;
    }

    return (
      <Box direction="col" gap={3}>
        <Typography size="text-sm" weight="semibold">
          {preview.operations?.length ?? 0} {t('label.change-plural')}
        </Typography>
        {preview.operations?.length ? (
          <ul
            className="tw:m-0 tw:max-h-64 tw:list-none tw:overflow-auto tw:rounded-xl tw:border tw:border-secondary tw:p-0"
            data-testid="ontology-native-import-preview">
            {pageOperations(preview).map((operation, index) => (
              <li
                className={classNames(
                  'tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-2.5',
                  index > 0 && 'tw:border-t tw:border-secondary'
                )}
                key={operation.id}>
                <Typography
                  as="span"
                  className="tw:min-w-0 tw:flex-1 tw:truncate"
                  size="text-sm">
                  {operationName(operation)}
                </Typography>
                <Badge
                  color={operation.targetId ? 'warning' : 'success'}
                  size="sm"
                  type="pill-color">
                  {t(operation.targetId ? 'label.updated' : 'label.added')}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <Alert variant="gray">{t('message.no-changes-to-save')}</Alert>
        )}
        {renderPagination(preview)}
      </Box>
    );
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
            {pageOperations(preview).map((operation) => (
              <li key={operation.id}>
                {operationName(operation)}
                {' · '}
                {t(operation.targetId ? 'label.updated' : 'label.added')}
              </li>
            ))}
          </ul>
        ) : (
          <Alert variant="gray">{t('message.no-changes-to-save')}</Alert>
        )}
        {renderPagination(preview)}
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
  const fileLabel = fileName && <Typography>{fileName}</Typography>;

  const errors = (
    <>
      {error && <Alert variant="error">{error}</Alert>}
      {apply.status.kind === 'blocked' && (
        <Alert variant="error">{apply.status.message}</Alert>
      )}
    </>
  );

  const importButton = (
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
  );

  if (isAiMode) {
    return (
      <Box direction="col" gap={4}>
        <Box
          align="center"
          className="tw:rounded-xl tw:border tw:border-dashed tw:border-secondary tw:bg-secondary_alt tw:px-6 tw:py-8 tw:text-center"
          direction="col"
          gap={3}>
          <FeaturedIcon color="gray" icon={Upload01} size="md" theme="modern" />
          <Typography color="secondary" size="text-sm">
            {t('message.native-ontology-import-help')}
          </Typography>
          {renderFilePicker()}
          {fileLabel}
        </Box>
        {renderAiPreview()}
        {errors}
        <Box justify="end">{importButton}</Box>
      </Box>
    );
  }

  return (
    <Box direction="col" gap={4}>
      <Typography color="secondary" size="text-sm">
        {t('message.native-ontology-import-help')}
      </Typography>
      {renderFilePicker()}
      {fileLabel}
      {renderPreview()}
      {errors}
      {importButton}
    </Box>
  );
};

export default OntologyNativeImportPanel;
