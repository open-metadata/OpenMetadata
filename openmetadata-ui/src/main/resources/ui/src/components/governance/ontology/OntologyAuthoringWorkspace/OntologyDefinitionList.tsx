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
  ButtonUtility,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Plus,
  Shield01,
  Trash01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import { Fragment, ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { useOntologyDraftGuard } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { restoreOntologyDefinition } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showUndoToast } from '../../../../utils/governance/ontology/OntologyUndoToast';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DeleteEntityModal from '../../../common/DeleteWidget/DeleteEntityModal';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../../../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
import Loader from '../../../common/Loader/Loader';
import OntologyStudioDrawer from '../OntologyStudioDrawer/OntologyStudioDrawer';
import OntologyConceptDeleteDialog from './OntologyConceptDeleteDialog';
import { pageCount, pageOf } from './OntologyDefinitionTable.utils';

export interface DefinitionColumn<T> {
  readonly id: string;
  readonly label: string;
  readonly render: (item: T) => ReactNode;
  /** A fixed width, e.g. `tw:w-24`; columns without one share what is left. */
  readonly width?: string;
  /** Numbers read right-aligned. */
  readonly align?: 'end';
  /** Names the row for assistive tech when the Name column is hidden. */
  readonly isRowHeader?: boolean;
}

/** Whether the open editor may change its definition; view mode never can. */
const editorCanEdit = (
  isReadOnly: boolean,
  isNew: boolean,
  canCreate: boolean,
  canEditAll: boolean
) => !isReadOnly && (isNew ? canCreate : canEditAll);

/**
 * What Add does: opens the form here in Edit, or asks for Edit from View mode.
 * Undefined when the user cannot create, or View mode offers no way to Edit.
 */
const createAction = (
  canCreate: boolean,
  isReadOnly: boolean,
  requestEdit: (() => void) | undefined,
  openHere: () => void
) => {
  if (!canCreate) {
    return undefined;
  }

  return isReadOnly ? requestEdit : openHere;
};

interface OntologyDefinitionListProps<T> {
  ontology: Ontology;
  canCreate: boolean;
  /** View mode: rows open read-only and nothing can be added. */
  isReadOnly?: boolean;
  /** Every definition of this kind before filters, so an empty list can say why it is empty. */
  totalCount?: number;
  /** View mode's Add: switches to Edit instead of opening the form here. */
  onRequestCreate?: () => void;
  /** Set when Edit was entered from View mode's Add, to open the create form once. */
  shouldOpenCreate?: boolean;
  onCreateOpened?: () => void;
  definitionType: 'concept' | 'property' | 'axiom';
  /** The rows after the tab's search and filters; undefined while the model loads. */
  items?: readonly T[];
  isError?: boolean;
  onRetry?: () => void;
  /** Called after a create, save, delete or undo so the tab reloads its rows. */
  onChanged?: () => void;
  /** Columns after Name. */
  columns: readonly DefinitionColumn<T>[];
  /** Drops the Name column, for definitions whose own column already names them. */
  hideNameColumn?: boolean;
  rowClassName?: (item: T) => string | undefined;
  /** A full-width row under the item when it returns content; `open` opens a row's editor. */
  renderDetail?: (item: T, open: (item: T) => void) => ReactNode;
  /** Buttons between the count and Add. */
  actions?: ReactNode;
  /** Search and filters, left of the count. */
  toolbar?: ReactNode;
  /** A notice between the controls and the table, such as unresolved conflicts. */
  banner?: ReactNode;
  /** "6 concepts" or "3 of 8", right of the filters. */
  summary?: ReactNode;
  /** Changes whenever the tab's search or filters change, which sends the list back to its first page. */
  filterKey?: string;
  /** Replaces the side editor for a row, e.g. to open a concept on the graph. */
  onOpen?: (item: T) => void;
  /**
   * Replaces the editor for a new definition with one that opens its own drawer; `saved` is set
   * once, to keep the new one open.
   */
  renderCreate?: (actions: {
    close: () => void;
    onCreated: (saved?: T) => void;
  }) => ReactNode;
  children: (
    definition: T | undefined,
    canEdit: boolean,
    onSaved: (saved: T) => void,
    close: () => void
  ) => ReactNode;
}

