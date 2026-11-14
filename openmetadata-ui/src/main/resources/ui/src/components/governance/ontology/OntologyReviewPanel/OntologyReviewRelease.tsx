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
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChangeType,
  MemberKind,
  type OntologyReleaseDiff,
} from '../../../../generated/api/data/ontologyReleaseDiff';
import { getOntologyReleaseDiff } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';
import OntologyReleaseChangeFilters from '../OntologyReleasePanel/OntologyReleaseChangeFilters';
import type {
  ChangeFilter,
  ChangeKindCounts,
} from '../OntologyReleasePanel/OntologyReleaseChanges.utils';

const EMPTY_COUNTS: ChangeKindCounts = {
  concepts: 0,
  properties: 0,
  relationships: 0,
  rules: 0,
  total: 0,
};

interface OntologyReviewReleaseProps {
  baseReleaseId?: string;
  releaseId: string;
  /** Adds the All / Added / Changed / Removed filters over the loaded page. */
  filterable?: boolean;
  counts?: ChangeKindCounts;
  onReadyChange?: (ready: boolean) => void;
}

type Change = OntologyReleaseDiff['data'][number];

const FILTER_TYPES: Record<ChangeFilter, readonly ChangeType[]> = {
  all: Object.values(ChangeType),
  added: [ChangeType.Added],
  changed: [ChangeType.Changed, ChangeType.Deprecated],
  removed: [ChangeType.Removed],
};

const KIND_LABELS: Record<MemberKind, string> = {
  [MemberKind.Concept]: 'label.concept-plural',
  [MemberKind.Property]: 'label.property-plural',
  [MemberKind.Association]: 'label.relationship-plural',
  [MemberKind.Axiom]: 'label.rule-plural',
  [MemberKind.Shape]: 'label.rule-plural',
  [MemberKind.Ontology]: 'label.ontology',
};

const CHANGE_TEXT_COLORS: Record<ChangeType, string> = {
  [ChangeType.Added]: 'tw:text-tertiary',
  [ChangeType.Changed]: 'tw:text-warning-primary',
  [ChangeType.Deprecated]: 'tw:text-warning-primary',
  [ChangeType.Removed]: 'tw:text-error-primary',
};

const filterChanges = (
  changes: readonly Change[],
  filter: ChangeFilter,
  search: string
) => {
  const needle = search.trim().toLowerCase();

  return changes.filter(
    (change) =>
      FILTER_TYPES[filter].includes(change.changeType) &&
      (!needle || getEntityName(change.entity).toLowerCase().includes(needle))
  );
};

const groupByKind = (changes: readonly Change[]) => {
  const groups = new Map<string, Change[]>();
  changes.forEach((change) => {
    const label = KIND_LABELS[change.memberKind];
    groups.set(label, [...(groups.get(label) ?? []), change]);
  });

  return [...groups.entries()];
};

const OntologyReviewRelease = ({
  baseReleaseId,
  releaseId,
  filterable,
  counts,
  onReadyChange,
}: OntologyReviewReleaseProps) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<ChangeFilter>('all');
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const after = cursors[cursors.length - 1];
  const page = useQuery({
    queryKey: ['ontology-review-members', releaseId, baseReleaseId, after],
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) =>
      getOntologyReleaseDiff(
        releaseId,
        { baseReleaseId, limit: 25, after },
        signal
      ),
  });
  const ready = page.isSuccess && !page.isFetching;
  useEffect(() => {
    onReadyChange?.(ready);

    return () => onReadyChange?.(false);
  }, [ready, onReadyChange]);

  if (page.isError) {
    return (
      <Alert variant="error">{t('message.ontology-review-unavailable')}</Alert>
    );
  }

  const renderFilters = (changes: readonly Change[]) =>
    filterable && (
      <OntologyReleaseChangeFilters
        counts={counts ?? { ...EMPTY_COUNTS, total: changes.length }}
        filter={filter}
        rowCounts={{
          all: filterChanges(changes, 'all', search).length,
          added: filterChanges(changes, 'added', search).length,
          changed: filterChanges(changes, 'changed', search).length,
          removed: filterChanges(changes, 'removed', search).length,
        }}
        search={search}
        onFilterChange={setFilter}
        onSearchChange={setSearch}
      />
    );
  const renderRow = (change: Change) => (
    <li
      className="tw:flex tw:items-center tw:gap-3 tw:border-t tw:border-secondary tw:px-4 tw:py-2"
      key={`${change.memberKind}:${change.entity.id}`}>
      <Typography
        className="tw:min-w-0 tw:flex-1 tw:truncate"
        size="text-sm"
        weight="semibold">
        {getEntityName(change.entity)}
      </Typography>
      <Typography
        as="span"
        className={CHANGE_TEXT_COLORS[change.changeType]}
        size="text-xs">
        {t(`label.${change.changeType.toLowerCase()}`)}
      </Typography>
    </li>
  );
  const renderChanges = () => {
    if (page.isPending) {
      return <Loader size="small" />;
    }
    const changes = page.data.data;
    const visible = filterable
      ? filterChanges(changes, filter, search)
      : changes;

    return (
      <>
        {renderFilters(changes)}
        {visible.length > 0 && (
          <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary">
            {groupByKind(visible).map(([label, rows], index) => (
              <section key={label}>
                <Box
                  align="center"
                  className={classNames(
                    'tw:bg-secondary tw:px-4 tw:py-2.5',
                    index > 0 && 'tw:border-t tw:border-secondary'
                  )}
                  justify="between">
                  <Typography size="text-sm" weight="medium">
                    {t(label)}
                  </Typography>
                  <Typography color="secondary" size="text-xs">
                    {rows.length}
                  </Typography>
                </Box>
                <ul className="tw:m-0 tw:list-none tw:p-0">
                  {rows.map(renderRow)}
                </ul>
              </section>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <Box direction="col" gap={3}>
      {renderChanges()}
      {(cursors.length > 1 || page.data?.paging.after) && (
        <Box gap={2}>
          <Button
            color="secondary"
            isDisabled={page.isPending || cursors.length === 1}
            size="sm"
            onPress={() => setCursors((current) => current.slice(0, -1))}>
            {t('label.previous')}
          </Button>
          <Button
            color="secondary"
            isDisabled={page.isPending || !page.data?.paging.after}
            size="sm"
            onPress={() =>
              setCursors((current) => [...current, page.data?.paging.after])
            }>
            {t('label.next')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default OntologyReviewRelease;
