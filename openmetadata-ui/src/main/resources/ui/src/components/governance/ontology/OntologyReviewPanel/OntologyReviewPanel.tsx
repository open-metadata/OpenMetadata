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
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { Task } from '../../../../generated/entity/tasks/task';
import { getOntologyReleaseVersion } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';
import {
  releaseChangeCount,
  releaseKindCounts,
} from '../OntologyReleasePanel/OntologyReleasePanel.utils';
import OntologyReviewRelease from './OntologyReviewRelease';

interface OntologyReviewPanelProps {
  task: Task;
  /** Heads the panel "Changes [n]" with change filters instead of the definition name. */
  asChanges?: boolean;
  onReadyChange?: (ready: boolean) => void;
}

const PanelHeader = ({
  asChanges,
  release,
}: {
  asChanges?: boolean;
  release: OntologyRelease;
}) => {
  const { t } = useTranslation();

  return asChanges ? (
    <Box align="center" gap={2}>
      <Typography
        as="h3"
        className="not-prose tw:m-0"
        size="text-md"
        weight="semibold">
        {t('label.change-plural')}
      </Typography>
      <Badge color="gray" size="sm" type="pill-color">
        {releaseChangeCount(release) ?? '—'}
      </Badge>
    </Box>
  ) : (
    <>
      <Typography
        as="h3"
        className="not-prose tw:m-0"
        size="text-md"
        weight="semibold">
        {t('label.submitted-definition')}
      </Typography>
      {/* The release's own name (release-1) is internal; a version is what a reviewer knows. */}
      <Typography>
        {release.semanticVersion
          ? 'v' + release.semanticVersion
          : `${getEntityName(release)} · ${t('label.draft')}`}
      </Typography>
    </>
  );
};

const OntologyReviewPanel = ({
  task,
  asChanges,
  onReadyChange,
}: OntologyReviewPanelProps) => {
  const { t } = useTranslation();
  const target = task.ontologyReview;
  const entityType = task.about?.type;
  const valid = Boolean(
    target &&
      entityType === 'ontologyRelease' &&
      target.entityId === task.about?.id
  );
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [
      'ontology-review-definition',
      entityType,
      target?.entityId,
      target?.entityVersion,
    ],
    enabled: valid,
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) => {
      if (!target || !entityType) {
        throw new Error('Missing ontology review target');
      }

      return getOntologyReleaseVersion(
        target.entityId,
        target.entityVersion,
        signal
      );
    },
  });

  useEffect(() => {
    if (!valid || isPending || isError) {
      onReadyChange?.(false);
    }

    return () => onReadyChange?.(false);
  }, [valid, isPending, isError, onReadyChange]);

  if (!valid || isError) {
    return (
      <Alert title={t('label.submitted-definition')} variant="error">
        <Box direction="col" gap={2}>
          {t('message.ontology-review-unavailable')}
          {valid && (
            <Button color="secondary" size="sm" onPress={() => refetch()}>
              {t('label.retry')}
            </Button>
          )}
        </Box>
      </Alert>
    );
  }

  if (isPending || !data) {
    return <Loader size="small" />;
  }

  return (
    <Box data-testid="ontology-review-panel" direction="col" gap={3}>
      <PanelHeader asChanges={asChanges} release={data} />
      <OntologyReviewRelease
        baseReleaseId={data.baseReleaseId}
        counts={asChanges ? releaseKindCounts(data) : undefined}
        filterable={asChanges}
        key={data.id}
        releaseId={data.id}
        onReadyChange={onReadyChange}
      />
    </Box>
  );
};

export default OntologyReviewPanel;
