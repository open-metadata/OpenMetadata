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
import { Star01 as Follow } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useOwnedAndFollowed } from '../../../../hooks/useOwnedAndFollowed';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import { getUserPath } from '../../../../utils/RouterUtils';
import { UserPageTabs } from '../../../Settings/Users/Users.interface';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';
import TrackedAssetList from '../Common/TopicWidget/TrackedAssetList';

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

  const isEmpty = owned.length === 0 && followed.length === 0;
  const summary = isError
    ? t('message.something-went-wrong')
    : t('message.count-followed-assets-changed', { count: changedCount });

  return (
    <TopicCard
      action={{
        label: t('label.view-entity', {
          entity: t('label.followed-asset-plural'),
        }),
        // The full list lives on the user's own profile; the landing page is
        // where this card already is.
        onPress: () =>
          navigate(
            getUserPath(currentUser?.name ?? '', UserPageTabs.FOLLOWING)
          ),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isLoading={isLoading}
      meta={
        isError
          ? undefined
          : t('message.count-owned-and-followed', {
              followed: followedTotal,
              owned: ownedTotal,
            })
      }
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
      {!isError && isEmpty && (
        // `!` on the colour: Typography renders `.prose`, whose unlayered
        // `color` rule is emitted after the Tailwind utilities.
        <Typography
          className="tw:text-text-secondary!"
          data-testid="yours-and-followed-empty"
          size="text-sm">
          {t('message.no-data-available')}
        </Typography>
      )}
      {!isError && !isEmpty && (
        <div className="tw:@container">
          <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:@md:grid-cols-2">
            <TrackedAssetList
              assets={owned}
              dataTestId="owned-assets"
              title={t('label.my-data')}
            />
            <TrackedAssetList
              assets={followed}
              dataTestId="followed-assets"
              title={t('label.following')}
            />
          </div>
        </div>
      )}
    </TopicCard>
  );
};

export default YoursAndFollowedWidget;
