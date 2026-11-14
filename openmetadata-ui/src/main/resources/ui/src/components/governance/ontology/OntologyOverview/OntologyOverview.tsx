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
  BadgeColors,
  Box,
  Button,
  Card,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle,
} from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChangeType,
  MemberChange,
  MemberKind,
} from '../../../../generated/api/data/ontologyWorkingDiff';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { EntityReference } from '../../../../generated/entity/type';
import { OntologyPublicationStatus } from '../../../../generated/type/ontologyPublicationStatus';
import { ONTOLOGY_WORKING_DIFF_QUERY_KEY } from '../../../../hooks/governance/ontology/useOntologyPublication';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import {
  getOntologyWorkingDiff,
  getOntologyWorkingValidation,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { OntologyModelRelation } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import Loader from '../../../common/Loader/Loader';
import { buildNativeTreeIndex } from '../../../OntologyExplorer/OntologyStudio.utils';
import { FILTERS } from '../AllOntologiesGraphView/AllOntologiesGraphView.constants';
import {
  AxiomStatus,
  constraintCheckTime,
  countAxiomStatuses,
  findAxiomConflicts,
} from '../OntologyAxiomWorkspace/OntologyAxiomWorkspace.utils';
import {
  overviewValidationQueryKey,
  RECENT_CHANGES_SHOWN,
} from './OntologyOverview.constants';

export type OntologyOverviewTab = 'concept' | 'property' | 'axiom';

interface OntologyOverviewProps {
  readonly ontology: Ontology;
  /** Counts come from this release when set, otherwise from the working draft. */
  readonly releaseId?: string;
  readonly status?: OntologyPublicationStatus;
  /** Given inside the Ontology tabs: a card opens the tab it summarises. */
  readonly onOpenTab?: (tab: OntologyOverviewTab, status?: AxiomStatus) => void;
  /** Opens Review & publish; the Recent changes card shows only when given. */
  readonly onOpenPublication?: () => void;
}

const MEMBER_KINDS: Partial<
  Record<MemberKind, { label: string; color: BadgeColors }>
> = {
  [MemberKind.Concept]: { label: 'label.concept', color: 'brand' },
  [MemberKind.Axiom]: { label: 'label.rule', color: 'orange' },
  [MemberKind.Property]: { label: 'label.property', color: 'purple' },
  [MemberKind.Association]: { label: 'label.relationship', color: 'success' },
};
const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  [ChangeType.Added]: 'label.added',
  [ChangeType.Changed]: 'label.changed',
  [ChangeType.Removed]: 'label.removed',
  [ChangeType.Deprecated]: 'label.deprecated',
};

const HIERARCHY_KIND = { label: 'label.hierarchy', color: 'gray' } as const;

const ChangeRow = ({
  change,
  hierarchy,
}: {
  change: MemberChange;
  /** The subclass relation a changed axiom asserts, which reads better than the axiom's name. */
  hierarchy?: OntologyModelRelation;
}) => {
  const { t } = useTranslation();
  const kind = hierarchy ? HIERARCHY_KIND : MEMBER_KINDS[change.memberKind];

  return (
    <Box
      align="center"
      className="tw:border-t tw:border-secondary tw:px-6 tw:py-3 tw:first:border-t-0"
      data-testid="ontology-overview-change"
      gap={3}>
      <div className="tw:w-28 tw:shrink-0">
        {kind ? (
          <Badge color={kind.color} size="sm" type="pill-color">
            {t(kind.label)}
          </Badge>
        ) : null}
      </div>
      <Box className="tw:min-w-0 tw:flex-1">
        <Typography ellipsis size="text-sm">
          {hierarchy
            ? t('message.ontology-concept-is-a-kind-of', {
                child: getEntityName(hierarchy.from),
                parent: getEntityName(hierarchy.to),
              })
            : getEntityName(change.entity)}
        </Typography>
      </Box>
      <Typography color="secondary" size="text-xs">
        {t(CHANGE_TYPE_LABELS[change.changeType])}
      </Typography>
    </Box>
  );
};

const isBeforeFirstRelease = (status?: OntologyPublicationStatus) =>
  Boolean(status && !status.active);

