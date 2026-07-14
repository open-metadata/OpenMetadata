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

import { Check, Edit03, Plus, Trash01 } from '@untitledui/icons';
import { Input, Modal } from 'antd';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import 'codemirror/addon/edit/closebrackets.js';
import 'codemirror/addon/edit/matchbrackets.js';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/sparql/sparql.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../enums/codemirror.enum';
import { Binding } from '../../generated/api/rdf/sparqlResponse';
import { useAuth } from '../../hooks/authHooks';
import { useSparqlQueryLibrary } from '../../hooks/useSparqlQueryLibrary';
import {
  runSparqlQuery,
  SavedSparqlQuery,
  SparqlPlaygroundResult,
} from '../../rest/rdfAPI';
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';
import { generateUUID } from '../../utils/StringUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import SchemaEditor from '../Database/SchemaEditor/SchemaEditor';
import { OntologyGraphData } from './OntologyExplorer.interface';
import {
  buildOntologyQuerySuggestions,
  NEW_ONTOLOGY_QUERY,
  OntologyQuerySuggestion,
} from './OntologyStudio.utils';
import './OntologyStudioQueryConsole.less';

interface OntologyStudioQueryConsoleProps {
  readonly initialQuery?: string;
  readonly graphData: OntologyGraphData | null;
  readonly relationTypes: GlossaryTermRelationType[];
  readonly selectedGlossaryIds: string[];
}

type SaveTarget = 'personal' | 'template';

function getResultValue(binding: Binding | undefined): string {
  return binding?.value ?? '';
}

