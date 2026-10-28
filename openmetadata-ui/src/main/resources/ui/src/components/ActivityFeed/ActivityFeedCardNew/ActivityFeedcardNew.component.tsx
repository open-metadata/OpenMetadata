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
import { EntityReference } from '../../../generated/entity/type';
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
import { getSettingsLink } from '../../../utils/SettingsModalLinkUtils';
import EntityPopOverCard from '../../common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import FeedCardBodyNew from '../ActivityFeedCard/FeedCardBody/FeedCardBodyNew';
import ActivityEventFooter from '../ActivityFeedCardV2/FeedCardFooter/ActivityEventFooter';
import FeedCardFooterNew from '../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import '../ActivityFeedTab/activity-feed-tab.less';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
import FeedFieldPath from '../Shared/FeedFieldPath/FeedFieldPath';
import {
  PANEL_HEADER_LAYOUT,
  SPACE_ITEM_CLASS_NAME,
} from './ActivityFeedcardNew.constants';
import {
  getActionsClassName,
  getFooterVisibility,
  getFullCardBaseClassName,
  getFullCardBodyClassName,
  getHeaderLayout,
  getHeaderTagsClassName,
  getHeaderTagsItemClassName,
} from './ActivityFeedcardNew.utils';
import CommentCard from './CommentCard.component';
const ActivityFeedEditorNew = withSuspenseFallback(
  lazy(() => import('../ActivityFeedEditor/ActivityFeedEditorNew'))
);

const CommentComposer = withSuspenseFallback(
  lazy(() => import('../../common/CommentComposer/CommentComposer'))
);

const POST_SKELETON_KEYS = ['first', 'second', 'third'];

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
  /** In the activity thread panel the conversation's Edit / Delete sit in a menu. */
  isThreadPanel?: boolean;
  /** Replaces the footer reply's default of opening the thread drawer. */
  onReplyPress?: () => void;
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

interface ThreadPanelEntityLinkProps {
  about: string;
  entityFQN: string;
  entityRef?: EntityReference;
  entityType: EntityType;
  showField: boolean;
}

// The thread panels' entity link: one line, cut with an ellipsis, followed by
// the field trail, which stays whole.
const ThreadPanelEntityLink = ({
  about,
  entityFQN,
  entityRef,
  entityType,
  showField,
}: ThreadPanelEntityLinkProps) => (
  <Box align="center" className="tw:min-w-0 tw:gap-1.5">
    <Box className={PANEL_HEADER_LAYOUT.entity}>
      <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
        <Box
          align="center"
          className="tw:min-w-0 text-sm"
          gap={1}
          justify="center">
          {searchClassBase.getEntityIcon(entityType) && (
            <Box inline align="center">
              {searchClassBase.getEntityIcon(entityType, 'tw:h-4 tw:w-4')}
            </Box>
          )}
          <Link
            className="text-sm header-link tw:block tw:min-w-0"
            data-testid="entity-link"
            to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
            {/* Truncated on the text: .header-link sets the link's wrapping. */}
            <Typography ellipsis color="brand">
              {entityRef
                ? getEntityName(entityRef)
                : entityDisplayName(entityType, entityFQN)}
            </Typography>
          </Link>
        </Box>
      </EntityPopOverCard>
    </Box>
    <Box className={PANEL_HEADER_LAYOUT.field}>
      <FeedFieldPath
        truncateColumn
        about={about}
        className={PANEL_HEADER_LAYOUT.fieldPath}
        entityType={entityType}
        showField={showField}
      />
    </Box>
  </Box>
);