/** The newest unpublished changes; hidden for a reader who may not see the draft. */
const RecentChangesCard = ({
  isFirstRelease,
  ontologyId,
  relations,
  onOpenPublication,
}: {
  /** Before the first release the ontology's own row is the container, not a change. */
  isFirstRelease: boolean;
  ontologyId: string;
  relations: readonly OntologyModelRelation[];
  onOpenPublication: () => void;
}) => {
  const { t } = useTranslation();
  const diff = useQuery({
    // Under the working-diff key, so a publish or any draft edit that refreshes the diff refreshes this too.
    queryKey: [ONTOLOGY_WORKING_DIFF_QUERY_KEY, ontologyId, 'overview-recent'],
    queryFn: ({ signal }) =>
      getOntologyWorkingDiff(
        ontologyId,
        { limit: RECENT_CHANGES_SHOWN },
        signal
      ),
    retry: false,
  });

  if (!diff.data) {
    return null;
  }
  const changes = isFirstRelease
    ? diff.data.data.filter(
        ({ memberKind }) => memberKind !== MemberKind.Ontology
      )
    : diff.data.data;
  const total = Math.max(
    (diff.data.paging.total ?? diff.data.data.length) - Number(isFirstRelease),
    0
  );

  return (
    <Card data-testid="ontology-overview-recent-changes">
      <Card.Header
        extra={
          <Box align="center" gap={3}>
            <Typography color="secondary" size="text-sm">
              {t('message.ontology-n-unpublished', { count: total })}
            </Typography>
            {total > 0 ? (
              <Button
                color="secondary"
                data-testid="ontology-overview-review-publish"
                size="sm"
                onPress={onOpenPublication}>
                {t('label.review-publish')}
              </Button>
            ) : null}
          </Box>
        }
        title={t('label.recent-change-plural')}
      />
      {total === 0 ? (
        <Card.Content>
          <Typography color="secondary" size="text-sm">
            {t('message.ontology-no-unpublished-changes')}
          </Typography>
        </Card.Content>
      ) : (
        <Box direction="col">
          {changes.map((change) => (
            <ChangeRow
              change={change}
              hierarchy={relations.find(
                (relation) =>
                  relation.kind === 'subClassOf' &&
                  relation.axiom?.id === change.entity.id
              )}
              key={`${change.memberKind}-${change.entity.id}`}
            />
          ))}
        </Box>
      )}
    </Card>
  );
};

const formatPeople = (people: EntityReference[] | undefined, none: string) =>
  people?.length ? people.map(getEntityName).join(', ') : none;

const getVersionLabel = (
  status: OntologyPublicationStatus | undefined,
  t: TFunction
) => {
  const active = status?.active;
  if (!active) {
    return t('label.draft');
  }

  return active.semanticVersion
    ? `v${active.semanticVersion}`
    : t('label.ontology-release-revision', {
        revision: active.releaseRevision,
      });
};

interface StatCardProps {
  readonly testId: string;
  readonly label: string;
  readonly count: number;
  readonly detail?: string;
  readonly isAlert?: boolean;
  readonly onOpen?: () => void;
}

const StatCard = ({
  testId,
  label,
  count,
  detail,
  isAlert,
  onOpen,
}: StatCardProps) => (
  // The whole card opens its tab, as the design has it; the arrow only marks that.
  <Card
    aria-label={onOpen ? label : undefined}
    data-testid={testId}
    isClickable={Boolean(onOpen)}
    role={onOpen ? 'button' : undefined}
    tabIndex={onOpen ? 0 : undefined}
    variant="stat"
    onClick={onOpen}
    onKeyDown={(event) => {
      if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onOpen();
      }
    }}>
    <Card.Content>
      <Box direction="col" gap={2}>
        <Box align="center" justify="between">
          <Typography color="secondary" size="text-sm" weight="medium">
            {label}
          </Typography>
          {onOpen ? (
            <ArrowUpRight
              aria-hidden
              className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
            />
          ) : null}
        </Box>
        <Typography size="display-xs" weight="semibold">
          {count}
        </Typography>
        {detail ? (
          <Typography color={isAlert ? 'danger' : 'secondary'} size="text-sm">
            {detail}
          </Typography>
        ) : null}
      </Box>
    </Card.Content>
  </Card>
);

