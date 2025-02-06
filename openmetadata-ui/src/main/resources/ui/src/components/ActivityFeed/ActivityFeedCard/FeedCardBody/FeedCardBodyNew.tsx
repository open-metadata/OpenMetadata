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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ASSET_CARD_STYLES } from '../../../../constants/Feeds.constants';
import { CardStyle } from '../../../../generated/entity/feed/thread';
import {
  getEntityFQN,
  getEntityType,
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../utils/FeedUtils';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import DescriptionFeed from '../../ActivityFeedCardV2/FeedCardBody/DescriptionFeed/DescriptionFeed';
import TagsFeed from '../../ActivityFeedCardV2/FeedCardBody/TagsFeed/TagsFeed';
import ActivityFeedEditor from '../../ActivityFeedEditor/ActivityFeedEditor';
import './feed-card-body-v1.less';
import { FeedCardBodyV1Props } from './FeedCardBodyV1.interface';

const FeedCardBodyNew = ({
  isPost = false,
  feed,
  isEditPost,
  className,
  showSchedule = true,
  message,
  announcement,
  onUpdate,
  onEditCancel,
  showThread,
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
        return <DescriptionFeed feed={feed} />;
      }

      if (cardStyle === CardStyle.Tags) {
        return <TagsFeed feed={feed} />;
      }

      if (ASSET_CARD_STYLES.includes(cardStyle as CardStyle)) {
        <Card bordered className="activity-feed-reply-card-message">
          <Typography.Text
            className="activity-feed-comment-text"
            style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {message}
          </Typography.Text>
        </Card>;
        // const entityInfo = feed.feedInfo?.entitySpecificInfo?.entity;
        // const isExecutableTestSuite =
        //   entityType === EntityType.TEST_SUITE && entityInfo.basic;
        // const isObservabilityAlert =
        //   entityType === EntityType.EVENT_SUBSCRIPTION &&
        //   (entityInfo as EventSubscription).alertType ===
        //     AlertType.Observability;

        // const entityCard = (
        //   <ExploreSearchCard
        //     className="asset-info-card"
        //     id={`tabledatacard${entityInfo.id}`}
        //     showTags={false}
        //     source={{ ...entityInfo, entityType }}
        //   />
        // );

        // return cardStyle === CardStyle.EntityDeleted ? (
        //   <div className="deleted-entity">{entityCard}</div>
        // ) : (
        //   <Link
        //     className="no-underline text-body text-hover-body"
        //     to={entityUtilClassBase.getEntityLink(
        //       entityType,
        //       entityFQN,
        //       '',
        //       '',
        //       isExecutableTestSuite,
        //       isObservabilityAlert
        //     )}>
        //     {entityCard}
        //   </Link>
        // );
      }
    }

    return (
      <RichTextEditorPreviewerV1
        className="text-wrap"
        markdown={getFrontEndFormat(message)}
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

  function stripHtml(html: any) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    return tempDiv.innerText || tempDiv.textContent;
  }

  // return !isPost ? (
  //   feed.feedInfo?.entitySpecificInfo?.entity?.description ? (
  //     <Card
  //       bordered
  //       className={`activity-feed-card-message ${
  //         showThread && 'activity-feed-card-message-right-panel'
  //       }`}>
  //       <Typography.Text
  //         style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
  //         {/* {feed.feedInfo.entitySpecificInfo.entity.description} */}
  //         {stripHtml(feed.feedInfo.entitySpecificInfo.entity.description)}
  //       </Typography.Text>
  //     </Card>
  //   ) : null
  // ) : isEditPost ? (
  //   feedBodyRender
  // ) : (
  //   <Card bordered className="activity-feed-reply-card-message">
  //     <Typography.Text
  //       className="activity-feed-comment-text"
  //       style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
  //       {message}
  //     </Typography.Text>
  //   </Card>
  // );
  return (
    <div
      style={
        showThread
          ? {
              background: 'rgba(239, 244, 250, 0.25)',
              padding:
                feed.cardStyle === 'description'
                  ? '20px 20px 20px 6px'
                  : '12px',
              borderRadius: '8px',
              border: '0.8px solid #dfdfdf',
              marginTop: '20px',
            }
          : {
              background: 'white',
              padding:
                feed.cardStyle === 'description'
                  ? '20px 20px 20px 6px'
                  : '12px',
              borderRadius: '8px',
              marginTop: '2px',
            }
      }>
      {feedBodyRender}
    </div>
  );
};

export default FeedCardBodyNew;
