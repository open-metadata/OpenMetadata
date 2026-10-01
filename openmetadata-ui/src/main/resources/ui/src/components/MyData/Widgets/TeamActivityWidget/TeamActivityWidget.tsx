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

import { Avatar, Typography } from '@openmetadata/ui-core-components';
import { Teams } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { EntityTabs } from '../../../../enums/entity.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getUserPath } from '../../../../utils/RouterUtils';
import { ActivityEvent } from '../../../../generated/entity/activity/activityEvent';
import { getMyActivityFeed } from '../../../../rest/activityAPI';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { getActivityVerb } from '../Common/TopicWidget/activityVerb';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';

export const TEAM_ACTIVITY_QUERY_KEY = [
  'landingPage',
  'widgets',
  'teamActivity',
];
const TEAM_ACTIVITY_WINDOW_DAYS = 7;
const TEAM_ACTIVITY_TTL_MS = 60_000;
// The card is a digest; the footer link is the full feed.
const MAX_VISIBLE_ROWS = 6;
const FETCH_LIMIT = 20;

const TONE = {
  icon: Teams,
  tile: 'tw:bg-utility-gray-100 tw:text-utility-gray-700',
};

const fetchTeamActivity = async (): Promise<ActivityEvent[]> => {
  const response = await getMyActivityFeed({
    days: TEAM_ACTIVITY_WINDOW_DAYS,
    limit: FETCH_LIMIT,
  });

  return response.data ?? [];
};

export type TeamActivityWidgetProps = WidgetCommonProps;

/** What changed recently in the domains this user owns. */
const TeamActivityWidget: React.FC<TeamActivityWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const { data, isError } = useQuery<ActivityEvent[]>({
    queryFn: fetchTeamActivity,
    queryKey: TEAM_ACTIVITY_QUERY_KEY,
    staleTime: TEAM_ACTIVITY_TTL_MS,
  });

  const events = useMemo(() => data ?? [], [data]);
  const count = events.length;

  // The newest event doubles as the card's summary, so a collapsed card still
  // says what actually happened rather than only how much did.
  const summary = useMemo(() => {
    if (isError) {
      return t('message.something-went-wrong');
    }
    const [latest] = events;
    if (!latest) {
      return t('message.no-recent-team-activity');
    }

    return `${getEntityName(latest.actor)} ${getActivityVerb(
      latest.eventType,
      t
    )} ${getEntityName(latest.entity)} · ${getRelativeTime(latest.timestamp)}`;
  }, [events, isError, t]);

  return (
    <TopicCard
      action={{
        label: t('label.view-all-entity', { entity: t('label.activity') }),
        onPress: () =>
          navigate(
            getUserPath(currentUser?.name ?? '', EntityTabs.ACTIVITY_FEED)
          ),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      meta={
        count > 0
          ? t('message.count-updates-in-domains-you-own', { count })
          : undefined
      }
      status={
        count > 0
          ? { color: 'gray', label: t('message.count-updates', { count }) }
          : undefined
      }
      summary={summary}
      title={t('label.team-activity')}
      tone={TONE}
      topicKey={TopicKey.TEAM_ACTIVITY}
      widgetKey={widgetKey}>
      {count === 0 ? (
        <Typography className="tw:text-text-secondary!" size="text-sm">
          {t('message.no-recent-team-activity')}
        </Typography>
      ) : (
        <ul
          className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
          data-testid="team-activity-rows">
          {events.slice(0, MAX_VISIBLE_ROWS).map((event) => {
            const actorName = getEntityName(event.actor);
            const entityName = getEntityName(event.entity);
            const entityLink = event.entity.fullyQualifiedName
              ? entityUtilClassBase.getEntityLink(
                  event.entity.type,
                  event.entity.fullyQualifiedName
                )
              : undefined;

            return (
              <li
                className="tw:flex tw:min-w-0 tw:items-start tw:gap-3 tw:py-3"
                data-testid={`team-activity-${event.id}`}
                key={event.id}>
                <Avatar
                  alt={actorName}
                  colorVariant="auto"
                  initials={actorName.charAt(0).toUpperCase()}
                  size="xs"
                />
                {/* `!` on the colour: Typography renders `.prose`, whose
                  unlayered `color` rule is emitted after the Tailwind
                  utilities and would otherwise silently win. */}
                <Typography
                  className="tw:min-w-0 tw:flex-1 tw:text-pretty tw:text-text-secondary!"
                  size="text-sm">
                  <span className="tw:font-medium tw:text-text-primary">
                    {actorName}
                  </span>
                  {` ${getActivityVerb(event.eventType, t)} `}
                  {entityLink ? (
                    <Link
                      className="tw:font-medium tw:text-brand-secondary"
                      to={entityLink}>
                      {entityName}
                    </Link>
                  ) : (
                    entityName
                  )}
                  {` · ${getRelativeTime(event.timestamp)}`}
                </Typography>
              </li>
            );
          })}
        </ul>
      )}
    </TopicCard>
  );
};

export default TeamActivityWidget;
