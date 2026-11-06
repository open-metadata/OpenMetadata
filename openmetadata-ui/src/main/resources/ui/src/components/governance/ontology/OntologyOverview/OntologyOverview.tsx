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
import { Alert, Box, Typography } from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { EntityReference } from '../../../../generated/entity/type';
import { OntologyPublicationStatus } from '../../../../generated/type/ontologyPublicationStatus';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';

interface OntologyOverviewProps {
  readonly ontology: Ontology;
  /** Counts come from this release when set, otherwise from the working draft. */
  readonly releaseId?: string;
  readonly status?: OntologyPublicationStatus;
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

const OntologyOverview = ({
  ontology,
  releaseId,
  status,
}: OntologyOverviewProps) => {
  const { t } = useTranslation();
  const { isError, isLoading, model, relations } = useOntologyStudioModel(
    ontology,
    releaseId
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

  const counts = [
    ['concepts', t('label.concept-plural'), model.concepts.length],
    ['properties', t('label.property-plural'), model.properties.length],
    ['relationships', t('label.relationship-plural'), relations.length],
    ['constraints', t('label.constraint-plural'), model.axioms.length],
  ] as const;
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
      className="tw:h-full tw:max-w-4xl tw:overflow-auto tw:p-6"
      data-testid="ontology-overview"
      direction="col"
      gap={6}>
      <Typography color="secondary" size="text-sm">
        {t('message.ontology-overview-read-only', { version: versionLabel })}
      </Typography>
      <Box className="tw:flex-wrap" gap={4}>
        {counts.map(([key, label, count]) => (
          <Box
            className="tw:min-w-36 tw:rounded-lg tw:border tw:border-secondary tw:p-4"
            data-testid={`ontology-overview-count-${key}`}
            direction="col"
            gap={1}
            key={key}>
            <Typography color="secondary" size="text-xs">
              {label}
            </Typography>
            <Typography size="text-xl" weight="semibold">
              {count}
            </Typography>
          </Box>
        ))}
      </Box>
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
