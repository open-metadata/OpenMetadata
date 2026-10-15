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

import { Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as InboxIconActive } from '../../../../assets/svg/ask-collate-nav-bar/inbox-active.svg';
import { ReactComponent as InboxIconDefault } from '../../../../assets/svg/ask-collate-nav-bar/inbox-default.svg';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useUnreadInboxActivity } from '../../../../hooks/useUnreadInboxActivity';
import { openTaskCountQuery } from '../openTaskCount';
import { PERSONAL_SPACE_ROUTES } from '../personalSpace.constants';

// Keep badge positioning local to this component
const INBOX_BADGE_CLASS =
  'tw:absolute tw:-right-1.5 tw:-top-1.5 tw:flex tw:h-[14px] tw:min-w-[14px] ' +
  'tw:items-center tw:justify-center tw:rounded-full tw:bg-error-solid ' +
  'tw:px-1 tw:text-[8px] tw:font-medium tw:leading-none tw:text-white';

/**
 * Inbox launcher shown in the sidebar (expanded `UserProfileCard` and the
 * collapsed `Rail`). The badge combines OPEN tasks the user needs to act on
 * (Open/InProgress/Pending — closed and already-granted tasks are excluded) with
 * activity they have not looked at yet, so a chat shared with them is visible
 * without opening the Inbox. It reads the same open-task query as the Triage
 * tab badge (`openTaskCountQuery`), so the two agree and share one fetch.
 */
const InboxIconButton: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { currentUser } = useApplicationStore();
  const userId = currentUser?.id;

  const { data: openTaskCount = 0 } = useQuery(openTaskCountQuery(userId));

  const unreadActivityCount = useUnreadInboxActivity();
  const pendingCount = openTaskCount + unreadActivityCount;

  let badgeLabel: string | undefined;
  if (pendingCount > 99) {
    badgeLabel = '99+';
  } else if (pendingCount > 0) {
    badgeLabel = `${pendingCount}`;
  } else {
    badgeLabel = undefined;
  }

  const isActive =
    pathname === PERSONAL_SPACE_ROUTES.INBOX ||
    pathname.startsWith(`${PERSONAL_SPACE_ROUTES.INBOX}/`) ||
    pathname === PERSONAL_SPACE_ROUTES.MY_DATA ||
    pathname.startsWith(`${PERSONAL_SPACE_ROUTES.MY_DATA}/`);

  return (
    <Tooltip arrow placement="right" title={t('label.inbox')}>
      <TooltipTrigger>
        <button
          aria-label={t('label.inbox')}
          className={classNames('ask-rail__item', {
            'ask-rail__item--active': isActive,
          })}
          data-testid="ai-inbox-icon-btn"
          type="button"
          onClick={() =>
            navigate(
              openTaskCount > 0
                ? PERSONAL_SPACE_ROUTES.INBOX_TASKS
                : PERSONAL_SPACE_ROUTES.INBOX
            )
          }>
          {isActive ? (
            <InboxIconActive height={20} width={20} />
          ) : (
            <InboxIconDefault height={20} width={20} />
          )}

          {badgeLabel && (
            <span className={INBOX_BADGE_CLASS} data-testid="ai-inbox-badge">
              {badgeLabel}
            </span>
          )}
        </button>
      </TooltipTrigger>
    </Tooltip>
  );
};

export default InboxIconButton;
