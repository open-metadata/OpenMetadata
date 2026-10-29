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
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../../generated/entity/tasks/task';
import { getOntologyReleaseVersion } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReviewRelease from './OntologyReviewRelease';

interface OntologyReviewPanelProps {
  task: Task;
  onReadyChange?: (ready: boolean) => void;
}

const OntologyReviewPanel = ({
  task,
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
    return <Typography role="status">{t('label.loading')}</Typography>;
  }

  return (
    <Box data-testid="ontology-review-panel" direction="col" gap={3}>
      <Typography as="h3" size="text-md" weight="semibold">
        {t('label.submitted-definition')}
      </Typography>
      <Typography>
        {getEntityName(data)} ·{' '}
        {t('label.version-number', { version: target?.entityVersion })}
      </Typography>
      <OntologyReviewRelease
        baseReleaseId={data.baseReleaseId}
        key={data.id}
        releaseId={data.id}
        onReadyChange={onReadyChange}
      />
    </Box>
  );
};

export default OntologyReviewPanel;
