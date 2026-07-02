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
  Badge,
  Button,
  Card,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Home02 } from '@untitledui/icons';
import { Input, Modal } from 'antd';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import 'codemirror/addon/edit/closebrackets.js';
import 'codemirror/addon/edit/matchbrackets.js';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/sparql/sparql.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import SchemaEditor from '../../components/Database/SchemaEditor/SchemaEditor';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { CSMode } from '../../enums/codemirror.enum';
import { Binding } from '../../generated/api/rdf/sparqlResponse';
import {
  runSparqlQuery,
  SparqlPlaygroundFormat,
  SparqlPlaygroundInference,
  SparqlPlaygroundResult,
} from '../../rest/rdfAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  DEFAULT_SPARQL_PREFIXES,
  SAMPLE_SPARQL_QUERIES,
  SavedSparqlQuery,
  SPARQL_PLAYGROUND_STORAGE_KEY,
} from './SparqlPlayground.interface';

const FORMAT_OPTIONS: ReadonlyArray<{
  value: SparqlPlaygroundFormat;
  label: string;
}> = [
  { value: 'json', label: 'JSON (SELECT/ASK)' },
  { value: 'csv', label: 'CSV (SELECT)' },
  { value: 'tsv', label: 'TSV (SELECT)' },
  { value: 'xml', label: 'XML (SELECT/ASK)' },
  { value: 'turtle', label: 'Turtle (CONSTRUCT/DESCRIBE)' },
  { value: 'jsonld', label: 'JSON-LD (CONSTRUCT/DESCRIBE)' },
  { value: 'ntriples', label: 'N-Triples (CONSTRUCT/DESCRIBE)' },
  { value: 'rdfxml', label: 'RDF-XML (CONSTRUCT/DESCRIBE)' },
];