const HealthRow = ({
  isOk,
  text,
  onReview,
}: {
  isOk: boolean;
  text: string;
  onReview?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box align="center" gap={3}>
      <FeaturedIcon
        color={isOk ? 'success' : 'warning'}
        icon={isOk ? CheckCircle : AlertCircle}
        size="sm"
        theme="light"
      />
      <Typography className="tw:flex-1" size="text-sm">
        {text}
      </Typography>
      {!isOk && onReview ? (
        <Button color="link-color" size="sm" onPress={onReview}>
          {t('label.review')}
        </Button>
      ) : null}
    </Box>
  );
};

interface OverviewFacts {
  conflictCount: number;
  dataProperties: number;
  hierarchyCount: number;
  isolated: number;
  undescribed: number;
}

const getOverviewFacts = (
  model: NonNullable<ReturnType<typeof useOntologyStudioModel>['model']>,
  treeIndex: ReturnType<typeof buildNativeTreeIndex>,
  conflictCount: number
): OverviewFacts => ({
  conflictCount,
  dataProperties: model.properties.filter(
    (property) => property.kind === Kind.Data
  ).length,
  hierarchyCount: [...treeIndex.parents.values()].reduce(
    (total, parents) => total + parents.length,
    0
  ),
  isolated: treeIndex.health.isolatedTerms.length,
  undescribed: model.concepts.filter((concept) => !concept.description?.trim())
    .length,
});

const getValidationMessage = (
  isFailed: boolean,
  hasResult: boolean,
  hasConflicts: boolean
) => {
  if (isFailed) {
    return 'server.unexpected-error';
  }
  if (!hasResult) {
    return 'label.validating-ellipsis';
  }

  return hasConflicts
    ? 'message.ontology-conflicts-explained-in-constraints'
    : 'message.ontology-validate-all-clean';
};

const STATUS_SEGMENTS: {
  status: AxiomStatus;
  label: string;
  color: string;
}[] = [
  {
    status: 'valid',
    label: 'label.valid-lowercase',
    color: 'tw:bg-fg-success-secondary',
  },
  {
    status: 'not-checked',
    label: 'label.not-checked-lowercase',
    color: 'tw:bg-quaternary',
  },
  {
    status: 'conflict',
    label: 'label.in-conflict-lowercase',
    color: 'tw:bg-fg-error-secondary',
  },
];

