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

import { Badge, Typography } from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { CLASSIC_MODE_RELEASE_NOTES_URL } from '../../constants/appMode.constants';

const ReleaseNotesLink = () => {
  const { t } = useTranslation();

  return (
    <a
      className="tw:inline-flex tw:items-center tw:gap-1 tw:text-sm tw:font-semibold tw:text-link"
      data-testid="classic-deprecation-release-notes"
      href={CLASSIC_MODE_RELEASE_NOTES_URL}
      rel="noopener noreferrer"
      target="_blank">
      {t('label.read-the-release-notes')}
      <ArrowRight height={14} width={14} />
    </a>
  );
};

/** Hover card shown on the Classic option of the interface switchers. */
export const ClassicDeprecationCard = () => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:flex tw:max-w-72 tw:flex-col tw:gap-2"
      data-testid="classic-deprecation-card">
      <Typography size="text-sm" weight="semibold">
        {t('message.classic-mode-retiring-title')}
      </Typography>
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('message.classic-mode-retiring-description')}
      </Typography>
      <ReleaseNotesLink />
    </div>
  );
};

/** Hint under the Classic option of the admin Default App Mode setting. */
export const ClassicDeprecationHint = () => {
  const { t } = useTranslation();

  return (
    <span data-testid="classic-deprecation-hint">
      {t('message.classic-mode-retiring-admin')} <ReleaseNotesLink />
    </span>
  );
};

/** The Classic option label with its Deprecated badge, for the admin setting. */
export const ClassicDeprecatedLabel = ({ label }: { label: string }) => {
  const { t } = useTranslation();

  return (
    <span className="tw:inline-flex tw:items-center tw:gap-2">
      {label}
      <Badge color="warning" data-testid="classic-deprecated-badge" size="sm">
        {t('label.deprecated')}
      </Badge>
    </span>
  );
};
