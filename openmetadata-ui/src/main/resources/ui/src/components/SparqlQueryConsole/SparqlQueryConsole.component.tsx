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
  ButtonUtility,
  Card,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit03, Trash01 } from '@untitledui/icons';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import 'codemirror/addon/edit/closebrackets.js';
import 'codemirror/addon/edit/matchbrackets.js';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/sparql/sparql.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../enums/codemirror.enum';
import { Binding } from '../../generated/api/rdf/sparqlResponse';
import { useAuth } from '../../hooks/authHooks';
import { useSparqlQueryLibrary } from '../../hooks/useSparqlQueryLibrary';
import {
  runSparqlQuery,
  SavedSparqlQuery,
  SparqlPlaygroundFormat,
  SparqlPlaygroundInference,
  SparqlPlaygroundResult,
} from '../../rest/rdfAPI';
import { generateUUID } from '../../utils/StringUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import SchemaEditor from '../Database/SchemaEditor/SchemaEditor';
import {
  DEFAULT_SPARQL_PREFIXES,
  SparqlQueryConsoleProps,
} from './SparqlQueryConsole.interface';

const FORMAT_OPTIONS: ReadonlyArray<{
  value: SparqlPlaygroundFormat;
  labelKey: string;
}> = [
  { value: 'json', labelKey: 'label.sparql-format-json-select-ask' },
  { value: 'csv', labelKey: 'label.sparql-format-csv-select' },
  { value: 'tsv', labelKey: 'label.sparql-format-tsv-select' },
  { value: 'xml', labelKey: 'label.sparql-format-xml-select-ask' },
  {
    value: 'turtle',
    labelKey: 'label.sparql-format-turtle-construct-describe',
  },
  {
    value: 'jsonld',
    labelKey: 'label.sparql-format-json-ld-construct-describe',
  },
  {
    value: 'ntriples',
    labelKey: 'label.sparql-format-n-triples-construct-describe',
  },
  {
    value: 'rdfxml',
    labelKey: 'label.sparql-format-rdf-xml-construct-describe',
  },
];

const INFERENCE_OPTIONS: ReadonlyArray<{
  value: SparqlPlaygroundInference;
  labelKey: string;
}> = [
  { value: 'none', labelKey: 'label.none' },
  { value: 'rdfs', labelKey: 'label.rdfs' },
  { value: 'owl', labelKey: 'label.owl' },
  { value: 'custom', labelKey: 'label.custom' },
];

const FORMAT_EXTENSIONS: Record<SparqlPlaygroundFormat, string> = {
  json: 'json',
  csv: 'csv',
  tsv: 'tsv',
  xml: 'xml',
  turtle: 'ttl',
  jsonld: 'jsonld',
  ntriples: 'nt',
  rdfxml: 'rdf',
};

function downloadAsFile(
  body: string,
  contentType: string,
  filename: string
): void {
  const blob = new Blob([body], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 100);
}

const DEFAULT_INITIAL_QUERY = `${DEFAULT_SPARQL_PREFIXES}\n\nSELECT ?s ?p ?o WHERE {\n  ?s ?p ?o\n} LIMIT 10`;

type SaveTarget = 'personal' | 'template';

/**
 * Reusable, page-chrome-free SPARQL query interface: editor, format/inference
 * controls, results (tabular for JSON SELECT/ASK, raw otherwise), and
 * sample/saved query lists. Hosted both by the standalone SPARQL Playground page
 * and by Ontology Studio's Query mode.
 */
