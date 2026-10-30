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
import { Button } from '@openmetadata/ui-core-components';
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

const OntologyVersionChip = ({
  status,
  isDisabled,
  onPress,
}: OntologyVersionChipProps) => {
  const { t, i18n } = useTranslation();
  const active = status?.active;
  const parts = [getVersionLabel(status, t)];
  if (active?.activatedAt !== undefined) {
    parts.push(
      new Intl.DateTimeFormat(i18n.language, {
        month: 'short',
        day: 'numeric',
      }).format(active.activatedAt)
    );
  }
  const stage = status?.latest?.stage;
  if (
    (status?.unpublishedChanges ?? 0) > 0 ||
    (stage && stage !== Stage.Published)
  ) {
    parts.push(t(RELEASE_STAGE_LABELS[stage ?? Stage.Draft]));
  }
  if ((status?.unpublishedChanges ?? 0) > 0) {
    parts.push(
      t('label.ontology-unpublished-count', {
        count: status?.unpublishedChanges,
      })
    );
  }

  return (
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
};

export default OntologyVersionChip;
