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
  Checkbox,
  Dialog,
  Modal,
  ModalOverlay,
  Select,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  CheckCircle,
  Download01,
  File02,
  InfoCircle,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  ChangeEvent,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../generated/entity/data/glossary';
import { exportGlossaryInCSVFormat } from '../../rest/glossaryAPI';
import {
  importGlossaryOntology,
  OntologyImportFormat,
  OntologyImportResult,
} from '../../rest/importExportAPI';
import {
  exportGlossaryAsOntology,
  OntologyExportFormat,
  ShaclValidationResult,
  validateOntologyShapes,
} from '../../rest/rdfAPI';
import { formatBytes } from '../../utils/ContextCenterPureUtils';
import {
  detectOntologyImportFormat,
  ONTOLOGY_IMPORT_FORMAT_LABEL,
} from '../../utils/OntologyImportUtils';
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from '../../utils/ToastUtils';
import { mergeOntologyExports } from './utils/ontologyExportMerge';

type TransferTab = 'export' | 'import';
type ExportFormatKey = OntologyExportFormat | 'csv';

interface FormatOption {
  key: ExportFormatKey;
  titleKey: string;
  extension: string;
  descriptionKey: string;
}

const FORMAT_OPTIONS: readonly FormatOption[] = [
  {
    descriptionKey: 'message.ontology-format-owl-description',
    extension: '.owl',
    key: 'rdfxml',
    titleKey: 'label.owl',
  },
  {
    descriptionKey: 'message.ontology-format-skos-description',
    extension: '.ttl',
    key: 'turtle',
    titleKey: 'label.skos-skos-xl',
  },
  {
    descriptionKey: 'message.ontology-format-jsonld-description',
    extension: '.jsonld',
    key: 'jsonld',
    titleKey: 'label.json-ld',
  },
  {
    descriptionKey: 'message.ontology-format-csv-description',
    extension: '.csv',
    key: 'csv',
    titleKey: 'label.csv-template',
  },
];

const FORMAT_MEDIA_TYPE: Record<OntologyExportFormat, string> = {
  jsonld: 'application/ld+json',
  ntriples: 'application/n-triples',
  rdfxml: 'application/rdf+xml',
  turtle: 'text/turtle',
};

const PREVIEW_BG = '#0A0D12';
const SYNTAX_COLOR = {
  default: '#D5D7DA',
  keyword: '#8AB4F8',
  string: '#7DD3A8',
  term: '#E8A87C',
};
const SYNTAX_TOKEN =
  /("(?:[^"\\]|\\.)*"(?:@[\w-]+)?)|(<[^>\s]*>)|(\b[A-Za-z][\w-]*:[\w/#.-]*)|(\ba\b)/g;
const PREVIEW_CHAR_LIMIT = 1800;
const ALL_GLOSSARIES = 'all';

interface OntologyImportExportModalProps {
  readonly glossary?: Glossary;
  readonly glossaries: Glossary[];
  readonly isAdminUser: boolean;
  readonly termCount: string;
  readonly relationCount: string;
  readonly onClose: () => void;
}