const OntologyStudioQueryConsole = ({
  initialQuery,
  graphData,
  relationTypes,
  selectedGlossaryIds,
}: OntologyStudioQueryConsoleProps) => {
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
  const querySuggestions = useMemo(
    () =>
      buildOntologyQuerySuggestions(
        graphData,
        selectedGlossaryIds,
        relationTypes
      ),
    [graphData, relationTypes, selectedGlossaryIds]
  );
  const defaultSuggestion = querySuggestions[0];
  const [query, setQuery] = useState(
    initialQuery ?? defaultSuggestion?.query ?? NEW_ONTOLOGY_QUERY
  );
  const [activeQueryId, setActiveQueryId] = useState<string | undefined>(
    initialQuery ? 'draft' : defaultSuggestion?.id
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SparqlPlaygroundResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('personal');

  useEffect(() => {
    if (!initialQuery) {
      return;
    }
    setQuery(initialQuery);
    setActiveQueryId('draft');
    setResult(null);
    setErrorMessage(null);
  }, [initialQuery]);

  useEffect(() => {
    const firstSuggestion = querySuggestions[0];
    if (initialQuery || activeQueryId !== undefined || !firstSuggestion) {
      return;
    }
    setQuery(firstSuggestion.query);
    setActiveQueryId(firstSuggestion.id);
  }, [activeQueryId, initialQuery, querySuggestions]);

  useEffect(() => {
    if (!activeQueryId?.startsWith('ontology-')) {
      return;
    }
    const activeSuggestion = querySuggestions.find(
      (suggestion) => suggestion.id === activeQueryId
    );
    if (activeSuggestion) {
      return;
    }
    const firstSuggestion = querySuggestions[0];
    if (firstSuggestion) {
      setQuery(firstSuggestion.query);
      setActiveQueryId(firstSuggestion.id);
    }
  }, [activeQueryId, querySuggestions]);

  const executeQuery = useCallback(
    async (nextQuery: string) => {
      if (!nextQuery.trim()) {
        setErrorMessage(t('message.sparql-empty-query-error'));

        return;
      }
      setRunning(true);
      setResult(null);
      setErrorMessage(null);
      try {
        const nextResult = await runSparqlQuery({
          query: nextQuery,
          format: 'json',
          inference: 'none',
        });
        setResult(nextResult);
      } catch (error) {
        const message = isAxiosError(error)
          ? typeof error.response?.data === 'string'
            ? error.response.data
            : error.message
          : (error as Error).message;
        setErrorMessage(message);
        showErrorToast(message);
      } finally {
        setRunning(false);
      }
    },
    [t]
  );

  const resultTable = useMemo(() => {
    if (!result?.parsed) {
      return null;
    }

    return {
      rows: result.parsed.results?.bindings ?? [],
      variables: result.parsed.head?.vars ?? [],
    };
  }, [result]);

  const conceptResults = useMemo(() => {
    if (!resultTable || resultTable.variables.length !== 1) {
      return null;
    }
    const variable = resultTable.variables[0];

    return resultTable.rows.map((row) => getResultValue(row[variable]));
  }, [resultTable]);

  const handleSuggestionRun = useCallback(
    (suggestion: OntologyQuerySuggestion) => {
      setQuery(suggestion.query);
      setActiveQueryId(suggestion.id);
      void executeQuery(suggestion.query);
    },
    [executeQuery]
  );

  const handleNewQuery = useCallback(() => {
    setQuery(NEW_ONTOLOGY_QUERY);
    setActiveQueryId('draft');
    setResult(null);
    setErrorMessage(null);
  }, []);

  const handleSaveCurrent = useCallback(() => {
    setSaveTarget('personal');
    setSaveName('');
    setIsSaveModalOpen(true);
  }, []);

  const handleSaveTemplate = useCallback(() => {
    const activeTemplateId = activeQueryId?.startsWith('template-')
      ? activeQueryId.slice('template-'.length)
      : undefined;
    const activeTemplate = queryTemplates.find(
      (queryTemplate) => queryTemplate.id === activeTemplateId
    );
    setSaveTarget('template');
    setSaveName(activeTemplate?.name ?? '');
    setIsSaveModalOpen(true);
  }, [activeQueryId, queryTemplates]);

  const handleCommitSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name) {
      return;
    }

    const activeTemplateId = activeQueryId?.startsWith('template-')
      ? activeQueryId.slice('template-'.length)
      : undefined;
    const id =
      saveTarget === 'template' && activeTemplateId
        ? activeTemplateId
        : generateUUID();
    const savedQuery: SavedSparqlQuery = {
      id,
      name,
      query,
      format: 'json',
      inference: 'none',
      savedAt: Date.now(),
    };
    const saved =
      saveTarget === 'template'
        ? await upsertQueryTemplate(savedQuery)
        : await upsertSavedQuery(savedQuery);

    if (saved) {
      setActiveQueryId(
        saveTarget === 'template' ? `template-${id}` : `saved-${id}`
      );
      setIsSaveModalOpen(false);
      showSuccessToast(t('message.sparql-query-saved'));
    }
  }, [
    activeQueryId,
    query,
    saveName,
    saveTarget,
    t,
    upsertQueryTemplate,
    upsertSavedQuery,
  ]);

  const handleSavedQueryRun = useCallback(
    (savedQuery: SavedSparqlQuery) => {
      setQuery(savedQuery.query);
      setActiveQueryId(`saved-${savedQuery.id}`);
      void executeQuery(savedQuery.query);
    },
    [executeQuery]
  );

  const handleDeleteSavedQuery = useCallback(
    async (id: string) => {
      const deleted = await deleteSavedQuery(id);
      if (deleted) {
        setActiveQueryId((currentId) =>
          currentId === `saved-${id}` ? 'draft' : currentId
        );
      }
    },
    [deleteSavedQuery]
  );

  const handleTemplateRun = useCallback(
    (queryTemplate: SavedSparqlQuery) => {
      setQuery(queryTemplate.query);
      setActiveQueryId(`template-${queryTemplate.id}`);
      void executeQuery(queryTemplate.query);
    },
    [executeQuery]
  );

  const handleTemplateEdit = useCallback((queryTemplate: SavedSparqlQuery) => {
    setQuery(queryTemplate.query);
    setActiveQueryId(`template-${queryTemplate.id}`);
    setResult(null);
    setErrorMessage(null);
  }, []);

  const handleDeleteTemplate = useCallback(
    async (id: string) => {
      const deleted = await deleteQueryTemplate(id);
      if (deleted) {
        setActiveQueryId((currentId) =>
          currentId === `template-${id}` ? 'draft' : currentId
        );
      }
    },
    [deleteQueryTemplate]
  );

  return (
    <>
      <div
        className="tw:flex tw:h-full tw:min-h-[540px] tw:bg-gray-warm-100"
        data-testid="ontology-studio-query-console">
        <aside
          className="tw:w-60 tw:shrink-0 tw:overflow-y-auto tw:border-r tw:border-gray-blue-100 tw:bg-gray-50 tw:px-3.5 tw:py-4"
          data-testid="ontology-query-sample-rail">
          <div className="tw:mb-3 tw:flex tw:items-center tw:justify-between tw:gap-2">
            <h2 className="tw:m-0 tw:font-body tw:text-[10px] tw:leading-[normal] tw:font-semibold tw:tracking-[0.05em] tw:text-gray-500 tw:uppercase">
              {t('label.query-plural')}
            </h2>
            <button
              className={classNames(
                'tw:flex tw:items-center tw:gap-1 tw:rounded-md tw:border-0 tw:bg-transparent tw:px-1.5 tw:py-1',
                'tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-brand-600 hover:tw:bg-brand-50'
              )}
              data-testid="ontology-query-new"
              type="button"
              onClick={handleNewQuery}>
              <Plus aria-hidden="true" className="tw:size-3" />
              <span>
                {t('label.new')} {t('label.query-lowercase')}
              </span>
            </button>
          </div>

          <h3 className="tw:mb-2 tw:font-body tw:text-[10px] tw:leading-[normal] tw:font-semibold tw:tracking-[0.05em] tw:text-gray-400 tw:uppercase">
            {t('label.ontology')}
          </h3>
          <div className="tw:flex tw:flex-col tw:gap-1">
            {querySuggestions.map((suggestion) => {
              const isActive = suggestion.id === activeQueryId;

              return (
                <button
                  aria-pressed={isActive}
                  className={classNames(
                    'tw:w-full tw:rounded-lg tw:border tw:px-[11px] tw:py-[9px] tw:text-left tw:font-body',
                    'tw:text-xs tw:leading-[normal] tw:font-medium tw:transition-colors',
                    'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-1 tw:focus-visible:outline-brand-600',
                    isActive
                      ? 'tw:border-brand-200 tw:bg-brand-50 tw:text-brand-700'
                      : 'tw:border-gray-200 tw:bg-white tw:text-gray-700 hover:tw:bg-gray-50'
                  )}
                  data-testid={`ontology-query-suggestion-${suggestion.id}`}
                  key={suggestion.id}
                  title={suggestion.label}
                  type="button"
                  onClick={() => handleSuggestionRun(suggestion)}>
                  <span className="tw:block tw:truncate">
                    {suggestion.label}
                  </span>
                </button>
              );
            })}
            {querySuggestions.length === 0 ? (
              <p className="tw:m-0 tw:px-1 tw:font-body tw:text-[11px] tw:text-gray-500">
                {t('message.no-query-available')}
              </p>
            ) : null}
          </div>

          <div className="tw:my-4 tw:h-px tw:bg-gray-200" />

          <h3 className="tw:mb-2 tw:font-body tw:text-[10px] tw:leading-[normal] tw:font-semibold tw:tracking-[0.05em] tw:text-gray-400 tw:uppercase">
            {t('label.installation-queries')}
          </h3>
          {isLoading ? (
            <p className="tw:m-0 tw:px-1 tw:font-body tw:text-[11px] tw:text-gray-500">
              {t('label.loading')}
            </p>
          ) : queryTemplates.length === 0 ? (
            <p className="tw:m-0 tw:px-1 tw:font-body tw:text-[11px] tw:text-gray-500">
              {t('message.no-query-available')}
            </p>
          ) : (
            <div
              className="tw:flex tw:flex-col tw:gap-1"
              data-testid="ontology-query-template-list">
              {queryTemplates.map((queryTemplate) => {
                const isActive =
                  `template-${queryTemplate.id}` === activeQueryId;

                return (
                  <div
                    className={classNames(
                      'tw:flex tw:items-center tw:gap-1 tw:rounded-lg tw:border tw:bg-white tw:pl-[11px] tw:pr-1 tw:transition-colors',
                      isActive
                        ? 'tw:border-brand-200 tw:bg-brand-50'
                        : 'tw:border-gray-200 hover:tw:bg-gray-50'
                    )}
                    key={queryTemplate.id}>
                    <button
                      aria-pressed={isActive}
                      className={classNames(
                        'tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:py-[9px] tw:text-left tw:font-body tw:text-xs tw:leading-[normal] tw:font-medium',
                        isActive ? 'tw:text-brand-700' : 'tw:text-gray-700'
                      )}
                      data-testid={`ontology-query-template-${queryTemplate.id}`}
                      title={queryTemplate.name}
                      type="button"
                      onClick={() => handleTemplateRun(queryTemplate)}>
                      <span className="tw:block tw:truncate">
                        {queryTemplate.name}
                      </span>
                    </button>
                    {isAdminUser ? (
                      <>
                        <button
                          aria-label={`${t('label.edit')} ${
                            queryTemplate.name
                          }`}
                          className="tw:grid tw:size-7 tw:shrink-0 tw:place-items-center tw:rounded-md tw:border-0 tw:bg-transparent tw:text-gray-400 hover:tw:bg-gray-100 hover:tw:text-gray-700"
                          data-testid={`ontology-query-template-edit-${queryTemplate.id}`}
                          type="button"
                          onClick={() => handleTemplateEdit(queryTemplate)}>
                          <Edit03 aria-hidden="true" className="tw:size-3.5" />
                        </button>
                        <button
                          aria-label={`${t('label.delete')} ${
                            queryTemplate.name
                          }`}
                          className="tw:grid tw:size-7 tw:shrink-0 tw:place-items-center tw:rounded-md tw:border-0 tw:bg-transparent tw:text-gray-400 hover:tw:bg-error-50 hover:tw:text-error-600"
                          data-testid={`ontology-query-template-delete-${queryTemplate.id}`}
                          type="button"
                          onClick={() =>
                            void handleDeleteTemplate(queryTemplate.id)
                          }>
                          <Trash01 aria-hidden="true" className="tw:size-3.5" />
                        </button>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="tw:my-4 tw:h-px tw:bg-gray-200" />

          <h3 className="tw:mb-2 tw:font-body tw:text-[10px] tw:leading-[normal] tw:font-semibold tw:tracking-[0.05em] tw:text-gray-400 tw:uppercase">
            {t('label.saved-queries')}
          </h3>
          <p className="tw:mb-2 tw:mt-0 tw:px-1 tw:font-body tw:text-[11px] tw:text-gray-500">
            {t('message.sparql-private-queries-description')}
          </p>
          {savedQueries.length === 0 ? (
            <p className="tw:m-0 tw:px-1 tw:font-body tw:text-[11px] tw:text-gray-500">
              {t('message.sparql-no-saved-queries')}
            </p>
          ) : (
            <div
              className="tw:flex tw:flex-col tw:gap-1"
              data-testid="ontology-query-saved-list">
              {savedQueries.map((savedQuery) => {
                const isActive = `saved-${savedQuery.id}` === activeQueryId;

                return (
                  <div
                    className={classNames(
                      'tw:flex tw:items-center tw:gap-1 tw:rounded-lg tw:border tw:bg-white tw:pl-[11px] tw:pr-1 tw:transition-colors',
                      isActive
                        ? 'tw:border-brand-200 tw:bg-brand-50'
                        : 'tw:border-gray-200 hover:tw:bg-gray-50'
                    )}
                    key={savedQuery.id}>
                    <button
                      aria-pressed={isActive}
                      className={classNames(
                        'tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:py-[9px] tw:text-left tw:font-body tw:text-xs tw:leading-[normal] tw:font-medium',
                        isActive ? 'tw:text-brand-700' : 'tw:text-gray-700'
                      )}
                      data-testid={`ontology-query-saved-${savedQuery.id}`}
                      title={savedQuery.name}
                      type="button"
                      onClick={() => handleSavedQueryRun(savedQuery)}>
                      <span className="tw:block tw:truncate">
                        {savedQuery.name}
                      </span>
                    </button>
                    <button
                      aria-label={`${t('label.delete')} ${savedQuery.name}`}
                      className="tw:grid tw:size-7 tw:shrink-0 tw:place-items-center tw:rounded-md tw:border-0 tw:bg-transparent tw:text-gray-400 hover:tw:bg-error-50 hover:tw:text-error-600"
                      data-testid={`ontology-query-saved-delete-${savedQuery.id}`}
                      type="button"
                      onClick={() =>
                        void handleDeleteSavedQuery(savedQuery.id)
                      }>
                      <Trash01 aria-hidden="true" className="tw:size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
          <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2 tw:border-b tw:border-gray-blue-100 tw:bg-white tw:px-4 tw:py-[11px]">
            <span
              className={classNames(
                'tw:rounded-[7px] tw:border tw:border-gray-300 tw:bg-white tw:px-2.5 tw:py-[5px]',
                'tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-gray-700 tw:uppercase'
              )}>
              {t('label.select')}
            </span>
            <span className="tw:flex-1" />
            <button
              className={classNames(
                'tw:rounded-[7px] tw:border tw:border-gray-300 tw:bg-white tw:px-[15px] tw:py-[7px]',
                'tw:font-body tw:text-xs tw:leading-[normal] tw:font-semibold tw:text-gray-700 tw:shadow-xs-skeuomorphic'
              )}
              data-testid="ontology-query-save"
              type="button"
              onClick={handleSaveCurrent}>
              {t('label.save-query')}
            </button>
            {isAdminUser ? (
              <button
                className={classNames(
                  'tw:rounded-[7px] tw:border tw:border-gray-300 tw:bg-white tw:px-[15px] tw:py-[7px]',
                  'tw:font-body tw:text-xs tw:leading-[normal] tw:font-semibold tw:text-gray-700 tw:shadow-xs-skeuomorphic'
                )}
                data-testid="ontology-query-save-template"
                type="button"
                onClick={handleSaveTemplate}>
                {activeQueryId?.startsWith('template-')
                  ? t('label.update-sample-query')
                  : t('label.save-as-sample-query')}
              </button>
            ) : null}
            <button
              className={classNames(
                'tw:rounded-[7px] tw:border-0 tw:bg-brand-solid tw:px-[15px] tw:py-[7px]',
                'tw:font-body tw:text-xs tw:leading-[normal] tw:font-semibold tw:text-white tw:shadow-xs-skeuomorphic',
                'disabled:tw:cursor-not-allowed disabled:tw:opacity-60'
              )}
              data-testid="ontology-sparql-run"
              disabled={running}
              type="button"
              onClick={() => void executeQuery(query)}>
              {running ? t('label.running') : t('label.run-query')}
            </button>
          </div>

          <div
            className="tw:shrink-0 tw:border-b tw:border-gray-blue-100 tw:bg-white"
            data-testid="ontology-sparql-editor">
            <SchemaEditor
              className="ontology-studio-query-editor"
              mode={{ name: CSMode.SPARQL }}
              options={{
                lineNumbers: false,
                lineWrapping: true,
                foldGutter: false,
                gutters: [],
                autoCloseBrackets: true,
                matchBrackets: true,
              }}
              showCopyButton={false}
              value={query}
              onChange={(value) => {
                setQuery(value);
                setActiveQueryId((currentId) =>
                  currentId?.startsWith('template-') ? currentId : 'draft'
                );
              }}
            />
          </div>

          <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-4">
            {errorMessage ? (
              <div
                className="tw:rounded-lg tw:border tw:border-error-200 tw:bg-error-50 tw:px-3 tw:py-2 tw:font-body tw:text-xs tw:text-error-700"
                data-testid="ontology-sparql-error">
                {errorMessage}
              </div>
            ) : null}

            {result ? (
              <div data-testid="ontology-sparql-result">
                <div className="tw:mb-3 tw:flex tw:items-center tw:gap-1.5 tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-success-700">
                  <Check aria-hidden="true" className="tw:size-[13px]" />
                  <span data-testid="ontology-sparql-result-status">
                    {resultTable?.rows.length ?? 0}{' '}
                    {t('label.result-plural').toLocaleLowerCase()}{' '}
                    <span aria-hidden="true">·</span> {result.durationMs} ms
                  </span>
                </div>

                {conceptResults ? (
                  <div
                    className="tw:flex tw:flex-wrap tw:gap-[7px]"
                    data-testid="ontology-sparql-chips">
                    {conceptResults.map((value, index) => (
                      <span
                        className="tw:rounded-full tw:border tw:border-gray-200 tw:bg-white tw:px-3 tw:py-[5px] tw:font-body tw:text-xs tw:leading-[normal] tw:font-medium tw:text-gray-900"
                        key={`${value}-${index}`}>
                        {value}
                      </span>
                    ))}
                  </div>
                ) : resultTable && resultTable.variables.length > 0 ? (
                  <div className="tw:max-h-[420px] tw:overflow-auto tw:rounded-lg tw:border tw:border-gray-200 tw:bg-white">
                    <table className="tw:w-full tw:border-collapse tw:font-body tw:text-xs">
                      <thead>
                        <tr>
                          {resultTable.variables.map((variable) => (
                            <th
                              className="tw:border-b tw:border-gray-200 tw:bg-gray-50 tw:px-3 tw:py-2 tw:text-left tw:font-semibold tw:text-gray-700"
                              key={variable}>
                              {variable}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resultTable.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {resultTable.variables.map((variable) => (
                              <td
                                className="tw:border-b tw:border-gray-100 tw:px-3 tw:py-2 tw:font-mono tw:text-[11px] tw:text-gray-700"
                                key={variable}>
                                {getResultValue(row[variable])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="tw:m-0 tw:max-h-[420px] tw:overflow-auto tw:rounded-lg tw:border tw:border-gray-200 tw:bg-white tw:p-3 tw:font-mono tw:text-[11px] tw:text-gray-700">
                    {result.body}
                  </pre>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        cancelText={t('label.cancel')}
        data-testid="ontology-query-save-modal"
        okButtonProps={{ disabled: !saveName.trim() }}
        okText={
          saveTarget === 'template' && activeQueryId?.startsWith('template-')
            ? t('label.update')
            : t('label.save')
        }
        open={isSaveModalOpen}
        title={
          saveTarget === 'template'
            ? activeQueryId?.startsWith('template-')
              ? t('label.update-sample-query')
              : t('label.save-as-sample-query')
            : t('label.save-query')
        }
        onCancel={() => setIsSaveModalOpen(false)}
        onOk={() => void handleCommitSave()}>
        <Input
          autoFocus
          data-testid="ontology-query-save-name"
          placeholder={t('message.sparql-save-prompt')}
          value={saveName}
          onChange={(event) => setSaveName(event.target.value)}
          onPressEnter={() => void handleCommitSave()}
        />
      </Modal>
    </>
  );
};

export default OntologyStudioQueryConsole;
