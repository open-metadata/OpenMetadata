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
import { Typography } from '@openmetadata/ui-core-components';
import { ClockRewind } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { VersionBadgeButtonProps } from './VersionHistorySlideout.interface';

const VERSION_BADGE_CLASS = [
  'tw:inline-flex tw:cursor-pointer tw:items-center tw:gap-1.5 tw:rounded-lg',
  'tw:border tw:border-primary tw:bg-primary tw:px-3 tw:py-2 tw:text-secondary',
  'tw:transition tw:hover:bg-primary_hover',
].join(' ');

/** The current version as a header pill that opens the version history. */
export const VersionBadgeButton = ({
  version,
  testId,
  onPress,
}: VersionBadgeButtonProps) => {
  const { t } = useTranslation();

  return (
    <Typography
      as="button"
      className={VERSION_BADGE_CLASS}
      data-testid={testId}
      size="text-sm"
      title={t('label.version-history')}
      weight="semibold"
      onClick={onPress}>
      <ClockRewind className="tw:size-4" />
      {t('label.version-short', { version })}
    </Typography>
  );
};