function highlightRdf(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  SYNTAX_TOKEN.lastIndex = 0;
  while ((match = SYNTAX_TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const color = match[1]
      ? SYNTAX_COLOR.string
      : match[2] || match[4]
      ? SYNTAX_COLOR.keyword
      : SYNTAX_COLOR.term;
    nodes.push(
      <span key={key++} style={{ color }}>
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function triggerDownload(text: string, filename: string, mediaType: string) {
  const blob = new Blob([text], { type: mediaType });
  const url = globalThis.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    globalThis.URL.revokeObjectURL(url);
  }, 100);
}

const OntologyImportExportModal = ({
  glossary,
  glossaries,
  isAdminUser,
  termCount,
  relationCount,
  onClose,
}: OntologyImportExportModalProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TransferTab>('export');
  const [format, setFormat] = useState<ExportFormatKey>('rdfxml');
  const [includeInverse, setIncludeInverse] = useState(true);
  const [validateShacl, setValidateShacl] = useState(isAdminUser);
  const [includeAssets, setIncludeAssets] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [shaclResult, setShaclResult] = useState<ShaclValidationResult | null>(
    null
  );
  const [preview, setPreview] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [activeGlossaryId, setActiveGlossaryId] = useState(
    glossary?.id ?? ALL_GLOSSARIES
  );
  const [importFileName, setImportFileName] = useState('');
  const [importFileContent, setImportFileContent] = useState('');
  const [importFileSize, setImportFileSize] = useState(0);
  const [importFormat, setImportFormat] =
    useState<OntologyImportFormat>('turtle');
  const [importValidation, setImportValidation] =
    useState<OntologyImportResult>();
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importTargetId, setImportTargetId] = useState(
    glossary?.id ?? glossaries[0]?.id ?? ''
  );
  const importInputRef = useRef<HTMLInputElement>(null);

  const activeGlossary = useMemo(
    () => glossaries.find((item) => item.id === activeGlossaryId),
    [activeGlossaryId, glossaries]
  );
  const glossaryItems = useMemo(
    () => [
      { id: ALL_GLOSSARIES, label: t('label.all-glossaries') },
      ...glossaries.map((item) => ({
        id: item.id,
        label: item.displayName ?? item.name,
      })),
    ],
    [glossaries, t]
  );
  const targetGlossaries = useMemo(
    () => (activeGlossary ? [activeGlossary] : glossaries),
    [activeGlossary, glossaries]
  );
  const importTargetItems = useMemo(
    () =>
      glossaries.map((item) => ({
        id: item.id,
        label: item.displayName ?? item.name,
      })),
    [glossaries]
  );
  const importTarget = useMemo(
    () =>
      activeGlossary ?? glossaries.find((item) => item.id === importTargetId),
    [activeGlossary, glossaries, importTargetId]
  );
  const previewGlossary = activeGlossary ?? glossaries[0];
  const isRdfFormat = format !== 'csv';
  const importTermTotal = importValidation
    ? importValidation.termsCreated + importValidation.termsUpdated
    : 0;
  const hasImportedTerms = importTermTotal > 0;
  const hasReviewers = Boolean(importTarget?.reviewers?.length);
  const importSkippedCount = importValidation?.messages.length ?? 0;

  useEffect(() => {
    if (activeTab !== 'export' || !isRdfFormat || !previewGlossary) {
      setPreview('');

      return;
    }
    let isActive = true;
    setIsPreviewLoading(true);
    exportGlossaryAsOntology({
      format,
      glossaryId: previewGlossary.id,
      includeRelations: includeInverse,
    })
      .then((blob) => blob.text())
      .then((text) => isActive && setPreview(text.slice(0, PREVIEW_CHAR_LIMIT)))
      .catch(() => isActive && setPreview(''))
      .finally(() => isActive && setIsPreviewLoading(false));

    return () => {
      isActive = false;
    };
  }, [activeTab, format, includeInverse, isRdfFormat, previewGlossary]);

  useEffect(() => {
    setImportValidation(undefined);
  }, [importTarget?.id]);

  const exportCsv = useCallback(async () => {
    if (!activeGlossary) {
      showWarningToast(t('message.select-glossary-for-csv'));

      return;
    }
    await exportGlossaryInCSVFormat(activeGlossary.name);
    showSuccessToast(t('message.csv-export-started'));
    onClose();
  }, [activeGlossary, onClose, t]);

  const exportOntology = useCallback(async () => {
    const rdfFormat = format as OntologyExportFormat;
    const parts = await Promise.all(
      targetGlossaries.map((item) =>
        exportGlossaryAsOntology({
          format: rdfFormat,
          glossaryId: item.id,
          includeRelations: includeInverse,
        }).then((blob) => blob.text())
      )
    );
    const merged = mergeOntologyExports(parts, rdfFormat);
    const option = FORMAT_OPTIONS.find((entry) => entry.key === format);
    const safeName = (
      activeGlossary?.name ?? t('label.all-glossaries')
    ).replaceAll(/[^a-zA-Z0-9-_]/g, '_');
    triggerDownload(
      merged,
      `${safeName}_ontology${option?.extension ?? '.ttl'}`,
      FORMAT_MEDIA_TYPE[rdfFormat]
    );
    onClose();
  }, [activeGlossary, format, includeInverse, onClose, t, targetGlossaries]);

  const runExportValidation = useCallback(async () => {
    try {
      const result = await validateOntologyShapes();
      setShaclResult(result);
      if (!result.conforms) {
        showWarningToast(t('message.export-shacl-warning'));
      }
    } catch {
      // SHACL validation is advisory: a validation-service failure must never
      // block the export itself.
      showWarningToast(t('message.export-shacl-skipped'));
    }
  }, [t]);

  const handleExport = useCallback(async () => {
    if (!targetGlossaries.length) {
      return;
    }
    setIsExporting(true);
    try {
      if (format === 'csv') {
        await exportCsv();

        return;
      }
      if (isAdminUser && validateShacl) {
        await runExportValidation();
      }
      await exportOntology();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsExporting(false);
    }
  }, [
    exportCsv,
    exportOntology,
    format,
    isAdminUser,
    runExportValidation,
    targetGlossaries.length,
    validateShacl,
  ]);

  const handleRunShacl = useCallback(async () => {
    setIsValidating(true);
    try {
      const result = await validateOntologyShapes();
      setShaclResult(result);
      if (result.conforms) {
        showSuccessToast(t('message.shacl-no-violations'));
      } else {
        showWarningToast(t('message.shacl-violations-found'));
        triggerDownload(result.report, 'shacl-report.ttl', 'text/turtle');
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsValidating(false);
    }
  }, [t]);

  const readImportFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = (event.target?.result as string) ?? '';
        setImportFileName(file.name);
        setImportFileContent(content);
        setImportFileSize(file.size);
        setImportFormat(detectOntologyImportFormat(file.name, content));
        setImportValidation(undefined);
      };
      reader.onerror = () => showErrorToast(t('server.unexpected-error'));
      reader.readAsText(file);
    },
    [t]
  );

  const handleImportInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) {
        readImportFile(file);
      }
    },
    [readImportFile]
  );

  const handleParseDryRun = useCallback(async () => {
    if (!importTarget || !importFileContent) {
      return;
    }
    setIsParsing(true);
    try {
      const result = await importGlossaryOntology({
        data: importFileContent,
        dryRun: true,
        format: importFormat,
        name: importTarget.name,
      });
      setImportValidation(result);
    } catch (error) {
      setImportValidation(undefined);
      showErrorToast(error as AxiosError);
    } finally {
      setIsParsing(false);
    }
  }, [importTarget, importFileContent, importFormat]);

  const handleConfirmImport = useCallback(async () => {
    if (!importTarget || !importFileContent) {
      return;
    }
    setIsImporting(true);
    try {
      const result = await importGlossaryOntology({
        data: importFileContent,
        dryRun: false,
        format: importFormat,
        name: importTarget.name,
      });
      if (result.messages.length > 0) {
        setImportValidation(result);
      } else {
        showSuccessToast(t('message.ontology-imported-successfully'));
        onClose();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsImporting(false);
    }
  }, [importTarget, importFileContent, importFormat, onClose, t]);

  return (
    <ModalOverlay
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog showCloseButton width={820} onClose={onClose}>
          <div
            className="tw:flex tw:max-h-[85vh] tw:flex-col tw:overflow-hidden tw:font-body"
            data-testid="ontology-import-export-modal">
            <div className="tw:flex tw:items-center tw:gap-3 tw:border-b tw:border-secondary tw:py-4 tw:pr-14 tw:pl-5">
              <span className="tw:shrink-0 tw:text-[15px] tw:font-bold tw:text-primary">
                {t('label.import-export-ontology')}
              </span>
              <Select
                aria-label={t('label.glossary')}
                className="tw:w-48"
                data-testid="ontology-scope-select"
                fontSize="sm"
                items={glossaryItems}
                size="sm"
                value={activeGlossaryId}
                onChange={(key) => setActiveGlossaryId(String(key))}>
                {(item) => (
                  <Select.Item id={item.id} key={item.id} label={item.label} />
                )}
              </Select>
              <span className="tw:shrink-0 tw:text-[11px] tw:font-medium tw:text-quaternary">
                {activeGlossary
                  ? `${activeGlossary.termCount ?? 0} ${t(
                      'label.term-plural'
                    ).toLocaleLowerCase()}`
                  : `${termCount} ${t(
                      'label.term-plural'
                    ).toLocaleLowerCase()} · ${relationCount} ${t(
                      'label.relation-plural'
                    ).toLocaleLowerCase()}`}
              </span>
              <span className="tw:flex-1" />
              <div className="tw:flex tw:gap-0.5 tw:rounded-[9px] tw:border tw:border-secondary tw:bg-tertiary tw:p-[3px]">
                {(['export', 'import'] as const).map((tab) => (
                  <button
                    aria-pressed={activeTab === tab}
                    className={classNames(
                      'tw:rounded-md tw:px-4 tw:py-1.5 tw:text-[13px] tw:font-semibold tw:capitalize',
                      activeTab === tab
                        ? 'tw:bg-primary tw:text-brand-secondary tw:shadow-xs'
                        : 'tw:bg-transparent tw:text-quaternary'
                    )}
                    data-testid={`ontology-transfer-tab-${tab}`}
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}>
                    {t(`label.${tab}`)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'export' ? (
              <div className="tw:flex tw:min-h-0 tw:flex-1 tw:gap-5 tw:overflow-y-auto tw:p-5">
                <div className="tw:min-w-0 tw:flex-1">
                  <div className="tw:mb-2.5 tw:text-[10px] tw:font-semibold tw:tracking-[0.05em] tw:text-quaternary tw:uppercase">
                    {t('label.format')}
                  </div>
                  <div className="tw:mb-[18px] tw:flex tw:flex-col tw:gap-2">
                    {FORMAT_OPTIONS.map((option) => (
                      <button
                        aria-checked={format === option.key}
                        className={classNames(
                          'tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:px-4 tw:py-3 tw:text-left',
                          format === option.key
                            ? 'tw:border-brand tw:bg-brand-primary'
                            : 'tw:border-secondary tw:bg-primary hover:tw:bg-secondary'
                        )}
                        data-testid={`ontology-format-${option.key}`}
                        key={option.key}
                        role="radio"
                        type="button"
                        onClick={() => setFormat(option.key)}>
                        <span
                          className={classNames(
                            'tw:grid tw:size-[18px] tw:shrink-0 tw:place-items-center tw:rounded-full tw:border-[1.5px]',
                            format === option.key
                              ? 'tw:border-brand-solid'
                              : 'tw:border-secondary'
                          )}>
                          {format === option.key ? (
                            <span className="tw:size-2.5 tw:rounded-full tw:bg-brand-solid" />
                          ) : null}
                        </span>
                        <span className="tw:min-w-0 tw:flex-1">
                          <span className="tw:block tw:text-[13px] tw:font-semibold tw:text-primary">
                            {t(option.titleKey)}
                          </span>
                          <span className="tw:block tw:text-[11px] tw:font-normal tw:text-quaternary">
                            {t(option.descriptionKey)}
                          </span>
                        </span>
                        <span className="tw:shrink-0 tw:font-mono tw:text-[11px] tw:font-medium tw:text-quaternary">
                          {option.extension}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="tw:flex tw:flex-col tw:gap-2.5">
                    <Checkbox
                      isSelected={includeInverse}
                      label={t('message.include-inverse-relationships')}
                      onChange={setIncludeInverse}
                    />
                    <Checkbox
                      isDisabled={!isAdminUser}
                      isSelected={validateShacl}
                      label={t('message.validate-with-shacl-before-export')}
                      onChange={setValidateShacl}
                    />
                    <Checkbox
                      isSelected={includeAssets}
                      label={t('message.include-bound-data-assets')}
                      onChange={setIncludeAssets}
                    />
                  </div>
                </div>

                <div className="tw:w-[300px] tw:shrink-0">
                  <div className="tw:mb-2.5 tw:text-[10px] tw:font-semibold tw:tracking-[0.05em] tw:text-quaternary tw:uppercase">
                    {t('label.preview')}
                  </div>
                  <div
                    className="tw:overflow-hidden tw:rounded-[10px] tw:px-[15px] tw:py-[13px]"
                    style={{ backgroundColor: PREVIEW_BG }}>
                    <pre
                      className="tw:max-h-[360px] tw:overflow-auto tw:font-mono tw:text-[11px] tw:leading-[1.7] tw:whitespace-pre-wrap"
                      data-testid="ontology-export-preview"
                      style={{ color: SYNTAX_COLOR.default }}>
                      {isPreviewLoading
                        ? t('label.loading')
                        : isRdfFormat && preview
                        ? highlightRdf(preview).map((node, index) => (
                            <Fragment key={index}>{node}</Fragment>
                          ))
                        : '—'}
                    </pre>
                  </div>
                  {shaclResult ? (
                    <div
                      className={classNames(
                        'tw:mt-3 tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:font-medium',
                        shaclResult.conforms
                          ? 'tw:text-success-primary'
                          : 'tw:text-error-primary'
                      )}
                      data-testid="ontology-shacl-status">
                      {shaclResult.conforms ? (
                        <CheckCircle className="tw:size-3.5" />
                      ) : (
                        <AlertCircle className="tw:size-3.5" />
                      )}
                      {t(
                        shaclResult.conforms
                          ? 'message.shacl-no-violations'
                          : 'message.shacl-violations-found'
                      )}
                    </div>
                  ) : isRdfFormat && preview && !isPreviewLoading ? (
                    <div className="tw:mt-3 tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:font-medium tw:text-success-primary">
                      <CheckCircle className="tw:size-3.5" />
                      {t('message.ontology-preview-ready')}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div
                className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:p-5"
                data-testid="ontology-import-panel">
                <input
                  accept=".ttl,.rdf,.owl,.nt,.xml"
                  className="tw:hidden"
                  data-testid="ontology-import-input"
                  ref={importInputRef}
                  type="file"
                  onChange={handleImportInputChange}
                />

                {!activeGlossary ? (
                  <div
                    className="tw:flex tw:items-center tw:gap-3"
                    data-testid="ontology-import-select-target">
                    <span className="tw:shrink-0 tw:text-[12px] tw:font-semibold tw:text-tertiary">
                      {t('label.import-into')}
                    </span>
                    <Select
                      aria-label={t('label.import-into')}
                      className="tw:w-56"
                      data-testid="ontology-import-target-select"
                      fontSize="sm"
                      items={importTargetItems}
                      size="sm"
                      value={importTargetId}
                      onChange={(key) => setImportTargetId(String(key))}>
                      {(item) => (
                        <Select.Item
                          id={item.id}
                          key={item.id}
                          label={item.label}
                        />
                      )}
                    </Select>
                  </div>
                ) : null}

                <div
                  className="tw:flex tw:items-center tw:gap-3.5 tw:rounded-xl tw:border tw:border-secondary tw:bg-secondary tw:px-4 tw:py-3.5"
                  data-testid="ontology-import-file">
                  <span className="tw:grid tw:size-11 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-brand-50">
                    <File02 className="tw:size-5 tw:text-brand-600" />
                  </span>
                  <span className="tw:min-w-0 tw:flex-1">
                    <span className="tw:block tw:truncate tw:text-[14px] tw:font-semibold tw:text-primary">
                      {importFileName || t('message.no-file-selected')}
                    </span>
                    <span className="tw:mt-0.5 tw:block tw:text-[12px] tw:font-normal tw:text-quaternary">
                      {importFileName ? (
                        <>
                          {`${formatBytes(importFileSize)} · ${
                            ONTOLOGY_IMPORT_FORMAT_LABEL[importFormat]
                          } · `}
                          <span className="tw:text-success-primary">
                            {t('label.format-auto-detected')}
                          </span>
                        </>
                      ) : (
                        t('message.ontology-accepted-extensions')
                      )}
                    </span>
                  </span>
                  <Button
                    color="secondary"
                    data-testid="ontology-choose-file"
                    size="sm"
                    onPress={() => importInputRef.current?.click()}>
                    {t('label.choose-file')}
                  </Button>
                </div>

                <p className="tw:text-[13px] tw:leading-relaxed tw:text-quaternary">
                  {t('message.import-ontology-accepts')}
                </p>

                {importValidation ? (
                  <div
                    className="tw:flex tw:flex-col tw:gap-3"
                    data-testid="ontology-import-summary">
                    <div className="tw:flex tw:items-center tw:gap-2.5">
                      <span className="tw:text-[11px] tw:font-semibold tw:tracking-[0.05em] tw:text-quaternary tw:uppercase">
                        {t('label.dry-run-preview')}
                      </span>
                      <span className="tw:rounded-full tw:bg-brand-50 tw:px-2.5 tw:py-0.5 tw:text-[11px] tw:font-semibold tw:text-brand-700">
                        {t('label.nothing-persisted-yet')}
                      </span>
                    </div>
                    <div className="tw:grid tw:grid-cols-4 tw:gap-2.5">
                      {[
                        {
                          key: 'terms',
                          labelKey: 'label.new-term-plural',
                          value: importValidation.termsCreated,
                        },
                        {
                          key: 'relations',
                          labelKey: 'label.relation-plural',
                          value: importValidation.relationsAdded,
                        },
                        {
                          key: 'mappings',
                          labelKey: 'label.mapping-plural',
                          value: importValidation.conceptMappingsAdded,
                        },
                        {
                          key: 'skipped',
                          labelKey: 'label.skipped',
                          value: importSkippedCount,
                          warn: true,
                        },
                      ].map((stat) => {
                        const isWarn = Boolean(stat.warn) && stat.value > 0;

                        return (
                          <div
                            className={classNames(
                              'tw:rounded-xl tw:border tw:px-4 tw:py-3.5',
                              isWarn
                                ? 'tw:border-warning-300 tw:bg-warning-50'
                                : 'tw:border-secondary tw:bg-primary'
                            )}
                            data-testid={`ontology-import-stat-${stat.key}`}
                            key={stat.key}>
                            <div
                              className={classNames(
                                'tw:text-[26px] tw:leading-none tw:font-bold',
                                isWarn
                                  ? 'tw:text-warning-primary'
                                  : 'tw:text-primary'
                              )}>
                              {stat.value}
                            </div>
                            <div className="tw:mt-1.5 tw:text-[12px] tw:font-normal tw:text-quaternary tw:lowercase">
                              {t(stat.labelKey)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {hasReviewers || importSkippedCount > 0 ? (
                      <div
                        className="tw:flex tw:gap-2 tw:rounded-lg tw:bg-brand-50 tw:px-3.5 tw:py-3"
                        data-testid="ontology-import-note">
                        <InfoCircle className="tw:mt-px tw:size-4 tw:shrink-0 tw:text-brand-600" />
                        <div className="tw:flex tw:flex-col tw:gap-1 tw:text-[12px] tw:leading-relaxed tw:text-brand-700">
                          {hasReviewers ? (
                            <span>{t('message.import-terms-enter-draft')}</span>
                          ) : null}
                          {importValidation.messages.map((message) => (
                            <span key={message}>{message}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            <div className="tw:flex tw:items-center tw:gap-2.5 tw:border-t tw:border-secondary tw:px-5 tw:py-3.5">
              {activeTab === 'export' ? (
                <>
                  <Button
                    color="primary"
                    data-testid="ontology-run-export"
                    iconLeading={<Download01 className="tw:size-4" />}
                    isDisabled={!targetGlossaries.length}
                    isLoading={isExporting}
                    onPress={handleExport}>
                    {t('label.export')}
                  </Button>
                  <Button
                    color="secondary"
                    data-testid="ontology-run-shacl"
                    isDisabled={!isAdminUser || isValidating}
                    isLoading={isValidating}
                    onPress={handleRunShacl}>
                    {t('label.run-shacl-report')}
                  </Button>
                </>
              ) : (
                <>
                  {hasImportedTerms ? (
                    <Button
                      color="primary"
                      data-testid="ontology-run-import"
                      isLoading={isImporting}
                      onPress={handleConfirmImport}>
                      {t('label.import-count-terms', {
                        count: importTermTotal,
                      })}
                    </Button>
                  ) : null}
                  <Button
                    color={hasImportedTerms ? 'secondary' : 'primary'}
                    data-testid="ontology-parse-dry-run"
                    isDisabled={
                      !importTarget || !importFileContent || isImporting
                    }
                    isLoading={isParsing}
                    onPress={handleParseDryRun}>
                    {t('label.parse-dry-run')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyImportExportModal;