// The side panel (a thread, or an activity opened from the list) has room for
// the full entity name; list cards truncate it.
const isSidePanelLayout = (
  showThread: boolean | undefined,
  isOpenInDrawer: boolean | undefined
): boolean => Boolean(showThread || isOpenInDrawer);

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
  isThreadPanel,
  onReplyPress,
  onActivityClick,
}: ActivityFeedCardNewProps) => {
  const isActivityEvent = !isUndefined(activity);
  const isPanelLayout = isSidePanelLayout(showThread, isOpenInDrawer);
  const timeFormat = useActiveTimeFormat();

  const entityRef = feed?.entityRef ?? activity?.entity;

  const { entityFQN, entityType, about } = useMemo(() => {
    const aboutValue = feed?.about ?? activity?.about ?? '';
    // Read the entity reference rather than parse `about`. For an activity
    // event, and a Conversation the server created from one, `about` carries
    // the changed field (`<#E::topic::fqn::entityStatus>`), and a field the
    // EntityLink grammar does not list makes ANTLR log a syntax error on every
    // render.
    if (entityRef?.fullyQualifiedName) {
      return {
        entityFQN: entityRef.fullyQualifiedName,
        entityType: entityRef.type as EntityType,
        about: aboutValue,
      };
    }

    return {
      entityFQN: getEntityFQN(aboutValue),
      entityType: getEntityType(aboutValue) as EntityType,
      about: aboutValue,
    };
  }, [feed?.about, activity?.about, entityRef]);

  const createdBy = useMemo(() => {
    const postAuthor = post?.author.name ?? post?.author.fullyQualifiedName;
    const feedCreator =
      feed?.createdBy?.name ?? feed?.createdBy?.fullyQualifiedName;

    return postAuthor ?? feedCreator ?? activity?.actor?.name ?? '';
  }, [feed?.createdBy, post?.author, activity?.actor?.name]);

  const feedId = computeFeedId(feed, activity);
  const headerLayout = getHeaderLayout(isThreadPanel);

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
    focusReplyEditor,
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
                'tw:block tw:truncate': !isPanelLayout,
              })}>
              {entityRef
                ? getEntityName(entityRef)
                : entityDisplayName(entityType, entityFQN)}
            </span>
          </Link>
        </UserPopOverCard>
      );
    } else {
      if (isThreadPanel) {
        return (
          <ThreadPanelEntityLink
            about={about}
            entityFQN={entityFQN}
            entityRef={entityRef}
            entityType={entityType}
            showField={!isActivityEvent}
          />
        );
      }

      return (
        // List cards: take the rest of the verb's line (basis 0) so the link
        // truncates there. Thread panel: natural width, wrapping under the verb.
        <Box
          align="center"
          className={classNames('tw:min-w-0 tw:gap-x-1.5 tw:gap-y-0.5', {
            'tw:max-w-full': isPanelLayout,
          })}
          wrap="wrap">
          {/* List cards: the link takes what the path leaves (basis 0), so
              "› Field" stays on the same line and the link truncates; the
              path wraps only when even a short link no longer fits. */}
          <Box
            className={
              isPanelLayout ? 'tw:min-w-0' : 'tw:min-w-12 tw:flex-1 tw:basis-0'
            }>
            <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
              <Box
                align={isPanelLayout ? 'start' : 'center'}
                className="tw:min-w-0 text-sm"
                gap={1}
                justify="start">
                {searchClassBase.getEntityIcon(entityType ?? '') && (
                  // h-5 = the text-sm line height, so the icon centres on the
                  // link's first line.
                  <Box inline align="center" className="tw:h-5 tw:shrink-0">
                    {searchClassBase.getEntityIcon(
                      entityType ?? '',
                      'tw:h-4 tw:w-4'
                    )}
                  </Box>
                )}
                <Link
                  className={classNames('text-sm header-link', {
                    // Ellipsis, not a word-wrapped one-line clamp: in a narrow
                    // card the clamp showed only the start of the first word.
                    'tw:block tw:min-w-0 tw:truncate': !isPanelLayout,
                    'tw:min-w-0 tw:wrap-break-word': isPanelLayout,
                  })}
                  data-testid="entity-link"
                  to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
                  <span>
                    {entityRef
                      ? getEntityName(entityRef)
                      : entityDisplayName(entityType, entityFQN)}
                  </span>
                </Link>
              </Box>
            </EntityPopOverCard>
          </Box>
          <FeedFieldPath
            about={about}
            entityType={entityType}
            showField={!isActivityEvent}
          />
        </Box>
      );
    }
  }, [
    entityType,
    entityFQN,
    about,
    isActivityEvent,
    isUserOrTeam,
    entityRef,
    createdBy,
    isPanelLayout,
    isThreadPanel,
  ]);

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
    <Tooltip
      excludeTriggerFromTabOrder
      containerClassName="timestamp-tooltip"
      title={formatDateTime(timestampValue, timeFormat)}>
      <Typography
        className={classNames(
          'feed-card-header-v2-timestamp',
          headerLayout.timestamp
        )}
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
        asMenu={isThreadPanel}
        className={getActionsClassName(isThreadPanel)}
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
    // The thread panel reads as a conversation, oldest reply first, with the
    // composer beneath; elsewhere the newest reply leads.
    const orderedPosts = orderBy(
      replies,
      ['createdAt'],
      [isThreadPanel ? 'asc' : 'desc']
    );

    if (orderedPosts.length === 0) {
      return null;
    }

    return (
      <Box
        className={classNames('p-l-0 p-r-0', isThreadPanel && 'tw:gap-4')}
        data-testid="feed-replies"
        direction="col">
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
              isThreadPanel={isThreadPanel}
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
    isThreadPanel,
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
        className={getHeaderTagsClassName(isPanelLayout, isThreadPanel)}
        gap={2}
        itemClassName={getHeaderTagsItemClassName(
          isPanelLayout,
          isThreadPanel
        )}>
        {/* The thread panels' title already says these are conversations. */}
        {!isThreadPanel && (
          <Typography
            className="card-style-feed-header"
            data-testid="headerText"
            size="text-sm">
            {feedHeaderText}
          </Typography>
        )}

        {renderEntityLink}
      </Box>
    ),
    [isPanelLayout, feedHeaderText, renderEntityLink, isThreadPanel]
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
          <Box align="center" direction="col" justify="start">
            <UserPopOverCard
              className="m-r-0"
              profileWidth={24}
              userName={createdBy}
            />

            {/* flex-1 + min-h-0 so the 100%-height line fills only what the
                avatar leaves; otherwise the column overflows and the card
                body's overflow:hidden clips the avatar. mx-auto centres the
                line under the avatar, as the vertical Divider's self-stretch
                otherwise pins it to the column's left edge. */}
            <Divider
              className="divider tw:mx-auto tw:min-h-0 tw:flex-1 tw:bg-transparent"
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
                    <Link to={getSettingsLink(getUserPath(createdBy))}>
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
              isActive={isActive}
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
            ellipsis
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

  const renderThreadPanelComments = () => (
    <Box
      // Out to the card's edges past the body's 20px padding, so the rule
      // spans the whole card; the content keeps its inset.
      className="tw:-mx-5 tw:mt-4 tw:border-t tw:border-secondary tw:px-5 tw:pt-4"
      data-testid="thread-panel-comments"
      direction="col"
      gap={4}>
      {posts}
      <CommentComposer
        focused={focusReplyEditor}
        placeHolder={t('label.reply-in-conversation')}
        onSave={onSave}
      />
    </Box>
  );

  const renderReplies = () =>
    isThreadPanel ? renderThreadPanelComments() : renderCommentsSection();

  const isContainerThread =
    showThread && entityRef?.type === EntityType.CONTAINER;

  const renderFullCard = () => (
    <Card
      className={getFeedCardWrapperClassName(
        getFullCardBaseClassName(isThreadPanel),
        showThread,
        isPost,
        isOpenInDrawer,
        isActive
      )}
      data-conversation-id={feed?.id}
      data-testid="feed-card-v2-sidebar">
      <Card.Content className={getFullCardBodyClassName(isThreadPanel)}>
        <Box direction="col" gap={2}>
          <div className={SPACE_ITEM_CLASS_NAME}>
            {/* Block, not inline: an inline row sizes to its content, so a
                one-line (truncating) header would push past the card. */}
            <Box
              align={isContainerThread ? 'start' : 'center'}
              className={headerLayout.row}
              gap={2}
              itemClassName={headerLayout.rowItem}
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

              <Box align="stretch" direction="col">
                <div className={SPACE_ITEM_CLASS_NAME}>
                  <Box
                    align="center"
                    className={classNames('', {
                      'header-container-card': !showThread,
                      'header-container-right-panel': showThread,
                    })}
                    itemClassName={headerLayout.authorRowItem}>
                    <Typography
                      className={classNames(
                        'mr-2 not-prose',
                        headerLayout.authorName,
                        {
                          'activity-feed-user-name': !isPost,
                          'reply-card-user-name': isPost,
                        }
                      )}>
                      <UserPopOverCard
                        className={classNames('mr-2', {
                          'activity-feed-user-name': !isPost,
                          'reply-card-user-name': isPost,
                        })}
                        userName={createdBy}>
                        <Link
                          className={headerLayout.authorLink}
                          to={getSettingsLink(getUserPath(createdBy))}>
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
              isActive={isActive}
              isEditPost={isEditPost}
              isForFeedTab={isForFeedTab}
              isPost={isPost}
              isThreadPanel={isThreadPanel}
              message={feedMessage}
              showThread={showThread}
              onEditCancel={() => setIsEditPost(false)}
              onUpdate={onUpdate}
            />
          </div>

          {!isActivityEvent && feed && (
            <div className={SPACE_ITEM_CLASS_NAME}>
              <FeedCardFooterNew
                componentsVisibility={getFooterVisibility(
                  isThreadPanel,
                  isPanelLayout
                )}
                conversation={feed}
                conversationId={feed.id}
                isForFeedTab={isForFeedTab}
                isReply={isPost}
                reply={post}
                showReplyCount={isThreadPanel}
                onReplyPress={onReplyPress}
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
        {isPanelLayout && renderReplies()}
        {feedActions}
      </Card.Content>
    </Card>
  );

  return renderFullCard();
};

export default ActivityFeedCardNew;
