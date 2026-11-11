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
import { Ontology } from '../../../../generated/entity/data/ontology';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { EntityReference } from '../../../../generated/entity/type';
import { OntologyPublicationStatus } from '../../../../generated/type/ontologyPublicationStatus';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { getOntologyWorkingValidation } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';
import { buildNativeTreeIndex } from '../../../OntologyExplorer/OntologyStudio.utils';
import { FILTERS } from '../AllOntologiesGraphView/AllOntologiesGraphView.constants';

export type OntologyOverviewTab = 'concept' | 'property' | 'axiom';

interface OntologyOverviewProps {
  readonly ontology: Ontology;
  /** Counts come from this release when set, otherwise from the working draft. */
  readonly releaseId?: string;
  readonly status?: OntologyPublicationStatus;
  /** Given inside the Ontology tabs: a card opens the tab it summarises. */
  readonly onOpenTab?: (tab: OntologyOverviewTab) => void;
}

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
  readonly detail: string;
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
  <Card data-testid={testId}>
    <Card.Content>
      <Box direction="col" gap={2}>
        <Box align="center" justify="between">
          <Typography color="secondary" size="text-sm" weight="medium">
            {label}
          </Typography>
          {onOpen ? (
            <Button
              aria-label={label}
              color="tertiary"
              iconLeading={ArrowUpRight}
              size="xs"
              onPress={onOpen}
            />
          ) : null}
        </Box>
        <Typography size="display-xs" weight="semibold">
          {count}
        </Typography>
        <Typography color={isAlert ? 'danger' : 'secondary'} size="text-sm">
          {detail}
        </Typography>
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

const ValidationCard = ({
  conflictCount,
  isChecking,
  onValidate,
  onReview,
}: {
  conflictCount: number;
  isChecking: boolean;
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
          <Typography color="secondary" size="text-sm">
            {t(
              hasConflicts
                ? 'message.ontology-conflicts-explained-in-constraints'
                : 'message.ontology-validate-all-clean'
            )}
          </Typography>
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

const OntologyOverview = ({
  ontology,
  releaseId,
  status,
  onOpenTab,
}: OntologyOverviewProps) => {
  const { t } = useTranslation();
  const { graph, isError, isLoading, model, relations } =
    useOntologyStudioModel(ontology, releaseId);
  const validation = useQuery({
    enabled: !releaseId,
    queryFn: () => getOntologyWorkingValidation(ontology.id),
    queryKey: ['ontology-working-validation', ontology.id, 'overview'],
    retry: false,
  });
  const treeIndex = useMemo(
    () => buildNativeTreeIndex(graph, FILTERS, []),
    [graph]
  );
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

  const facts = getOverviewFacts(
    model,
    treeIndex,
    validation.data?.violations.length ?? 0
  );
  const openTab = (tab: OntologyOverviewTab) =>
    onOpenTab ? () => onOpenTab(tab) : undefined;
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

  return (
    <Box
      className="tw:h-full tw:overflow-auto tw:pb-20"
      data-testid="ontology-overview"
      direction="col"
      gap={5}>
      <Typography color="secondary" size="text-sm">
        {t('message.ontology-overview-read-only', { version: versionLabel })}
      </Typography>
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
          detail={t('message.ontology-overview-in-conflict', {
            count: facts.conflictCount,
          })}
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
            isChecking={validation.isFetching}
            onReview={openTab('axiom')}
            onValidate={() => void validation.refetch()}
          />
        )}
        <HealthCard
          facts={facts}
          total={model.concepts.length}
          onReview={openTab('concept')}
        />
      </div>
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
    </Box>
  );
};

export default OntologyOverview;
