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

import { Button } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { lazy, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../../../components/AppRouter/withSuspenseFallback';
import { ActivityEventType } from '../../../../generated/entity/activity/activityEvent';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../utils/FeedUtilsPure';
import './feed-card-body-v1.less';
import { FeedCardBodyV1Props } from './FeedCardBodyV1.interface';

const RichTextEditorPreviewerNew = withSuspenseFallback(
  lazy(() => import('../../../common/RichTextEditor/RichTextEditorPreviewNew'))
);

const ActivityDescriptionFeed = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../ActivityFeedCardV2/FeedCardBody/DescriptionFeed/ActivityDescriptionFeed'
      )
  )
);

const ActivityOwnersFeed = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../ActivityFeedCardV2/FeedCardBody/OwnerFeed/ActivityOwnersFeed'
      )
  )
);

const ActivityFeedEditor = withSuspenseFallback(
  lazy(() => import('../../ActivityFeedEditor/ActivityFeedEditor'))
);
const ActivityTagsFeed = withSuspenseFallback(
  lazy(
    () =>
      import('../../ActivityFeedCardV2/FeedCardBody/TagsFeed/ActivityTagsFeed')
  )
);

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
    feed,
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
                color="secondary-brand"
                data-testid="cancel-button"
                size="xs"
                onPress={onEditCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="save-button"
                isDisabled={!message.length}
                size="xs"
                onPress={handleSave}>
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
        'tw:overflow-x-hidden tw:overflow-y-scroll tw:rounded-lg tw:border-[0.5px] tw:border-utility-gray-blue-100 tw:dark:border-subtle',
        showThread
          ? [
              'tw:max-h-100 tw:bg-utility-gray-blue-50 tw:dark:bg-secondary_subtle',
              isFeedWidget ? 'tw:mt-2.5 tw:px-4 tw:py-3' : 'tw:mt-5 tw:p-5',
            ]
          : // The collapsed well takes the card's own tone in dark (surface, or
            // the brand tint when selected); a filled well reads black there.
            'tw:mt-0.5 tw:max-h-50 tw:bg-surface tw:p-5 tw:[scrollbar-width:none] tw:dark:bg-transparent tw:[&::-webkit-scrollbar]:hidden'
      )}>
      {feedBodyRender}
    </div>
  );
};

export default FeedCardBodyNew;
