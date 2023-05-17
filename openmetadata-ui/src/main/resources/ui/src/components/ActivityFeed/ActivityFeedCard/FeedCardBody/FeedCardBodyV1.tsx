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
import { Button, Space, Typography } from 'antd';
import classNames from 'classnames';
import ActivityFeedEditor from 'components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Reactions from 'components/Reactions/Reactions';
import { Thread } from 'generated/entity/feed/thread';
import { isUndefined, noop } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFrontEndFormat, MarkdownToHTMLConverter } from 'utils/FeedUtils';
import { getDateTimeByTimeStamp } from 'utils/TimeUtils';

interface props {
  isEditPost: boolean;
  feed: Thread;
  className?: string;
}

const FeedCardBodyV1 = ({
  isEditPost,
  className,
  feed: { message, announcement, reactions },
}: props) => {
  const { t } = useTranslation();
  const getDefaultValue = (defaultMessage: string) => {
    return MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(defaultMessage));
  };

  const FEED_BODY = useMemo(
    () =>
      isEditPost ? (
        <ActivityFeedEditor
          defaultValue={getDefaultValue(message)}
          editAction={
            <div className="d-flex tw-justify-end tw-gap-2 tw-mr-1.5">
              <Button
                className="tw-border tw-border-primary tw-text-primary tw-rounded"
                data-testid="cancel-button"
                size="small"
                onClick={noop}>
                {t('label.cancel')}
              </Button>
              <Button
                className="tw-rounded"
                data-testid="save-button"
                disabled={!postMessage.length}
                size="small"
                type="primary"
                onClick={noop}>
                {t('label.save')}
              </Button>
            </div>
          }
          editorClass="is_edit_post"
          onSave={noop}
          onTextChange={noop}
        />
      ) : (
        <RichTextEditorPreviewer
          className="activity-feed-card-v1-text"
          markdown={getFrontEndFormat(message)}
        />
      ),
    [isEditPost, message]
  );

  return (
    <div className={classNames('feed-card-body', isEditPost ? '' : className)}>
      <div className="feed-meesage">
        {!isUndefined(announcement) ? (
          <Space direction="vertical" size={4}>
            <Typography.Text className="feed-body-schedule text-xs text-grey-muted">
              {t('label.schedule')}{' '}
              {getDateTimeByTimeStamp(announcement.startTime * 1000)}{' '}
              {t('label.to-lowercase')}{' '}
              {getDateTimeByTimeStamp(announcement.endTime * 1000)}
            </Typography.Text>
            <Typography.Text className="font-semibold">
              {postMessage}
            </Typography.Text>
            <RichTextEditorPreviewer
              className="activity-feed-card-v1-text"
              markdown={announcement.description || ''}
            />
          </Space>
        ) : (
          FEED_BODY
        )}
      </div>
      {Boolean(reactions?.length) && (
        <Reactions reactions={reactions || []} onReactionSelect={noop} />
      )}
    </div>
  );
};

export default FeedCardBodyV1;
