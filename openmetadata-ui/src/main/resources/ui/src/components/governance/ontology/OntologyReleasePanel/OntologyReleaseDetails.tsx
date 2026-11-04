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
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  EntityStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReviewRelease from '../OntologyReviewPanel/OntologyReviewRelease';
import OntologyReleaseEvents from './OntologyReleaseEvents';
import OntologyReleaseExport from './OntologyReleaseExport';

interface OntologyReleaseDetailsProps {
  release: OntologyRelease;
  isActive: boolean;
  showExport?: boolean;
  canPublish: boolean;
  onActivate: () => Promise<void>;
}

const OntologyReleaseDetails = ({
  release,
  isActive,
  showExport = true,
  canPublish,
  onActivate,
}: OntologyReleaseDetailsProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const isApproved = release.entityStatus === EntityStatus.Approved;
  const statusLabel = t(
    `label.${release.entityStatus.toLowerCase().replaceAll(' ', '-')}`
  );

  const actions = (
    <Box gap={3} wrap="wrap">
      {showExport && <OntologyReleaseExport releaseId={release.id} />}
      {release.reviewTask && (
        <Link to={`/tasks/${encodeURIComponent(release.reviewTask)}`}>
          {t('label.approval')}
        </Link>
      )}
      <Button
        color="primary"
        isDisabled={!canPublish || isActive || !isApproved}
        onPress={onActivate}>
        {t('label.activate-release')}
      </Button>
    </Box>
  );

  const consistencyAlert = (
    <Alert variant="warning">{t('message.ontology-consistency-not-run')}</Alert>
  );

  const history = (
    <>
      <OntologyReleaseEvents releaseId={release.id} />
      <OntologyReviewRelease
        baseReleaseId={release.baseReleaseId}
        key={release.id}
        releaseId={release.id}
      />
    </>
  );

  if (isAiMode) {
    return (
      <Card data-testid="ontology-release-definition" size="md">
        <Card.Content>
          <Box direction="col" gap={4}>
            <Box align="center" gap={2} wrap="wrap">
              <Typography as="h3" size="text-lg" weight="semibold">
                {getEntityName(release)}
              </Typography>
              <Badge color="gray" size="sm" type="pill-color">
                {statusLabel}
              </Badge>
              {isActive && (
                <Badge
                  color="success"
                  data-testid="ontology-active-release"
                  size="sm"
                  type="pill-color">
                  {t('label.active')}
                </Badge>
              )}
            </Box>
            {consistencyAlert}
            {actions}
            {history}
          </Box>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Box data-testid="ontology-release-definition" direction="col" gap={3}>
      <Typography as="h3" size="text-md" weight="semibold">
        {getEntityName(release)}
      </Typography>
      <Typography>{statusLabel}</Typography>
      {isActive && (
        <Typography data-testid="ontology-active-release">
          {t('label.active')}
        </Typography>
      )}
      {consistencyAlert}
      {actions}
      {history}
    </Box>
  );
};

export default OntologyReleaseDetails;
