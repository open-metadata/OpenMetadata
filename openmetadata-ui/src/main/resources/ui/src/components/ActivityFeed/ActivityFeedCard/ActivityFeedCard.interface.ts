/*
 *  Copyright 2021 Collate
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

import { Post } from 'Models';
import { HTMLAttributes } from 'react';

export interface ConfirmState {
  state: boolean;
  threadId: string | undefined;
  postId: string | undefined;
}
export interface ActivityFeedCardProp extends HTMLAttributes<HTMLDivElement> {
  feed: Post;
  entityLink?: string;
  repliedUsers?: Array<string>;
  replies?: number;
  isEntityFeed?: boolean;
  threadId?: string;
  lastReplyTimeStamp?: number;
  isFooterVisible?: boolean;
  onThreadSelect?: (id: string) => void;
  onConfirmation?: (data: ConfirmState) => void;
}
export interface FeedHeaderProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<ActivityFeedCardProp, 'isEntityFeed'> {
  createdBy: string;
  timeStamp: number;
  entityType: string;
  entityFQN: string;
  entityField: string;
}
export interface FeedBodyProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<ActivityFeedCardProp, 'onConfirmation'> {
  message: string;
  postId?: string;
  threadId?: string;
  isAuthor: boolean;
}
export interface FeedFooterProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<
      ActivityFeedCardProp,
      | 'replies'
      | 'repliedUsers'
      | 'threadId'
      | 'onThreadSelect'
      | 'lastReplyTimeStamp'
      | 'isFooterVisible'
    > {}
