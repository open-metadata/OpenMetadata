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
  ButtonUtility,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, XClose } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { PagingResponse } from 'Models';
import { Fragment, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useOntologyDraftGuard } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { ListParams } from '../../../../interface/API.interface';
import { restoreOntologyDefinition } from '../../../../rest/ontologyAPI';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { humanizeName } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { showUndoToast } from '../../../../utils/governance/ontology/OntologyUndoToast';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DeleteEntityModal from '../../../common/DeleteWidget/DeleteEntityModal';
import OntologyStudioDrawer from '../OntologyStudioDrawer/OntologyStudioDrawer';
import OntologyConceptDeleteDialog from './OntologyConceptDeleteDialog';

interface OntologyDefinitionListProps<T> {
  ontology: Ontology;
  canCreate: boolean;
  definitionType: 'concept' | 'property' | 'axiom';
  load: (
    params: ListParams & { ontology?: string },
    signal?: AbortSignal
  ) => Promise<PagingResponse<T[]>>;
  onWorkingChange?: () => void;
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

const definitionKind = (definition: object) => {
  const { conceptType, kind, axiomType } = definition as {
    conceptType?: string;
    kind?: string;
    axiomType?: string;
  };

  return conceptType ?? kind ?? axiomType;
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
  load,
  children,
  onWorkingChange,
  renderCreate,
}: OntologyDefinitionListProps<T>) => {
  const { t } = useTranslation();
  const guard = useOntologyDraftGuard();
  const label = definitionType === 'axiom' ? 'constraint' : definitionType;
  const entityLabel = t(`label.${label}`);
  const pluralLabel = t(`label.${label}-plural`);
  const [pagination, setPagination] = useState<
    Pick<ListParams, 'after' | 'before'>
  >({});
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
  const page = useQuery({
    queryKey: ['ontology-definitions', definitionType, ontology.id, pagination],
    queryFn: ({ signal }) =>
      load(
        {
          ontology: ontology.fullyQualifiedName,
          limit: 25,
          fields: 'owners',
          ...pagination,
        },
        signal
      ),
    retry: false,
    gcTime: 0,
  });

  if (page.isError) {
    return (
      <Alert variant="error">
        <Box direction="col" gap={2}>
          {t('server.entity-fetch-error', {
            entity: pluralLabel,
          })}
          <Button
            color="secondary"
            onPress={() => {
              void page.refetch();
            }}>
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
          void page.refetch();
          onWorkingChange?.();
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
    void page.refetch();
    onWorkingChange?.();
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

  const renderDelete = () => (
    <>
      {definition && permission.canDelete && (
        <Button
          color="secondary-destructive"
          size="sm"
          onPress={() => setIsDeleting(true)}>
          {t('label.delete')}
        </Button>
      )}
      {renderDeleteDialog()}
    </>
  );

  const renderEditorForm = () => (
    <Fragment
      key={definition ? definition.id + ':' + definition.version : 'new'}>
      {children(
        definition,
        selected === 'new' ? canCreate : permission.canEditAll,
        (saved) => {
          setSelected(saved);
          void page.refetch();
          onWorkingChange?.();
        }
      )}
      <div className="tw:flex tw:empty:hidden">{renderDelete()}</div>
    </Fragment>
  );

  const renderCreateForm = (create: NonNullable<typeof renderCreate>) =>
    create({
      close: () => guard(() => setSelected(undefined)),
      onCreated: (saved) => {
        if (saved) {
          setSelected(saved);
        }
        void page.refetch();
        onWorkingChange?.();
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
      definition ? getEntityName(definition) : entityLabel,
      renderEditorForm()
    );
  };

  const renderPagination = () => (
    <>
      <Button
        color="secondary"
        isDisabled={page.isFetching || !page.data?.paging.before}
        size="sm"
        onPress={() =>
          guard(() => {
            setSelected(undefined);
            setPagination({ before: page.data?.paging.before });
          })
        }>
        {t('label.previous')}
      </Button>
      <Button
        color="secondary"
        isDisabled={page.isFetching || !page.data?.paging.after}
        size="sm"
        onPress={() =>
          guard(() => {
            setSelected(undefined);
            setPagination({ after: page.data?.paging.after });
          })
        }>
        {t('label.next')}
      </Button>
    </>
  );

  const groupsOf = (items: T[]) =>
    definitionType === 'property'
      ? [
          {
            id: 'property',
            items: items.filter((item) => definitionKind(item) !== Kind.Object),
            label: pluralLabel,
          },
          {
            id: 'relationship',
            items: items.filter((item) => definitionKind(item) === Kind.Object),
            label: t('label.relationship-plural'),
          },
        ].filter((group, index) => index === 0 || group.items.length > 0)
      : [{ id: definitionType, items, label: pluralLabel }];

  const renderAiTable = (
    items: T[],
    label: string,
    groupId: string,
    hasPagination: boolean
  ) => (
    <TableCard.Root
      data-testid={`ontology-definition-group-${groupId}`}
      size="sm">
      <Table aria-label={label} size="sm">
        <Table.Header>
          <Table.Head isRowHeader id="name" label={t('label.name')} />
          <Table.Head id="type" label={t('label.type')} />
          <Table.Head id="description" label={t('label.description')} />
          <Table.Head id="updated" label={t('label.last-edited')} />
        </Table.Header>
        <Table.Body
          items={items}
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
                <Button
                  color="link-gray"
                  size="sm"
                  onPress={() => guard(() => setSelected(item))}>
                  {getEntityName(item)}
                </Button>
              </Table.Cell>
              <Table.Cell>
                {definitionKind(item) ? (
                  <Badge color="gray" size="sm" type="pill-color">
                    {humanizeName(definitionKind(item) ?? '')}
                  </Badge>
                ) : null}
              </Table.Cell>
              <Table.Cell>
                <Typography
                  as="span"
                  className="tw:line-clamp-1"
                  size="text-sm">
                  {(item as { description?: string }).description}
                </Typography>
              </Table.Cell>
              <Table.Cell>
                <Typography
                  as="span"
                  className="tw:whitespace-nowrap tw:text-tertiary"
                  size="text-sm">
                  {formatDate((item as { updatedAt?: number }).updatedAt)}
                </Typography>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
      {hasPagination ? (
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-secondary tw:px-4 tw:py-3">
          {renderPagination()}
        </div>
      ) : null}
    </TableCard.Root>
  );

  const renderAiTables = (items: T[]) => {
    const groups = groupsOf(items);

    return groups.map((group, index) => (
      <Box direction="col" gap={2} key={group.id}>
        {groups.length > 1 ? (
          <Typography as="h3" size="text-sm" weight="semibold">
            {group.label}
          </Typography>
        ) : null}
        {renderAiTable(
          group.items,
          group.label,
          group.id,
          index === groups.length - 1
        )}
      </Box>
    ));
  };

  return (
    <Box direction="col" gap={5}>
      <Box align="center" gap={3} justify="between">
        <Typography as="h2" size="text-md" weight="semibold">
          {pluralLabel}
        </Typography>
        {canCreate && (
          <Button
            color="secondary"
            data-testid={`ontology-add-${definitionType}`}
            iconLeading={Plus}
            size="sm"
            onPress={() => guard(() => setSelected('new'))}>
            {t('label.add-entity', { entity: entityLabel })}
          </Button>
        )}
      </Box>
      {page.isPending ? (
        <Typography role="status">{t('label.loading')}</Typography>
      ) : (
        renderAiTables(page.data.data)
      )}
      {renderEditor()}
    </Box>
  );
};

export default OntologyDefinitionList;
