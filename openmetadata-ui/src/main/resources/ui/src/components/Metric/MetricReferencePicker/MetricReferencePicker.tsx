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
  Checkbox,
  Input,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { SearchLg } from '@untitledui/icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchIndex } from '../../../enums/search.enum';
import type { EntityReference } from '../../../generated/entity/type';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';

interface MetricReferencePickerProps {
  identityField?: 'fullyQualifiedName' | 'id';
  initialSearch?: string;
  isDisabled?: boolean;
  label: string;
  maxSelections?: number;
  queryFilter?: Record<string, unknown>;
  searchIndexes: SearchIndex[];
  selected: EntityReference[];
  optionFilter?: (reference: EntityReference) => boolean;
  selectionResolver?: (
    selected: EntityReference[],
    reference: EntityReference,
    isSelected: boolean
  ) => EntityReference[];
  onChange: (selected: EntityReference[]) => void;
}

const PAGE_SIZE = 20;

const resolveSelection = (
  selected: EntityReference[],
  reference: EntityReference,
  isSelected: boolean,
  maxSelections?: number
) => {
  if (!isSelected) {
    return selected.filter(({ id }) => id !== reference.id);
  }
  if (selected.some(({ id }) => id === reference.id)) {
    return selected;
  }
  if (maxSelections === 1) {
    return [reference];
  }
  if (maxSelections !== undefined && selected.length >= maxSelections) {
    return selected;
  }

  return [...selected, reference];
};

const getReferenceType = (
  source: Record<string, unknown>,
  index: string,
  fallback?: SearchIndex
) => {
  if (typeof source.entityType === 'string') {
    return source.entityType;
  }
  if (index.toLowerCase().includes('team')) {
    return 'team';
  }
  if (index.toLowerCase().includes('user')) {
    return 'user';
  }

  return fallback ?? 'entity';
};

const MetricReferencePicker = ({
  identityField = 'id',
  initialSearch = '',
  isDisabled = false,
  label,
  maxSelections,
  onChange,
  optionFilter,
  queryFilter,
  searchIndexes,
  selectionResolver,
  selected,
}: MetricReferencePickerProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const searchIndexKey = searchIndexes.join(',');

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250
    );

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => setPage(1), [debouncedSearch, queryFilter, searchIndexKey]);

  const query = useQuery({
    queryKey: [
      'metric-reference-picker',
      searchIndexKey,
      debouncedSearch,
      page,
      queryFilter,
    ],
    queryFn: () =>
      searchQuery({
        query: debouncedSearch,
        pageNumber: page,
        pageSize: PAGE_SIZE,
        queryFilter,
        searchIndex:
          searchIndexes.length === 1 ? searchIndexes[0] : searchIndexes,
        trackTotalHits: false,
      }),
  });

  const options = useMemo<EntityReference[]>(
    () =>
      (query.data?.hits.hits ?? []).flatMap((hit) => {
        const source = hit._source as unknown as Record<string, unknown>;
        if (typeof source.id !== 'string' || typeof source.name !== 'string') {
          return [];
        }

        const fullyQualifiedName =
          typeof source.fullyQualifiedName === 'string'
            ? source.fullyQualifiedName
            : undefined;
        const id =
          identityField === 'fullyQualifiedName' && fullyQualifiedName
            ? fullyQualifiedName
            : source.id;
        const reference: EntityReference = {
          id,
          name: source.name,
          ...(typeof source.displayName === 'string'
            ? { displayName: source.displayName }
            : {}),
          ...(fullyQualifiedName ? { fullyQualifiedName } : {}),
          type: getReferenceType(
            source,
            String(hit._index ?? ''),
            searchIndexes[0]
          ),
        };

        return optionFilter?.(reference) === false ? [] : [reference];
      }),
    [identityField, optionFilter, query.data?.hits.hits, searchIndexes]
  );
  const selectedIds = useMemo(
    () => new Set(selected.map(({ id }) => id)),
    [selected]
  );
  const totalPages = Math.max(
    1,
    Math.ceil((query.data?.hits.total.value ?? 0) / PAGE_SIZE)
  );

  const toggle = (reference: EntityReference, isSelected: boolean) => {
    if (selectionResolver) {
      onChange(selectionResolver(selected, reference, isSelected));

      return;
    }

    onChange(resolveSelection(selected, reference, isSelected, maxSelections));
  };

  return (
    <Box
      aria-label={label}
      className="tw:rounded-lg tw:border tw:border-secondary tw:p-3"
      direction="col"
      gap={3}
      role="group">
      <Typography size="text-sm" weight="medium">
        {label}
      </Typography>
      <Input
        aria-label={t('label.search-entity', { entity: label })}
        icon={SearchLg}
        isDisabled={isDisabled}
        value={search}
        onChange={setSearch}
      />
      {selected.length > 0 && (
        <Box aria-label={t('label.selected-lowercase')} gap={1} wrap="wrap">
          {selected.map((reference) => (
            <Badge color="brand" key={reference.id} size="sm">
              {getEntityName(reference)}
            </Badge>
          ))}
        </Box>
      )}
      {query.isPending ? (
        <Box
          aria-label={t('label.loading')}
          direction="col"
          gap={2}
          role="status">
          <Skeleton height={32} variant="rounded" />
          <Skeleton height={32} variant="rounded" />
        </Box>
      ) : query.error ? (
        <Alert
          title={t('server.entity-fetch-error', { entity: label })}
          variant="error">
          <Button color="secondary" size="sm" onPress={() => query.refetch()}>
            {t('label.try-again')}
          </Button>
        </Alert>
      ) : options.length ? (
        <Box className="tw:max-h-44 tw:overflow-y-auto" direction="col" gap={2}>
          {options.map((reference) => (
            <Checkbox
              isDisabled={isDisabled}
              isSelected={selectedIds.has(reference.id)}
              key={reference.id}
              label={getEntityName(reference)}
              onChange={(isSelected) => toggle(reference, isSelected)}
            />
          ))}
        </Box>
      ) : (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('label.no-data')}
        </Typography>
      )}
      {!query.isPending && !query.error && totalPages > 1 && (
        <Box align="center" justify="between">
          <Button
            color="secondary"
            data-testid="metric-reference-previous"
            isDisabled={isDisabled || page === 1 || query.isFetching}
            size="sm"
            onPress={() => setPage((current) => current - 1)}>
            {t('label.previous')}
          </Button>
          <Typography className="tw:text-tertiary" size="text-xs">
            {t('label.page')} {page} / {totalPages}
          </Typography>
          <Button
            color="secondary"
            data-testid="metric-reference-next"
            isDisabled={isDisabled || page === totalPages || query.isFetching}
            size="sm"
            onPress={() => setPage((current) => current + 1)}>
            {t('label.next')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default MetricReferencePicker;
