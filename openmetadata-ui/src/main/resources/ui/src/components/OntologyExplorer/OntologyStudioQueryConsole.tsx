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

import { Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import {
  Badge,
  Box,
  Button,
  ButtonUtility,
  Dialog,
  Dropdown,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Copy01,
  Edit01,
  InfoCircle,
  Lock01,
  Play,
  Plus,
  Search,
  Trash01,
  User01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import {
  FC,
  ReactNode,
  RefObject,
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
import { NavigatorHelper } from '../../utils/NavigatorUtils';
import { generateUUID } from '../../utils/StringUtils';
import { showSuccessToast } from '../../utils/ToastUtils';
import SchemaEditor from '../Database/SchemaEditor/SchemaEditor';
import { OntologyGraphData } from './OntologyExplorer.interface';
import {
  describeQueryError,
  QueryErrorDisplay,
} from './OntologyQueryError.utils';
import OntologyQueryResults, {
  QueryResultsEmptyState,
} from './OntologyQueryResults';
import { describeTimeAgo } from './OntologyQueryResults.utils';
import {
  buildQueryScopeLabel,
  OntologyQueryScope,
} from './OntologyQueryScope.utils';
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
  /** What a native ontology's queries read: the active release or the working draft. */
  readonly queryScope?: OntologyQueryScope;
  readonly graphData: OntologyGraphData | null;
  readonly relationTypes: RelationshipType[];
  readonly selectedGlossaryIds: string[];
  readonly selectedOntologyId?: string;
}

type SaveTarget = 'personal' | 'template';

const SPARQL_QUERY_FORM = /\b(SELECT|CONSTRUCT|ASK|DESCRIBE)\b/i;

const GRAPH_QUERY_FORMS = new Set(['CONSTRUCT', 'DESCRIBE']);

const META_SEPARATOR = ' · ';

// SELECT / CONSTRUCT / ASK / DESCRIBE, read past the PREFIX declarations.
function getQueryForm(query: string): string {
  return (query.match(SPARQL_QUERY_FORM)?.[1] ?? 'SELECT').toUpperCase();
}

interface QueryListItem {
  readonly id: string;
  readonly isDirty?: boolean;
  readonly label: string;
  readonly subtitle?: string;
  readonly testId: string;
  readonly actions?: ReactNode;
  readonly onRun: () => void;
}

interface QueryGroupProps {
  readonly emptyText: string;
  readonly icon: FC<{ className?: string }>;
  readonly isLoading?: boolean;
  readonly items: QueryListItem[];
  readonly activeQueryId?: string;
  readonly listTestId: string;
  readonly title: string;
}

const QueryGroup = ({
  emptyText,
  icon: Icon,
  isLoading,
  items,
  activeQueryId,
  listTestId,
  title,
}: QueryGroupProps) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={1}>
      <Box align="center" className="tw:px-1 tw:pb-1" gap={2}>
        <Icon
          aria-hidden="true"
          className="tw:size-3.5 tw:text-fg-quaternary"
        />
        <Typography size="text-sm" weight="medium">
          {title}
        </Typography>
        <Badge color="gray" size="sm" type="pill-color">
          {items.length}
        </Badge>
      </Box>
      {isLoading && items.length === 0 ? (
        <Typography className="tw:px-1" color="secondary" size="text-xs">
          {t('label.loading')}
        </Typography>
      ) : null}
      {!isLoading && items.length === 0 ? (
        <Typography className="tw:px-1" color="quaternary" size="text-xs">
          {emptyText}
        </Typography>
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
                    'tw:min-w-0 tw:flex-1 tw:justify-start tw:py-2 tw:pl-2.5 tw:text-left',
                    'tw:*:data-text:min-w-0 tw:*:data-text:w-full tw:*:data-text:truncate',
                    isActive
                      ? 'tw:font-medium tw:text-brand-secondary'
                      : 'tw:font-normal tw:text-primary'
                  )}
                  color="tertiary"
                  data-testid={item.testId}
                  size="sm"
                  title={item.label}
                  onClick={item.onRun}>
                  <span className="tw:block tw:truncate">{item.label}</span>
                  {item.subtitle ? (
                    <span className="tw:block tw:truncate tw:text-xs tw:font-normal tw:text-tertiary">
                      {item.subtitle}
                    </span>
                  ) : null}
                </Button>
                {item.isDirty ? (
                  <span
                    aria-label={t('label.unsaved-changes')}
                    className="tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-fg-warning-secondary"
                    role="img"
                  />
                ) : null}
                {item.actions ? (
                  // Row actions stay out of the way until the row is hovered or focused.
                  <Box
                    align="center"
                    className="tw:gap-0.5 tw:opacity-0 tw:transition-opacity tw:group-hover:opacity-100 tw:group-focus-within:opacity-100">
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
  readonly inputRef: RefObject<HTMLInputElement>;
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

// A query under My queries is renamed in place; shared ones are read-only.
const QueryTitle = ({ activeQuery, rename }: QueryTitleProps) => {
  const { t } = useTranslation();
  const { savedQuery } = activeQuery;

  if (savedQuery) {
    const commitOrCancel = () =>
      rename.isRenaming &&
      rename.value.trim() &&
      rename.value.trim() !== savedQuery.name
        ? rename.onCommit()
        : rename.onCancel();

    return (
      <Input
        borderless
        aria-label={t('label.name')}
        fontSize="lg"
        inputClassName="tw:font-semibold"
        inputDataTestId="ontology-query-rename-input"
        ref={rename.inputRef}
        size="sm"
        value={rename.isRenaming ? rename.value : savedQuery.name}
        wrapperClassName="tw:w-80 tw:max-w-full"
        onBlur={commitOrCancel}
        onChange={(value) => {
          if (!rename.isRenaming) {
            rename.onStart();
          }
          rename.onChange(value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitOrCancel();
          }
          if (event.key === 'Escape') {
            rename.onCancel();
          }
        }}
      />
    );
  }

  return (
    <Typography
      ellipsis
      className="tw:min-w-0"
      data-testid="ontology-query-title"
      size="text-lg"
      weight="semibold">
      {activeQuery.title ?? t('label.untitled-query')}
    </Typography>
  );
};

interface QueryConsoleHeaderProps {
  readonly activeQuery: ActiveQuery;
  readonly rename: QueryRename;
  readonly isAdminUser?: boolean;
  readonly isDirty: boolean;
  readonly query: string;
  readonly running: boolean;
  readonly onDelete: () => void;
  readonly onDiscard: () => void;
  readonly onDuplicate: () => void;
  readonly onRun: () => void;
  readonly onSave: () => void;
  readonly onSaveTemplate: () => void;
  readonly onUpdateSaved: () => void;
}

type QueryConsoleActionsProps = Omit<
  QueryConsoleHeaderProps,
  'query' | 'rename'
>;

// Rarely used saves and Discard live behind "⋯" so the header keeps Duplicate, Save and Run.
const QueryMoreActions = ({
  activeQuery,
  isAdminUser,
  isDirty,
  onDiscard,
  onSave,
  onSaveTemplate,
}: QueryConsoleActionsProps) => {
  const { t } = useTranslation();

  return (
    <Dropdown.Root>
      <Dropdown.DotsButton
        color="secondary"
        data-testid="ontology-query-more"
        size="lg"
      />
      <Dropdown.Popover className="tw:w-56">
        <Dropdown.Menu aria-label={t('label.more-actions')}>
          <Dropdown.Item
            data-testid="ontology-query-save"
            label={
              activeQuery.savedQuery
                ? t('label.save-as-new')
                : t('label.save-as-my-query')
            }
            onAction={onSave}
          />
          {isAdminUser ? (
            <Dropdown.Item
              data-testid="ontology-query-save-template"
              label={
                activeQuery.template
                  ? t('label.update-sample-query')
                  : t('label.save-as-sample-query')
              }
              onAction={onSaveTemplate}
            />
          ) : null}
          {isDirty ? (
            <Dropdown.Item
              data-testid="ontology-query-discard"
              label={t('label.discard')}
              onAction={onDiscard}
            />
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const QueryConsoleActions = (props: QueryConsoleActionsProps) => {
  const { activeQuery, isDirty, running, onDelete, onDuplicate, onRun } = props;
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:ml-auto" gap={2} wrap="wrap">
      <QueryMoreActions {...props} />
      {activeQuery.savedQuery ? (
        <>
          <ButtonUtility
            color="tertiary-destructive"
            data-testid="ontology-query-delete"
            icon={Trash01}
            size="sm"
            tooltip={t('label.delete-entity', {
              entity: t('label.query').toLocaleLowerCase(),
            })}
            onClick={onDelete}
          />
          <ButtonUtility
            data-testid="ontology-query-duplicate"
            icon={Copy01}
            size="sm"
            tooltip={t('label.duplicate')}
            onClick={onDuplicate}
          />
          <Button
            color="secondary"
            data-testid="ontology-query-update"
            isDisabled={!isDirty}
            size="sm"
            onClick={props.onUpdateSaved}>
            {isDirty ? t('label.save') : t('label.saved')}
          </Button>
        </>
      ) : (
        <Button
          color="secondary"
          data-testid="ontology-query-duplicate"
          iconLeading={Copy01}
          size="sm"
          onClick={onDuplicate}>
          {t(
            activeQuery.isShared ? 'label.duplicate-to-edit' : 'label.duplicate'
          )}
        </Button>
      )}
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

function describeQuerySubtitle(
  activeQuery: ActiveQuery,
  t: (key: string, options?: Record<string, unknown>) => string
): string | undefined {
  if (activeQuery.isShared) {
    return t('message.shared-with-everyone');
  }
  if (activeQuery.savedQuery) {
    return [
      t('label.saved-time', {
        time: describeTimeAgo(
          activeQuery.savedQuery.savedAt,
          t('label.just-now')
        ),
      }),
      t('message.only-visible-to-you'),
    ].join(META_SEPARATOR);
  }

  return undefined;
}

const QueryConsoleHeader = ({
  activeQuery,
  rename,
  isDirty,
  query,
  ...actions
}: QueryConsoleHeaderProps) => {
  const { t } = useTranslation();
  const subtitle = describeQuerySubtitle(activeQuery, t);

  return (
    <>
      <Box
        align="center"
        className="tw:min-h-16 tw:shrink-0 tw:border-b tw:border-secondary tw:px-5 tw:py-3"
        gap={3}
        wrap="wrap">
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <Box align="center" gap={2} wrap="wrap">
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
                {t('label.read-only')}
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
          {subtitle ? (
            <Typography
              color="secondary"
              data-testid="ontology-query-subtitle"
              size="text-sm">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <QueryConsoleActions
          activeQuery={activeQuery}
          isDirty={isDirty}
          {...actions}
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

interface QueryStatusBarProps {
  readonly canSave: boolean;
  readonly isReadOnly: boolean;
  readonly query: string;
  readonly scopeLabel?: string;
}

const QueryStatusBar = ({
  canSave,
  isReadOnly,
  query,
  scopeLabel,
}: QueryStatusBarProps) => {
  const { t } = useTranslation();
  const mod = NavigatorHelper.isMacOs() ? '⌘' : t('label.ctrl-key');
  const hints = [t('label.mod-enter-to-run', { mod })];
  if (canSave) {
    hints.push(t('label.mod-s-to-save', { mod }));
  }
  if (isReadOnly) {
    hints.push(t('label.read-only'));
  }

  return (
    <Box
      align="center"
      className="tw:h-8 tw:shrink-0 tw:border-b tw:border-secondary tw:bg-secondary tw:px-4"
      data-testid="ontology-query-status-bar"
      gap={3}
      justify="between">
      <Typography color="secondary" size="text-xs">
        {t('label.line-count', { count: query.split('\n').length })}
        {scopeLabel ? (
          <>
            {META_SEPARATOR}
            <span data-testid="ontology-query-scope">{scopeLabel}</span>
          </>
        ) : null}
      </Typography>
      <Typography color="secondary" size="text-xs">
        {hints.join(META_SEPARATOR)}
      </Typography>
    </Box>
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

const getNewQueryTemplate = (selectedOntologyId: string | undefined) =>
  selectedOntologyId ? NEW_NATIVE_ONTOLOGY_QUERY : NEW_ONTOLOGY_QUERY;

const OntologyStudioQueryConsole = ({
  createQueryOnMount,
  initialQuery,
  onQueryCreated,
  queryScope,
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
  const newQuery = getNewQueryTemplate(selectedOntologyId);
  const [query, setQuery] = useState(
    initialQuery ?? defaultSuggestion?.query ?? newQuery
  );
  // The text the active query was opened with, so edits can be flagged and discarded.
  const [openedQuery, setOpenedQuery] = useState(query);
  const [activeQueryId, setActiveQueryId] = useState<string | undefined>(
    initialQuery ? 'draft' : defaultSuggestion?.id
  );
  const [running, setRunning] = useState(false);
  // The scope is kept with the result: switching the version later must not relabel old rows.
  const [result, setResult] = useState<{
    readonly data: SparqlPlaygroundResult;
    readonly ranAt: number;
    readonly scopeLabel?: string;
  } | null>(null);
  const [queryError, setQueryError] = useState<QueryErrorDisplay | null>(null);
  const [findText, setFindText] = useState('');
  const scopeLabel = queryScope
    ? buildQueryScopeLabel(queryScope, t)
    : undefined;
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('personal');
  const [renameValue, setRenameValue] = useState<string>();
  const renameInputRef = useRef<HTMLInputElement>(null);
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
    setQueryError(null);
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
        setQueryError({
          title: t('message.query-error-empty-title'),
          hint: t('message.sparql-empty-query-error'),
        });

        return;
      }
      setRunning(true);
      setResult(null);
      setQueryError(null);
      try {
        // CONSTRUCT and DESCRIBE return a graph, which the server refuses to write as JSON.
        const queryParams = {
          query: nextQuery,
          format: GRAPH_QUERY_FORMS.has(getQueryForm(nextQuery))
            ? ('turtle' as const)
            : ('json' as const),
          inference: 'none' as const,
        };
        const glossaryId = selectedGlossaryIds[0];
        if (!glossaryId && !selectedOntologyId && !isAdminUser) {
          throw new Error(t('message.ontology-select-glossary-to-query'));
        }
        let nextResult;
        if (selectedOntologyId) {
          nextResult = await runOntologySparqlQuery(
            selectedOntologyId,
            queryParams,
            { scope: queryScope?.version === 'draft' ? 'draft' : 'release' }
          );
        } else if (glossaryId) {
          nextResult = await runGlossarySparqlQuery(glossaryId, queryParams);
        } else {
          nextResult = await runSparqlQuery(queryParams);
        }
        setResult({ data: nextResult, ranAt: Date.now(), scopeLabel });
      } catch (error) {
        setQueryError(
          describeQueryError(error, { isAdmin: Boolean(isAdminUser), t })
        );
      } finally {
        setRunning(false);
      }
    },
    [
      isAdminUser,
      queryScope?.version,
      scopeLabel,
      selectedGlossaryIds,
      selectedOntologyId,
      t,
    ]
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
    setQueryError(null);
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
        setQueryError(null);
      }
      setRenameValue(savedQuery.name);
      // The title input mounts once the query opens, so focus it on the next tick.
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
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

  const duplicateIntoMyQueries = useCallback(
    async (name: string, text: string) => {
      const id = generateUUID();
      const saved = await upsertSavedQuery({
        id,
        name: t('message.query-copy-name', { name }),
        query: text,
        format: 'json',
        inference: 'none',
        savedAt: Date.now(),
      });
      if (saved) {
        openQuery(`saved-${id}`, text);
        setResult(null);
        setQueryError(null);
        showSuccessToast(t('message.query-duplicated'));
      }
    },
    [openQuery, t, upsertSavedQuery]
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

  const handleTemplateEdit = useCallback(
    (queryTemplate: SavedSparqlQuery) => {
      openQuery(`template-${queryTemplate.id}`, queryTemplate.query);
      setResult(null);
      setQueryError(null);
    },
    [openQuery]
  );

  // The editor keymap is built once, so it reads the current handlers through this ref.
  const shortcutsRef = useRef<{ run: () => void; save?: () => void }>({
    run: () => undefined,
  });
  useEffect(() => {
    shortcutsRef.current = {
      run: () => {
        if (!running) {
          void executeQuery(query);
        }
      },
      save:
        activeSavedQuery && isDirty
          ? () => void handleUpdateSavedQuery()
          : undefined,
    };
  });
  const editorExtensions = useMemo(
    () => [
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              shortcutsRef.current.run();

              return true;
            },
          },
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              shortcutsRef.current.save?.();

              return true;
            },
          },
        ])
      ),
    ],
    []
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

  const matchesFind = (label: string) =>
    label.toLocaleLowerCase().includes(findText.trim().toLocaleLowerCase());
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
              data-testid={`ontology-query-template-edit-${queryTemplate.id}`}
              icon={Edit01}
              size="sm"
              tooltip={`${t('label.edit')} ${queryTemplate.name}`}
              onClick={() => handleTemplateEdit(queryTemplate)}
            />
            <ButtonUtility
              color="tertiary-destructive"
              data-testid={`ontology-query-template-delete-${queryTemplate.id}`}
              icon={Trash01}
              size="sm"
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
  ].filter((item) => matchesFind(item.label));
  const myQueryItems: QueryListItem[] = savedQueries
    .filter((savedQuery) => matchesFind(savedQuery.name))
    .map((savedQuery) => ({
      actions: (
        <>
          <ButtonUtility
            data-testid={`ontology-query-saved-duplicate-${savedQuery.id}`}
            icon={Copy01}
            size="sm"
            tooltip={`${t('label.duplicate')} ${savedQuery.name}`}
            onClick={() =>
              void duplicateIntoMyQueries(savedQuery.name, savedQuery.query)
            }
          />
          <ButtonUtility
            data-testid={`ontology-query-saved-rename-${savedQuery.id}`}
            icon={Edit01}
            size="sm"
            tooltip={`${t('label.rename')} ${savedQuery.name}`}
            onClick={() => startRename(savedQuery)}
          />
          <ButtonUtility
            color="tertiary-destructive"
            data-testid={`ontology-query-saved-delete-${savedQuery.id}`}
            icon={Trash01}
            size="sm"
            tooltip={`${t('label.delete')} ${savedQuery.name}`}
            onClick={() => void handleDeleteSavedQuery(savedQuery.id)}
          />
        </>
      ),
      id: `saved-${savedQuery.id}`,
      isDirty: isDirty && activeQueryId === `saved-${savedQuery.id}`,
      label: savedQuery.name,
      subtitle: t('label.saved-time', {
        time: describeTimeAgo(savedQuery.savedAt, t('label.just-now')),
      }),
      testId: `ontology-query-saved-${savedQuery.id}`,
      onRun: () => runListedQuery(`saved-${savedQuery.id}`, savedQuery.query),
    }));
  const isFinding = findText.trim() !== '';
  const searchLabel = t('label.search-entity', {
    entity: t('label.query-plural').toLocaleLowerCase(),
  });

  const renderResults = () => {
    if (queryError) {
      return (
        <Box
          className="tw:rounded-lg tw:border tw:border-utility-error-200 tw:bg-utility-error-50 tw:px-3 tw:py-2"
          data-testid="ontology-sparql-error"
          direction="col"
          gap={1}
          role="alert">
          <Typography
            className="tw:text-utility-error-700"
            data-testid="ontology-sparql-error-title"
            size="text-sm"
            weight="semibold">
            {queryError.title}
          </Typography>
          <Typography
            className="tw:text-utility-error-700"
            data-testid="ontology-sparql-error-hint"
            size="text-sm">
            {queryError.hint}
          </Typography>
        </Box>
      );
    }

    if (result) {
      return (
        <OntologyQueryResults
          exportName={activeQuery.title}
          graphData={graphData}
          ranAt={result.ranAt}
          relationshipTypes={relationTypes}
          result={result.data}
          scopeLabel={result.scopeLabel}
        />
      );
    }

    return <QueryResultsEmptyState isRunning={running} />;
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
          <Box align="center" className="tw:shrink-0 tw:px-4 tw:pt-4" gap={2}>
            <Typography className="tw:flex-1" size="text-md" weight="semibold">
              {t('label.query-plural')}
            </Typography>
            <ButtonUtility
              color="secondary"
              data-testid="ontology-query-new"
              icon={Plus}
              size="lg"
              tooltip={t('label.new-entity', {
                entity: t('label.query').toLocaleLowerCase(),
              })}
              onClick={() => void handleNewQuery()}
            />
          </Box>
          <Box className="tw:shrink-0 tw:px-4 tw:pt-3">
            <Input
              aria-label={searchLabel}
              autoComplete="off"
              icon={Search}
              inputDataTestId="ontology-query-find"
              placeholder={searchLabel}
              size="sm"
              value={findText}
              onChange={setFindText}
            />
          </Box>
          <Box
            className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-2 tw:pt-4 tw:pb-6"
            direction="col"
            gap={3}>
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
                  emptyText={
                    isFinding
                      ? t('message.no-match-found')
                      : t('message.my-queries-empty')
                  }
                  icon={User01}
                  items={myQueryItems}
                  listTestId="ontology-query-saved-list"
                  title={t('label.my-queries')}
                />
                <hr className="tw:mx-1 tw:border-secondary" />
                <QueryGroup
                  activeQueryId={activeQueryId}
                  emptyText={
                    isFinding
                      ? t('message.no-match-found')
                      : t('message.no-query-available')
                  }
                  icon={Lock01}
                  isLoading={isLoading}
                  items={sharedQueryItems}
                  listTestId="ontology-query-template-list"
                  title={t('label.shared')}
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
              inputRef: renameInputRef,
              isRenaming: renameValue !== undefined,
              value: renameValue ?? '',
              onCancel: () => setRenameValue(undefined),
              onChange: setRenameValue,
              onCommit: () => void handleRenameCommit(),
              onStart: () => setRenameValue(activeSavedQuery?.name ?? ''),
            }}
            running={running}
            onDelete={() =>
              activeSavedQuery &&
              void handleDeleteSavedQuery(activeSavedQuery.id)
            }
            onDiscard={() => setQuery(openedQuery)}
            onDuplicate={() =>
              void duplicateIntoMyQueries(
                activeQuery.title ?? t('label.untitled-query'),
                query
              )
            }
            onRun={() => void executeQuery(query)}
            onSave={handleSaveCurrent}
            onSaveTemplate={handleSaveTemplate}
            onUpdateSaved={() => void handleUpdateSavedQuery()}
          />

          <Box
            className="tw:h-2/5 tw:min-h-50 tw:shrink-0 tw:overflow-auto"
            data-testid="ontology-sparql-editor"
            direction="col">
            <SchemaEditor
              className="ontology-studio-query-editor"
              extensions={editorExtensions}
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
          <QueryStatusBar
            canSave={Boolean(activeSavedQuery)}
            isReadOnly={activeQuery.isShared}
            query={query}
            scopeLabel={scopeLabel}
          />

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
