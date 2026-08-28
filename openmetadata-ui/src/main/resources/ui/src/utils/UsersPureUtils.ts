/*
 *  Copyright 2025 Collate.
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

import type { AxiosError } from 'axios';
import moment from 'moment';
import { HTTP_STATUS_CODE } from '../constants/Auth.constants';
import { ERROR_MESSAGE, NO_DATA_PLACEHOLDER } from '../constants/constants';
import { MASKED_EMAIL } from '../constants/User.constants';
import type { User } from '../generated/entity/teams/user';
import { getIsErrorMatch } from './APIUtils';
import { t } from './i18next/LocalUtil';

export const isMaskedEmail = (email: string) => {
  return email === MASKED_EMAIL;
};

export const getUserCreationErrorMessage = ({
  error,
  entity,
  entityLowercase,
  entityName,
}: {
  error?: AxiosError;
  entity: string;
  entityLowercase?: string;
  entityName?: string;
}) => {
  if (error) {
    if (getIsErrorMatch(error, ERROR_MESSAGE.alreadyExist)) {
      return t('server.email-already-exist', {
        entity: entityLowercase ?? '',
        name: entityName ?? '',
      });
    }

    if (error.response?.status === HTTP_STATUS_CODE.LIMIT_REACHED) {
      return t('server.entity-limit-reached', { entity });
    }
  }

  return t('server.create-entity-error', { entity });
};

export const getEmptyTextFromUserProfileItem = (item: string) => {
  const messages = {
    roles: t('message.no-roles-assigned'),
    teams: t('message.no-teams-assigned'),
    inheritedRoles: t('message.no-inherited-roles-found'),
    personas: t('message.no-persona-assigned'),
  };

  return messages[item as keyof typeof messages] || NO_DATA_PLACEHOLDER;
};

export const getUserOnlineStatus = (userData: User, includeTooltip = false) => {
  if (!userData || userData.isBot) {
    return null;
  }

  const activityTime = userData.lastActivityTime || userData.lastLoginTime;

  if (!activityTime) {
    return null;
  }

  const lastActivityMoment = moment(activityTime);
  const now = moment();
  const diffMinutes = now.diff(lastActivityMoment, 'minutes');

  if (diffMinutes <= 5) {
    return {
      status: 'success' as const,
      text: t('label.online-now'),
      ...(includeTooltip && {
        tooltip: t('label.last-activity-n-minutes-ago', { count: diffMinutes }),
      }),
    };
  } else if (diffMinutes <= 60) {
    return {
      status: 'success' as const,
      text: t('label.active-recently'),
      ...(includeTooltip && {
        tooltip: t('label.last-activity-n-minutes-ago', { count: diffMinutes }),
      }),
    };
  }

  return null;
};
