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

import { Button, Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ActivityFeedEditor from '../../../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import RichTextEditorPreviewer from '../../../../components/common/RichTextEditor/RichTextEditorPreviewer';
import { ASSET_CARD_STYLES } from '../../../../constants/Feeds.constants';
import { CardStyle } from '../../../../generated/entity/feed/thread';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import {
  getEntityFQN,
  getEntityType,
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../utils/FeedUtils';
import ExploreSearchCard from '../../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import CustomPropertyFeed from '../../ActivityFeedCardV2/FeedCardBody/CustomPropertyFeed/CustomPropertyFeed.component';
import DescriptionFeed from '../../ActivityFeedCardV2/FeedCardBody/DescriptionFeed/DescriptionFeed';
import TagsFeed from '../../ActivityFeedCardV2/FeedCardBody/TagsFeed/TagsFeed';
import TestCaseFeed from '../../ActivityFeedCardV2/FeedCardBody/TestCaseFeed/TestCaseFeed';
import './feed-card-body-v1.less';
import { FeedCardBodyV1Props } from './FeedCardBodyV1.interface';

const FeedCardBodyV1 = ({
  isPost = false,
  feed,
  isEditPost,
  className,
  showSchedule = true,
  message,
  announcement,
  onUpdate,
  onEditCancel,
}: FeedCardBodyV1Props) => {
  const { t } = useTranslation();
  const [postMessage, setPostMessage] = useState<string>(message);

  const { entityFQN, entityType } = useMemo(() => {
    const entityFQN = getEntityFQN(feed.about) ?? '';
    const entityType = getEntityType(feed.about) ?? '';

    return { entityFQN, entityType };
  }, [feed]);

  const { cardStyle } = useMemo(() => {
    return {
      cardStyle: feed.cardStyle ?? '',
    };
  }, [feed]);

  const handleSave = useCallback(() => {
    onUpdate?.(postMessage ?? '');
  }, [onUpdate, postMessage]);

  const getDefaultValue = (defaultMessage: string) => {
    return MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(defaultMessage));
  };

  const feedBody = useMemo(() => {
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

    if (!isPost) {
      if (cardStyle === CardStyle.Description) {
        return <DescriptionFeed feed={feed} />;
      }

      if (cardStyle === CardStyle.Tags) {
        return <TagsFeed feed={feed} />;
      }

      if (cardStyle === CardStyle.TestCaseResult) {
        return (
          <TestCaseFeed
            entitySpecificInfo={feed.feedInfo?.entitySpecificInfo}
            // testResultSummary={
            //   feed.feedInfo?.entitySpecificInfo
            //     ?.entityTestResultSummary as EntityTestResultSummaryObject[]
            // }
          />
        );
      }

      if (ASSET_CARD_STYLES.includes(cardStyle as CardStyle)) {
        const entityInfo = feed.feedInfo?.entitySpecificInfo?.entity;
        const entityCard = (
          <ExploreSearchCard
            className="asset-info-card"
            id={`tabledatacard${entityInfo.id}`}
            showTags={false}
            source={{ ...entityInfo, entityType }}
          />
        );

        return cardStyle === CardStyle.EntityDeleted ? (
          entityCard
        ) : (
          <Link
            className="no-underline"
            to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
            {entityCard}
          </Link>
        );
      }

      if (cardStyle === CardStyle.CustomProperties) {
        return <CustomPropertyFeed feed={feed} />;
      }
    }

    return (
      <RichTextEditorPreviewer
        className="text-wrap"
        markdown={getFrontEndFormat(message)}
      />
    );
  }, [isEditPost, message, postMessage, cardStyle, feed]);

  return (
    <div
      className={classNames(
        'feed-card-body bg-grey-5 p-sm rounded-6',
        isEditPost ? '' : className
      )}>
      <div className="feed-message">
        {!isUndefined(announcement) ? (
          <>
            <Row>
              <Col span={24}>
                {showSchedule && (
                  <Typography.Text className="feed-body-schedule text-xs text-grey-muted">
                    {t('label.schedule')}{' '}
                    {formatDateTime(announcement.startTime * 1000)}{' '}
                    {t('label.to-lowercase')}{' '}
                    {formatDateTime(announcement.endTime * 1000)}
                  </Typography.Text>
                )}
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <Typography.Text className="font-semibold">
                  {message}
                </Typography.Text>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <RichTextEditorPreviewer
                  className="text-wrap"
                  markdown={announcement.description ?? ''}
                />
              </Col>
            </Row>
          </>
        ) : (
          feedBody
        )}
      </div>
    </div>
  );
};

export default FeedCardBodyV1;
