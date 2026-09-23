/*
 *  Copyright 2025 Collate.
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
  Box,
  Button,
  Card,
  Divider,
  SkeletonParagraph,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isUndefined, orderBy } from 'lodash';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import withSuspenseFallback from '../../../components/AppRouter/withSuspenseFallback';
import { EntityType } from '../../../enums/entity.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import {
  Conversation,
  ConversationReply,
} from '../../../generated/entity/feed/conversation';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import {
  formatDateTime,
  getRelativeTime,
  useActiveTimeFormat,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getActivityEventHeaderText } from '../../../utils/FeedUtils';
import {
  entityDisplayName,
  getEntityFQN,
  getEntityType,
  isFeedPostAuthor,
} from '../../../utils/FeedUtilsPure';
import { getUserPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import EntityPopOverCard from '../../common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import FeedCardBodyNew from '../ActivityFeedCard/FeedCardBody/FeedCardBodyNew';
import ActivityEventFooter from '../ActivityFeedCardV2/FeedCardFooter/ActivityEventFooter';
import FeedCardFooterNew from '../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import '../ActivityFeedTab/activity-feed-tab.less';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
import CommentCard from './CommentCard.component';
const ActivityFeedEditorNew = withSuspenseFallback(
  lazy(() => import('../ActivityFeedEditor/ActivityFeedEditorNew'))
);

const POST_SKELETON_KEYS = ['first', 'second', 'third'];

// Each child of the antd Space this markup replaced sat in its own block
// wrapper, which sets the line box the header text and avatars align in;
// keep that wrapper, and hide it when empty as antd's did.
const SPACE_ITEM_CLASS_NAME = 'tw:empty:hidden';

interface ActivityFeedCardNewProps {
  feed?: Conversation;
  activity?: ActivityEvent;
  isPost?: boolean;
  isActive?: boolean;
  post?: ConversationReply;
  showActivityFeedEditor?: boolean;
  showThread?: boolean;
  isForFeedTab?: boolean;
  isOpenInDrawer?: boolean;
  isFeedWidget?: boolean;
  isFullSizeWidget?: boolean;
  onActivityClick?: (activity: ActivityEvent) => void;
}

const getFeedCardWrapperClassName = (
  baseClassName: string,
  showThread: boolean | undefined,
  isPost: boolean,
  isOpenInDrawer: boolean,
  isActive: boolean | undefined
): string =>
  classNames(
    baseClassName,
    {
      'activity-feed-card-new-right-panel m-0 gap-0':
        showThread || isPost || isOpenInDrawer,
    },
    { 'activity-feed-reply-card': isPost },
    { 'active-card is-active': isActive }
  );

const getHeaderTagsClassName = (
  showThread: boolean | undefined,
  entityRefType?: string
): string =>
  classNames('d-flex', {
    'header-container-card': !showThread,
    'flex-wrap': showThread && entityRefType !== EntityType.CONTAINER,
    'items-start': showThread && entityRefType === EntityType.CONTAINER,
    'items-center': !showThread || entityRefType !== EntityType.CONTAINER,
  });

const computeFeedId = (feed?: Conversation, activity?: ActivityEvent): string =>
  feed?.id ?? activity?.id ?? '';

const computeHasNoReplies = (
  isActivityEvent: boolean,
  activityReplies: ConversationReply[],
  feed?: Conversation
): boolean =>
  isActivityEvent
    ? activityReplies.length === 0
    : (feed?.replies?.length ?? 0) === 0;

const computeShouldAddBottomMargin = (
  showActivityFeedEditor: boolean | undefined,
  hasNoReplies: boolean,
  isOpenInDrawer: boolean
): boolean => (showActivityFeedEditor && hasNoReplies) || isOpenInDrawer;

const ActivityFeedCardNew = ({
  feed,
  activity,
  isPost = false,
  post,
  showActivityFeedEditor,
  showThread,
  isActive,
  isForFeedTab,
  isOpenInDrawer = false,
  isFeedWidget = false,
  isFullSizeWidget = false,
  onActivityClick,
}: ActivityFeedCardNewProps) => {
  const isActivityEvent = !isUndefined(activity);
  const timeFormat = useActiveTimeFormat();

  const { entityFQN, entityType } = useMemo(() => {
    const aboutValue = feed?.about ?? activity?.about ?? '';
    // `||`, not `??`: the EntityLink accessors return '' for a missing or
    // unparseable link, and an activity event's `about` is optional. `??` would
    // keep that '' and skip the entity reference the event does carry, leaving
    // the card with no entity link, icon or popover.
    const entityFQN =
      getEntityFQN(aboutValue) || activity?.entity?.fullyQualifiedName || '';
    const entityType =
      getEntityType(aboutValue) || (activity?.entity?.type as EntityType) || '';

    return { entityFQN, entityType };
  }, [feed?.about, activity?.about, activity?.entity]);

  const createdBy = useMemo(() => {
    const postAuthor = post?.author.name ?? post?.author.fullyQualifiedName;
    const feedCreator =
      feed?.createdBy?.name ?? feed?.createdBy?.fullyQualifiedName;

    return postAuthor ?? feedCreator ?? activity?.actor?.name ?? '';
  }, [feed?.createdBy, post?.author, activity?.actor?.name]);

  const feedId = computeFeedId(feed, activity);

  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const {
    selectedThread,
    postFeed,
    updateFeed,
    deleteFeed,
    updateReactions,
    isPostsLoading,
    postActivityComment,
    activityReplies,
  } = useActivityFeedProvider();
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const [, , user] = useUserProfile({
    permission: true,
    name: createdBy,
  });

  useEffect(() => {
    setShowFeedEditor(false);
  }, [feedId]);

  const onSave = (message: string) => {
    if (isActivityEvent && activity) {
      postActivityComment(message, activity).catch(() => {
        // ignore since error is displayed in toast in the parent promise.
      });
    } else {
      postFeed(message, selectedThread?.id ?? '').catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      });
    }
    setShowFeedEditor(false);
  };

  const onUpdate = (message: string) => {
    if (!feed) {
      return;
    }
    const target = isPost && post ? post : feed;
    const patch = compare(target, { ...target, message });
    updateFeed(feed.id, post?.id ?? '', !isPost, patch);
    setIsEditPost(!isEditPost);
  };

  const { isUserOrTeam } = useMemo(() => {
    return {
      entityCheck: !isUndefined(entityFQN) && !isUndefined(entityType),
      isUserOrTeam: [EntityType.USER, EntityType.TEAM].includes(entityType),
    };
  }, [entityFQN, entityType]);
  const entityRef = feed?.entityRef ?? activity?.entity;

  const renderEntityLink = useMemo(() => {
    if (isUserOrTeam) {
      return (
        <UserPopOverCard
          showUserName
          showUserProfile={false}
          userName={createdBy}>
          <Link
            className="break-all text-body header-link"
            data-testid="entity-link"
            to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
            <span
              className={classNames('text-sm', {
                'max-one-line': !showThread,
              })}>
              {entityRef
                ? getEntityName(entityRef)
                : entityDisplayName(entityType, entityFQN)}
            </span>
          </Link>
        </UserPopOverCard>
      );
    } else {
      return (
        <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
          <div
            className={classNames('text-sm flex-center gap-1', {
              'max-one-line': !showThread,
            })}>
            {searchClassBase.getEntityIcon(entityType ?? '') && (
              <span className="d-inline-flex align-middle">
                {searchClassBase.getEntityIcon(
                  entityType ?? '',
                  'tw:h-4 tw:w-4'
                )}
              </span>
            )}
            <Link
              className="break-word text-sm header-link"
              data-testid="entity-link"
              to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
              <span>
                {entityRef
                  ? getEntityName(entityRef)
                  : entityDisplayName(entityType, entityFQN)}
              </span>
            </Link>
          </div>
        </EntityPopOverCard>
      );
    }
  }, [entityType, entityFQN, isUserOrTeam, entityRef, createdBy, showThread]);

  const feedHeaderText = useMemo(() => {
    if (isActivityEvent && activity) {
      return getActivityEventHeaderText(
        activity.eventType,
        activity.fieldName,
        entityType
      );
    }

    return t('label.conversation-lowercase');
  }, [isActivityEvent, activity, entityType, t]);

  const timestampValue =
    post?.createdAt ?? feed?.createdAt ?? activity?.timestamp;
  const timestamp = timestampValue ? (
    <Tooltip excludeTriggerFromTabOrder title={formatDateTime(timestampValue)}>
      <Typography
        className="feed-card-header-v2-timestamp"
        color="secondary"
        data-testid="timestamp"
        size="text-xs">
        {getRelativeTime(timestampValue)}
      </Typography>
    </Tooltip>
  ) : null;

  const closeFeedEditor = useCallback(() => {
    setShowFeedEditor(false);
  }, []);

  // Rendered unconditionally and revealed with CSS: gating the mount on hover
  // put these permanently out of reach of the keyboard and screen readers.
  const feedActions =
    !isActivityEvent && !isPost && feed ? (
      <ActivityFeedActions
        conversation={feed}
        conversationId={feed.id}
        isReply={false}
        onEditPost={() => setIsEditPost((current) => !current)}
      />
    ) : null;

  const posts = useMemo(() => {
    if (!showThread && !isOpenInDrawer) {
      return null;
    }
    if (isPostsLoading) {
      return (
        <Box className="m-y-md" direction="col" gap={4}>
          {POST_SKELETON_KEYS.map((key) => (
            <SkeletonParagraph key={key} />
          ))}
        </Box>
      );
    }

    const replies = isActivityEvent ? activityReplies : feed?.replies ?? [];
    const orderedPosts = orderBy(replies, ['createdAt'], ['desc']);

    if (orderedPosts.length === 0) {
      return null;
    }

    return (
      <Box className="p-l-0 p-r-0" data-testid="feed-replies" direction="col">
        {orderedPosts.map((reply, index, arr) => {
          const conversationId = activity?.id ?? feed?.id ?? '';
          const canManage =
            isFeedPostAuthor(currentUser, reply.author) ||
            Boolean(currentUser?.isAdmin);

          return (
            <CommentCard
              canDelete={canManage}
              canEdit={canManage}
              closeFeedEditor={closeFeedEditor}
              isLastReply={index === arr.length - 1}
              key={reply.id}
              reply={reply}
              onDelete={() => deleteFeed(conversationId, reply.id, false)}
              onEdit={async (message) => {
                await updateFeed(
                  conversationId,
                  reply.id,
                  false,
                  compare(reply, { ...reply, message })
                );
              }}
              onReaction={(reaction, operation) =>
                updateReactions(
                  reply,
                  conversationId,
                  false,
                  reaction,
                  operation
                )
              }
            />
          );
        })}
      </Box>
    );
  }, [
    feed,
    showThread,
    isOpenInDrawer,
    closeFeedEditor,
    isPostsLoading,
    isActivityEvent,
    activityReplies,
    activity?.id,
    currentUser,
    deleteFeed,
    updateFeed,
    updateReactions,
  ]);

  const feedMessage = useMemo(() => {
    if (isActivityEvent) {
      return activity?.summary ?? '';
    }

    return isPost ? post?.message ?? '' : feed?.message ?? '';
  }, [isActivityEvent, activity, isPost, feed, post]);

  const headerTags = useMemo(
    () => (
      <Box
        className={getHeaderTagsClassName(showThread, entityRef?.type)}
        gap={2}
        itemClassName={SPACE_ITEM_CLASS_NAME}>
        <Typography
          className="card-style-feed-header"
          data-testid="headerText"
          size="text-sm">
          {feedHeaderText}
        </Typography>

        {renderEntityLink}
      </Box>
    ),
    [showThread, entityRef?.type, feedHeaderText, renderEntityLink]
  );

  const renderWidgetCard = () => (
    <Card
      className={getFeedCardWrapperClassName(
        'activity-feed-card-new activity-feed-card-new-surface tw:overflow-visible tw:rounded-none tw:border-primary tw:text-primary',
        showThread,
        isPost,
        isOpenInDrawer,
        isActive
      )}
      data-conversation-id={feed?.id}
      data-testid="feed-card-v2-sidebar">
      <Card.Content className="activity-feed-card-new-body tw:p-0">
        <Box className="w-full" gap={2}>
          <Box align="center" direction="col" justify="center">
            <UserPopOverCard
              className="m-r-0"
              profileWidth={24}
              userName={createdBy}
            />

            <Divider
              className="divider tw:bg-transparent"
              orientation="vertical"
            />
          </Box>

          <Box className="w-full min-w-0 overflow-hidden" direction="col">
            <Box align="start" direction="col">
              <Box
                align="center"
                className={classNames('w-full', {
                  'header-container-card': !showThread,
                  'header-container-right-panel': showThread,
                })}
                justify="between">
                <div
                  className={classNames('mr-2', {
                    'activity-feed-user-name': !isPost,
                    'reply-card-user-name': isPost,
                  })}>
                  <UserPopOverCard
                    className={classNames('mr-2', {
                      'activity-feed-user-name': !isPost,
                      'reply-card-user-name': isPost,
                    })}
                    userName={createdBy}>
                    <Link to={getUserPath(createdBy)}>
                      {getEntityName(user)}
                    </Link>
                  </UserPopOverCard>
                </div>
                {timestamp}
              </Box>
              {!isPost && headerTags}
            </Box>
            <FeedCardBodyNew
              activity={activity}
              feed={feed}
              isEditPost={isEditPost}
              isFeedWidget={isFeedWidget}
              isForFeedTab={isForFeedTab}
              isPost={isPost}
              message={feedMessage}
              showThread={showThread}
              onEditCancel={() => setIsEditPost(false)}
              onUpdate={onUpdate}
            />
            {isFullSizeWidget && !isActivityEvent && feed && (
              <div className="m-b-md">
                <FeedCardFooterNew
                  isForFeedTab
                  conversation={feed}
                  conversationId={feed.id}
                  isReply={isPost}
                  reply={post}
                />
              </div>
            )}
            {isFullSizeWidget && isActivityEvent && activity && (
              <div className="m-b-md">
                <ActivityEventFooter
                  activity={activity}
                  isForFeedTab={isForFeedTab}
                  onActivityClick={onActivityClick}
                />
              </div>
            )}
          </Box>
        </Box>
        {feedActions}
      </Card.Content>
    </Card>
  );

  if (isFeedWidget) {
    return renderWidgetCard();
  }

  const hasNoReplies = computeHasNoReplies(
    isActivityEvent,
    activityReplies,
    feed
  );
  const shouldAddBottomMargin = computeShouldAddBottomMargin(
    showActivityFeedEditor,
    hasNoReplies,
    isOpenInDrawer
  );

  const renderCommentsSection = () => (
    <Box className="activity-feed-comments-container" direction="col">
      {(showActivityFeedEditor || isOpenInDrawer) && (
        <Typography className="activity-feed-comments-title m-b-md">
          {t('label.comment-plural')}
        </Typography>
      )}
      {showFeedEditor ? (
        <ActivityFeedEditorNew
          // Revealed by a click on its placeholder, so it takes focus.
          focused
          className={classNames(
            'm-t-md feed-editor activity-feed-editor-container-new',
            {
              'm-b-md': shouldAddBottomMargin,
            }
          )}
          onSave={onSave}
        />
      ) : (
        <Box gap={2}>
          <div>
            <UserPopOverCard userName={currentUser?.name ?? ''}>
              <Box align="center">
                <ProfilePicture
                  key={feedId}
                  name={currentUser?.name ?? ''}
                  width="32"
                />
              </Box>
            </UserPopOverCard>
          </div>

          {/* Only opens the editor, so it is a button rather than an input. */}
          <Button
            className="tw:w-full tw:justify-start"
            color="secondary"
            data-testid="comments-input-field"
            size="sm"
            onPress={() => setShowFeedEditor(true)}>
            {t('message.input-placeholder')}
          </Button>
        </Box>
      )}

      {posts}
    </Box>
  );

  const isContainerThread =
    showThread && entityRef?.type === EntityType.CONTAINER;

  const renderFullCard = () => (
    <Card
      className={getFeedCardWrapperClassName(
        'relative activity-feed-card-new activity-feed-card-new-surface tw:overflow-visible tw:rounded-none tw:border-primary tw:text-primary',
        showThread,
        isPost,
        isOpenInDrawer,
        isActive
      )}
      data-conversation-id={feed?.id}
      data-testid="feed-card-v2-sidebar">
      <Card.Content className="activity-feed-card-new-body tw:p-0">
        <Box direction="col" gap={2}>
          <div className={SPACE_ITEM_CLASS_NAME}>
            <Box
              inline
              align={isContainerThread ? 'start' : 'center'}
              gap={2}
              itemClassName={SPACE_ITEM_CLASS_NAME}
              justify="start">
              <UserPopOverCard userName={createdBy}>
                <Box align="center">
                  <ProfilePicture
                    key={feedId}
                    name={createdBy}
                    width={showThread ? '40' : '32'}
                  />
                </Box>
              </UserPopOverCard>

              <Box align="start" direction="col">
                <div className={SPACE_ITEM_CLASS_NAME}>
                  <Box
                    align="center"
                    className={classNames('', {
                      'header-container-card': !showThread,
                      'header-container-right-panel': showThread,
                    })}
                    itemClassName={SPACE_ITEM_CLASS_NAME}>
                    <Typography
                      className={classNames('mr-2 not-prose', {
                        'activity-feed-user-name': !isPost,
                        'reply-card-user-name': isPost,
                      })}>
                      <UserPopOverCard
                        className={classNames('mr-2', {
                          'activity-feed-user-name': !isPost,
                          'reply-card-user-name': isPost,
                        })}
                        userName={createdBy}>
                        <Link to={getUserPath(createdBy)}>
                          {getEntityName(user)}
                        </Link>
                      </UserPopOverCard>
                    </Typography>

                    {timestamp}
                  </Box>
                </div>
                {!isPost && (
                  <div className={SPACE_ITEM_CLASS_NAME}>{headerTags}</div>
                )}
              </Box>
            </Box>
          </div>

          <div className={SPACE_ITEM_CLASS_NAME}>
            <FeedCardBodyNew
              activity={activity}
              feed={feed}
              isEditPost={isEditPost}
              isForFeedTab={isForFeedTab}
              isPost={isPost}
              message={feedMessage}
              showThread={showThread}
              onEditCancel={() => setIsEditPost(false)}
              onUpdate={onUpdate}
            />
          </div>

          {!isActivityEvent && feed && (
            <div className={SPACE_ITEM_CLASS_NAME}>
              <FeedCardFooterNew
                conversation={feed}
                conversationId={feed.id}
                isForFeedTab={isForFeedTab}
                isReply={isPost}
                reply={post}
              />
            </div>
          )}

          {isActivityEvent && activity && (
            <div className={SPACE_ITEM_CLASS_NAME}>
              <ActivityEventFooter
                activity={activity}
                isForFeedTab={isForFeedTab}
                onActivityClick={onActivityClick}
              />
            </div>
          )}
        </Box>
        {(showThread || isOpenInDrawer) && renderCommentsSection()}
        {feedActions}
      </Card.Content>
    </Card>
  );

  return renderFullCard();
};

export default ActivityFeedCardNew;
