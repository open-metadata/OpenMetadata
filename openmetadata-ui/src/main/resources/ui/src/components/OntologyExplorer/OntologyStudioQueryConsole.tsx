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
  Box,
  Button,
  ButtonUtility,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Check,
  Edit03,
  InfoCircle,
  Lock01,
  Play,
  Plus,
  Trash01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../enums/codemirror.enum';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { useAuth } from '../../hooks/authHooks';
import { useSparqlQueryLibrary } from '../../hooks/useSparqlQueryLibrary';
import {
  runGlossarySparqlQuery,
  runOntologySparqlQuery,
  runSparqlQuery,
  SavedSparqlQuery,
  SparqlPlaygroundResult,
} from '../../rest/rdfAPI';
import { generateUUID } from '../../utils/StringUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import SchemaEditor from '../Database/SchemaEditor/SchemaEditor';
import { OntologyGraphData } from './OntologyExplorer.interface';
import OntologyQueryResults from './OntologyQueryResults';
import {
  buildOntologyQuerySuggestions,
  isCanonicalGlossaryQueryTemplate,
  NEW_NATIVE_ONTOLOGY_QUERY,
  NEW_ONTOLOGY_QUERY,
  OntologyQuerySuggestion,
} from './OntologyStudio.utils';
import './OntologyStudioQueryConsole.css';

interface OntologyStudioQueryConsoleProps {
  /** Creates an "Untitled query" under My queries as soon as the console opens. */
  readonly createQueryOnMount?: boolean;
  readonly initialQuery?: string;
  readonly onQueryCreated?: () => void;
  readonly graphData: OntologyGraphData | null;
  readonly relationTypes: RelationshipType[];
  readonly selectedGlossaryIds: string[];
  readonly selectedOntologyId?: string;
}

type SaveTarget = 'personal' | 'template';

const SPARQL_QUERY_FORM = /\b(SELECT|CONSTRUCT|ASK|DESCRIBE)\b/i;

// SELECT / CONSTRUCT / ASK / DESCRIBE, read past the PREFIX declarations.
function getQueryForm(query: string): string {
  return (query.match(SPARQL_QUERY_FORM)?.[1] ?? 'SELECT').toUpperCase();
}

interface QueryListItem {
  readonly id: string;
  readonly isDirty?: boolean;
  readonly label: string;
  readonly testId: string;
  readonly actions?: ReactNode;
  readonly onRun: () => void;
}

interface QueryGroupProps {
  /** My queries keep rename/delete visible; shared admin actions show on hover. */
  readonly areActionsAlwaysVisible?: boolean;
  readonly emptyText: string;
  readonly hint: string;
  readonly isLoading?: boolean;
  readonly items: QueryListItem[];
  readonly activeQueryId?: string;
  readonly listTestId: string;
  readonly title: string;
}

