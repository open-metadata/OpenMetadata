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
  HeartRounded,
  Star01 as Follow,
} from '@openmetadata/ui-core-components/icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useOwnedAndFollowed } from '../../../../hooks/useOwnedAndFollowed';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import { getUserPath } from '../../../../utils/RouterUtils';
import TopicCard from '../Common/TopicWidget/TopicCard';
import TopicFilterChips from '../Common/TopicWidget/TopicFilterChips';
import {
  TOPIC_FILTERED_BODY_CLASSES,
  TOPIC_FILTERED_LIST_CLASSES,
} from '../Common/TopicWidget/topicRowStyles';
import {
  TopicEmptyStateConfig,
  TopicKey,
} from '../Common/TopicWidget/topics.types';
import TrackedAssetList from '../Common/TopicWidget/TrackedAssetList';
import {
  TrackedFilter,
  TRACKED_LISTS,
} from './YoursAndFollowedWidget.constants';
import { getDefaultTrackedFilter } from './YoursAndFollowedWidget.utils';

const TONE = {
  icon: Follow,
  tile: 'tw:bg-utility-purple-50 tw:text-utility-purple-600',
};

export type YoursAndFollowedWidgetProps = WidgetCommonProps;

/** The assets this user owns, and the ones they follow that recently moved. */
const YoursAndFollowedWidget: React.FC<YoursAndFollowedWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const [pickedFilter, setPickedFilter] = useState<TrackedFilter>();
  const {
    owned,
    followed,
    ownedTotal,
    followedTotal,
    changedCount,
    isError,
    isLoading,
    refetch,
  } = useOwnedAndFollowed(currentUser?.id);

  const summary = isError
    ? t('message.something-went-wrong')
    : t('message.count-followed-assets-changed', { count: changedCount });

  // Following is the reader's own move, made from any asset page — there is
  // no single place to send them, so no call to action.
  const emptyState: TopicEmptyStateConfig | undefined =
    owned.length === 0 && followed.length === 0
      ? {
          description: t('message.yours-and-followed-empty-description'),
          icon: HeartRounded,
          summary: t('message.yours-and-followed-widget-description'),
          title: t('message.nothing-owned-or-followed-yet'),
        }
      : undefined;

  const filter =
    pickedFilter ?? getDefaultTrackedFilter(ownedTotal, followedTotal);
  const list = TRACKED_LISTS[filter];

  return (
    <TopicCard
      action={{
        label: t('label.view-all-entity', {
          entity: t(list.viewAllEntityKey),
        }),
        // The full lists live on the user's own profile; the landing page is
        // where this card already is.
        onPress: () =>
          navigate(getUserPath(currentUser?.name ?? '', list.profileTab)),
      }}
      bodyClassName={TOPIC_FILTERED_BODY_CLASSES}
      emptyState={emptyState}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isLoading={isLoading}
      status={
        !isError && changedCount > 0
          ? {
              color: 'warning',
              label: t('message.count-changed', { count: changedCount }),
            }
          : undefined
      }
      summary={summary}
      title={t('label.yours-and-followed')}
      tone={TONE}
      topicKey={TopicKey.YOURS_AND_FOLLOWED}
      widgetKey={widgetKey}
      onRetry={refetch}>
      {!isError && !emptyState && (
        <>
          <TopicFilterChips
            chips={[
              {
                count: ownedTotal,
                id: TrackedFilter.OWNED,
                label: t(TRACKED_LISTS[TrackedFilter.OWNED].pillLabelKey),
                tone: 'brand',
              },
              {
                count: followedTotal,
                id: TrackedFilter.FOLLOWING,
                label: t(TRACKED_LISTS[TrackedFilter.FOLLOWING].pillLabelKey),
                tone: 'brand',
              },
            ]}
            label={t('label.yours-and-followed')}
            testIdPrefix="yours-and-followed"
            value={filter}
            onChange={(next) => setPickedFilter(next as TrackedFilter)}
          />
          <div className={TOPIC_FILTERED_LIST_CLASSES}>
            <TrackedAssetList
              assets={filter === TrackedFilter.OWNED ? owned : followed}
              dataTestId={list.listTestId}
              title={t('label.recently-updated')}
            />
          </div>
        </>
      )}
    </TopicCard>
  );
};

export default YoursAndFollowedWidget;