const DEFINITION_RESOURCES = {
  concept: ResourceEntity.ONTOLOGY_CONCEPT,
  property: ResourceEntity.ONTOLOGY_PROPERTY,
  axiom: ResourceEntity.ONTOLOGY_AXIOM,
};
const DEFINITION_ENTITIES = {
  concept: EntityType.ONTOLOGY_CONCEPT,
  property: EntityType.ONTOLOGY_PROPERTY,
  axiom: EntityType.ONTOLOGY_AXIOM,
};
// Narrower than the table's default padding, so every column fits at 1440 wide.
const CELL_PADDING = 'tw:px-3 tw:first:pl-5 tw:last:pr-5';

const columnClassName = <T,>(column: DefinitionColumn<T>) =>
  [CELL_PADDING, column.width, column.align === 'end' ? 'tw:text-right' : '']
    .filter(Boolean)
    .join(' ');

/** The page index, back to the first page whenever `resetKey` changes. */
const usePageResetOn = (resetKey?: string) => {
  const [page, setPage] = useState(0);
  const [pagedKey, setPagedKey] = useState(resetKey);
  if (pagedKey !== resetKey) {
    setPagedKey(resetKey);
    setPage(0);
  }

  return [page, setPage] as const;
};

const OntologyDefinitionList = <
  T extends Pick<
    OntologyConcept,
    'id' | 'name' | 'displayName' | 'version' | 'deleted'
  >