const QueryGroup = ({
  areActionsAlwaysVisible,
  emptyText,
  hint,
  isLoading,
  items,
  activeQueryId,
  listTestId,
  title,
}: QueryGroupProps) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={1}>
      <Box align="center" className="tw:px-3" gap={2}>
        <Typography className="tw:text-primary" size="text-sm" weight="medium">
          {title}
        </Typography>
        <Badge color="gray" size="sm" type="pill-color">
          {items.length}
        </Badge>
      </Box>
      <Typography className="tw:px-3 tw:pb-1.5 tw:text-tertiary" size="text-xs">
        {hint}
      </Typography>
      {isLoading && items.length === 0 ? (
        <Typography className="tw:px-3 tw:text-tertiary" size="text-xs">
          {t('label.loading')}
        </Typography>
      ) : null}
      {!isLoading && items.length === 0 ? (
        <Box className="tw:mx-1 tw:rounded-lg tw:border tw:border-dashed tw:border-primary tw:p-3">
          <Typography className="tw:text-tertiary" size="text-xs">
            {emptyText}
          </Typography>
        </Box>
      ) : null}
      {items.length > 0 ? (
        <Box className="tw:gap-0.5" data-testid={listTestId} direction="col">
          {items.map((item) => {
            const isActive = item.id === activeQueryId;

            return (
              <Box
                align="center"
                className={classNames(
                  'tw:group tw:min-h-9 tw:rounded-lg tw:pr-1',
                  isActive ? 'tw:bg-brand-primary' : 'tw:hover:bg-primary_hover'
                )}
                gap={1}
                key={item.id}>
                <Button
                  noTextPadding
                  aria-pressed={isActive}
                  className={classNames(
                    'tw:min-w-0 tw:flex-1 tw:justify-start tw:py-2 tw:pl-3 tw:text-left',
                    'tw:*:data-text:min-w-0 tw:*:data-text:w-full tw:*:data-text:truncate',
                    isActive
                      ? 'tw:font-semibold tw:text-brand-secondary'
                      : 'tw:font-normal tw:text-secondary'
                  )}
                  color="tertiary"
                  data-testid={item.testId}
                  size="sm"
                  title={item.label}
                  onClick={item.onRun}>
                  {item.label}
                </Button>
                {item.isDirty ? (
                  <span
                    aria-label={t('label.unsaved-changes')}
                    className="tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-fg-warning-secondary"
                    role="img"
                  />
                ) : null}
                {item.actions ? (
                  <Box
                    align="center"
                    className={classNames(
                      'tw:gap-0.5',
                      !areActionsAlwaysVisible &&
                        'tw:opacity-0 tw:transition-opacity tw:group-hover:opacity-100 tw:group-focus-within:opacity-100'
                    )}>
                    {item.actions}
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
};

interface ActiveQuery {
  readonly savedQuery?: SavedSparqlQuery;
  readonly template?: SavedSparqlQuery;
  readonly templateId?: string;
  readonly title?: string;
  readonly isShared: boolean;
}

// Resolves the rail item behind the active id ("ontology-*", "template-*", "saved-*" or "draft").
function describeActiveQuery(
  activeQueryId: string | undefined,
  querySuggestions: OntologyQuerySuggestion[],
  queryTemplates: SavedSparqlQuery[],
  savedQueries: SavedSparqlQuery[]
): ActiveQuery {
  const id = activeQueryId ?? '';
  const templateId = id.startsWith('template-')
    ? id.slice('template-'.length)
    : undefined;
  const savedId = id.startsWith('saved-') ? id.slice('saved-'.length) : '';
  const suggestion = querySuggestions.find((item) => item.id === id);
  const template = queryTemplates.find((item) => item.id === templateId);
  const savedQuery = savedQueries.find((item) => item.id === savedId);

  return {
    isShared: Boolean(suggestion ?? template),
    savedQuery,
    template,
    templateId,
    title: suggestion?.label ?? template?.name ?? savedQuery?.name,
  };
}

interface QueryRename {
  readonly isRenaming: boolean;
  readonly value: string;
  readonly onCancel: () => void;
  readonly onChange: (value: string) => void;
  readonly onCommit: () => void;
  readonly onStart: () => void;
}

interface QueryTitleProps {
  readonly activeQuery: ActiveQuery;
  readonly rename: QueryRename;
}

// Only a query under My queries can be renamed; shared ones are read-only.
const QueryTitle = ({ activeQuery, rename }: QueryTitleProps) => {
  const { t } = useTranslation();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isRenaming = Boolean(activeQuery.savedQuery) && rename.isRenaming;

  // Starting a rename is a user action, so the name field takes focus with the text selected.
  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  if (isRenaming) {
    return (
      <Box align="center" className="tw:w-80 tw:max-w-full" gap={1}>
        <Input
          aria-label={t('label.name')}
          inputDataTestId="ontology-query-rename-input"
          ref={renameInputRef}
          size="sm"
          value={rename.value}
          wrapperClassName="tw:min-w-0 tw:flex-1"
          onChange={rename.onChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              rename.onCommit();
            }
            if (event.key === 'Escape') {
              rename.onCancel();
            }
          }}
        />
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-query-rename-save"
          icon={Check}
          isDisabled={!rename.value.trim()}
          size="xs"
          tooltip={t('label.save')}
          onClick={rename.onCommit}
        />
        <ButtonUtility
          color="tertiary"
          icon={XClose}
          size="xs"
          tooltip={t('label.cancel')}
          onClick={rename.onCancel}
        />
      </Box>
    );
  }

  return (
    <Box align="center" className="tw:min-w-0" gap={1}>
      <Typography
        ellipsis
        className="tw:min-w-0 tw:text-primary"
        data-testid="ontology-query-title"
        size="text-sm"
        weight="medium">
        {activeQuery.title ?? t('label.untitled-query')}
      </Typography>
      {activeQuery.savedQuery ? (
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-query-rename"
          icon={Edit03}
          size="xs"
          tooltip={t('label.rename')}
          onClick={rename.onStart}
        />
      ) : null}
    </Box>
  );
};

interface QueryConsoleHeaderProps {
  readonly activeQuery: ActiveQuery;
  readonly rename: QueryRename;
  readonly isAdminUser?: boolean;
  readonly isDirty: boolean;
  readonly query: string;
  readonly running: boolean;
  readonly onDiscard: () => void;
  readonly onRun: () => void;
  readonly onSave: () => void;
  readonly onSaveTemplate: () => void;
  readonly onUpdateSaved: () => void;
}

type QueryConsoleActionsProps = Omit<
  QueryConsoleHeaderProps,
  'query' | 'rename'
>;

const QueryConsoleActions = ({
  activeQuery,
  isAdminUser,
  isDirty,
  running,
  onDiscard,
  onRun,
  onSave,
  onSaveTemplate,
  onUpdateSaved,
}: QueryConsoleActionsProps) => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:ml-auto" gap={2} wrap="wrap">
      {isDirty ? (
        <Button
          color="tertiary"
          data-testid="ontology-query-discard"
          size="sm"
          onClick={onDiscard}>
          {t('label.discard')}
        </Button>
      ) : null}
      <Button
        color="secondary"
        data-testid="ontology-query-save"
        size="sm"
        onClick={onSave}>
        {activeQuery.savedQuery
          ? t('label.save-as-new')
          : t('label.save-as-my-query')}
      </Button>
      {activeQuery.savedQuery ? (
        <Button
          color="secondary"
          data-testid="ontology-query-update"
          isDisabled={!isDirty}
          size="sm"
          onClick={onUpdateSaved}>
          {t('label.save-changes')}
        </Button>
      ) : null}
      {isAdminUser ? (
        <Button
          color="secondary"
          data-testid="ontology-query-save-template"
          size="sm"
          onClick={onSaveTemplate}>
          {activeQuery.template
            ? t('label.update-sample-query')
            : t('label.save-as-sample-query')}
        </Button>
      ) : null}
      <Button
        color="primary"
        data-testid="ontology-sparql-run"
        iconLeading={Play}
        isDisabled={running}
        size="sm"
        onClick={onRun}>
        {running ? t('label.running') : t('label.run-query')}
      </Button>
    </Box>
  );
};

const QueryConsoleHeader = ({
  activeQuery,
  rename,
  isAdminUser,
  isDirty,
  query,
  running,
  onDiscard,
  onRun,
  onSave,
  onSaveTemplate,
  onUpdateSaved,
}: QueryConsoleHeaderProps) => {
  const { t } = useTranslation();

  return (
    <>
      <Box
        align="center"
        className="tw:min-h-14 tw:shrink-0 tw:border-b tw:border-secondary tw:px-5 tw:py-2.5"
        gap={3}
        wrap="wrap">
        <Box
          align="center"
          className="tw:min-w-0 tw:flex-1"
          gap={2}
          wrap="wrap">
          <QueryTitle activeQuery={activeQuery} rename={rename} />
          <Badge
            color="blue"
            data-testid="ontology-query-form"
            size="sm"
            type="pill-color">
            {getQueryForm(query)}
          </Badge>
          {activeQuery.isShared ? (
            <Badge
              className="tw:gap-1"
              color="gray"
              data-testid="ontology-query-read-only"
              size="sm"
              type="pill-color">
              <Lock01 aria-hidden="true" className="tw:size-3" />
              {t('label.shared-read-only')}
            </Badge>
          ) : null}
          {activeQuery.savedQuery ? (
            <Badge color="purple" size="sm" type="pill-color">
              {t('label.my-query')}
            </Badge>
          ) : null}
          {isDirty ? (
            <Badge
              color="warning"
              data-testid="ontology-query-unsaved"
              size="sm"
              type="pill-color">
              {t('label.unsaved-changes')}
            </Badge>
          ) : null}
        </Box>
        <QueryConsoleActions
          activeQuery={activeQuery}
          isAdminUser={isAdminUser}
          isDirty={isDirty}
          running={running}
          onDiscard={onDiscard}
          onRun={onRun}
          onSave={onSave}
          onSaveTemplate={onSaveTemplate}
          onUpdateSaved={onUpdateSaved}
        />
      </Box>

      {activeQuery.isShared && isDirty ? (
        <Box
          align="center"
          className="tw:shrink-0 tw:border-b tw:border-utility-blue-100 tw:bg-utility-blue-50 tw:px-5 tw:py-2 tw:text-utility-blue-700"
          data-testid="ontology-query-shared-hint"
          gap={2}>
          <InfoCircle aria-hidden="true" className="tw:size-4 tw:shrink-0" />
          <Typography size="text-xs">
            {t('message.editing-shared-query-hint')}
          </Typography>
        </Box>
      ) : null}
    </>
  );
};

interface SaveQueryModalProps {
  readonly t: (key: string) => string;
  readonly isOpen: boolean;
  readonly isCopyOfMyQuery: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly saveTarget: SaveTarget;
  readonly activeQueryId?: string;
  readonly saveName: string;
  readonly onSaveNameChange: (value: string) => void;
  readonly onCommitSave: () => void;
}

// Rendered separately so the title/label ternaries don't add to the parent
// console's cyclomatic complexity.
const SaveQueryModal = ({
  t,
  isOpen,
  isCopyOfMyQuery,
  onOpenChange,
  saveTarget,
  activeQueryId,
  saveName,
  onSaveNameChange,
  onCommitSave,
}: SaveQueryModalProps) => {
  const isUpdatingTemplate =
    saveTarget === 'template' && activeQueryId?.startsWith('template-');

  let title = isCopyOfMyQuery
    ? t('label.save-as-new-query')
    : t('label.save-as-my-query');
  if (saveTarget === 'template') {
    title = isUpdatingTemplate
      ? t('label.update-sample-query')
      : t('label.save-as-sample-query');
  }
  const commitLabel = isUpdatingTemplate ? t('label.update') : t('label.save');

  return (
    <ModalOverlay isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="ontology-query-save-modal"
          dividers="scroll"
          title={title}
          width={480}
          onClose={() => onOpenChange(false)}>
          <Dialog.Content>
            {saveTarget === 'personal' ? (
              <Typography
                as="p"
                className="tw:m-0 tw:mb-4 tw:text-tertiary"
                size="text-sm">
                {t('message.save-my-query-hint')}
              </Typography>
            ) : null}
            <Input
              isRequired
              inputDataTestId="ontology-query-save-name"
              label={t('label.name')}
              placeholder={t('message.sparql-save-prompt')}
              value={saveName}
              onChange={onSaveNameChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && saveName.trim()) {
                  onCommitSave();
                }
              }}
            />
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              size="sm"
              onPress={() => onOpenChange(false)}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              isDisabled={!saveName.trim()}
              size="sm"
              onPress={onCommitSave}>
              {commitLabel}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const OntologyStudioQueryConsole = ({
  createQueryOnMount,
  initialQuery,
  onQueryCreated,
  graphData,
  relationTypes,
  selectedGlossaryIds,
  selectedOntologyId,
}: OntologyStudioQueryConsoleProps) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const {
    isLoading,
    loadStatus,
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
  const newQuery = selectedOntologyId
    ? NEW_NATIVE_ONTOLOGY_QUERY
    : NEW_ONTOLOGY_QUERY;
  const [query, setQuery] = useState(
    initialQuery ?? defaultSuggestion?.query ?? newQuery
  );
  // The text the active query was opened with, so edits can be flagged and discarded.
  const [openedQuery, setOpenedQuery] = useState(query);
  const [activeQueryId, setActiveQueryId] = useState<string | undefined>(
    initialQuery ? 'draft' : defaultSuggestion?.id
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SparqlPlaygroundResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('personal');
  const [renameValue, setRenameValue] = useState<string>();
  const hasCreatedOnMountRef = useRef(false);

  const openQuery = useCallback((id: string, text: string) => {
    setQuery(text);
    setOpenedQuery(text);
    setActiveQueryId(id);
  }, []);

  useEffect(() => {
    if (!initialQuery) {
      return;
    }
    openQuery('draft', initialQuery);
    setResult(null);
    setErrorMessage(null);
  }, [initialQuery, openQuery]);

  useEffect(() => {
    const firstSuggestion = querySuggestions[0];
    if (initialQuery || activeQueryId !== undefined || !firstSuggestion) {
      return;
    }
    openQuery(firstSuggestion.id, firstSuggestion.query);
  }, [activeQueryId, initialQuery, openQuery, querySuggestions]);

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
      openQuery(firstSuggestion.id, firstSuggestion.query);
    }
  }, [activeQueryId, openQuery, querySuggestions]);

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
        const queryParams = {
          query: nextQuery,
          format: 'json' as const,
          inference: 'none' as const,
        };
        const glossaryId = selectedGlossaryIds[0];
        if (!glossaryId && !selectedOntologyId && !isAdminUser) {
          throw new Error(
            t('label.please-select-entity', { entity: t('label.glossary') })
          );
        }
        let nextResult;
        if (selectedOntologyId) {
          nextResult = await runOntologySparqlQuery(
            selectedOntologyId,
            queryParams
          );
        } else if (glossaryId) {
          nextResult = await runGlossarySparqlQuery(glossaryId, queryParams);
        } else {
          nextResult = await runSparqlQuery(queryParams);
        }
        setResult(nextResult);
      } catch (error) {
        let message: string;
        if (isAxiosError(error)) {
          message =
            typeof error.response?.data === 'string'
              ? error.response.data
              : error.message;
        } else {
          message = (error as Error).message;
        }
        setErrorMessage(message);
        showErrorToast(message);
      } finally {
        setRunning(false);
      }
    },
    [isAdminUser, selectedGlossaryIds, selectedOntologyId, t]
  );

  const runListedQuery = useCallback(
    (id: string, text: string) => {
      setRenameValue(undefined);
      openQuery(id, text);
      void executeQuery(text);
    },
    [executeQuery, openQuery]
  );

  // A new query is created under My queries straight away, so it can be renamed and saved in place.
  const handleNewQuery = useCallback(async () => {
    const id = generateUUID();
    const created = await upsertSavedQuery({
      id,
      name: t('label.untitled-query'),
      query: newQuery,
      format: 'json',
      inference: 'none',
      savedAt: Date.now(),
    });
    openQuery(created ? `saved-${id}` : 'draft', newQuery);
    setRenameValue(undefined);
    setResult(null);
    setErrorMessage(null);
  }, [newQuery, openQuery, t, upsertSavedQuery]);

  useEffect(() => {
    // The ref keeps a re-run (React strict mode) from creating a second query.
    if (
      !createQueryOnMount ||
      loadStatus !== 'ready' ||
      hasCreatedOnMountRef.current
    ) {
      return;
    }
    hasCreatedOnMountRef.current = true;
    void handleNewQuery().then(() => onQueryCreated?.());
  }, [createQueryOnMount, handleNewQuery, loadStatus, onQueryCreated]);

  const activeQuery = describeActiveQuery(
    activeQueryId,
    querySuggestions,
    queryTemplates,
    savedQueries
  );
  const activeTemplate = activeQuery.template;
  const activeTemplateId = activeQuery.templateId;
  const activeSavedQuery = activeQuery.savedQuery;
  const isDirty = activeQueryId !== 'draft' && query !== openedQuery;

  const handleSaveCurrent = useCallback(() => {
    setSaveTarget('personal');
    setSaveName(
      activeSavedQuery
        ? t('message.query-copy-name', { name: activeSavedQuery.name })
        : activeQuery.title ?? ''
    );
    setIsSaveModalOpen(true);
  }, [activeQuery.title, activeSavedQuery, t]);

  const handleRenameCommit = useCallback(async () => {
    const name = renameValue?.trim();
    if (!activeSavedQuery || !name) {
      return;
    }
    const saved = await upsertSavedQuery({ ...activeSavedQuery, name });
    if (saved) {
      setRenameValue(undefined);
    }
  }, [activeSavedQuery, renameValue, upsertSavedQuery]);

  const startRename = useCallback(
    (savedQuery: SavedSparqlQuery) => {
      if (activeQueryId !== `saved-${savedQuery.id}`) {
        openQuery(`saved-${savedQuery.id}`, savedQuery.query);
        setResult(null);
        setErrorMessage(null);
      }
      setRenameValue(savedQuery.name);
    },
    [activeQueryId, openQuery]
  );

  const handleSaveTemplate = useCallback(() => {
    setSaveTarget('template');
    setSaveName(activeTemplate?.name ?? '');
    setIsSaveModalOpen(true);
  }, [activeTemplate]);

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
      format: 'json',
      inference: 'none',
      savedAt: Date.now(),
    };
    const saved =
      saveTarget === 'template'
        ? await upsertQueryTemplate(savedQuery)
        : await upsertSavedQuery(savedQuery);

    if (saved) {
      openQuery(
        saveTarget === 'template' ? `template-${id}` : `saved-${id}`,
        query
      );
      setIsSaveModalOpen(false);
      showSuccessToast(t('message.sparql-query-saved'));
    }
  }, [
    activeTemplateId,
    openQuery,
    query,
    saveName,
    saveTarget,
    t,
    upsertQueryTemplate,
    upsertSavedQuery,
  ]);

  const handleUpdateSavedQuery = useCallback(async () => {
    if (!activeSavedQuery) {
      return;
    }
    const saved = await upsertSavedQuery({
      ...activeSavedQuery,
      query,
      savedAt: Date.now(),
    });
    if (saved) {
      setOpenedQuery(query);
      showSuccessToast(t('message.sparql-query-saved'));
    }
  }, [activeSavedQuery, query, t, upsertSavedQuery]);

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

  const handleTemplateEdit = useCallback(
    (queryTemplate: SavedSparqlQuery) => {
      openQuery(`template-${queryTemplate.id}`, queryTemplate.query);
      setResult(null);
      setErrorMessage(null);
    },
    [openQuery]
  );

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

  const sharedQueryItems: QueryListItem[] = [
    ...querySuggestions.map((suggestion: OntologyQuerySuggestion) => ({
      id: suggestion.id,
      isDirty: isDirty && activeQueryId === suggestion.id,
      label: suggestion.label,
      testId: `ontology-query-suggestion-${suggestion.id}`,
      onRun: () => runListedQuery(suggestion.id, suggestion.query),
    })),
    ...queryTemplates
      .filter(
        (template) =>
          !selectedOntologyId || !isCanonicalGlossaryQueryTemplate(template)
      )
      .map((queryTemplate) => ({
        actions: isAdminUser ? (
          <>
            <ButtonUtility
              color="tertiary"
              data-testid={`ontology-query-template-edit-${queryTemplate.id}`}
              icon={Edit03}
              size="xs"
              tooltip={`${t('label.edit')} ${queryTemplate.name}`}
              onClick={() => handleTemplateEdit(queryTemplate)}
            />
            <ButtonUtility
              color="tertiary"
              data-testid={`ontology-query-template-delete-${queryTemplate.id}`}
              icon={Trash01}
              size="xs"
              tooltip={`${t('label.delete')} ${queryTemplate.name}`}
              onClick={() => void handleDeleteTemplate(queryTemplate.id)}
            />
          </>
        ) : undefined,
        id: `template-${queryTemplate.id}`,
        isDirty: isDirty && activeQueryId === `template-${queryTemplate.id}`,
        label: queryTemplate.name,
        testId: `ontology-query-template-${queryTemplate.id}`,
        onRun: () =>
          runListedQuery(`template-${queryTemplate.id}`, queryTemplate.query),
      })),
  ];
  const myQueryItems: QueryListItem[] = savedQueries.map((savedQuery) => ({
    actions: (
      <>
        <ButtonUtility
          color="tertiary"
          data-testid={`ontology-query-saved-rename-${savedQuery.id}`}
          icon={Edit03}
          size="xs"
          tooltip={`${t('label.rename')} ${savedQuery.name}`}
          onClick={() => startRename(savedQuery)}
        />
        <ButtonUtility
          color="tertiary"
          data-testid={`ontology-query-saved-delete-${savedQuery.id}`}
          icon={Trash01}
          size="xs"
          tooltip={`${t('label.delete')} ${savedQuery.name}`}
          onClick={() => void handleDeleteSavedQuery(savedQuery.id)}
        />
      </>
    ),
    id: `saved-${savedQuery.id}`,
    isDirty: isDirty && activeQueryId === `saved-${savedQuery.id}`,
    label: savedQuery.name,
    testId: `ontology-query-saved-${savedQuery.id}`,
    onRun: () => runListedQuery(`saved-${savedQuery.id}`, savedQuery.query),
  }));

  const renderResults = () => {
    if (errorMessage) {
      return (
        <Box
          className="tw:rounded-lg tw:border tw:border-utility-error-200 tw:bg-utility-error-50 tw:px-3 tw:py-2"
          data-testid="ontology-sparql-error">
          <Typography className="tw:text-utility-error-700" size="text-sm">
            {errorMessage}
          </Typography>
        </Box>
      );
    }

    if (result) {
      return (
        <OntologyQueryResults
          graphData={graphData}
          relationshipTypes={relationTypes}
          result={result}
        />
      );
    }

    return (
      <Box
        align="center"
        className="tw:min-h-40 tw:text-center"
        data-testid="ontology-sparql-results-empty"
        direction="col"
        gap={1}
        justify="center">
        <Typography
          className="tw:text-secondary"
          size="text-sm"
          weight="medium">
          {t('label.no-results-yet')}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.run-query-to-see-results')}
        </Typography>
      </Box>
    );
  };

  return (
    <>
      <Box
        className="tw:h-full tw:bg-primary"
        data-testid="ontology-studio-query-console">
        <Box
          aria-busy={isLoading}
          className="tw:w-70 tw:shrink-0 tw:border-r tw:border-secondary"
          data-library-state={loadStatus}
          data-testid="ontology-query-sample-rail"
          direction="col">
          <Box
            align="center"
            className="tw:h-14 tw:shrink-0 tw:border-b tw:border-secondary tw:pr-2.5 tw:pl-5"
            gap={2}>
            <Typography
              className="tw:flex-1 tw:text-primary"
              size="text-sm"
              weight="medium">
              {t('label.query-plural')}
            </Typography>
            <Button
              color="link-color"
              data-testid="ontology-query-new"
              iconLeading={Plus}
              size="sm"
              onClick={() => void handleNewQuery()}>
              {t('label.new-entity', { entity: t('label.query') })}
            </Button>
          </Box>
          <Box
            className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-2 tw:pt-4 tw:pb-6"
            direction="col"
            gap={6}>
            {loadStatus === 'error' ? (
              <Typography
                className="tw:px-3 tw:text-error-primary"
                role="alert"
                size="text-sm">
                {t('server.unexpected-error')}
              </Typography>
            ) : (
              <>
                <QueryGroup
                  activeQueryId={activeQueryId}
                  emptyText={t('message.no-query-available')}
                  hint={t('message.shared-queries-description')}
                  isLoading={isLoading}
                  items={sharedQueryItems}
                  listTestId="ontology-query-template-list"
                  title={t('label.shared-queries')}
                />
                <QueryGroup
                  areActionsAlwaysVisible
                  activeQueryId={activeQueryId}
                  emptyText={t('message.my-queries-empty')}
                  hint={t('message.sparql-private-queries-description')}
                  items={myQueryItems}
                  listTestId="ontology-query-saved-list"
                  title={t('label.my-queries')}
                />
              </>
            )}
          </Box>
        </Box>

        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <QueryConsoleHeader
            activeQuery={activeQuery}
            isAdminUser={isAdminUser}
            isDirty={isDirty}
            query={query}
            rename={{
              isRenaming: renameValue !== undefined,
              value: renameValue ?? '',
              onCancel: () => setRenameValue(undefined),
              onChange: setRenameValue,
              onCommit: () => void handleRenameCommit(),
              onStart: () => setRenameValue(activeSavedQuery?.name ?? ''),
            }}
            running={running}
            onDiscard={() => setQuery(openedQuery)}
            onRun={() => void executeQuery(query)}
            onSave={handleSaveCurrent}
            onSaveTemplate={handleSaveTemplate}
            onUpdateSaved={() => void handleUpdateSavedQuery()}
          />

          <Box
            className="tw:h-2/5 tw:min-h-50 tw:shrink-0 tw:overflow-auto tw:border-b tw:border-secondary"
            data-testid="ontology-sparql-editor"
            direction="col">
            <SchemaEditor
              className="ontology-studio-query-editor"
              mode={{ name: CSMode.SPARQL }}
              options={{
                lineNumbers: true,
                lineWrapping: true,
                foldGutter: false,
                autoCloseBrackets: true,
                matchBrackets: true,
              }}
              showCopyButton={false}
              value={query}
              onChange={(value) => {
                setQuery(value);
                if (!activeQueryId) {
                  setActiveQueryId('draft');
                }
              }}
            />
          </Box>

          <Box
            className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:px-5 tw:pt-4 tw:pb-6"
            direction="col"
            gap={3}>
            {renderResults()}
          </Box>
        </Box>
      </Box>

      <SaveQueryModal
        activeQueryId={activeQueryId}
        isCopyOfMyQuery={Boolean(activeSavedQuery)}
        isOpen={isSaveModalOpen}
        saveName={saveName}
        saveTarget={saveTarget}
        t={t}
        onCommitSave={() => void handleCommitSave()}
        onOpenChange={setIsSaveModalOpen}
        onSaveNameChange={setSaveName}
      />
    </>
  );
};

export default OntologyStudioQueryConsole;
