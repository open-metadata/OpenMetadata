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

import { Owner, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../../../generated/entity/type';

// The core chip sets its name at 14px; a topic row's secondary line is 12px.
const OWNER_NAME_CLASSES =
  'tw:[&_[data-testid=owner-link]]:text-xs tw:[&_[data-testid=owner-link]]:text-tertiary';

// Core's avatar group backs each avatar with an opaque disc so overlaps cut
// cleanly. That disc is a block span sized by the line height, not the avatar,
// so it showed as an oversized white blob; and it is always `bg-surface`, which
// stood out on the row's hover tint. Flex the spans so the disc hugs the
// avatar, and give it the row's hover tint so the cut still matches. The "+N"
// trigger is sized by the line height the same way, so it is flexed too or it
// sits below the avatars.
const AVATAR_BACKING_CLASSES =
  'tw:[&_[data-testid=avatar-group-item]]:flex tw:[&_[data-testid=avatar-group-item]_span]:flex ' +
  'tw:[&_[data-testid=avatar-group-overflow]]:flex ' +
  'tw:group-hover:[&_[data-testid=avatar-group-item]]:bg-utility-gray-blue-50';

export interface TopicRowOwnersProps {
  owners: EntityReference[];
  dataTestId: string;
  className?: string;
}

/**
 * Who owns a topic row's entity: one owner by avatar and name, several as an
 * avatar stack with the rest behind "+N", or a warning when there is nobody.
 *
 * Sits above the row's stretched link (`relative z-10`), so each owner keeps
 * its own link and hover card instead of opening the row.
 */
const TopicRowOwners: React.FC<TopicRowOwnersProps> = ({
  owners,
  dataTestId,
  className,
}) => {
  const { t } = useTranslation();

  if (owners.length === 0) {
    // `!` on the colour: Typography renders `.prose`, whose unlayered `color`
    // rule is emitted after the Tailwind utilities and would otherwise win.
    return (
      <Typography
        className={classNames(
          'tw:min-w-0 tw:max-w-full tw:text-utility-warning-700!',
          className
        )}
        data-testid={dataTestId}
        ellipsis={{ rows: 1 }}
        size="text-xs">
        {t('label.no-owner')}
      </Typography>
    );
  }

  return (
    <Owner
      avatarSize={16}
      className={classNames(
        // Capped like the row's title, so a long owner name truncates.
        'tw:relative tw:z-10 tw:min-w-0 tw:max-w-full',
        OWNER_NAME_CLASSES,
        AVATAR_BACKING_CLASSES,
        className
      )}
      data-testid={dataTestId}
      hasPermission={false}
      isCompactView={false}
      maxVisibleOwners={3}
      owners={owners}
      showLabel={false}
    />
  );
};

export default TopicRowOwners;
