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

import { Box, Button, Card, Skeleton } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../../../components/AppRouter/withSuspenseFallback';
import { FEED_MESSAGE_RENDERED_CONTENT_SELECTOR } from '../../../../constants/Feeds.constants';
import { ActivityEventType } from '../../../../generated/entity/activity/activityEvent';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../utils/FeedUtilsPure';
import { stripMarkdown } from '../../../../utils/RichTextStringUtils';
import DeferredWidget from '../../../common/DeferredWidget/DeferredWidget.component';
import './feed-card-body-v1.less';
import { FeedCardBodyV1Props } from './FeedCardBodyV1.interface';

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

const RichTextEditorPreviewerNew = withSuspenseFallback(
  lazy(() => import('../../../common/RichTextEditor/RichTextEditorPreviewNew'))
);

// The message's plain text stays in the DOM while its preview is deferred, so screen
// readers, find-in-page and text lookups see it before the editor mounts.
const FeedMessageSkeleton = ({ text }: { text: string }) => (
  <Box data-testid="feed-message-skeleton" direction="col" gap={2}>
    <span className="tw:sr-only">{text}</span>
    <Skeleton aria-hidden height={14} variant="text" width="100%" />
    <Skeleton aria-hidden height={14} variant="text" width="60%" />
  </Box>
);

// The previewer and its editor both load lazily and the editor first renders empty, so
// the skeleton stays until the hidden preview has rendered content; the field is never blank.
const FeedMessagePreviewContent = ({
  markdown,
  plainText,
}: {
  markdown: string;
  plainText: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isRendered) {
      return;
    }
    const checkRendered = () => {
      if (
        container.textContent?.trim() ||
        container.querySelector(FEED_MESSAGE_RENDERED_CONTENT_SELECTOR)
      ) {
        setIsRendered(true);
      }
    };
    const observer = new MutationObserver(checkRendered);
    observer.observe(container, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    checkRendered();

    return () => observer.disconnect();
  }, [isRendered]);

  return (
    <>
      {isRendered ? null : <FeedMessageSkeleton text={plainText} />}
      <div className={isRendered ? undefined : 'tw:hidden'} ref={containerRef}>
        <RichTextEditorPreviewerNew
          clampByLines
          className="text-wrap"
          markdown={markdown}
        />
      </div>
    </>
  );
};

// Each preview mounts a read-only rich-text editor; a long feed mounting them all at
// once blocks the main thread for tens of seconds, so only cards near the viewport do.
const FeedMessagePreview = ({ markdown }: { markdown: string }) => {
  const plainText = useMemo(() => stripMarkdown(markdown), [markdown]);

  return (
    <DeferredWidget placeholder={<FeedMessageSkeleton text={plainText} />}>
      <FeedMessagePreviewContent markdown={markdown} plainText={plainText} />
    </DeferredWidget>
  );
};

const FeedCardBodyNew = ({
  feed,
  activity,
  isEditPost,
  message,
  onUpdate,
  onEditCancel,
  showThread,
  isForFeedTab,
  isFeedWidget,
  isActive,
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
        <FeedMessagePreview
          markdown={getFrontEndFormat(activity.summary ?? message)}
        />
      );
    }

    return (
      <FeedMessagePreview
        markdown={getFrontEndFormat(feed?.message ?? message)}
      />
    );
  }, [message, feed, isActivityEvent, activity, isForFeedTab, showThread]);

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
  }, [
    isEditPost,
    message,
    feedBodyStyleCardsRender,
    handleSave,
    onEditCancel,
    t,
  ]);

  return (
    <Card
      className={classNames(
        'tw:overflow-y-auto',
        // On the selected card's dark brand tint the surface Card is a dark
        // slab; let the tint show through. Light mode keeps the white surface.
        isActive && 'tw:dark:bg-transparent',
        showThread
          ? [
              'tw:max-h-100',
              isFeedWidget ? 'tw:mt-2.5 tw:px-4 tw:py-3' : 'tw:mt-5 tw:p-5',
            ]
          : 'tw:mt-0.5 tw:max-h-50 tw:p-5 tw:scrollbar-hide'
      )}>
      {feedBodyRender}
    </Card>
  );
};

export default FeedCardBodyNew;
