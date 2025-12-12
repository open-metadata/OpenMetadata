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
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ASSET_CARD_STYLES } from '../../../../constants/Feeds.constants';
import { CardStyle } from '../../../../generated/entity/feed/thread';
import {
  getEntityFQN,
  getEntityType,
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../utils/FeedUtils';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import DescriptionFeedNew from '../../ActivityFeedCardV2/FeedCardBody/DescriptionFeed/DescriptionFeedNew';
import OwnersFeed from '../../ActivityFeedCardV2/FeedCardBody/OwnerFeed/OwnersFeed';
import TagsFeed from '../../ActivityFeedCardV2/FeedCardBody/TagsFeed/TagsFeed';
import ActivityFeedEditor from '../../ActivityFeedEditor/ActivityFeedEditor';
import './feed-card-body-v1.less';
import { FeedCardBodyV1Props } from './FeedCardBodyV1.interface';

const FeedCardBodyNew = ({
  isPost = false,
  feed,
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

  const { entityFQN, entityType, cardStyle } = useMemo(() => {
    return {
      entityFQN: getEntityFQN(feed.about) ?? '',
      entityType: getEntityType(feed.about) ?? '',
      cardStyle: feed.cardStyle ?? '',
    };
  }, [feed]);

  const handleSave = useCallback(() => {
    onUpdate?.(postMessage ?? '');
  }, [onUpdate, postMessage]);

  const getDefaultValue = (defaultMessage: string) => {
    return MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(defaultMessage));
  };

  const feedBodyStyleCardsRender = useMemo(() => {
    if (!isPost) {
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
        markdown={getFrontEndFormat(feed.message)}
      />
    );
  }, [isPost, message, postMessage, cardStyle, feed, entityType, entityFQN]);

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
        feed.cardStyle === 'description' ? 'description' : '',
        !showThread &&
          feed.cardStyle === 'description' &&
          feed.fieldOperation === 'updated'
          ? 'updated'
          : '',
        isFeedWidget && 'feed-widget-body'
      )}>
      {feedBodyRender}
    </div>
  );
};

export default FeedCardBodyNew;
