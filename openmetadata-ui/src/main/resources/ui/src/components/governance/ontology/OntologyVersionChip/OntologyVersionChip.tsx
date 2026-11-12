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
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { ClockRewind } from '@openmetadata/ui-core-components/icons';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  OntologyPublicationStatus,
  Stage,
} from '../../../../generated/type/ontologyPublicationStatus';
import { RELEASE_STAGE_LABELS } from '../OntologyReleasePanel/OntologyReleasePanel.constants';

interface OntologyVersionChipProps {
  readonly status?: OntologyPublicationStatus;
  readonly isDisabled?: boolean;
  /** Which version the Studio reads. Given with `onVersionChange` only to users who can edit. */
  readonly version?: 'draft' | 'published';
  readonly onVersionChange?: (version: 'draft' | 'published') => void;
  readonly onPress: () => void;
}

const getVersionLabel = (
  status: OntologyPublicationStatus | undefined,
  t: TFunction
) => {
  const active = status?.active;
  let version = t(status ? 'label.draft' : 'label.unavailable');
  if (active) {
    version = active.semanticVersion
      ? `v${active.semanticVersion}`
      : t('label.ontology-release-revision', {
          revision: active.releaseRevision,
        });
  }

  return version;
};

// Before the first release the server counts the ontology itself as an added
// member; a user did not make that a change, so it is not part of the count.
const getUnpublishedCount = (status: OntologyPublicationStatus | undefined) => {
  const count = status?.unpublishedChanges ?? 0;

  return status?.active ? count : Math.max(count - 1, 0);
};

const getChipParts = (
  status: OntologyPublicationStatus | undefined,
  t: TFunction,
  language: string
) => {
  const active = status?.active;
  const parts = [getVersionLabel(status, t)];
  if (active?.activatedAt !== undefined) {
    parts.push(
      new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
      }).format(active.activatedAt)
    );
  }
  const stage = status?.latest?.stage;
  const unpublished = getUnpublishedCount(status);
  if (unpublished > 0 || (stage && stage !== Stage.Published)) {
    const stageLabel = t(RELEASE_STAGE_LABELS[stage ?? Stage.Draft]);
    if (!parts.includes(stageLabel)) {
      parts.push(stageLabel);
    }
  }
  if (unpublished > 0) {
    parts.push(t('label.ontology-unpublished-count', { count: unpublished }));
  }

  return parts;
};

const VersionSwitch = ({
  isDisabled,
  status,
  version,
  onVersionChange,
}: Required<Pick<OntologyVersionChipProps, 'version' | 'onVersionChange'>> &
  Pick<OntologyVersionChipProps, 'isDisabled' | 'status'>) => {
  const { t } = useTranslation();
  const unpublished = getUnpublishedCount(status);
  const publishedVersion = status?.active ? getVersionLabel(status, t) : '';

  return (
    <Box
      align="center"
      aria-label={t('label.ontology-version-switch')}
      className="tw:gap-0.5 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-0.5"
      data-testid="ontology-version-switch"
      role="group">
      {(['draft', 'published'] as const).map((option) => (
        <Button
          aria-pressed={version === option}
          color={version === option ? 'secondary' : 'tertiary'}
          data-testid={`ontology-version-${option}`}
          isDisabled={isDisabled}
          key={option}
          size="sm"
          onPress={() => onVersionChange(option)}>
          <span className="tw:flex tw:items-center tw:gap-1.5 tw:whitespace-nowrap">
            {t(`label.${option}`)}
            {option === 'draft' && unpublished > 0 ? (
              <Badge
                color="warning"
                data-testid="ontology-version-draft-count"
                size="sm"
                type="pill-color">
                {unpublished}
              </Badge>
            ) : null}
            {option === 'published' && publishedVersion ? (
              <Typography as="span" color="secondary" size="text-xs">
                {publishedVersion}
              </Typography>
            ) : null}
          </span>
        </Button>
      ))}
    </Box>
  );
};

const OntologyVersionChip = ({
  status,
  isDisabled,
  version,
  onVersionChange,
  onPress,
}: OntologyVersionChipProps) => {
  const { t, i18n } = useTranslation();
  const parts = getChipParts(status, t, i18n.language);
  const releases = (
    <Button
      color="secondary"
      data-testid="ontology-release-history-trigger"
      isDisabled={isDisabled}
      size="xs"
      tooltip={t('label.release-history')}
      onPress={onPress}>
      {parts.join(' · ')}
    </Button>
  );
  if (!version || !onVersionChange) {
    return releases;
  }

  return (
    <>
      <VersionSwitch
        isDisabled={isDisabled}
        status={status}
        version={version}
        onVersionChange={onVersionChange}
      />
      <Button
        aria-label={`${t('label.release-history')}: ${parts.join(' · ')}`}
        color="secondary"
        data-testid="ontology-release-history-trigger"
        iconLeading={ClockRewind}
        isDisabled={isDisabled}
        size="sm"
        tooltip={`${t('label.release-history')} · ${parts.join(' · ')}`}
        onPress={onPress}
      />
    </>
  );
};

export default OntologyVersionChip;
