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
import { Box, Button } from '@openmetadata/ui-core-components';
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
  version,
  onVersionChange,
}: Required<Pick<OntologyVersionChipProps, 'version' | 'onVersionChange'>> &
  Pick<OntologyVersionChipProps, 'isDisabled'>) => {
  const { t } = useTranslation();

  return (
    <Box
      aria-label={t('label.ontology-version-switch')}
      className="tw:rounded-lg tw:border tw:border-secondary tw:p-0.5"
      data-testid="ontology-version-switch"
      gap={1}
      role="group">
      {(['draft', 'published'] as const).map((option) => (
        <Button
          aria-pressed={version === option}
          color={version === option ? 'primary' : 'tertiary'}
          data-testid={`ontology-version-${option}`}
          isDisabled={isDisabled}
          key={option}
          size="xs"
          onPress={() => onVersionChange(option)}>
          {t(`label.${option}`)}
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
        version={version}
        onVersionChange={onVersionChange}
      />
      {releases}
    </>
  );
};

export default OntologyVersionChip;