>({
  ontology,
  canCreate: canCreateProp,
  isReadOnly = false,
  totalCount,
  onRequestCreate,
  shouldOpenCreate,
  onCreateOpened,
  definitionType,
  items,
  isError,
  onRetry,
  onChanged,
  columns,
  hideNameColumn,
  rowClassName,
  renderDetail,
  actions,
  toolbar,
  banner,
  summary,
  filterKey,
  onOpen,
  children,
  renderCreate,
}: OntologyDefinitionListProps<T>) => {
  const canCreate = editorCanEdit(isReadOnly, true, canCreateProp, false);
  const { t } = useTranslation();
  const guard = useOntologyDraftGuard();
  const label = definitionType === 'axiom' ? 'constraint' : definitionType;
  const entityLabel = t(`label.${label}`);
  // Sentence case: "Add concept", not "Add Concept".
  const entityText = entityLabel.toLocaleLowerCase();
  const pluralLabel = t(`label.${label}-plural`);
  const [page, setPage] = usePageResetOn(filterKey);
  const [selected, setSelected] = useState<T | 'new'>();
  const startCreate = createAction(
    canCreateProp,
    isReadOnly,
    onRequestCreate,
    () => guard(() => setSelected('new'))
  );
  // Edit entered from View mode's Add opens the create form once permissions allow it.
  useEffect(() => {
    if (shouldOpenCreate && canCreate) {
      setSelected('new');
      onCreateOpened?.();
    }
  }, [shouldOpenCreate, canCreate, onCreateOpened]);
  const [isDeleting, setIsDeleting] = useState(false);
  const definition = selected === 'new' ? undefined : selected;
  const permission = useEntityPermissions(
    DEFINITION_RESOURCES[definitionType],
    { id: definition?.id ?? '' },
    {
      enabled: Boolean(definition),
      deleted: definition?.deleted,
    }
  );
  if (isError) {
    return (
      <Alert
        rightContent={
          <Button color="secondary" size="sm" onPress={onRetry}>
            {t('label.retry')}
          </Button>
        }
        variant="error">
        {t('server.entity-fetch-error', {
          entity: pluralLabel,
        })}
      </Alert>
    );
  }

  const offerUndo = (
    deleted: T,
    restore = () => restoreOntologyDefinition(definitionType, deleted.id)
  ) =>
    showUndoToast(
      t('message.ontology-definition-deleted', {
        name: getEntityName(deleted),
      }),
      async () => {
        try {
          await restore();
          onChanged?.();
        } catch (error) {
          showErrorToast(
            isAxiosError(error) ? error : t('server.unexpected-error')
          );
        }
      }
    );

  const closeAfterDelete = () => {
    setIsDeleting(false);
    setSelected(undefined);
    onChanged?.();
  };

  const renderDeleteDialog = () => {
    if (!definition || !isDeleting) {
      return null;
    }

    return definitionType === 'concept' ? (
      <OntologyConceptDeleteDialog
        concept={definition}
        onCancel={() => setIsDeleting(false)}
        onDeleted={({ restore }) => {
          closeAfterDelete();
          offerUndo(definition, restore);
        }}
      />
    ) : (
      <DeleteEntityModal
        allowSoftDelete
        visible
        afterDeleteAction={(isSoftDelete) => {
          closeAfterDelete();
          if (isSoftDelete) {
            offerUndo(definition);
          }
        }}
        entityId={definition.id}
        entityName={getEntityName(definition)}
        entityType={DEFINITION_ENTITIES[definitionType]}
        onCancel={() => setIsDeleting(false)}
      />
    );
  };

  const renderDeleteAction = () =>
    definition && permission.canDelete ? (
      <ButtonUtility
        aria-label={t('label.delete')}
        color="tertiary"
        data-testid="ontology-definition-delete"
        icon={Trash01}
        size="sm"
        tooltip={t('label.delete')}
        onClick={() => setIsDeleting(true)}
      />
    ) : null;

  const closeEditor = () => guard(() => setSelected(undefined));

  const renderEditorForm = () => (
    <Fragment
      key={definition ? definition.id + ':' + definition.version : 'new'}>
      {children(
        definition,
        editorCanEdit(
          isReadOnly,
          selected === 'new',
          canCreate,
          permission.canEditAll
        ),
        (saved) => {
          setSelected(saved);
          onChanged?.();
        },
        closeEditor
      )}
      {renderDeleteDialog()}
    </Fragment>
  );

  const renderCreateForm = (create: NonNullable<typeof renderCreate>) =>
    create({
      close: closeEditor,
      onCreated: (saved) => {
        if (saved) {
          setSelected(saved);
        }
        onChanged?.();
      },
    });

  const renderBlockedState = () => {
    if (definition && permission.isLoading) {
      return <Loader size="small" />;
    }
    if (definition && !permission.hasViewAccess) {
      return (
        <Alert variant="error">
          {t('server.entity-fetch-error', { entity: entityLabel })}
        </Alert>
      );
    }

    return null;
  };

  // Row editors open in the Studio's right slide-over, beside the list.
  const renderDrawer = (title: string, content: ReactNode) => (
    <OntologyStudioDrawer
      testId="ontology-definition-drawer"
      // Unguarded: the drawer runs its own discard prompt first.
      onInteractOutside={() => setSelected(undefined)}>
      <Box
        align="center"
        className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-6 tw:py-4"
        gap={3}>
        {/* The design gives a constraint a shield tile and puts its ontology under the title. */}
        {definitionType === 'axiom' ? (
          <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:shadow-xs">
            <Shield01 aria-hidden className="tw:size-5 tw:text-fg-secondary" />
          </span>
        ) : null}
        <Box
          className={classNames(
            'tw:min-w-0 tw:flex-1',
            definitionType === 'axiom' && 'tw:flex-col-reverse'
          )}
          direction="col">
          <Typography color="secondary" size="text-sm">
            {t('label.in-entity', { entity: getEntityName(ontology) })}
          </Typography>
          <Typography
            ellipsis
            as="h2"
            className="not-prose tw:m-0 tw:text-primary"
            size="text-lg"
            weight="semibold">
            {title}
          </Typography>
        </Box>
        {renderDeleteAction()}
        <ButtonUtility
          data-testid="ontology-definition-drawer-close"
          icon={XClose}
          size="lg"
          tooltip={t('label.close')}
          onClick={closeEditor}
        />
      </Box>
      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-6"
        direction="col"
        gap={4}>
        {content}
      </Box>
    </OntologyStudioDrawer>
  );

  const renderEditor = () => {
    if (!selected) {
      return null;
    }
    if (selected === 'new' && renderCreate) {
      // Wrapping it in this drawer too stacked an empty drawer over the form.
      return renderCreateForm(renderCreate);
    }
    const blocked = renderBlockedState();
    if (blocked) {
      return blocked;
    }

    return renderDrawer(
      definition
        ? getEntityName(definition)
        : t('label.new-entity', { entity: entityText }),
      renderEditorForm()
    );
  };

  const total = items?.length ?? 0;
  const lastPage = pageCount(total) - 1;
  const currentPage = Math.min(page, lastPage);

  const renderPagination = () => (
    <>
      <Button
        color="secondary"
        isDisabled={currentPage === 0}
        size="sm"
        onPress={() =>
          guard(() => {
            setSelected(undefined);
            setPage(currentPage - 1);
          })
        }>
        {t('label.previous')}
      </Button>
      <Button
        color="secondary"
        isDisabled={currentPage >= lastPage}
        size="sm"
        onPress={() =>
          guard(() => {
            setSelected(undefined);
            setPage(currentPage + 1);
          })
        }>
        {t('label.next')}
      </Button>
    </>
  );

  const openRow = (item: T) =>
    guard(() => (onOpen ? onOpen(item) : setSelected(item)));

  const toRows = (page: readonly T[]) =>
    page.flatMap((item) => {
      const detail = renderDetail?.(item, openRow);

      return detail
        ? [
            { id: item.id, item },
            { id: `${item.id}-detail`, item, detail },
          ]
        : [{ id: item.id, item }];
    });

  const renderNameCell = (item: T) => (
    <Table.Cell className={CELL_PADDING}>
      <Box align="center" className="tw:min-w-0 tw:overflow-hidden" gap={2}>
        {definitionType === 'concept' ? (
          <span
            aria-hidden
            className="tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-fg-brand-primary"
          />
        ) : null}
        <Button
          ellipsis
          className="tw:min-w-0 tw:max-w-full tw:overflow-hidden"
          color="link-gray"
          size="sm"
          onPress={() => openRow(item)}>
          <span className="tw:font-semibold tw:text-primary">
            {getEntityName(item)}
          </span>
        </Button>
      </Box>
    </Table.Cell>
  );

  const renderRow = ({ id, item, detail }: ReturnType<typeof toRows>[0]) =>
    detail ? (
      <Table.Row className={rowClassName?.(item)} id={id}>
        <Table.Cell
          className={CELL_PADDING}
          colSpan={columns.length + (hideNameColumn ? 0 : 1)}>
          {detail}
        </Table.Cell>
      </Table.Row>
    ) : (
      <Table.Row
        className={rowClassName?.(item)}
        id={id}
        onAction={() => openRow(item)}>
        {hideNameColumn ? null : renderNameCell(item)}
        {columns.map((column) => (
          <Table.Cell className={columnClassName(column)} key={column.id}>
            {column.render(item)}
          </Table.Cell>
        ))}
      </Table.Row>
    );

  // The shared placeholders, as the glossary terms table uses: nothing yet, or nothing matching.
  const renderEmpty = () => (
    <div
      className="tw:relative tw:min-h-80"
      data-testid={`ontology-${definitionType}-empty`}>
      {totalCount ? (
        <NoFilteredResultsPlaceholder
          description={t('message.ontology-definitions-no-match', {
            entity: pluralLabel.toLocaleLowerCase(),
          })}
        />
      ) : (
        <NoDataPlaceholder
          description={t('message.ontology-definitions-empty-description', {
            entity: entityText,
          })}
          footer={
            startCreate ? (
              <Button
                color="primary"
                data-testid={`ontology-empty-add-${definitionType}`}
                iconLeading={Plus}
                size="sm"
                onPress={startCreate}>
                {t('label.add-entity', { entity: entityText })}
              </Button>
            ) : undefined
          }
          title={t('label.no-entity', { entity: pluralLabel })}
        />
      )}
    </div>
  );

  const renderTable = (rows: readonly T[]) => (
    <TableCard.Root
      data-testid={`ontology-definition-group-${definitionType}`}
      size="sm">
      <Table aria-label={pluralLabel} className="tw:table-fixed" size="sm">
        <Table.Header>
          {hideNameColumn ? null : (
            <Table.Head
              isRowHeader
              className={`${CELL_PADDING} tw:w-44`}
              id="name"
              label={t('label.name')}
            />
          )}
          {columns.map((column) => (
            <Table.Head
              align={column.align}
              className={columnClassName(column)}
              id={column.id}
              isRowHeader={column.isRowHeader}
              key={column.id}
              label={column.label}
            />
          ))}
        </Table.Header>
        <Table.Body items={toRows(rows)} renderEmptyState={renderEmpty}>
          {renderRow}
        </Table.Body>
      </Table>
      {lastPage > 0 ? (
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-secondary tw:px-4 tw:py-3">
          {renderPagination()}
        </div>
      ) : null}
    </TableCard.Root>
  );

  return (
    <Box direction="col" gap={4}>
      <Box align="center" gap={3} wrap="wrap">
        <Box
          align="center"
          className="tw:min-w-0 tw:flex-1"
          gap={2}
          wrap="wrap">
          {toolbar}
        </Box>
        {summary ? (
          <Typography
            color="secondary"
            data-testid="ontology-definition-summary"
            size="text-sm">
            {summary}
          </Typography>
        ) : null}
        {actions}
        {startCreate && (
          <Button
            color="primary"
            data-testid={`ontology-add-${definitionType}`}
            iconLeading={Plus}
            size="sm"
            onPress={startCreate}>
            {t('label.add-entity', { entity: entityText })}
          </Button>
        )}
      </Box>
      {banner}
      {items ? (
        renderTable(pageOf(items, currentPage))
      ) : (
        <Loader size="small" />
      )}
      {renderEditor()}
    </Box>
  );
};

export default OntologyDefinitionList;
