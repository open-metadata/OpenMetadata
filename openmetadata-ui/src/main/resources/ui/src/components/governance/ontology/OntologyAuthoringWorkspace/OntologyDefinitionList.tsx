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
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { PagingResponse } from 'Models';
import { Fragment, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { ListParams } from '../../../../interface/API.interface';
import { getEntityName } from '../../../../utils/EntityNameUtils';

interface OntologyDefinitionListProps<T> {
  ontology: Ontology;
  canCreate: boolean;
  definitionType: 'concept' | 'property';
  load: (
    params: ListParams & { ontology?: string },
    signal?: AbortSignal
  ) => Promise<PagingResponse<T[]>>;
  children: (
    definition: T | undefined,
    canEdit: boolean,
    onSaved: (saved: T) => void
  ) => ReactNode;
}

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
}: OntologyDefinitionListProps<T>) => {
  const { t } = useTranslation();
  const entityLabel = t(`label.${definitionType}`);
  const pluralLabel = t(`label.${definitionType}-plural`);
  const [pagination, setPagination] = useState<
    Pick<ListParams, 'after' | 'before'>
  >({});
  const [selected, setSelected] = useState<T | 'new'>();
  const definition = selected === 'new' ? undefined : selected;
  const permission = useEntityPermissions(
    definitionType === 'concept'
      ? ResourceEntity.ONTOLOGY_CONCEPT
      : ResourceEntity.ONTOLOGY_PROPERTY,
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
          fields: 'owners,reviewers',
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

  const renderEditor = () => {
    if (!selected) {
      return null;
    }
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

    return (
      <Fragment
        key={definition ? definition.id + ':' + definition.version : 'new'}>
        {children(
          definition,
          selected === 'new' ? canCreate : permission.canEditAll,
          (saved) => {
            setSelected(saved);
            void page.refetch();
          }
        )}
      </Fragment>
    );
  };

  return (
    <Box direction="col" gap={4}>
      <Box align="center" gap={3}>
        <Typography as="h2" size="text-lg" weight="semibold">
          {pluralLabel}
        </Typography>
        {canCreate && (
          <Button
            color="secondary"
            data-testid={`ontology-add-${definitionType}`}
            onPress={() => setSelected('new')}>
            {t('label.add-entity', { entity: entityLabel })}
          </Button>
        )}
      </Box>
      {page.isPending ? (
        <Typography role="status">{t('label.loading')}</Typography>
      ) : (
        <ul className="tw:m-0 tw:list-none tw:p-0">
          {page.data.data.map((item) => (
            <li key={item.id}>
              <Button color="link-color" onPress={() => setSelected(item)}>
                {getEntityName(item)}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Box gap={2}>
        <Button
          color="secondary"
          isDisabled={page.isFetching || !page.data?.paging.before}
          onPress={() => {
            setSelected(undefined);
            setPagination({ before: page.data?.paging.before });
          }}>
          {t('label.previous')}
        </Button>
        <Button
          color="secondary"
          isDisabled={page.isFetching || !page.data?.paging.after}
          onPress={() => {
            setSelected(undefined);
            setPagination({ after: page.data?.paging.after });
          }}>
          {t('label.next')}
        </Button>
      </Box>
      {renderEditor()}
    </Box>
  );
};

export default OntologyDefinitionList;