const INFERENCE_OPTIONS: ReadonlyArray<{
  value: SparqlPlaygroundInference;
  label: string;
}> = [
  { value: 'none', label: 'none' },
  { value: 'rdfs', label: 'rdfs' },
  { value: 'owl', label: 'owl' },
  { value: 'custom', label: 'custom' },
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

function loadSavedQueries(): SavedSparqlQuery[] {
  try {
    const raw = window.localStorage.getItem(SPARQL_PLAYGROUND_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (q): q is SavedSparqlQuery =>
        typeof q === 'object' &&
        q !== null &&
        typeof (q as SavedSparqlQuery).id === 'string' &&
        typeof (q as SavedSparqlQuery).query === 'string'
    );
  } catch {
    return [];
  }
}

function persistSavedQueries(queries: SavedSparqlQuery[]): void {
  window.localStorage.setItem(
    SPARQL_PLAYGROUND_STORAGE_KEY,
    JSON.stringify(queries)
  );
}

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

const initialQuery = `${DEFAULT_SPARQL_PREFIXES}\n\nSELECT ?s ?p ?o WHERE {\n  ?s ?p ?o\n} LIMIT 10`;

const SparqlPlayground: React.FC = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState<string>(initialQuery);
  const [format, setFormat] = useState<SparqlPlaygroundFormat>('json');
  const [inference, setInference] = useState<SparqlPlaygroundInference>('none');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SparqlPlaygroundResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedSparqlQuery[]>(() =>
    loadSavedQueries()
  );
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    persistSavedQueries(savedQueries);
  }, [savedQueries]);

  const handleRun = useCallback(async () => {
    if (!query.trim()) {
      setErrorMessage(t('label.sparql-empty-query-error'));

      return;
    }
    setRunning(true);
    setErrorMessage(null);
    setResult(null);
    try {
      const r = await runSparqlQuery({ query, format, inference });
      setResult(r);
    } catch (e) {
      const message = isAxiosError(e)
        ? typeof e.response?.data === 'string'
          ? e.response.data
          : e.message
        : (e as Error).message;
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setRunning(false);
    }
  }, [query, format, inference, t]);

  const handleSaveCurrent = useCallback(() => {
    setSaveName('');
    setIsSaveModalOpen(true);
  }, []);

  const handleCommitSave = useCallback(() => {
    const name = saveName.trim();
    if (!name) {
      return;
    }
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSavedQueries((prev) => [
      ...prev,
      {
        id,
        name,
        query,
        format,
        inference,
        savedAt: Date.now(),
      },
    ]);
    setIsSaveModalOpen(false);
    showSuccessToast(t('message.sparql-query-saved'));
  }, [saveName, query, format, inference, t]);

  const handleLoadSaved = useCallback((saved: SavedSparqlQuery) => {
    setQuery(saved.query);
    setFormat(saved.format);
    setInference(saved.inference);
  }, []);

  const handleDeleteSaved = useCallback((id: string) => {
    setSavedQueries((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const handleLoadSample = useCallback(
    (sample: (typeof SAMPLE_SPARQL_QUERIES)[number]) => {
      setQuery(sample.query);
    },
    []
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

    return { vars, rows };
  }, [result]);

  return (
    <PageLayoutV1 pageTitle={t('label.sparql-playground')}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <TitleBreadcrumb
          useCustomArrow
          titleLinks={[
            {
              name: '',
              icon: <Home02 size={12} />,
              url: '/',
              activeTitle: true,
            },
            {
              name: t('label.sparql-playground'),
              url: '',
            },
          ]}
        />

        <Card className="tw:p-5">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Typography
              as="span"
              data-testid="heading"
              size="text-md"
              weight="semibold">
              {t('label.sparql-playground')}
            </Typography>
            <Badge color="blue-light" size="sm" type="pill-color">
              {t('label.beta')}
            </Badge>
          </div>
          <Typography
            as="p"
            className="tw:mt-1 tw:text-tertiary"
            size="text-sm">
            {t('message.sparql-playground-subtitle')}
          </Typography>
        </Card>

        <div className="tw:grid tw:grid-cols-1 tw:gap-3 lg:tw:grid-cols-[1fr_320px]">
          <Card className="tw:flex tw:flex-col tw:gap-3 tw:p-4">
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              <Select
                aria-label={t('label.format')}
                data-testid="sparql-format-select"
                items={FORMAT_OPTIONS.map((o) => ({
                  id: o.value,
                  label: o.label,
                }))}
                size="sm"
                value={format}
                onChange={(key) =>
                  setFormat(String(key) as SparqlPlaygroundFormat)
                }
              />
              <Select
                aria-label={t('label.inference')}
                data-testid="sparql-inference-select"
                items={INFERENCE_OPTIONS.map((o) => ({
                  id: o.value,
                  label: o.label,
                }))}
                size="sm"
                value={inference}
                onChange={(key) =>
                  setInference(String(key) as SparqlPlaygroundInference)
                }
              />
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
                <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-tertiary">
                  <Typography as="span" size="text-xs">
                    {t('label.format')}: {result.format}
                  </Typography>
                  <Typography as="span" size="text-xs">
                    {t('label.duration')}: {result.durationMs}ms
                  </Typography>
                  <Button
                    color="secondary"
                    data-testid="sparql-download"
                    size="sm"
                    onClick={handleDownload}>
                    {t('label.download')}
                  </Button>
                </div>
                {tabularResult ? (
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
                        {tabularResult.rows.map((row, idx) => (
                          <tr key={idx}>
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
                ) : (
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

          <Card className="tw:flex tw:flex-col tw:gap-3 tw:p-4">
            <Typography as="span" size="text-sm" weight="semibold">
              {t('label.sample-queries')}
            </Typography>
            <ul className="tw:flex tw:flex-col tw:gap-1">
              {SAMPLE_SPARQL_QUERIES.map((sample) => (
                <li key={sample.nameKey}>
                  <Button
                    color="tertiary"
                    data-testid={`sparql-sample-${sample.nameKey}`}
                    size="sm"
                    onClick={() => handleLoadSample(sample)}>
                    {t(sample.nameKey)}
                  </Button>
                </li>
              ))}
            </ul>

            <Typography
              as="span"
              className="tw:mt-3"
              size="text-sm"
              weight="semibold">
              {t('label.saved-queries')}
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
                      onClick={() => handleDeleteSaved(saved.id)}>
                      {t('label.delete')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Modal
        cancelText={t('label.cancel')}
        data-testid="sparql-save-modal"
        okButtonProps={{ disabled: !saveName.trim() }}
        okText={t('label.save')}
        open={isSaveModalOpen}
        title={t('label.save-query')}
        onCancel={() => setIsSaveModalOpen(false)}
        onOk={handleCommitSave}>
        <Input
          autoFocus
          data-testid="sparql-save-name-input"
          placeholder={t('label.sparql-save-prompt')}
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onPressEnter={handleCommitSave}
        />
      </Modal>
    </PageLayoutV1>
  );
};

export default SparqlPlayground;
