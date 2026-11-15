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
import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import {
  ColumnBinding,
  OntologyAssetConceptLinks,
} from '../../generated/type/ontologyAssetConceptLinks';
import { getOntologyConceptsBoundToAsset } from '../../rest/ontologyAPI';
import { getEntityName } from '../../utils/EntityNameUtils';

interface TableLinkedConceptsProps {
  tableId: string;
  /** When the page is on one column, only that column's bindings are listed. */
  columnFqn?: string;
}

const conceptStudioPath = (ontologyId: string, conceptId: string) =>
  `${ROUTES.ONTOLOGY_EXPLORER}?${new URLSearchParams({
    ontology: ontologyId,
    concept: conceptId,
  })}`;

const columnLabel = (binding: ColumnBinding) =>
  binding.column?.fullyQualifiedName ?? binding.columnPath.join('.');

const TableLinkedConcepts = ({
  tableId,
  columnFqn,
}: TableLinkedConceptsProps) => {
  const { t } = useTranslation();
  // The trace is a courtesy on the table page: a failed or denied read hides it instead of
  // breaking the page.
  const { data } = useQuery<OntologyAssetConceptLinks>({
    queryKey: ['ontology-linked-concepts', 'table', tableId],
    queryFn: ({ signal }) =>
      getOntologyConceptsBoundToAsset('table', tableId, signal),
    retry: false,
    staleTime: 30_000,
  });

  const links = (data?.links ?? [])
    .map((link) => ({
      ...link,
      columns: columnFqn
        ? link.columns.filter(
            (binding) => binding.column?.fullyQualifiedName === columnFqn
          )
        : link.columns,
    }))
    .filter((link) => !columnFqn || link.columns.length > 0);

  if (links.length === 0) {
    return null;
  }

  return (
    <Box
      className="tw:rounded-xl tw:bg-surface tw:p-4"
      data-testid="table-linked-concepts"
      direction="col"
      gap={2}>
      <Typography as="h3" size="text-sm" weight="semibold">
        {t('label.linked-concept-plural')}
      </Typography>
      {links.map((link) => (
        <Box
          data-testid={`table-linked-concept-${link.concept.id}`}
          direction="col"
          gap={1}
          key={link.concept.id}>
          <Box align="center" gap={2}>
            <Link
              data-testid="table-linked-concept-link"
              to={conceptStudioPath(link.ontology.id, link.concept.id)}>
              {getEntityName(link.concept)}
            </Link>
            <Typography color="secondary" size="text-xs">
              {getEntityName(link.ontology)}
            </Typography>
          </Box>
          {link.columns.map((binding) => (
            <Box
              align="center"
              data-testid="table-linked-concept-column"
              gap={2}
              key={`${binding.propertyId}:${binding.columnPath.join('.')}`}>
              <Badge color="indigo" size="sm" type="pill-color">
                {columnLabel(binding)}
              </Badge>
              <Typography color="secondary" size="text-xs">
                {binding.property ? getEntityName(binding.property) : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default TableLinkedConcepts;
