/*
 *  Copyright 2023 Collate.
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

import { Button, Card, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ASSET_CARD_STYLES } from '../../../../constants/Feeds.constants';
import { ActivityEventType } from '../../../../generated/entity/activity/activityEvent';
import { CardStyle } from '../../../../generated/entity/feed/thread';
import {
  getEntityFQN,
  getEntityType,
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../utils/FeedUtils';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import ActivityDescriptionFeed from '../../ActivityFeedCardV2/FeedCardBody/DescriptionFeed/ActivityDescriptionFeed';
import DescriptionFeedNew from '../../ActivityFeedCardV2/FeedCardBody/DescriptionFeed/DescriptionFeedNew';
import ActivityOwnersFeed from '../../ActivityFeedCardV2/FeedCardBody/OwnerFeed/ActivityOwnersFeed';
import OwnersFeed from '../../ActivityFeedCardV2/FeedCardBody/OwnerFeed/OwnersFeed';
import ActivityTagsFeed from '../../ActivityFeedCardV2/FeedCardBody/TagsFeed/ActivityTagsFeed';
import TagsFeed from '../../ActivityFeedCardV2/FeedCardBody/TagsFeed/TagsFeed';
import ActivityFeedEditor from '../../ActivityFeedEditor/ActivityFeedEditor';
import './feed-card-body-v1.less';
import { FeedCardBodyV1Props } from './FeedCardBodyV1.interface';

const FeedCardBodyNew = ({
  isPost = false,
  feed,
  activity,
  isEditPost,
  message,
  onUpdate,
  onEditCancel,
  showThread,
  isForFeedTab,
  isFeedWidget,
}: FeedCardBodyV1Props) => {
  const { t } = useTranslation();
  const [postMessage, setPostMessage] = useState<string>(message);
  const isActivityEvent = !isUndefined(activity);

  const { entityFQN, entityType, cardStyle } = useMemo(() => {
    const aboutValue = feed?.about ?? activity?.about ?? '';

    return {
      entityFQN:
        getEntityFQN(aboutValue) ?? activity?.entity?.fullyQualifiedName ?? '',
      entityType: getEntityType(aboutValue) ?? activity?.entity?.type ?? '',
      cardStyle: feed?.cardStyle ?? '',
    };
  }, [feed, activity]);

  const handleSave = useCallback(() => {
    onUpdate?.(postMessage ?? '');
  }, [onUpdate, postMessage]);

  const getDefaultValue = (defaultMessage: string) => {
    return MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(defaultMessage));
  };

  const feedBodyStyleCardsRender = useMemo(() => {
    if (isActivityEvent && activity) {
      const eventType = activity.eventType;

      if (
        eventType === ActivityEventType.TagsUpdated ||
        eventType === ActivityEventType.ColumnTagsUpdated
      ) {
        return <ActivityTagsFeed activity={activity} />;
      }

      if (
        eventType === ActivityEventType.DescriptionUpdated ||
        eventType === ActivityEventType.ColumnDescriptionUpdated
      ) {
        return <ActivityDescriptionFeed activity={activity} />;
      }

      if (eventType === ActivityEventType.OwnerUpdated) {
        return (
          <ActivityOwnersFeed
            activity={activity}
            isForFeedTab={isForFeedTab}
            showThread={showThread}
          />
        );
      }

      return (
        <RichTextEditorPreviewerNew
          className="text-wrap"
          markdown={getFrontEndFormat(activity.summary ?? message)}
        />
      );
    }

    if (!isPost && feed) {
      if (cardStyle === CardStyle.Description) {
        return <DescriptionFeedNew feed={feed} />;
      }

      if (cardStyle === CardStyle.Tags) {
        return <TagsFeed feed={feed} />;
      }

      if (cardStyle === CardStyle.Owner) {
        return (
          <OwnersFeed
            feed={feed}
            isForFeedTab={isForFeedTab}
            showThread={showThread}
          />
        );
      }

      if (ASSET_CARD_STYLES.includes(cardStyle as CardStyle)) {
        <Card bordered className="activity-feed-reply-card-message">
          <Typography.Text className="activity-feed-comment-text">
            {message}
          </Typography.Text>
        </Card>;
      }
    }

    return (
      <RichTextEditorPreviewerNew
        className="text-wrap"
        markdown={getFrontEndFormat(feed?.message ?? message)}
      />
    );
  }, [
    isPost,
    message,
    postMessage,
    cardStyle,
    feed,
    entityType,
    entityFQN,
    isActivityEvent,
    activity,
    isForFeedTab,
    showThread,
  ]);

  const feedBodyRender = useMemo(() => {
    if (isEditPost) {
      return (
        <ActivityFeedEditor
          focused
          className="mb-8"
          defaultValue={getDefaultValue(message)}
          editAction={
            <div className="d-flex justify-end gap-2 m-r-xss">
              <Button
                className="border border-primary text-primary rounded-4"
                data-testid="cancel-button"
                size="small"
                onClick={onEditCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                className="rounded-4"
                data-testid="save-button"
                disabled={!message.length}
                size="small"
                type="primary"
                onClick={handleSave}>
                {t('label.save')}
              </Button>
            </div>
          }
          editorClass="is_edit_post"
          onSave={handleSave}
          onTextChange={(message) => setPostMessage(message)}
        />
      );
    }

    return feedBodyStyleCardsRender;
  }, [isEditPost, message, feedBodyStyleCardsRender]);

  return (
    <div
      className={classNames(
        showThread ? 'show-thread' : 'hide-thread',
        feed?.cardStyle === 'description' ? 'description' : '',
        !showThread &&
          feed?.cardStyle === 'description' &&
          feed?.fieldOperation === 'updated'
          ? 'updated'
          : '',
        isFeedWidget && 'feed-widget-body'
      )}>
      {feedBodyRender}
    </div>
  );
};

export default FeedCardBodyNew;