/** Constraints by status: a proportional bar, then a legend that carries the counts in text. */
const StatusBreakdown = ({
  counts,
}: {
  counts: Record<AxiomStatus, number>;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      data-testid="ontology-overview-validation-breakdown"
      direction="col"
      gap={3}>
      <div
        aria-hidden
        className="tw:flex tw:h-2 tw:gap-0.5 tw:overflow-hidden tw:rounded-full tw:bg-tertiary">
        {STATUS_SEGMENTS.filter(({ status }) => counts[status] > 0).map(
          ({ status, color }) => (
            <div
              className={color}
              key={status}
              style={{ flexGrow: counts[status] }}
            />
          )
        )}
      </div>
      <Box gap={5} wrap="wrap">
        {STATUS_SEGMENTS.map(({ status, label, color }) => (
          <Box
            align="center"
            data-testid={`ontology-overview-validation-${status}`}
            gap={1}
            key={status}>
            <span
              aria-hidden
              className={`tw:size-2 tw:shrink-0 tw:rounded-xs ${color}`}
            />
            <Typography as="span" size="text-sm" weight="semibold">
              {counts[status]}
            </Typography>
            <Typography as="span" color="secondary" size="text-sm">
              {t(label)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ValidationCard = ({
  conflictCount,
  statusCounts,
  hasResult,
  isChecking,
  isFailed,
  onValidate,
  onReview,
}: {
  conflictCount: number;
  statusCounts: Record<AxiomStatus, number>;
  /** False until a validation run answered, so a pending or failed run never reads as clean. */
  hasResult: boolean;
  isChecking: boolean;
  isFailed: boolean;
  onValidate: () => void;
  onReview?: () => void;
}) => {
  const { t } = useTranslation();
  const hasConflicts = conflictCount > 0;

  return (
    <Card data-testid="ontology-overview-validation">
      <Card.Header
        extra={
          hasConflicts ? (
            <Badge color="error" size="sm" type="pill-color">
              {t('label.n-conflicts', { count: conflictCount })}
            </Badge>
          ) : null
        }
        title={t('label.validation')}
      />
      <Card.Content>
        <Box direction="col" gap={4}>
          {isFailed ? (
            <Alert variant="error">
              {t(getValidationMessage(isFailed, hasResult, hasConflicts))}
            </Alert>
          ) : (
            <Typography
              color="secondary"
              data-testid="ontology-overview-validation-message"
              size="text-sm">
              {t(getValidationMessage(isFailed, hasResult, hasConflicts))}
            </Typography>
          )}
          <StatusBreakdown counts={statusCounts} />
          <Box gap={2} wrap="wrap">
            <Button
              color="secondary"
              data-testid="ontology-overview-validate"
              iconLeading={CheckCircle}
              isLoading={isChecking}
              size="sm"
              onPress={onValidate}>
              {t('label.validate-all')}
            </Button>
            {hasConflicts && onReview ? (
              <Button
                color="secondary-destructive"
                data-testid="ontology-overview-review-conflicts"
                size="sm"
                onPress={onReview}>
                {t('label.review-conflicts')}
              </Button>
            ) : null}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
};

const HealthCard = ({
  facts,
  total,
  onReview,
}: {
  facts: OverviewFacts;
  total: number;
  onReview?: () => void;
}) => {
  const { t } = useTranslation();
  const toReview = [facts.undescribed > 0, facts.isolated > 0].filter(
    Boolean
  ).length;

  return (
    <Card data-testid="ontology-overview-health">
      <Card.Header
        extra={
          toReview > 0 ? (
            <Typography color="secondary" size="text-sm">
              {t('label.n-to-review', { count: toReview })}
            </Typography>
          ) : null
        }
        title={t('label.health')}
      />
      <Card.Content>
        <Box direction="col" gap={4}>
          <HealthRow
            isOk={facts.undescribed === 0}
            text={
              facts.undescribed === 0
                ? t('message.ontology-every-concept-described')
                : t('message.ontology-concepts-without-description', {
                    count: facts.undescribed,
                    total,
                  })
            }
            onReview={onReview}
          />
          <HealthRow
            isOk={facts.isolated === 0}
            text={
              facts.isolated === 0
                ? t('message.ontology-every-concept-linked')
                : t('message.ontology-concepts-not-linked', {
                    count: facts.isolated,
                  })
            }
            onReview={onReview}
          />
        </Box>
      </Card.Content>
    </Card>
  );
};

type ValidationRead = { data?: { violations: readonly unknown[] } };

const countConflicts = (validation: ValidationRead) =>
  validation.data?.violations.length ?? 0;

/**
 * What the Overview points at for the conflicts: the constraints in conflict when the clashes name
 * them, otherwise the server's violation count and the constraints it left unchecked.
 */
const conflictFocus = (constraintsInConflict: number, violations: number) =>
  constraintsInConflict
    ? { count: constraintsInConflict, filter: 'conflict' as const }
    : { count: violations, filter: 'not-checked' as const };

/** "3 in conflict" — constraints, not clashes — once validation has run; nothing before. */
const conflictDetail = (
  validation: ValidationRead,
  count: number,
  t: TFunction
) =>
  validation.data
    ? t('message.ontology-overview-in-conflict', { count })
    : undefined;

const OntologyOverview = ({
  ontology,
  releaseId,
  status,
  onOpenTab,
  onOpenPublication,
}: OntologyOverviewProps) => {
  const { t } = useTranslation();
  const { graph, isError, isLoading, model, relations } =
    useOntologyStudioModel(ontology, releaseId);
  const validation = useQuery({
    enabled: !releaseId,
    queryFn: () => getOntologyWorkingValidation(ontology.id),
    queryKey: overviewValidationQueryKey(ontology.id),
    retry: false,
  });
  const treeIndex = useMemo(
    () => buildNativeTreeIndex(graph, FILTERS, []),
    [graph]
  );
  const statusCounts = useMemo(() => {
    const violations = validation.data?.violations ?? [];
    const conflicts = findAxiomConflicts(
      model?.axioms ?? [],
      model?.concepts ?? [],
      violations
    );

    return countAxiomStatuses(
      model?.axioms ?? [],
      conflicts,
      constraintCheckTime(
        conflicts,
        violations,
        validation.data ? validation.dataUpdatedAt : undefined
      )
    );
  }, [model, validation.data, validation.dataUpdatedAt]);
  const version = getVersionLabel(status, t);
  const versionLabel = t(releaseId ? 'label.published' : 'label.draft');

  if (isError) {
    return (
      <Alert variant="error">
        {t('server.entity-fetch-error', { entity: t('label.ontology') })}
      </Alert>
    );
  }
  if (isLoading || !model) {
    return <Loader />;
  }

  const facts = getOverviewFacts(model, treeIndex, countConflicts(validation));
  const openTab = (tab: OntologyOverviewTab, status?: AxiomStatus) =>
    onOpenTab ? () => onOpenTab(tab, status) : undefined;
  const details = [
    ['version', t('label.version'), version],
    ['namespace', t('label.namespace'), ontology.namespace],
    [
      'owners',
      t('label.owner-plural'),
      formatPeople(ontology.owners, t('label.none')),
    ],
    [
      'reviewers',
      t('label.reviewer-plural'),
      formatPeople(ontology.reviewers, t('label.none')),
    ],
  ] as const;

  // Inside the Ontology tabs the header names the ontology and Settings holds its details.
  const isStandalone = !onOpenTab;

  return (
    <Box
      className="tw:pb-20"
      data-testid="ontology-overview"
      direction="col"
      gap={5}>
      {isStandalone ? (
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-overview-read-only', { version: versionLabel })}
        </Typography>
      ) : null}
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2 tw:xl:grid-cols-4">
        <StatCard
          count={model.concepts.length}
          detail={t('message.ontology-overview-top-level', {
            count: treeIndex.roots.length,
          })}
          label={t('label.concept-plural')}
          testId="ontology-overview-count-concepts"
          onOpen={openTab('concept')}
        />
        <StatCard
          count={relations.length}
          detail={t('message.ontology-overview-hierarchy-links', {
            hierarchy: facts.hierarchyCount,
            links: Math.max(relations.length - facts.hierarchyCount, 0),
          })}
          label={t('label.relationship-plural')}
          testId="ontology-overview-count-relationships"
          onOpen={openTab('axiom')}
        />
        <StatCard
          count={model.properties.length}
          detail={t('message.ontology-overview-values-links', {
            values: facts.dataProperties,
            links: model.properties.length - facts.dataProperties,
          })}
          label={t('label.property-plural')}
          testId="ontology-overview-count-properties"
          onOpen={openTab('property')}
        />
        <StatCard
          count={model.axioms.length}
          // The server's violations decide the alert: one that names no constraint still counts.
          detail={conflictDetail(
            validation,
            conflictFocus(statusCounts.conflict, facts.conflictCount).count,
            t
          )}
          isAlert={facts.conflictCount > 0}
          label={t('label.constraint-plural')}
          testId="ontology-overview-count-constraints"
          onOpen={openTab('axiom')}
        />
      </div>
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-2">
        {releaseId ? null : (
          <ValidationCard
            conflictCount={facts.conflictCount}
            hasResult={Boolean(validation.data)}
            isChecking={validation.isFetching}
            isFailed={validation.isError}
            statusCounts={statusCounts}
            onReview={openTab(
              'axiom',
              conflictFocus(statusCounts.conflict, facts.conflictCount).filter
            )}
            onValidate={() => void validation.refetch()}
          />
        )}
        <HealthCard
          facts={facts}
          total={model.concepts.length}
          onReview={openTab('concept')}
        />
      </div>
      {releaseId || !onOpenPublication ? null : (
        <RecentChangesCard
          isFirstRelease={isBeforeFirstRelease(status)}
          ontologyId={ontology.id}
          relations={relations}
          onOpenPublication={onOpenPublication}
        />
      )}
      {isStandalone ? (
        <Box direction="col" gap={3}>
          {details.map(([key, label, value]) => (
            <Box data-testid={`ontology-overview-${key}`} gap={4} key={key}>
              <Typography
                className="tw:w-28 tw:shrink-0"
                color="secondary"
                size="text-sm">
                {label}
              </Typography>
              <Typography className="tw:break-all" size="text-sm">
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

export default OntologyOverview;
