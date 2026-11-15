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
  Badge,
  BadgeWithIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { RELEASE_DISPLAY_STATUS } from './OntologyReleasePanel.constants';
import {
  releaseChangeBreakdown,
  ReleaseDisplayStatus,
} from './OntologyReleasePanel.utils';

interface OntologyReleaseBadgesProps {
  release: OntologyRelease;
  status: ReleaseDisplayStatus;
  isLatest: boolean;
  bump?: VersionBump;
}

/** Status, Latest, Approved and version-part chips, then the +/~/− change counts. */
const OntologyReleaseBadges = ({
  release,
  status,
  isLatest,
  bump,
}: OntologyReleaseBadgesProps) => {
  const { t } = useTranslation();
  const { label, color } = RELEASE_DISPLAY_STATUS[status];
  const breakdown = releaseChangeBreakdown(release);
  const wasApproved = status === 'active' || status === 'superseded';

  return (
    <>
      <span data-testid={`ontology-release-status-${release.id}`}>
        {status === 'inReview' ? (
          <BadgeWithIcon color={color} iconLeading={Clock} size="sm">
            {t(label)}
          </BadgeWithIcon>
        ) : (
          <Badge color={color} size="sm">
            {t(label)}
          </Badge>
        )}
      </span>
      {isLatest && (
        <Badge color="blue" size="sm">
          {t('label.latest')}
        </Badge>
      )}
      {wasApproved && (
        <Badge color="gray" size="sm" type="modern">
          {t('label.approved')}
        </Badge>
      )}
      {bump && (
        <Badge
          color="gray"
          data-testid={`ontology-release-bump-${release.id}`}
          size="sm"
          type="color">
          {t(`label.version-${bump}`)}
        </Badge>
      )}
      {breakdown ? (
        <Typography
          as="span"
          data-testid={`ontology-release-count-${release.id}`}
          size="text-xs"
          weight="semibold">
          <span className="tw:text-utility-success-700">
            +{breakdown.added}
          </span>{' '}
          <span className="tw:text-utility-warning-700">
            ~{breakdown.changed}
          </span>{' '}
          <span className="tw:text-utility-error-700">
            −{breakdown.removed}
          </span>
        </Typography>
      ) : (
        <Typography
          as="span"
          color="secondary"
          data-testid={`ontology-release-count-${release.id}`}
          size="text-xs">
          {t('message.ontology-change-summary-unavailable')}
        </Typography>
      )}
    </>
  );
};

export default OntologyReleaseBadges;
