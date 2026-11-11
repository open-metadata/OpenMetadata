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
    Typography
} from '@openmetadata/ui-core-components';
import { Plus, Trash01, XClose } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import { Fragment, ReactNode, useState } from 'react';
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
import OntologyStudioDrawer from '../OntologyStudioDrawer/OntologyStudioDrawer';
import OntologyConceptDeleteDialog from './OntologyConceptDeleteDialog';
import { pageCount, pageOf } from './OntologyDefinitionTable.utils';

export interface DefinitionColumn<T> {
  readonly id: string;
  readonly label: string;
  readonly render: (item: T) => ReactNode;
}

interface OntologyDefinitionListProps<T> {
  ontology: Ontology;
  canCreate: boolean;
  definitionType: 'concept' | 'property' | 'axiom';
  /** The rows after the tab's search and filters; undefined while the model loads. */
  items?: readonly T[];
  isError?: boolean;
  onRetry?: () => void;
  /** Called after a create, save, delete or undo so the tab reloads its rows. */
  onChanged?: () => void;
  /** Columns after Name. */
  columns: readonly DefinitionColumn<T>[];
  /** Search and filters, left of the count. */
  toolbar?: ReactNode;
  /** "6 concepts" or "3 of 8", right of the filters. */
  summary?: ReactNode;
  /** Replaces the side editor for a row, e.g. to open a concept on the graph. */
  onOpen?: (item: T) => void;
  /** Replaces the inline editor for a new definition; `saved` is set once, to keep the new one open. */
  renderCreate?: (actions: {
    close: () => void;
    onCreated: (saved?: T) => void;
  }) => ReactNode;
  children: (
    definition: T | undefined,
    canEdit: boolean,
    onSaved: (saved: T) => void
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

const OntologyDefinitionList = <
  T extends Pick<
    OntologyConcept,
    'id' | 'name' | 'displayName' | 'version' | 'deleted'
  >
>({
  ontology,
  canCreate,
  definitionType,
  items,
  isError,
  onRetry,
  onChanged,
  columns,
  toolbar,
  summary,
  onOpen,
  children,
  renderCreate,
}: OntologyDefinitionListProps<T>) => {
  const { t } = useTranslation();
  const guard = useOntologyDraftGuard();
  const label = definitionType === 'axiom' ? 'constraint' : definitionType;
  const entityLabel = t(`label.${label}`);
  const pluralLabel = t(`label.${label}-plural`);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<T | 'new'>();
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
      <Alert variant="error">
        <Box direction="col" gap={2}>
          {t('server.entity-fetch-error', {
            entity: pluralLabel,
          })}
          <Button color="secondary" onPress={onRetry}>
            {t('label.retry')}
          </Button>
        </Box>
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

  const renderEditorForm = () => (
    <Fragment
      key={definition ? definition.id + ':' + definition.version : 'new'}>
      {children(
        definition,
        selected === 'new' ? canCreate : permission.canEditAll,
        (saved) => {
          setSelected(saved);
          onChanged?.();
        }
      )}
      {renderDeleteDialog()}
    </Fragment>
  );

  const renderCreateForm = (create: NonNullable<typeof renderCreate>) =>
    create({
      close: () => guard(() => setSelected(undefined)),
      onCreated: (saved) => {
        if (saved) {
          setSelected(saved);
        }
        onChanged?.();
      },
    });

  const renderBlockedState = () => {
    if (definition && permission.isLoading) {
      return <Typography role="status">{t('label.loading')}</Typography>;
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
      placement="overlay"
      testId="ontology-definition-drawer">
      <Box
        align="center"
        className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-6 tw:py-4"
        gap={2}>
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <Typography color="secondary" size="text-sm">
            {t('label.in-entity', { entity: getEntityName(ontology) })}
          </Typography>
          <Typography
            ellipsis
            as="h2"
            className="not-prose tw:m-0"
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
          onClick={() => guard(() => setSelected(undefined))}
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
      return renderDrawer(
        t('label.add-entity', { entity: entityLabel }),
        renderCreateForm(renderCreate)
      );
    }
    const blocked = renderBlockedState();
    if (blocked) {
      return blocked;
    }

    return renderDrawer(
      definition
        ? getEntityName(definition)
        : t('label.new-entity', { entity: entityLabel }),
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

  const renderTable = (rows: readonly T[]) => (
    <TableCard.Root
      data-testid={`ontology-definition-group-${definitionType}`}
      size="sm">
      <Table aria-label={pluralLabel} size="sm">
        <Table.Header>
          <Table.Head isRowHeader id="name" label={t('label.name')} />
          {columns.map((column) => (
            <Table.Head id={column.id} key={column.id} label={column.label} />
          ))}
        </Table.Header>
        <Table.Body
          items={rows}
          renderEmptyState={() => (
            <div className="tw:m-4 tw:rounded-lg tw:bg-secondary_alt tw:p-4">
              <Typography as="p" size="text-sm" weight="medium">
                {t('label.no-entity', { entity: pluralLabel })}
              </Typography>
            </div>
          )}>
          {(item) => (
            <Table.Row id={item.id}>
              <Table.Cell>
                <Box align="center" className="tw:max-w-80 tw:min-w-0" gap={2}>
                  <span
                    aria-hidden
                    className="tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-fg-brand-primary"
                  />
                  <Button
                    className="tw:min-w-0"
                    color="link-gray"
                    size="sm"
                    onPress={() => openRow(item)}>
                    <span className="tw:truncate">{getEntityName(item)}</span>
                  </Button>
                </Box>
              </Table.Cell>
              {columns.map((column) => (
                <Table.Cell key={column.id}>{column.render(item)}</Table.Cell>
              ))}
            </Table.Row>
          )}
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
        {canCreate && (
          <Button
            color={definitionType === 'axiom' ? 'primary' : 'secondary'}
            data-testid={`ontology-add-${definitionType}`}
            iconLeading={Plus}
            size="sm"
            onPress={() => guard(() => setSelected('new'))}>
            {t('label.add-entity', { entity: entityLabel })}
          </Button>
        )}
      </Box>
      {items ? (
        renderTable(pageOf(items, currentPage))
      ) : (
        <Typography role="status">{t('label.loading')}</Typography>
      )}
      {renderEditor()}
    </Box>
  );
};

export default OntologyDefinitionList;
