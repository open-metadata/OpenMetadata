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
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  EntityStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReviewRelease from '../OntologyReviewPanel/OntologyReviewRelease';
import OntologyReleaseEvents from './OntologyReleaseEvents';
import OntologyReleaseExport from './OntologyReleaseExport';

interface OntologyReleaseDetailsProps {
  release: OntologyRelease;
  isActive: boolean;
  showExport?: boolean;
  canPublish: boolean;
  onRequestApproval: () => Promise<void>;
  onActivate: () => Promise<void>;
}

const OntologyReleaseDetails = ({
  release,
  isActive,
  showExport = true,
  canPublish,
  onRequestApproval,
  onActivate,
}: OntologyReleaseDetailsProps) => {
  const { t } = useTranslation();
  const isApproved = release.entityStatus === EntityStatus.Approved;
  const canRequestReview = release.entityStatus === EntityStatus.Draft;

  return (
    <Box data-testid="ontology-release-definition" direction="col" gap={3}>
      <Typography as="h3" size="text-md" weight="semibold">
        {getEntityName(release)}
      </Typography>
      <Typography>
        {t(`label.${release.entityStatus.toLowerCase().replaceAll(' ', '-')}`)}
      </Typography>
      {isActive && (
        <Typography data-testid="ontology-active-release">
          {t('label.active')}
        </Typography>
      )}
      <Alert variant="warning">
        {t('message.ontology-consistency-not-run')}
      </Alert>
      <Box gap={3} wrap="wrap">
        {showExport && <OntologyReleaseExport releaseId={release.id} />}
        {release.reviewTask && (
          <Link to={`/tasks/${encodeURIComponent(release.reviewTask)}`}>
            {t('label.approval')}
          </Link>
        )}
        {canRequestReview && (
          <Button
            color="secondary"
            isDisabled={!canPublish}
            onPress={onRequestApproval}>
            {t('label.request-approval')}
          </Button>
        )}
        <Button
          color="primary"
          isDisabled={!canPublish || isActive || !isApproved}
          onPress={onActivate}>
          {t('label.activate-release')}
        </Button>
      </Box>
      <OntologyReleaseEvents releaseId={release.id} />
      <OntologyReviewRelease
        baseReleaseId={release.baseReleaseId}
        key={release.id}
        releaseId={release.id}
      />
    </Box>
  );
};

export default OntologyReleaseDetails;