const SparqlQueryConsole: React.FC<SparqlQueryConsoleProps> = ({
  className,
  initialQuery,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const {
    isLoading,
    queryTemplates,
    savedQueries,
    deleteQueryTemplate,
    deleteSavedQuery,
    upsertQueryTemplate,
    upsertSavedQuery,
  } = useSparqlQueryLibrary();
  const [query, setQuery] = useState<string>(
    initialQuery || DEFAULT_INITIAL_QUERY
  );
  const [format, setFormat] = useState<SparqlPlaygroundFormat>('json');
  const [inference, setInference] = useState<SparqlPlaygroundInference>('none');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SparqlPlaygroundResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string>();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('personal');

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setErrorMessage(null);
      setResult(null);
    }
  }, [initialQuery]);

  const handleRun = useCallback(async () => {
    if (!query.trim()) {
      setErrorMessage(t('message.sparql-empty-query-error'));

      return;
    }
    setRunning(true);
    setErrorMessage(null);
    setResult(null);
    try {
      const r = await runSparqlQuery({ query, format, inference });
      setResult(r);
    } catch (e) {
      let message: string;
      if (isAxiosError(e)) {
        message =
          typeof e.response?.data === 'string' ? e.response.data : e.message;
      } else {
        message = (e as Error).message;
      }
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setRunning(false);
    }
  }, [query, format, inference, t]);

  const handleSaveCurrent = useCallback(() => {
    setSaveTarget('personal');
    setSaveName('');
    setIsSaveModalOpen(true);
  }, []);

  const handleSaveTemplate = useCallback(() => {
    const activeTemplate = queryTemplates.find(
      (queryTemplate) => queryTemplate.id === activeTemplateId
    );
    setSaveTarget('template');
    setSaveName(activeTemplate?.name ?? '');
    setIsSaveModalOpen(true);
  }, [activeTemplateId, queryTemplates]);

  const handleCommitSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name) {
      return;
    }

    const id =
      saveTarget === 'template' && activeTemplateId
        ? activeTemplateId
        : generateUUID();
    const savedQuery: SavedSparqlQuery = {
      id,
      name,
      query,
      format,
      inference,
      savedAt: Date.now(),
    };
    const saved =
      saveTarget === 'template'
        ? await upsertQueryTemplate(savedQuery)
        : await upsertSavedQuery(savedQuery);

    if (saved) {
      if (saveTarget === 'template') {
        setActiveTemplateId(id);
      }
      setIsSaveModalOpen(false);
      showSuccessToast(t('message.sparql-query-saved'));
    }
  }, [
    activeTemplateId,
    format,
    inference,
    query,
    saveName,
    saveTarget,
    t,
    upsertQueryTemplate,
    upsertSavedQuery,
  ]);

  const handleLoadSaved = useCallback((saved: SavedSparqlQuery) => {
    setQuery(saved.query);
    setFormat(saved.format);
    setInference(saved.inference);
    setActiveTemplateId(undefined);
  }, []);

  const handleLoadTemplate = useCallback((queryTemplate: SavedSparqlQuery) => {
    setQuery(queryTemplate.query);
    setFormat(queryTemplate.format);
    setInference(queryTemplate.inference);
    setActiveTemplateId(queryTemplate.id);
  }, []);

  const handleDeleteTemplate = useCallback(
    async (id: string) => {
      const deleted = await deleteQueryTemplate(id);
      if (deleted && activeTemplateId === id) {
        setActiveTemplateId(undefined);
      }
    },
    [activeTemplateId, deleteQueryTemplate]
  );

  const handleDownload = useCallback(() => {
    if (!result) {
      return;
    }
    const filename = `sparql-result.${FORMAT_EXTENSIONS[result.format]}`;
    downloadAsFile(result.body, result.contentType, filename);
  }, [result]);

  const handleInjectPrefixes = useCallback(() => {
    if (query.includes('PREFIX om:')) {
      return;
    }
    setQuery(`${DEFAULT_SPARQL_PREFIXES}\n\n${query}`);
  }, [query]);

  const tabularResult = useMemo(() => {
    if (!result || result.format !== 'json' || !result.parsed) {
      return null;
    }
    const vars = result.parsed.head?.vars ?? [];
    const rows = result.parsed.results?.bindings ?? [];

    return {
      keyedRows: rows.map((row) => ({ key: generateUUID(), row })),
      rows,
      vars,
    };
  }, [result]);

  // A single-variable SELECT is a list of concepts — render them as chips
  // (subgraph-style) like the design, rather than a one-column table.
  const conceptChips = useMemo(() => {
    if (!tabularResult || tabularResult.vars.length !== 1) {
      return null;
    }
    const variable = tabularResult.vars[0];

    return tabularResult.keyedRows.map(({ key, row }) => ({
      key,
      value: (row[variable] as Binding | undefined)?.value ?? '',
    }));
  }, [tabularResult]);

  const templateSaveTitle = activeTemplateId
    ? t('label.update-sample-query')
    : t('label.save-as-sample-query');
  const modalTitle =
    saveTarget === 'template' ? templateSaveTitle : t('label.save-query');

  return (
    <>
      <div
        className={classNames(
          'tw:grid tw:grid-cols-1 tw:gap-3 lg:tw:grid-cols-[220px_1fr]',
          className
        )}>
        <Card className="tw:flex tw:flex-col tw:gap-3 tw:p-4 lg:tw:order-2">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              <Select
                aria-label={t('label.format')}
                data-testid="sparql-format-select"
                items={FORMAT_OPTIONS.map((o) => ({
                  id: o.value,
                  label: t(o.labelKey),
                }))}
                size="sm"
                value={format}
                onChange={(key) =>
                  setFormat(String(key) as SparqlPlaygroundFormat)
                }>
                {(item) => (
                  <Select.Item id={item.id} key={item.id} label={item.label} />
                )}
              </Select>
              <Select
                aria-label={t('label.inference')}
                data-testid="sparql-inference-select"
                items={INFERENCE_OPTIONS.map((o) => ({
                  id: o.value,
                  label: t(o.labelKey),
                }))}
                size="sm"
                value={inference}
                onChange={(key) =>
                  setInference(String(key) as SparqlPlaygroundInference)
                }>
                {(item) => (
                  <Select.Item id={item.id} key={item.id} label={item.label} />
                )}
              </Select>
              <Button
                color="secondary"
                data-testid="sparql-inject-prefixes"
                size="sm"
                onClick={handleInjectPrefixes}>
                {t('label.inject-prefixes')}
              </Button>
              <Button
                color="secondary"
                data-testid="sparql-save-query"
                size="sm"
                onClick={handleSaveCurrent}>
                {t('label.save-query')}
              </Button>
              {isAdminUser ? (
                <Button
                  color="secondary"
                  data-testid="sparql-save-template"
                  size="sm"
                  onClick={handleSaveTemplate}>
                  {activeTemplateId
                    ? t('label.update-sample-query')
                    : t('label.save-as-sample-query')}
                </Button>
              ) : null}
            </div>
            <Button
              color="primary"
              data-testid="sparql-run"
              isDisabled={running}
              size="sm"
              onClick={handleRun}>
              {running ? t('label.running') : t('label.run-query')}
            </Button>
          </div>

          <div
            className="tw:rounded-md tw:border tw:border-utility-gray-200"
            data-testid="sparql-editor">
            <SchemaEditor
              mode={{ name: CSMode.SPARQL }}
              options={{
                lineNumbers: true,
                lineWrapping: true,
                autoCloseBrackets: true,
                matchBrackets: true,
              }}
              showCopyButton={false}
              value={query}
              onChange={setQuery}
            />
          </div>

          {errorMessage ? (
            <div
              className="tw:rounded-md tw:border tw:border-error-300 tw:bg-error-50 tw:p-3 tw:text-error-700"
              data-testid="sparql-error">
              {errorMessage}
            </div>
          ) : null}

          {result ? (
            <div
              className="tw:flex tw:flex-col tw:gap-2"
              data-testid="sparql-result">
              <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                <Typography
                  as="span"
                  className={
                    tabularResult
                      ? 'tw:text-success-primary'
                      : 'tw:text-tertiary'
                  }
                  data-testid="sparql-result-status"
                  size="text-xs"
                  weight="medium">
                  {tabularResult
                    ? `✓ ${tabularResult.rows.length} ${t(
                        'label.result-plural'
                      )} · ${result.durationMs} ms`
                    : `${result.format} · ${result.durationMs} ms`}
                </Typography>
                <Button
                  color="secondary"
                  data-testid="sparql-download"
                  size="sm"
                  onClick={handleDownload}>
                  {t('label.download')}
                </Button>
              </div>
              {conceptChips && (
                <div
                  className="tw:flex tw:flex-wrap tw:gap-2"
                  data-testid="sparql-chips">
                  {conceptChips.length === 0 ? (
                    <Typography
                      as="span"
                      className="tw:text-tertiary"
                      size="text-xs">
                      {t('message.sparql-no-rows')}
                    </Typography>
                  ) : (
                    conceptChips.map(({ key, value }) => (
                      <span
                        className="tw:rounded-full tw:border tw:border-utility-gray-200 tw:bg-primary tw:px-3 tw:py-1 tw:text-xs"
                        key={key}>
                        {value}
                      </span>
                    ))
                  )}
                </div>
              )}
              {!conceptChips && tabularResult && (
                <div
                  className="tw:max-h-[420px] tw:overflow-auto tw:rounded-md tw:border tw:border-utility-gray-200"
                  data-testid="sparql-table">
                  <table className="tw:w-full tw:text-sm">
                    <thead>
                      <tr>
                        {tabularResult.vars.map((v) => (
                          <th
                            className="tw:border-b tw:border-utility-gray-200 tw:bg-secondary tw:px-3 tw:py-2 tw:text-left tw:font-semibold"
                            key={v}>
                            {v}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tabularResult.keyedRows.map(({ key, row }) => (
                        <tr key={key}>
                          {tabularResult.vars.map((v) => {
                            const binding = row[v] as Binding | undefined;

                            return (
                              <td
                                className="tw:border-b tw:border-utility-gray-100 tw:px-3 tw:py-2 tw:font-mono tw:text-xs"
                                key={v}>
                                {binding?.value ?? ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {tabularResult.rows.length === 0 ? (
                    <div className="tw:p-3 tw:text-tertiary">
                      {t('message.sparql-no-rows')}
                    </div>
                  ) : null}
                </div>
              )}
              {!conceptChips && !tabularResult && (
                <pre
                  className={classNames(
                    'tw:max-h-[420px] tw:overflow-auto tw:rounded-md tw:border tw:border-utility-gray-200 tw:bg-secondary tw:p-3 tw:text-xs'
                  )}
                  data-testid="sparql-raw">
                  {result.body}
                </pre>
              )}
            </div>
          ) : null}
        </Card>

        <Card className="tw:flex tw:flex-col tw:gap-3 tw:p-4 lg:tw:order-1">
          <Typography
            as="span"
            className="tw:uppercase tw:text-quaternary"
            size="text-xs"
            weight="semibold">
            {t('label.installation-queries')}
          </Typography>
          {isLoading && (
            <Typography as="p" className="tw:text-tertiary" size="text-xs">
              {t('label.loading')}
            </Typography>
          )}
          {!isLoading && queryTemplates.length === 0 && (
            <Typography as="p" className="tw:text-tertiary" size="text-xs">
              {t('message.no-query-available')}
            </Typography>
          )}
          {!isLoading && queryTemplates.length !== 0 && (
            <ul className="tw:flex tw:flex-col tw:gap-1">
              {queryTemplates.map((queryTemplate) => (
                <li
                  className="tw:flex tw:items-center tw:justify-between tw:gap-1"
                  key={queryTemplate.id}>
                  <Button
                    className="tw:min-w-0 tw:flex-1 tw:justify-start"
                    color="tertiary"
                    data-testid={`sparql-template-${queryTemplate.id}`}
                    size="sm"
                    onClick={() => handleLoadTemplate(queryTemplate)}>
                    {queryTemplate.name}
                  </Button>
                  {isAdminUser ? (
                    <>
                      <ButtonUtility
                        className="tw:size-7 tw:shrink-0 tw:border-0 tw:bg-transparent tw:p-0 tw:text-tertiary hover:tw:bg-secondary"
                        data-testid={`sparql-template-edit-${queryTemplate.id}`}
                        icon={Edit03}
                        size="xs"
                        tooltip={`${t('label.edit')} ${queryTemplate.name}`}
                        onClick={() => handleLoadTemplate(queryTemplate)}
                      />
                      <ButtonUtility
                        className="tw:size-7 tw:shrink-0 tw:border-0 tw:bg-transparent tw:p-0 tw:text-tertiary hover:tw:bg-error-50 hover:tw:text-error-600"
                        data-testid={`sparql-template-delete-${queryTemplate.id}`}
                        icon={Trash01}
                        size="xs"
                        tooltip={`${t('label.delete')} ${queryTemplate.name}`}
                        onClick={() =>
                          void handleDeleteTemplate(queryTemplate.id)
                        }
                      />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <Typography
            as="span"
            className="tw:mt-2 tw:uppercase tw:text-quaternary"
            size="text-xs"
            weight="semibold">
            {t('label.saved-queries')}
          </Typography>
          <Typography as="p" className="tw:text-tertiary" size="text-xs">
            {t('message.sparql-private-queries-description')}
          </Typography>
          {savedQueries.length === 0 ? (
            <Typography as="p" className="tw:text-tertiary" size="text-xs">
              {t('message.sparql-no-saved-queries')}
            </Typography>
          ) : (
            <ul
              className="tw:flex tw:flex-col tw:gap-1"
              data-testid="sparql-saved-list">
              {savedQueries.map((saved) => (
                <li
                  className="tw:flex tw:items-center tw:justify-between tw:gap-2"
                  key={saved.id}>
                  <Button
                    color="tertiary"
                    data-testid={`sparql-saved-${saved.id}`}
                    size="sm"
                    onClick={() => handleLoadSaved(saved)}>
                    {saved.name}
                  </Button>
                  <Button
                    color="tertiary"
                    data-testid={`sparql-saved-delete-${saved.id}`}
                    size="sm"
                    onClick={() => void deleteSavedQuery(saved.id)}>
                    {t('label.delete')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ModalOverlay
        isDismissable
        isOpen={isSaveModalOpen}
        onOpenChange={setIsSaveModalOpen}>
        <Modal>
          <Dialog
            showCloseButton
            data-testid="sparql-save-modal"
            title={modalTitle}
            width={480}
            onClose={() => setIsSaveModalOpen(false)}>
            <Dialog.Content>
              <Input
                inputDataTestId="sparql-save-name-input"
                label={t('label.name')}
                placeholder={t('message.sparql-save-prompt')}
                value={saveName}
                onChange={setSaveName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && saveName.trim()) {
                    void handleCommitSave();
                  }
                }}
              />
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="secondary"
                size="sm"
                onPress={() => setIsSaveModalOpen(false)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                isDisabled={!saveName.trim()}
                size="sm"
                onPress={() => void handleCommitSave()}>
                {saveTarget === 'template' && activeTemplateId
                  ? t('label.update')
                  : t('label.save')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
};

export default SparqlQueryConsole;
