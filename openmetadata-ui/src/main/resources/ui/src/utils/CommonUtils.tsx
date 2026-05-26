/*
 *  Copyright 2022 Collate.
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

import { AxiosError } from 'axios';
import { isEmpty, isNil, isUndefined } from 'lodash';
import { ExtraInfo } from 'Models';
import { Dispatch, SetStateAction } from 'react';
import { EntityReference, User } from '../generated/entity/teams/user';
import { FeedCounts } from '../interface/feed.interface';
import { getEntityActivityByFqn } from '../rest/feedsAPI';
import { getTaskCounts } from '../rest/tasksAPI';
import { t } from './i18next/LocalUtil';
import { showErrorToast } from './ToastUtils';

export const hasEditAccess = (owners: EntityReference[], currentUser: User) => {
  return owners.some((owner) => {
    if (owner.type === 'user') {
      return owner.id === currentUser.id;
    } else {
      return Boolean(
        currentUser.teams?.length &&
          currentUser.teams.some((team) => team.id === owner.id)
      );
    }
  });
};

/**
 * Take teams data and filter out the non deleted teams
 * @param teams - teams array
 * @returns - non deleted team
 */
export const getNonDeletedTeams = (teams: EntityReference[]) => {
  return teams.filter((t) => !t.deleted);
};

/**
 * Get feed counts for given entity type and fqn
 * @param entityType - entity type
 * @param entityFQN - entity fqn
 * @param onDataFetched - callback function which return FeedCounts object
 */

export const getFeedCounts = async (
  entityType: string,
  entityFQN: string,
  domainOrCallback: string | undefined | ((countValue: FeedCounts) => void),
  callback?: (countValue: FeedCounts) => void
) => {
  try {
    const domain =
      typeof domainOrCallback === 'string' || domainOrCallback === undefined
        ? domainOrCallback
        : undefined;
    const feedCountCallback =
      typeof domainOrCallback === 'function' ? domainOrCallback : callback;

    if (!feedCountCallback) {
      return;
    }

    const [activityRes, taskCounts] = await Promise.all([
      getEntityActivityByFqn(entityType, entityFQN, {
        days: 30,
        limit: 100,
        domain,
      }),
      getTaskCounts({ aboutEntity: entityFQN, domain }),
    ]);

    const activityCount = activityRes?.data?.length ?? 0;

    const openTaskCount = taskCounts.open ?? 0;
    const closedTaskCount = taskCounts.completed ?? 0;
    const totalTasksCount = taskCounts.total ?? 0;

    feedCountCallback({
      conversationCount: activityCount,
      totalTasksCount,
      openTaskCount,
      closedTaskCount,
      totalCount: activityCount + totalTasksCount,
      mentionCount: 0,
    });
  } catch (err) {
    showErrorToast(err as AxiosError, t('server.entity-feed-fetch-error'));
  }
};

/**
 * Eager task-count fetch for entity-detail pages. Pair on mount with
 * {@link fetchEntityActivityCountInto} — both are cheap (task counts are aggregate; activity
 * count uses {@code limit=0} which short-circuits to a server-side {@code COUNT(*)}) so they
 * can run side-by-side on the same render. Total count is derived from
 * {@code (conversationCount ?? 0) + totalTasksCount} so the merge stays correct whichever
 * fetch arrives first.
 */
export const fetchEntityTaskCountsInto = async (
  entityFqn: string,
  setFeedCount: Dispatch<SetStateAction<FeedCounts>>,
  domain?: string
) => {
  try {
    const taskCounts = await getTaskCounts({ aboutEntity: entityFqn, domain });
    setFeedCount((prev) => {
      const openTaskCount = taskCounts.open ?? 0;
      const closedTaskCount = taskCounts.completed ?? 0;
      const totalTasksCount = taskCounts.total ?? 0;

      return {
        ...prev,
        openTaskCount,
        closedTaskCount,
        totalTasksCount,
        totalCount: (prev.conversationCount ?? 0) + totalTasksCount,
      };
    });
  } catch (err) {
    showErrorToast(err as AxiosError, t('server.entity-feed-fetch-error'));
  }
};

/**
 * Eager activity-count fetch. Pulls only the count (no events) for an entity and updates the
 * {@code conversationCount} and {@code totalCount} fields of the page's {@link FeedCounts}
 * state. Backed by {@code limit=0} on {@code GET /v1/activity/entity/{type}/name/{fqn}} —
 * the server short-circuits to a {@code COUNT(*)} and returns an empty {@code data} array
 * plus an accurate {@code paging.total}. Total payload is a few dozen bytes, so this can stay
 * eager on mount and the Activity Feed tab badge populates on first paint.
 *
 * <p>Historically the badge ran with {@code limit=100} and read {@code data.length}, which
 * (a) shipped 100 row JSONs just to count them and (b) silently capped the displayed value at
 * 100. The cheap path is both faster and more accurate.
 */
export const fetchEntityActivityCountInto = async (
  entityType: string,
  entityFqn: string,
  setFeedCount: Dispatch<SetStateAction<FeedCounts>>,
  domain?: string
) => {
  try {
    const activityRes = await getEntityActivityByFqn(entityType, entityFqn, {
      days: 30,
      limit: 0,
      domain,
    });
    setFeedCount((prev) => {
      const conversationCount = activityRes?.paging?.total ?? 0;

      return {
        ...prev,
        conversationCount,
        totalCount: conversationCount + (prev.totalTasksCount ?? 0),
      };
    });
  } catch (err) {
    showErrorToast(err as AxiosError, t('server.entity-feed-fetch-error'));
  }
};

export const getTeamsUser = (
  data: ExtraInfo,
  currentUser: User
): Record<string, string | undefined> | undefined => {
  if (!isUndefined(data) && !isEmpty(data?.placeholderText || data?.id)) {
    const teams = currentUser?.teams;

    const dataFound = teams?.find((team) => {
      return data.id === team.id;
    });

    if (dataFound) {
      return {
        ownerName: (currentUser?.displayName || currentUser?.name) as string,
        id: currentUser?.id as string,
      };
    }
  }

  return;
};

/**
 * It takes a state and an action, and returns a new state with the action merged into it
 * @param {S} state - S - The current state of the reducer.
 * @param {A} action - A - The action that was dispatched.
 * @returns An object with the state and action properties.
 */
export const reducerWithoutAction = <S, A>(state: S, action: A) => {
  return {
    ...state,
    ...action,
  };
};

/**
 * helper method to check to determine the deleted flag is true or false
 * some times deleted flag is string or boolean or undefined from the API
 * for Example "false" or false or true in Lineage API
 * @param deleted
 * @returns
 */
export const isDeleted = (deleted: unknown): boolean => {
  return (deleted as string) === 'false' || deleted === false || isNil(deleted)
    ? false
    : true;
};

export const normalizeToArray = <T,>(value: T | T[]): T[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value == null) {
    return [];
  }

  return [value];
};
