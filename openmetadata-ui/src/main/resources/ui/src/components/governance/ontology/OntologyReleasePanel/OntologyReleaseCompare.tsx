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
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChangeType,
  MemberChange,
  MemberKind,
  OntologyReleaseDiff,
} from '../../../../generated/api/data/ontologyReleaseDiff';
import { MemberKind as WorkingMemberKind } from '../../../../generated/api/data/ontologyWorkingDiff';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { getOntologyReleaseDiff } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';
import OntologyReleasePicker from '../OntologyReleasePicker/OntologyReleasePicker';
import {
  ChangeKindCounts,
  countChangesByKind,
} from './OntologyReleaseChanges.utils';

const COMPARE_PAGE_SIZE = 500;

const SECTION_TYPES = {
  added: [ChangeType.Added],
  changed: [ChangeType.Changed, ChangeType.Deprecated],
  removed: [ChangeType.Removed],
} as const;

const SECTIONS = ['added', 'changed', 'removed'] as const;

const KIND_LABELS: Partial<Record<MemberKind, string>> = {
  [MemberKind.Concept]: 'label.concept',
  [MemberKind.Property]: 'label.property',
  [MemberKind.Association]: 'label.relationship',
  [MemberKind.Axiom]: 'label.rule',
  [MemberKind.Shape]: 'label.rule',
};

const KIND_MESSAGES: readonly [
  Exclude<keyof ChangeKindCounts, 'total'>,
  string
][] = [
  ['concepts', 'message.native-concept-count'],
  ['properties', 'message.ontology-property-count'],
  ['relationships', 'message.ontology-relationship-count'],
  ['rules', 'message.ontology-rule-count'],
];

// The release diff and the working diff generate separate enums with the same wire values.
const asWorkingKind = (kind: MemberKind) =>
  kind as unknown as WorkingMemberKind;

const releaseName = (release: OntologyRelease) => release.semanticVersion ?? '';

const summarizeDiff = (pages: OntologyReleaseDiff[] | undefined) => {
  const changes: MemberChange[] = (pages ?? [])
    .flatMap((page) => page.data)
    .filter(({ memberKind }) => memberKind !== MemberKind.Ontology);

  return {
    changes,
    total: pages?.[0]?.paging.total ?? 0,
    counts: countChangesByKind(
      changes.map(({ memberKind }) => ({
        memberKind: asWorkingKind(memberKind),
      }))
    ),
  };
};

const useReleaseCompare = (from?: OntologyRelease, to?: OntologyRelease) => {
  const isSame = from?.id === to?.id;
  const diff = useInfiniteQuery({
    queryKey: ['ontology-release-compare', to?.id, from?.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getOntologyReleaseDiff(
        to?.id ?? '',
        { baseReleaseId: from?.id, limit: COMPARE_PAGE_SIZE, after: pageParam },
        signal
      ),
    getNextPageParam: (last) => last.paging.after,
    enabled: Boolean(from && to) && !isSame,
    retry: false,
    gcTime: 0,
  });
  const summary = summarizeDiff(diff.data?.pages);
  const hasResult = diff.isSuccess && !isSame;
  const isEmptyResult =
    hasResult && summary.changes.length === 0 && !diff.hasNextPage;

  return {
    ...summary,
    diff,
    hasResult,
    noDifferences: Boolean(from && to) && (isSame || isEmptyResult),
  };
};

const OntologyReleaseCompare = ({
  ontologyId,
  initialTo,
}: {
  ontologyId: string;
  /** Preselects the newer side, as when a release row asks to compare itself. */
  initialTo?: OntologyRelease;
}) => {
  const { t } = useTranslation();
  const [from, setFrom] = useState<OntologyRelease>();
  const [to, setTo] = useState<OntologyRelease | undefined>(initialTo);
  const { diff, changes, counts, total, hasResult, noDifferences } =
    useReleaseCompare(from, to);

  const renderSummary = () => (
    <Typography
      color="secondary"
      data-testid="ontology-compare-counts"
      size="text-sm">
      {[
        t('message.ontology-change-total', { count: counts.total }),
        ...KIND_MESSAGES.filter(([kind]) => counts[kind] > 0).map(
          ([kind, message]) => t(message, { count: counts[kind] })
        ),
      ].join(' · ')}
    </Typography>
  );

  const renderSection = (section: (typeof SECTIONS)[number]) => {
    const rows = changes.filter(({ changeType }) =>
      (SECTION_TYPES[section] as readonly ChangeType[]).includes(changeType)
    );
    if (rows.length === 0) {
      return null;
    }

    return (
      <Box
        data-testid={`ontology-compare-${section}`}
        direction="col"
        gap={1}
        key={section}>
        <Typography
          as="h5"
          className="not-prose tw:m-0"
          size="text-sm"
          weight="semibold">
          {t(`label.${section}`)} · {rows.length}
        </Typography>
        <ul className="tw:m-0 tw:list-none tw:p-0">
          {rows.map((change) => (
            <li key={`${change.memberKind}:${change.entity.id}`}>
              <Typography size="text-sm">
                {getEntityName(change.entity)}
                <Typography as="span" color="secondary" size="text-xs">
                  {' · '}
                  {t(KIND_LABELS[change.memberKind] ?? 'label.concept')}
                  {change.changeType === ChangeType.Deprecated &&
                    ` · ${t('label.deprecated')}`}
                </Typography>
              </Typography>
            </li>
          ))}
        </ul>
      </Box>
    );
  };

  const renderResult = () => {
    if (!from || !to) {
      return (
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-compare-pick-two')}
        </Typography>
      );
    }
    if (noDifferences) {
      return (
        <Typography data-testid="ontology-compare-empty" size="text-sm">
          {t('message.ontology-compare-no-differences', {
            from: releaseName(from),
            to: releaseName(to),
          })}
        </Typography>
      );
    }
    if (diff.isError) {
      return (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
          <Button
            color="secondary"
            size="sm"
            onPress={() => void diff.refetch()}>
            {t('label.retry')}
          </Button>
        </Alert>
      );
    }
    if (!hasResult) {
      return <Loader size="small" />;
    }

    return (
      <Box data-testid="ontology-compare-result" direction="col" gap={3}>
        {renderSummary()}
        {SECTIONS.map(renderSection)}
        {diff.hasNextPage && (
          <Box align="center" gap={2}>
            <Typography color="secondary" size="text-xs">
              {t('label.kg-showing-of', { shown: changes.length, total })}
            </Typography>
            <Button
              color="secondary"
              isLoading={diff.isFetchingNextPage}
              size="sm"
              onPress={() => void diff.fetchNextPage()}>
              {t('label.load-more-lowercase')}
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box
      className="tw:rounded-xl tw:border tw:border-secondary tw:p-4"
      data-testid="ontology-release-compare"
      direction="col"
      gap={3}>
      <Typography
        as="h4"
        className="not-prose tw:m-0"
        size="text-sm"
        weight="semibold">
        {t('label.compare-versions')}
      </Typography>
      <Box gap={2} wrap="wrap">
        <OntologyReleasePicker
          label={t('label.compare-from-version')}
          ontologyId={ontologyId}
          value={from}
          onChange={setFrom}
        />
        <OntologyReleasePicker
          label={t('label.compare-to-version')}
          ontologyId={ontologyId}
          value={to}
          onChange={setTo}
        />
      </Box>
      {renderResult()}
    </Box>
  );
};

export default OntologyReleaseCompare;
