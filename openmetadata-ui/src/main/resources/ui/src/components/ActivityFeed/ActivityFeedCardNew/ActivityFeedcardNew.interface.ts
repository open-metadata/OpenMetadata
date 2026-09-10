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
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import {
  Conversation,
  ConversationReply,
} from '../../../generated/entity/feed/conversation';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';

export type EntityRefLike = { type?: string } | undefined;

export interface FeedHeaderTextRowProps {
  isPost: boolean;
  showThread?: boolean;
  entityRef: EntityRefLike;
  feedHeaderText: string;
  renderEntityLink: React.ReactNode;
}

export interface FeedWidgetFooterSectionProps {
  isFullSizeWidget?: boolean;
  isActivityEvent: boolean;
  feed?: Conversation;
  activity?: ActivityEvent;
  isForFeedTab?: boolean;
  isPost: boolean;
  post?: ConversationReply;
  onActivityClick?: (activity: ActivityEvent) => void;
}

export interface ThreadFooterSectionProps {
  isActivityEvent: boolean;
  feed?: Conversation;
  activity?: ActivityEvent;
  isForFeedTab?: boolean;
  isPost: boolean;
  post?: ConversationReply;
  onActivityClick?: (activity: ActivityEvent) => void;
}

export interface FeedCommentsSectionProps {
  showThread?: boolean;
  isOpenInDrawer: boolean;
  showActivityFeedEditor?: boolean;
  showFeedEditor: boolean;
  isActivityEvent: boolean;
  activityReplies: ConversationReply[];
  feed?: Conversation;
  feedId: string;
  currentUserName: string;
  onSave: (message: string) => void;
  onShowEditor: () => void;
  posts: React.ReactNode;
  t: (key: string) => string;
}

export interface FeedWidgetCardProps {
  feed?: Conversation;
  activity?: ActivityEvent;
  isPost: boolean;
  post?: ConversationReply;
  showThread?: boolean;
  isActive?: boolean;
  isForFeedTab?: boolean;
  isOpenInDrawer: boolean;
  isFeedWidget: boolean;
  isFullSizeWidget?: boolean;
  onActivityClick?: (activity: ActivityEvent) => void;
  createdBy: string;
  user: ReturnType<typeof useUserProfile>[2];
  entityRef: EntityRefLike;
  feedHeaderText: string;
  renderEntityLink: React.ReactNode;
  feedMessage: string;
  isEditPost: boolean;
  setIsEditPost: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdate: (message: string) => void;
  timestamp: React.ReactNode;
  feedActions: React.ReactNode;
  isActivityEvent: boolean;
  setIsHovered: (value: boolean) => void;
}

export interface ThreadFeedCardProps {
  feed?: Conversation;
  activity?: ActivityEvent;
  isPost: boolean;
  post?: ConversationReply;
  showActivityFeedEditor?: boolean;
  showThread?: boolean;
  isActive?: boolean;
  isForFeedTab?: boolean;
  isOpenInDrawer: boolean;
  onActivityClick?: (activity: ActivityEvent) => void;
  createdBy: string;
  user: ReturnType<typeof useUserProfile>[2];
  entityRef: EntityRefLike;
  feedHeaderText: string;
  renderEntityLink: React.ReactNode;
  feedMessage: string;
  isEditPost: boolean;
  setIsEditPost: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdate: (message: string) => void;
  timestamp: React.ReactNode;
  feedActions: React.ReactNode;
  isActivityEvent: boolean;
  setIsHovered: (value: boolean) => void;
  feedId: string;
  showFeedEditor: boolean;
  setShowFeedEditor: (value: boolean) => void;
  onSave: (message: string) => void;
  activityReplies: ConversationReply[];
  posts: React.ReactNode;
  currentUserName: string;
  t: (key: string) => string;
}
